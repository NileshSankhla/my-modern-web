import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";

export const SUPPORTED_MERCHANT_NAMES = new Set([
  "amazon",
  "flipkart",
  "myntra",
  "ajio",
]);

export const COMING_SOON_MERCHANT_NAMES = new Set([
  "flipkart",
  "myntra",
  "ajio",
]);

const getAllMerchantsCached = unstable_cache(
  async () => db.select().from(merchants),
  ["merchants:all"],
  {
    revalidate: 60 * 60,
    tags: ["merchants"],
  },
);

const getMerchantByIdCached = unstable_cache(
  async (merchantId: number) => {
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    return merchant ?? null;
  },
  ["merchants:by-id"],
  {
    revalidate: 60 * 60,
    tags: ["merchants"],
  },
);

export const getAllMerchants = async () => getAllMerchantsCached();

export const getMerchantById = async (merchantId: number) =>
  getMerchantByIdCached(merchantId);
