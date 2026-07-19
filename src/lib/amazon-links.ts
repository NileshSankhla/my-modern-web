// All Amazon config is centralized in @/config/app — no hardcoded values here.
import { AMAZON_CONFIG } from "@/config/app";

export const PRIMARY_AMAZON_AFFILIATE_URL = AMAZON_CONFIG.primaryAffiliateUrl;
export const PRIMARY_AMAZON_MERCHANT_ID = AMAZON_CONFIG.merchantId;

// NOTE: No hardcoded tag allowlist. Any tag added by admin via the admin panel is accepted.
// Tag validation is done at DB-insert time (admin panel validates the URL has a tag parameter).
const isAmazonHost = (hostname: string): boolean =>
  AMAZON_CONFIG.validHosts.some(
    (suffix: string) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );

export const normalizeAmazonAffiliateUrl = (
  urlString: string | null | undefined,
): string | null => {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" || !isAmazonHost(url.hostname)) return null;
    const tag = url.searchParams.get("tag");
    if (!tag || !tag.trim()) return null;
    return url.toString();
  } catch {
    return null;
  }
};
