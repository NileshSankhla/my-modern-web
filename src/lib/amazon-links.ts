export const VALID_AMAZON_TAGS = ["fareback2-21"];
export const PRIMARY_AMAZON_AFFILIATE_URL = "https://www.amazon.in/?tag=fareback2-21";
export const PRIMARY_AMAZON_MERCHANT_ID = Number(process.env.AMAZON_MERCHANT_ID || 1);

const AMAZON_HOST_SUFFIXES = ["amazon.in", "amazon.com"];

const isAmazonHost = (hostname: string): boolean =>
  AMAZON_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );

export const normalizeAmazonAffiliateUrl = (
  urlString: string | null | undefined,
): string | null => {
  if (!urlString) {
    return null;
  }

  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" || !isAmazonHost(url.hostname)) {
      return null;
    }
    const tag = url.searchParams.get("tag");
    if (!tag || !VALID_AMAZON_TAGS.includes(tag)) return null;

    return url.toString();
  } catch {
    return null;
  }
};
