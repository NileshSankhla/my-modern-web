import { db } from "@/lib/db";
import { affiliateLinks, merchants } from "@/lib/db/schema";
import { Redis } from "@upstash/redis";
import { and, asc, eq, sql } from "drizzle-orm";

const REDIS_COUNTER_KEY = "affiliate:amazon:counter";
const REDIS_LINKS_KEY = process.env.AFFILIATE_REDIS_LIST_KEY || "affiliate:amazon:links";
const AMAZON_LOOKUP_CACHE_TTL_MS = 60_000;
const AMAZON_LINKS_CACHE_TTL_MS = 30_000;

let redisClient: Redis | null = null;
let cachedAmazonMerchantId: { value: number | null; expiresAt: number } | null = null;
let cachedAmazonLinks: { value: string[]; expiresAt: number } | null = null;

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

const linkFromCounter = (
  currentCount: number,
  totalLinks: number,
): { index: number; linkNumber: number } => {
  const effectiveTotal = Math.max(1, totalLinks);
  const index = (currentCount - 1 + effectiveTotal) % effectiveTotal;
  return {
    index,
    linkNumber: index + 1,
  };
};

const getAmazonMerchantId = async (): Promise<number | null> => {
  const now = Date.now();
  if (cachedAmazonMerchantId && cachedAmazonMerchantId.expiresAt > now) {
    return cachedAmazonMerchantId.value;
  }

  const [amazon] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(sql`lower(${merchants.name}) = 'amazon'`)
    .limit(1);

  const merchantId = amazon?.id ?? null;
  cachedAmazonMerchantId = {
    value: merchantId,
    expiresAt: now + AMAZON_LOOKUP_CACHE_TTL_MS,
  };

  return merchantId;
};

const getLinksFromDatabase = async (): Promise<string[]> => {
  const now = Date.now();
  if (cachedAmazonLinks && cachedAmazonLinks.expiresAt > now) {
    return cachedAmazonLinks.value;
  }

  const amazonMerchantId = await getAmazonMerchantId();
  if (!amazonMerchantId) {
    return [];
  }

  const rows = await db
    .select({ url: affiliateLinks.url })
    .from(affiliateLinks)
    .where(
      and(
        eq(affiliateLinks.merchantId, amazonMerchantId),
        eq(affiliateLinks.isActive, true),
      ),
    )
    .orderBy(asc(affiliateLinks.linkNumber));

  const links = rows.map((row) => row.url);
  cachedAmazonLinks = {
    value: links,
    expiresAt: now + AMAZON_LINKS_CACHE_TTL_MS,
  };

  return links;
};

const getNextCountFromDbCounter = async (): Promise<number> => {
  const result = await db.execute(sql`
    INSERT INTO affiliate_link_counter (id, link_count, updated_at)
    VALUES (1, 1, NOW())
    ON CONFLICT (id) DO UPDATE
    SET link_count = affiliate_link_counter.link_count + 1,
        updated_at = NOW()
    RETURNING link_count;
  `);

  if (result.rows && result.rows.length > 0) {
    return (result.rows[0] as { link_count: number }).link_count;
  }

  return 1;
};

/**
 * Get the next affiliate link index and rotate the counter atomically.
 * This function is designed to handle concurrent requests safely.
 *
 * Uses a simple approach: track the counter in a separate table with atomic updates.
 */
export async function getNextAffiliateLinkIndex(): Promise<{
  index: number;
  url: string;
}> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const totalLinks = await redis.llen(REDIS_LINKS_KEY);
      if (typeof totalLinks === "number" && totalLinks > 0) {
        const currentCount = await redis.incr(REDIS_COUNTER_KEY);
        const { index } = linkFromCounter(currentCount, totalLinks);
        const url = await redis.lindex(REDIS_LINKS_KEY, index);

        if (typeof url === "string" && url.length > 0) {
          return { index, url };
        }
      }

      console.warn("Redis affiliate link list is empty. Falling back to database list.");
    } catch (error) {
      console.error("Upstash Redis list read failed, falling back to DB list:", error);
    }
  }

  try {
    const links = await getLinksFromDatabase();
    if (links.length > 0) {
      const currentCount = redis
        ? await redis.incr(REDIS_COUNTER_KEY)
        : await getNextCountFromDbCounter();
      const { index } = linkFromCounter(currentCount, links.length);
      return {
        index,
        url: links[index],
      };
    }

    throw new Error("No affiliate links found in Redis or database.");
  } catch (error) {
    console.error("Failed to get rotating affiliate link:", error);
    throw error;
  }
}

export async function getAffiliateLinkByIndex(index: number): Promise<string | null> {
  if (index < 0) {
    return null;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const url = await redis.lindex(REDIS_LINKS_KEY, index);
      if (typeof url === "string" && url.length > 0) {
        return url;
      }
    } catch {
      // Fall through to DB fallback
    }
  }

  const links = await getLinksFromDatabase();
  return links[index] ?? null;
}

/**
 * Get current counter value (for monitoring/debugging)
 */
export async function getCurrentCounterValue(): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const value = await redis.get<number>(REDIS_COUNTER_KEY);
      return typeof value === "number" ? value : 0;
    } catch {
      // Fall through to DB fallback
    }
  }

  try {
    const result = await db.execute(
      sql.raw(
        "SELECT link_count FROM affiliate_link_counter WHERE id = 1 LIMIT 1;"
      )
    );

    if (result.rows && result.rows.length > 0) {
      return (result.rows[0] as { link_count: number }).link_count;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Reset counter (admin operation)
 */
export async function resetCounterValue(newValue: number = 0): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(REDIS_COUNTER_KEY, newValue);
      return;
    } catch (error) {
      console.error("Failed to reset Upstash Redis counter, falling back to DB:", error);
    }
  }

  try {
    await db.execute(sql`
      INSERT INTO affiliate_link_counter (id, link_count, updated_at)
      VALUES (1, ${newValue}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET link_count = ${newValue}, updated_at = NOW();
    `);
  } catch (error) {
    console.error("Failed to reset counter:", error);
  }
}
