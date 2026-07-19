/**
 * ============================================================
 * FAREBACK — Master Application Configuration
 * ============================================================
 * Single source of truth for every value that might need to
 * change in production without a code rewrite.
 *
 * Priority: Environment Variables > Defaults below.
 *
 * Add new config here. Never scatter magic numbers in logic files.
 * ============================================================
 */

// ── App Identity ─────────────────────────────────────────────────────────────
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Fareback",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "Earn real cashback on every Amazon order",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://www.fareback.in",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@fareback.in",
  adminEmail: process.env.NEXT_PUBLIC_ADMIN_CONTACT_EMAIL || "admin@fareback.in",
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  timezoneOffset: process.env.APP_TIMEZONE_OFFSET || "+05:30",
  currency: process.env.APP_CURRENCY || "INR",
  currencySymbol: process.env.APP_CURRENCY_SYMBOL || "₹",
} as const;

// ── Amazon Affiliate ──────────────────────────────────────────────────────────
// Update AMAZON_AFFILIATE_BASE_URL env var to change the primary tag everywhere at once.
const _rawAmazonUrl =
  process.env.AMAZON_AFFILIATE_BASE_URL?.trim() ||
  "https://www.amazon.in/?tag=fareback2-21";

export const AMAZON_CONFIG = {
  /** Primary/fallback affiliate URL — shown on public pages and used when Redis+DB both fail */
  primaryAffiliateUrl: _rawAmazonUrl.startsWith("https://")
    ? _rawAmazonUrl
    : "https://www.amazon.in/?tag=fareback2-21",

  /** Internal DB merchant ID for Amazon */
  merchantId: Number(process.env.AMAZON_MERCHANT_ID || 1),

  /** Valid Amazon domains for affiliate link validation */
  validHosts: ["amazon.in", "amazon.com", "www.amazon.in", "www.amazon.com"] as string[],

  /** Redis list key holding the active rotation pool */
  redisLinksKey: process.env.AFFILIATE_REDIS_LIST_KEY || "affiliate:amazon:links",

  /** Redis counter key for round-robin rotation */
  redisCounterKey: "affiliate:amazon:counter",

  /** In-memory cache TTL for affiliate links (seconds) */
  linkCacheTtlSeconds: Number(process.env.AFFILIATE_CACHE_TTL_SECONDS || 30),
} as const;

// ── Wallet & Financial Limits ─────────────────────────────────────────────────
export const WALLET_CONFIG = {
  /** Minimum withdrawal: ₹1 */
  minimumWithdrawalPaise: Number(process.env.MIN_WITHDRAWAL_PAISE || 100),

  /** Maximum withdrawal per request: ₹50,000 */
  maximumWithdrawalPaise: Number(process.env.MAX_WITHDRAWAL_PAISE || 5_000_000),

  /** Wallet types supported */
  types: ["cashback", "amazon_rewards"] as const,

  /** Default wallet type assigned to new transactions */
  defaultType: "cashback" as const,
} as const;

// ── Redirect & Click Tracking ─────────────────────────────────────────────────
export const REDIRECT_CONFIG = {
  /** Redis lock TTL for deduplicating concurrent redirect clicks (seconds) */
  idempotencyLockTtlSeconds: Number(process.env.REDIRECT_LOCK_TTL_SECONDS || 3),

  /** Wait time before checking if lock is still held (ms) */
  idempotencyWaitMs: Number(process.env.REDIRECT_LOCK_WAIT_MS || 40),

  /** How long to cache today's recent-click record in Redis (seconds) — max 24h */
  recentClickTtlSeconds: Number(process.env.RECENT_CLICK_TTL_SECONDS || 86_400),

  /** Max redirect requests per user per 5-minute window */
  rateLimitMax: Number(process.env.REDIRECT_RATE_LIMIT_MAX || 30),

  /** Rate limit window in seconds */
  rateLimitWindowSeconds: Number(process.env.REDIRECT_RATE_LIMIT_WINDOW_SECONDS || 300),
} as const;

// ── Merchant Affiliate URLs (non-Amazon) ─────────────────────────────────────
// These are test/fallback homepage URLs until full affiliate programs are integrated.
// Add new merchants here without touching redirect logic.
export const MERCHANT_AFFILIATE_URLS: Record<string, string> = {
  flipkart: process.env.FLIPKART_AFFILIATE_URL || "https://fktr.in/49T8I82",
  myntra: process.env.MYNTRA_AFFILIATE_URL || "https://myntr.it/auK4aA9",
  ajio: process.env.AJIO_AFFILIATE_URL || "https://ajiio.in/xTvzcfm",
};

// ── Merchant Sets ─────────────────────────────────────────────────────────────
// Merchants live in DB but these sets are needed for fast middleware/edge checks.
// Keep in sync with DB. Lowercase only.
export const SUPPORTED_MERCHANTS = new Set<string>(
  (process.env.SUPPORTED_MERCHANTS || "amazon,flipkart,myntra,ajio")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export const COMING_SOON_MERCHANTS = new Set<string>(
  (process.env.COMING_SOON_MERCHANTS || "flipkart,myntra,ajio")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** Merchants that should be shown first in hero sections */
export const HERO_PRIORITY_MERCHANTS = (
  process.env.HERO_PRIORITY_MERCHANTS || "amazon,flipkart,myntra"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ── Session & Auth ────────────────────────────────────────────────────────────
export const AUTH_CONFIG = {
  /** Session cookie name */
  cookieName: process.env.SESSION_COOKIE_NAME || "fareback_session",

  /** OTP expiry in seconds */
  otpExpirySeconds: Number(process.env.OTP_EXPIRY_SECONDS || 300),

  /** Password reset token expiry in seconds */
  passwordResetExpirySeconds: Number(process.env.PASSWORD_RESET_EXPIRY_SECONDS || 3600),

  /** Max failed login attempts before lockout */
  maxFailedAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5),

  /** Lockout duration in seconds */
  lockoutSeconds: Number(process.env.ACCOUNT_LOCKOUT_SECONDS || 900),

  /** Password history limit (can't reuse last N passwords) */
  passwordHistoryLimit: Number(process.env.PASSWORD_HISTORY_LIMIT || 5),
} as const;

// ── Pagination / Query Limits ─────────────────────────────────────────────────
export const PAGINATION = {
  /** Max users fetched in admin user list */
  adminUserListLimit: Number(process.env.ADMIN_USER_LIST_LIMIT || 500),

  /** Max clicks shown per page in finance panel */
  financeClicksPageSize: Number(process.env.FINANCE_CLICKS_PAGE_SIZE || 50),
} as const;
