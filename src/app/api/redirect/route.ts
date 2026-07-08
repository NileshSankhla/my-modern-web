import { and, desc, eq, gte } from "drizzle-orm";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  PRIMARY_AMAZON_AFFILIATE_URL,
  isPrimaryAmazonMerchantId,
  normalizeAmazonAffiliateUrl,
} from "@/lib/affiliate-rotation";
import { db } from "@/lib/db";
import { clicks } from "@/lib/db/schema";
import {
  COMING_SOON_MERCHANT_NAMES,
  getMerchantById,
  SUPPORTED_MERCHANT_NAMES,
} from "@/lib/data/merchants";
import { createHash } from "crypto";
import {
  getAffiliateLinkByIndex,
  getNextAffiliateLinkIndex,
} from "@/lib/affiliate-rotation";

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
  let merchantNameKey = "";

  try {
    const merchantIdParam = request.nextUrl.searchParams.get("merchantId");
    if (!merchantIdParam) {
      return NextResponse.json(
        { error: "merchantId required" },
        { status: 400 },
      );
    }

    const merchantId = parseInt(merchantIdParam, 10);
    if (Number.isNaN(merchantId)) {
      return NextResponse.json(
        { error: "Invalid merchantId" },
        { status: 400 },
      );
    }

    const user = await getCurrentUser();

    const merchant = await getMerchantById(merchantId);

    if (!merchant) {
      if (merchantId === Number(process.env.AMAZON_MERCHANT_ID || 1)) {
        return NextResponse.redirect(PRIMARY_AMAZON_AFFILIATE_URL, {
          status: 302,
        });
      }

      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 },
      );
    }

    merchantNameKey = merchant.name.trim().toLowerCase();
    const isAmazonMerchant = merchantNameKey === "amazon";

    if (!user) {
      if (isAmazonMerchant) {
        return NextResponse.redirect(PRIMARY_AMAZON_AFFILIATE_URL, {
          status: 302,
        });
      }

      return NextResponse.redirect(
        new URL(
          `/sign-in?redirect=/merchants?merchantId=${merchantId}`,
          request.url,
        ),
        { status: 302 },
      );
    }

    if (COMING_SOON_MERCHANT_NAMES.has(merchantNameKey)) {
      return NextResponse.redirect(
        new URL(`/coming-soon/${merchantNameKey}`, request.url),
        { status: 302 },
      );
    }

    if (!SUPPORTED_MERCHANT_NAMES.has(merchantNameKey)) {
      return NextResponse.json(
        { error: "Merchant not supported" },
        { status: 404 },
      );
    }

    // Rate Limiter (User-based)
    if (redis) {
      try {
        const rateLimitKey = `rate_limit:redirect:${user.id}`;
        const requests = await redis.incr(rateLimitKey);
        if (requests === 1) {
          await redis.expire(rateLimitKey, 300); // 5 minutes window
        }
        if (requests > 30) {
          return NextResponse.json(
            { error: "Too many redirect requests. Please try again later." },
            { status: 429 },
          );
        }
      } catch {
        // Safe degrade if Redis fails
      }
    }

    // Environment Safety Net
    const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

    let skipDbInsert = false;
    lockKey = `affiliate:redirect:lock:${user.id}:${merchantId}`;
    if (redis) {
      try {
        const lockResult = await redis.set(lockKey, "1", {
          nx: true,
          ex: IDEMPOTENCY_LOCK_TTL_SECONDS,
        });
        lockAcquired = lockResult === "OK";
        if (!lockAcquired) {
          skipDbInsert = true; // Duplicate concurrent request; skip DB write
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
        const cachedPayload = await redis.get<RecentClickPayload | string>(
          recentClickKey,
        );

        if (cachedPayload) {
          if (typeof cachedPayload === "object") {
            recentClick = cachedPayload;
          } else if (
            typeof cachedPayload === "string" &&
            cachedPayload.length > 0
          ) {
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

    if (isAmazonMerchant) {
      if (
        recentClick?.affiliateLinkIndex !== null &&
        recentClick?.affiliateLinkIndex !== undefined
      ) {
        affiliateLinkIndex = recentClick.affiliateLinkIndex;
        affiliateLinkUrl = normalizeAmazonAffiliateUrl(
          await getAffiliateLinkByIndex(recentClick.affiliateLinkIndex),
        );
      }

      // Do not trust previously stored raw URLs; they can become stale after link rotations.
      // If index resolution fails, pick from the current active link pool.

      if (!affiliateLinkUrl) {
        try {
          const linkInfo = await getNextAffiliateLinkIndex();
          affiliateLinkIndex = linkInfo.index;
          affiliateLinkUrl = normalizeAmazonAffiliateUrl(linkInfo.url);
        } catch (error) {
          console.error("Failed to get affiliate link:", error);
          affiliateLinkUrl = normalizeAmazonAffiliateUrl(
            process.env.AMAZON_AFFILIATE_BASE_URL,
          );
        }
      }

      if (!affiliateLinkUrl) {
        affiliateLinkUrl = PRIMARY_AMAZON_AFFILIATE_URL;
      }
    }

    // Always persist each redirect click as its own history row.
    const rawIpAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? null;
    
    // Hash IP address to minimize PII exposure (limit to 45 chars for DB schema)
    const ipAddress = rawIpAddress 
      ? createHash('sha256').update(rawIpAddress).digest('hex').substring(0, 45)
      : null;

    const userAgent = request.headers.get("user-agent") ?? null;
    const referrerUrl = request.headers.get("referer") ?? null;

    try {
      if (!skipDbInsert) {
        await db
          .insert(clicks)
          .values({
            userId: user.id,
            merchantId,
            affiliateLinkIndex,
            affiliateLinkUrl,
            ipAddress,
            userAgent,
            referrerUrl,
          })
          .execute();
      }

      if (isAmazonMerchant && redis && affiliateLinkUrl) {
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
    if (isAmazonMerchant && affiliateLinkUrl) {
      return new NextResponse(null, {
        status: 302,
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

    return NextResponse.redirect(destinationUrl, { status: 302 });
  } catch (error) {
    console.error("API error:", error);
    if (merchantNameKey === "amazon" || merchantNameKey === "") {
      return NextResponse.redirect(PRIMARY_AMAZON_AFFILIATE_URL, {
        status: 302,
      });
    }

    return NextResponse.redirect(new URL("/#offers", request.url), {
      status: 302,
    });
  } finally {
    if (lockAcquired && redis && lockKey) {
      redis.del(lockKey).catch(() => {});
    }
  }
}
