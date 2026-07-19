import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { SUPPORTED_MERCHANTS, COMING_SOON_MERCHANTS } from "@/config/app";

// Re-export from central config so all imports use one source of truth
export const SUPPORTED_MERCHANT_NAMES = SUPPORTED_MERCHANTS;
export const COMING_SOON_MERCHANT_NAMES = COMING_SOON_MERCHANTS;

const getAllMerchantsCached = unstable_cache(
  async () => db.select().from(merchants),
  ["merchants:all"],
  {
    revalidate: 60 * 60,
    tags: ["merchants"],
  },
);

export const getAllMerchants = async () => getAllMerchantsCached();

export const getMerchantById = async (merchantId: number) => {
  const getMerchantByIdForKey = unstable_cache(
    async () => {
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .limit(1);

      return merchant ?? null;
    },
    ["merchants:by-id", String(merchantId)],
    {
      revalidate: 60 * 60,
      tags: ["merchants"],
    },
  );

  return getMerchantByIdForKey();
};
