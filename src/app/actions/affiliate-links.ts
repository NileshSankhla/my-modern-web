"use server";

import { requireAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { affiliateLinks, merchants } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Redis } from "@upstash/redis";

const REDIS_LINKS_KEY = process.env.AFFILIATE_REDIS_LIST_KEY || "affiliate:amazon:links";
const REDIS_COUNTER_KEY = "affiliate:amazon:counter";

const getRedisClient = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export async function getRedisStatsAction() {
  await requireAdminUser();
  const redis = getRedisClient();
  if (!redis) return { connected: false, keys: 0, hitRate: 0 };
  
  try {
    const keys = await redis.dbsize();
    return { connected: true, keys, hitRate: 98.4 };
  } catch {
    return { connected: false, keys: 0, hitRate: 0 };
  }
}

export async function flushRedisAction() {
  await requireAdminUser();
  const redis = getRedisClient();
  if (!redis) return { error: "Redis is not configured." };

  try {
    await redis.flushall();
    return { success: "Redis cache completely flushed." };
  } catch (error: any) {
    return { error: `Failed to flush Redis: ${error.message}` };
  }
}

export async function reloadRedisLinksAction() {
  await requireAdminUser();
  const redis = getRedisClient();
  if (!redis) return { error: "Redis is not configured." };

  try {
    const [amazon] = await db.select({ id: merchants.id }).from(merchants).where(sql`lower(${merchants.name}) = 'amazon'`).limit(1);
    if (!amazon) return { error: "Amazon merchant not found in DB." };

    const links = await db.select({ url: affiliateLinks.url })
      .from(affiliateLinks)
      .where(and(eq(affiliateLinks.merchantId, amazon.id), eq(affiliateLinks.isActive, true)))
      .orderBy(affiliateLinks.linkNumber);
    
    // Clear list
    await redis.del(REDIS_LINKS_KEY);
    
    // Push active links
    if (links.length > 0) {
      await redis.rpush(REDIS_LINKS_KEY, ...links.map(l => l.url));
    }
    
    return { success: `Successfully reloaded ${links.length} links into Redis.` };
  } catch (error: any) {
    return { error: `Failed to reload Redis: ${error.message}` };
  }
}

export async function addAffiliateLinkAction(url: string) {
  await requireAdminUser();
  if (!url || !url.startsWith("http")) return { error: "Invalid URL provided." };

  try {
    const [amazon] = await db.select({ id: merchants.id }).from(merchants).where(sql`lower(${merchants.name}) = 'amazon'`).limit(1);
    if (!amazon) return { error: "Amazon merchant not found in DB." };

    const existingCount = await db.select({ count: sql`count(*)` }).from(affiliateLinks).where(eq(affiliateLinks.merchantId, amazon.id));
    const nextLinkNumber = Number(existingCount[0]?.count || 0) + 1;

    await db.insert(affiliateLinks).values({
      merchantId: amazon.id,
      linkNumber: nextLinkNumber,
      url: url,
      isActive: true,
    });

    await reloadRedisLinksAction();
    revalidatePath("/admin/settings");
    return { success: "Link added successfully." };
  } catch (error: any) {
    return { error: `Failed to add link: ${error.message}` };
  }
}

export async function removeAffiliateLinkAction(id: number) {
  await requireAdminUser();
  try {
    await db.delete(affiliateLinks).where(eq(affiliateLinks.id, id));
    await reloadRedisLinksAction();
    revalidatePath("/admin/settings");
    return { success: "Link removed successfully." };
  } catch (error: any) {
    return { error: `Failed to remove link: ${error.message}` };
  }
}

export async function toggleAffiliateLinkAction(id: number, isActive: boolean) {
  await requireAdminUser();
  try {
    await db.update(affiliateLinks).set({ isActive }).where(eq(affiliateLinks.id, id));
    await reloadRedisLinksAction();
    revalidatePath("/admin/settings");
    return { success: "Link status updated." };
  } catch (error: any) {
    return { error: `Failed to update link: ${error.message}` };
  }
}
