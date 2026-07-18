// Primary fallback URL — used when Redis and DB both fail
export const PRIMARY_AMAZON_AFFILIATE_URL = "https://www.amazon.in/?tag=fareback2-21";
export const PRIMARY_AMAZON_MERCHANT_ID = Number(process.env.AMAZON_MERCHANT_ID || 1);

// NOTE: No hardcoded tag allowlist. Any tag added by admin via the admin panel is accepted.
// Tag validation is done at DB-insert time (admin panel validates the URL has a tag parameter).
const VALID_AMAZON_HOSTS = ["amazon.in", "amazon.com"];

const isAmazonHost = (hostname: string): boolean =>
  VALID_AMAZON_HOSTS.some(
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
