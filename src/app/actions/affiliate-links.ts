"use server";

import { requireAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { affiliateLinks, clicks, merchants } from "@/lib/db/schema";
import { eq, sql, and, count, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Redis } from "@upstash/redis";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/security/audit";
import { clearAffiliateLinksCache } from "@/lib/affiliate-rotation";
import { AMAZON_CONFIG } from "@/config/app";

const REDIS_LINKS_KEY = AMAZON_CONFIG.redisLinksKey;
const REDIS_COUNTER_KEY = AMAZON_CONFIG.redisCounterKey;

// Singleton pattern for Redis client
let _redis: Redis | null = null;
const getRedis = (): Redis | null => {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
};

// Validate that a URL is a legitimate Amazon affiliate URL with a tag
const validateAmazonAffiliateUrl = (url: string): { valid: boolean; error?: string; tag?: string } => {
  if (!url || !url.trim()) return { valid: false, error: "URL cannot be empty." };
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "URL must use HTTPS." };
  }
  if (!AMAZON_CONFIG.validHosts.includes(parsed.hostname)) {
    return { valid: false, error: `Not an Amazon domain. Got: ${parsed.hostname}` };
  }
  const tag = parsed.searchParams.get("tag");
  if (!tag || !tag.trim()) {
    return { valid: false, error: "URL must include a `?tag=` affiliate parameter." };
  }
  return { valid: true, tag: tag.trim() };
};

// Get the Amazon merchant from DB
const getAmazonMerchant = async () => {
  const [amazon] = await db
    .select({ id: merchants.id, name: merchants.name })
    .from(merchants)
    .where(sql`lower(${merchants.name}) = 'amazon'`)
    .limit(1);
  return amazon ?? null;
};

// Reload the Redis affiliate links list from the DB (canonical source of truth)
// Only replaces the affiliate links list, never touches other Redis keys
export async function reloadRedisLinksAction(): Promise<{ success?: string; error?: string; count?: number }> {
  await requireAdminUser();
  const redis = getRedis();
  if (!redis) return { error: "Redis is not configured (missing UPSTASH_REDIS_REST_URL/TOKEN)." };

  try {
    const amazon = await getAmazonMerchant();
    if (!amazon) return { error: "Amazon merchant not found in database." };

    const rows = await db
      .select({ url: affiliateLinks.url })
      .from(affiliateLinks)
      .where(and(eq(affiliateLinks.merchantId, amazon.id), eq(affiliateLinks.isActive, true)))
      .orderBy(affiliateLinks.linkNumber);

    const activeUrls = rows.map((r) => r.url);

    // Use a pipeline to atomically replace the list — prevents a race window
    // where concurrent redirects see an empty list between DEL and RPUSH.
    const pipeline = redis.pipeline();
    pipeline.del(REDIS_LINKS_KEY);
    if (activeUrls.length > 0) {
      pipeline.rpush(REDIS_LINKS_KEY, ...activeUrls);
    }
    await pipeline.exec();
    
    clearAffiliateLinksCache();

    return { success: `Redis links refreshed: ${activeUrls.length} active link(s) loaded.`, count: activeUrls.length };
  } catch (err: any) {
    console.error("[redis] reloadRedisLinksAction failed:", err);
    return { error: `Failed to reload Redis: ${err.message}` };
  }
}

// Get Redis health stats
export async function getRedisStatsAction(): Promise<{
  connected: boolean;
  totalKeys: number;
  affiliateLinkCount: number;
  counterValue: number | null;
  error?: string;
}> {
  await requireAdminUser();
  const redis = getRedis();
  if (!redis) return { connected: false, totalKeys: 0, affiliateLinkCount: 0, counterValue: null };

  try {
    const [totalKeys, affiliateLinkCount, counterRaw] = await Promise.all([
      redis.dbsize(),
      redis.llen(REDIS_LINKS_KEY),
      redis.get<number>(REDIS_COUNTER_KEY),
    ]);
    return {
      connected: true,
      totalKeys: typeof totalKeys === "number" ? totalKeys : 0,
      affiliateLinkCount: typeof affiliateLinkCount === "number" ? affiliateLinkCount : 0,
      counterValue: counterRaw ?? null,
    };
  } catch (err: any) {
    return { connected: false, totalKeys: 0, affiliateLinkCount: 0, counterValue: null, error: err.message };
  }
}

