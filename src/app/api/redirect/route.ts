import { and, desc, eq, gte } from "drizzle-orm";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clicks } from "@/lib/db/schema";
import {
  COMING_SOON_MERCHANT_NAMES,
  getMerchantById,
  SUPPORTED_MERCHANT_NAMES,
} from "@/lib/data/merchants";
import { getAffiliateLinkByIndex, getNextAffiliateLinkIndex } from "@/lib/affiliate-rotation";

const TEST_MERCHANT_HOMEPAGES: Record<string, string> = {
  flipkart: "https://fktr.in/49T8I82",
  myntra: "https://myntr.it/auK4aA9",
  ajio: "https://ajiio.in/xTvzcfm",
};

const IDEMPOTENCY_LOCK_TTL_SECONDS = 3;
const IDEMPOTENCY_WAIT_MS = 40;
// Give the Redis key a 24-hour max lifespan; the date string naturally invalidates it at midnight anyway.
const RECENT_CLICK_TTL_SECONDS = 24 * 60 * 60;
const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let redisClient: Redis | null = null;

const getRedisClient = (): Redis | null => {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const appendSubidParam = (urlString: string, subid: string): string => {
  try {
    const url = new URL(urlString);
    url.searchParams.append("subid", subid);
    return url.toString();
  } catch {
    return urlString;
  }
};

// --- Timezone Helpers for IST Midnight Reset ---
const getISTDateString = (date: Date): string => {
  const parts = IST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const getISTStartOfDay = (date: Date): Date => {
  const dateString = getISTDateString(date);
  // Construct an exact ISO string for midnight in Indian Standard Time (+05:30)
  return new Date(`${dateString}T00:00:00+05:30`);
};
// -----------------------------------------------

type RecentClickPayload = {
  id: string;
  affiliateLinkIndex: number | null;
  affiliateLinkUrl: string | null;
};

export async function GET(request: NextRequest) {
  let lockAcquired = false;
  const redis = getRedisClient();
  let lockKey = "";

  try {
    const merchantIdParam = request.nextUrl.searchParams.get("merchantId");
    if (!merchantIdParam) {
      return NextResponse.json({ error: "merchantId required" }, { status: 400 });
    }

    const merchantId = parseInt(merchantIdParam, 10);
    if (Number.isNaN(merchantId)) {
      return NextResponse.json({ error: "Invalid merchantId" }, { status: 400 });
    }

    const [user, merchant] = await Promise.all([
      getCurrentUser(),
      getMerchantById(merchantId),
    ]);

    if (!user) {
      return NextResponse.redirect(
        new URL(`/sign-in?redirect=/merchants?merchantId=${merchantId}`, request.url),
        { status: 307 },
      );
    }

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const merchantNameKey = merchant.name.trim().toLowerCase();
    if (COMING_SOON_MERCHANT_NAMES.has(merchantNameKey)) {
      return NextResponse.redirect(new URL(`/coming-soon/${merchantNameKey}`, request.url), { status: 307 });
    }

    if (!SUPPORTED_MERCHANT_NAMES.has(merchantNameKey)) {
      return NextResponse.json({ error: "Merchant not supported" }, { status: 404 });
    }

    lockKey = `affiliate:redirect:lock:${user.id}:${merchantId}`;
    if (redis) {
      try {
        const lockResult = await redis.set(lockKey, "1", {
          nx: true,
          ex: IDEMPOTENCY_LOCK_TTL_SECONDS,
        });
        lockAcquired = lockResult === "OK";
        if (!lockAcquired) {
          await sleep(IDEMPOTENCY_WAIT_MS);
        }
      } catch {
        // Ignore lock failures and continue.
      }
    }

    const now = new Date();
    const todayIST = getISTDateString(now);
    const startOfTodayIST = getISTStartOfDay(now);

    // UNIQUE REDIS KEY PER DAY
    const recentClickKey = `affiliate:redirect:recent:${user.id}:${merchantId}:${todayIST}`;
    let recentClick: RecentClickPayload | undefined;

    if (merchantNameKey === "amazon" && redis) {
      try {
        // UPSTASH BUG FIX: Safely handling object vs string responses
        const cachedPayload = await redis.get<RecentClickPayload | string>(recentClickKey);

        if (cachedPayload) {
          if (typeof cachedPayload === "object") {
            recentClick = cachedPayload;
          } else if (typeof cachedPayload === "string" && cachedPayload.length > 0) {
            recentClick = JSON.parse(cachedPayload) as RecentClickPayload;
          }
        }
      } catch {
        // Redis miss or bad payload, fall back to DB.
      }
    }

    if (!recentClick) {
      [recentClick] = await db
        .select({
          id: clicks.id,
          affiliateLinkIndex: clicks.affiliateLinkIndex,
          affiliateLinkUrl: clicks.affiliateLinkUrl,
        })
        .from(clicks)
        .where(
          and(
            eq(clicks.userId, user.id),
            eq(clicks.merchantId, merchantId),
            // Look for clicks only since midnight IST today
            gte(clicks.createdAt, startOfTodayIST),
          ),
        )
        .orderBy(desc(clicks.createdAt))
        .limit(1);
    }

    let affiliateLinkIndex: number | null = null;
    let affiliateLinkUrl: string | null = null;

    if (merchantNameKey === "amazon") {
      if (recentClick?.affiliateLinkIndex !== null && recentClick?.affiliateLinkIndex !== undefined) {
        affiliateLinkIndex = recentClick.affiliateLinkIndex;
        affiliateLinkUrl = await getAffiliateLinkByIndex(recentClick.affiliateLinkIndex);
      }

      // Do not trust previously stored raw URLs; they can become stale after link rotations.
      // If index resolution fails, pick from the current active link pool.

      if (!affiliateLinkUrl) {
        try {
          const linkInfo = await getNextAffiliateLinkIndex();
          affiliateLinkIndex = linkInfo.index;
          affiliateLinkUrl = linkInfo.url;
        } catch (error) {
          console.error("Failed to get affiliate link:", error);
          affiliateLinkUrl =
            process.env.AMAZON_AFFILIATE_BASE_URL ||
            "https://www.amazon.in?&linkCode=ll2&tag=fareback-21&linkId=711b78face92a1bf8be6139d25b1f780&ref_=as_li_ss_tl";
        }
      }
    }

    // Always persist each redirect click as its own history row.
    try {
      await db
        .insert(clicks)
        .values({
          userId: user.id,
          merchantId,
          affiliateLinkIndex,
          affiliateLinkUrl,
        })
        .execute();

      if (merchantNameKey === "amazon" && redis && affiliateLinkUrl) {
        // Upstash auto-stringifies objects
        await redis.set(
          recentClickKey,
          {
            id: "recent",
            affiliateLinkIndex,
            affiliateLinkUrl,
          },
          { ex: RECENT_CLICK_TTL_SECONDS },
        );
      }
    } catch (error) {
      console.warn("Click insert failed, continuing to redirect:", error);
    }

    // RAW UNTOUCHED REDIRECT FOR AMAZON
    if (merchantNameKey === "amazon" && affiliateLinkUrl) {
      return new NextResponse(null, {
        status: 307,
        headers: {
          Location: affiliateLinkUrl,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // STANDARD REDIRECT FOR OTHERS
    let destinationUrl = merchant.baseUrl;
    try {
      if (TEST_MERCHANT_HOMEPAGES[merchantNameKey]) {
        destinationUrl = TEST_MERCHANT_HOMEPAGES[merchantNameKey];
      }

      const subid = user.name || user.email.split("@")[0];
      destinationUrl = appendSubidParam(destinationUrl, subid);
    } catch {
      // Keep base URL if manipulation fails.
    }

    return NextResponse.redirect(destinationUrl, { status: 307 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.redirect(new URL("/#offers", request.url), { status: 307 });
  } finally {
    if (lockAcquired && redis && lockKey) {
      redis.del(lockKey).catch(() => {});
    }
  }
}
