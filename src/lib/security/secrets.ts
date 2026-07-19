// ============================================================================
// FAREBACK — Boot-time Secrets Validation
// ============================================================================
// Called ONCE from instrumentation.ts when the server starts.
// Hard-fails loudly if any required secret is missing in production.
// In development: logs a warning but doesn't crash so devs can start with
// partial config.
// ============================================================================

import "server-only";

// ── Required secrets ─────────────────────────────────────────────────────────
// App cannot function correctly without these in production.
const REQUIRED_SECRETS = [
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SESSION_SECRET",
  "ENCRYPTION_MASTER_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "COMPARISON_SECRET",
  "CRON_SECRET",
] as const;

// ── Optional secrets (have defaults or are feature-gated) ────────────────────
const OPTIONAL_SECRETS = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_WEBHOOK_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "SIEM_WEBHOOK_URL",
  "SIEM_API_KEY",
  "SLACK_WEBHOOK_URL",
  "ADMIN_EMAILS",
  "GIFT_CARD_ENCRYPTION_KEY",
  "AMAZON_AFFILIATE_BASE_URL",
  "API_SIGNING_SECRET",
] as const;

// ── Validate secrets ──────────────────────────────────────────────────────────

export const validateSecrets = (): { valid: boolean; missing: string[] } => {
  const missing = REQUIRED_SECRETS.filter((s) => !process.env[s]);
  return { valid: missing.length === 0, missing };
};

// ── Get a required secret (throws if missing) ─────────────────────────────────

export const getSecret = (key: typeof REQUIRED_SECRETS[number]): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Required secret ${key} is not set. Add it to your .env file.`,
    );
  }
  return value;
};

// ── Get an optional secret (returns undefined if missing) ─────────────────────

export const getOptionalSecret = (
  key: typeof OPTIONAL_SECRETS[number],
): string | undefined => {
  return process.env[key];
};

// ── Get a secret with a fallback ──────────────────────────────────────────────

export const getSecretWithFallback = (
  key: string,
  fallback: string,
): string => {
  return process.env[key] ?? fallback;
};

// ── Check if a feature is enabled (based on secret presence) ─────────────────

export const isFeatureEnabled = (feature: "email" | "turnstile" | "siem" | "slack"): boolean => {
  switch (feature) {
    case "email":
      return Boolean(process.env.RESEND_API_KEY);
    case "turnstile":
      // Secret key is server-only; site key must be NEXT_PUBLIC_ for client
      return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    case "siem":
      return Boolean(process.env.SIEM_WEBHOOK_URL);
    case "slack":
      return Boolean(process.env.SLACK_WEBHOOK_URL);
    default:
      return false;
  }
};

// ── Hot-reload secrets from Redis (for rotation without redeploy) ─────────────
// Set `secrets:KEY` in Redis to override the env value.
// Useful for emergency key rotation without a redeploy.

let redisClient: import("@upstash/redis").Redis | null = null;
const getRedis = async () => {
  if (redisClient) return redisClient;
  const { Redis } = await import("@upstash/redis");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
};

const secretCache = new Map<string, { value: string; expiresAt: number }>();
const SECRET_CACHE_TTL_MS = 60 * 1000; // 1 minute

export const getHotSecret = async (key: string): Promise<string | undefined> => {
  const cached = secretCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const redis = await getRedis();
  if (redis) {
    try {
      const hotValue = await redis.get(`secrets:${key}`);
      if (hotValue) {
        const value = typeof hotValue === "string" ? hotValue : String(hotValue);
        secretCache.set(key, { value, expiresAt: Date.now() + SECRET_CACHE_TTL_MS });
        return value;
      }
    } catch {
      // Fall through to env
    }
  }

  // Fall back to env
  return process.env[key];
};

// ── Rotate a secret (sets the new value in Redis) ─────────────────────────────
// Does NOT update the env var — that requires a redeploy. But the hot-reload
// path above will pick up the new value within 1 minute.

export const rotateSecret = async (key: string, newValue: string): Promise<void> => {
  const redis = await getRedis();
  if (!redis) throw new Error("Redis not configured for secret rotation");
  await redis.set(`secrets:${key}`, newValue);
  // Clear the cache so the new value is picked up immediately
  secretCache.delete(key);
};