// Reset the affiliate counter only (not entire Redis)
export async function resetAffiliateLinkCounterAction(): Promise<{ success?: string; error?: string }> {
  await requireAdminUser();
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured." };
  try {
    await redis.set(REDIS_COUNTER_KEY, 0);
    return { success: "Affiliate link rotation counter reset to 0." };
  } catch (err: any) {
    return { error: `Failed to reset counter: ${err.message}` };
  }
}

// Safe flush — ONLY removes affiliate rotation keys, NOT sessions/idempotency/other keys
export async function flushAffiliateRedisKeysAction(): Promise<{ success?: string; error?: string }> {
  await requireAdminUser();
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured." };

  try {
    // Only delete affiliate-related keys, not global flush
    await Promise.all([
      redis.del(REDIS_LINKS_KEY),
      redis.del(REDIS_COUNTER_KEY),
    ]);
    // Also clear recent-click caches (pattern: affiliate:redirect:recent:*)
    // Upstash doesn't support KEYS * in production, so we just clear the known keys
    return { success: "Affiliate rotation cache cleared. Other Redis data (sessions, idempotency) preserved." };
  } catch (err: any) {
    return { error: `Failed to flush affiliate Redis keys: ${err.message}` };
  }
}

// Add a new affiliate link to the DB and sync Redis
export async function addAffiliateLinkAction(url: string): Promise<{ success?: string; error?: string; linkId?: number }> {
  const admin = await requireAdminUser();

  const validation = validateAmazonAffiliateUrl(url);
  if (!validation.valid) return { error: validation.error };

  const cleanUrl = new URL(url.trim()).toString();

  try {
    const amazon = await getAmazonMerchant();
    if (!amazon) return { error: "Amazon merchant not found in database." };

    // Check for duplicate URL
    const [existing] = await db
      .select({ id: affiliateLinks.id })
      .from(affiliateLinks)
      .where(and(eq(affiliateLinks.merchantId, amazon.id), eq(affiliateLinks.url, cleanUrl)))
      .limit(1);
    if (existing) return { error: "This exact URL already exists in the rotation pool." };

    // Use MAX(linkNumber) + 1 so deletions don't cause re-collision
    const [maxRow] = await db
      .select({ max: max(affiliateLinks.linkNumber) })
      .from(affiliateLinks)
      .where(eq(affiliateLinks.merchantId, amazon.id));
    const nextLinkNumber = (maxRow?.max ?? 0) + 1;

    const [inserted] = await db
      .insert(affiliateLinks)
      .values({
        merchantId: amazon.id,
        linkNumber: nextLinkNumber,
        url: cleanUrl,
        isActive: true,
      })
      .returning({ id: affiliateLinks.id });

    await reloadRedisLinksAction();
    revalidatePath("/admin");

    await logSecurityEvent(SECURITY_EVENTS.LINK_ADDED, { actorId: admin.id, entityType: "affiliate_link", entityId: String(inserted.id), metadata: { action: "add", url: cleanUrl, tag: validation.tag, linkNumber: nextLinkNumber } });

    return { success: `Link #${nextLinkNumber} added (tag: ${validation.tag}).`, linkId: inserted.id };
  } catch (err: any) {
    console.error("[affiliate] addAffiliateLinkAction failed:", err);
    return { error: `Failed to add link: ${err.message}` };
  }
}

// Update an existing affiliate link URL
export async function updateAffiliateLinkAction(id: number, url: string): Promise<{ success?: string; error?: string }> {
  const admin = await requireAdminUser();

  const validation = validateAmazonAffiliateUrl(url);
  if (!validation.valid) return { error: validation.error };

  const cleanUrl = new URL(url.trim()).toString();

  try {
    const amazon = await getAmazonMerchant();
    if (!amazon) return { error: "Amazon merchant not found in database." };

    // Check the link belongs to Amazon merchant
    const [existing] = await db
      .select({ id: affiliateLinks.id, merchantId: affiliateLinks.merchantId })
      .from(affiliateLinks)
      .where(eq(affiliateLinks.id, id))
      .limit(1);

    if (!existing) return { error: "Affiliate link not found." };
    if (existing.merchantId !== amazon.id) return { error: "Can only edit Amazon affiliate links." };

    // Check no other link has the same URL
    const [duplicate] = await db
      .select({ id: affiliateLinks.id })
      .from(affiliateLinks)
      .where(and(eq(affiliateLinks.merchantId, amazon.id), eq(affiliateLinks.url, cleanUrl)))
      .limit(1);
    if (duplicate && duplicate.id !== id) return { error: "Another link with this URL already exists." };

    await db
      .update(affiliateLinks)
      .set({ url: cleanUrl, updatedAt: new Date() })
      .where(eq(affiliateLinks.id, id));

    await reloadRedisLinksAction();
    revalidatePath("/admin");

    await logSecurityEvent(SECURITY_EVENTS.LINK_UPDATED, { actorId: admin.id, entityType: "affiliate_link", entityId: String(id), metadata: { action: "update", newUrl: cleanUrl, newTag: validation.tag } });

    return { success: `Link updated (tag: ${validation.tag}).` };
  } catch (err: any) {
    return { error: `Failed to update link: ${err.message}` };
  }
}

// Toggle a link active/inactive
export async function toggleAffiliateLinkAction(id: number, isActive: boolean): Promise<{ success?: string; error?: string }> {
  const admin = await requireAdminUser();
  try {
    await db
      .update(affiliateLinks)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(affiliateLinks.id, id));

    await reloadRedisLinksAction();
    revalidatePath("/admin");

    await logSecurityEvent(SECURITY_EVENTS.LINK_TOGGLED, { actorId: admin.id, entityType: "affiliate_link", entityId: String(id), metadata: { action: "toggle", isActive } });

    return { success: `Link ${isActive ? "activated" : "paused"} successfully.` };
  } catch (err: any) {
    return { error: `Failed to toggle link: ${err.message}` };
  }
}

// Remove an affiliate link (hard delete — click history is preserved via affiliateLinkIndex)
export async function removeAffiliateLinkAction(id: number): Promise<{ success?: string; error?: string }> {
  const admin = await requireAdminUser();
  try {
    const [link] = await db
      .select({ id: affiliateLinks.id, linkNumber: affiliateLinks.linkNumber })
      .from(affiliateLinks)
      .where(eq(affiliateLinks.id, id))
      .limit(1);

    if (!link) return { error: "Link not found." };

    await db.delete(affiliateLinks).where(eq(affiliateLinks.id, id));
    await reloadRedisLinksAction();
    revalidatePath("/admin");

    await logSecurityEvent(SECURITY_EVENTS.LINK_REMOVED, { actorId: admin.id, entityType: "affiliate_link", entityId: String(id), metadata: { action: "remove", linkNumber: link.linkNumber } });

    return { success: `Link #${link.linkNumber} removed. Click history is preserved.` };
  } catch (err: any) {
    return { error: `Failed to remove link: ${err.message}` };
  }
}

// Get per-link click counts (for display in admin panel)
export async function getAffiliateLinkClickCountsAction(): Promise<Record<number, number>> {
  await requireAdminUser();
  try {
    const amazon = await getAmazonMerchant();
    if (!amazon) return {};

    // Get all links for Amazon
    const links = await db
      .select({ id: affiliateLinks.id, linkNumber: affiliateLinks.linkNumber })
      .from(affiliateLinks)
      .where(eq(affiliateLinks.merchantId, amazon.id));

    // Count clicks per linkNumber (affiliateLinkIndex in clicks table)
    const clickCounts = await db
      .select({
        affiliateLinkIndex: clicks.affiliateLinkIndex,
        count: count(),
      })
      .from(clicks)
      .where(eq(clicks.merchantId, amazon.id))
      .groupBy(clicks.affiliateLinkIndex);

    const result: Record<number, number> = {};
    for (const link of links) {
      const matching = clickCounts.find((c) => c.affiliateLinkIndex === link.linkNumber - 1); // index = linkNumber - 1
      result[link.id] = matching ? Number(matching.count) : 0;
    }
    return result;
  } catch {
    return {};
  }
}
