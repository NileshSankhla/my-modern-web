// ============================================================================
// FAREBACK — Rate Limiting (IIT Campus Edition — User-Based, Not IP-Based)
// ============================================================================
// CRITICAL CONTEXT: All IIT students share a single public IP address.
// IP-based rate limiting would block legitimate students instantly.
//
// Therefore:
//   - Default strategy is "user" (rate limit by authenticated user ID)
//   - IP-based limits are extremely generous (only for true abuse, not UX)
//   - Anonymous endpoints use device fingerprint + IP combo
//   - Progressive backoff still applies per-user
// ============================================================================

import "server-only";
import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

const getRedis = (): Redis | null => {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
};

// ── Rate limit configurations ───────────────────────────────────────────────
// IIT campus-aware: user-based by default, generous IP fallbacks.

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  blockDurationSeconds?: number;
  strategy: "user" | "ip" | "fingerprint" | "user+ip";
}

export const RATE_LIMITS = {
  // Auth — per-IP for unauthenticated flows (very generous for shared campus IP)
  // Real protection comes from Google's own rate limiting on OAuth side
  GOOGLE_OAUTH_INIT: { limit: 50, windowSeconds: 60, strategy: "ip" as const },
  SIGN_IN_CALLBACK: { limit: 30, windowSeconds: 60, strategy: "ip" as const },
  PASSWORD_RESET: { limit: 5, windowSeconds: 60 * 60, strategy: "ip" as const },

  // Authenticated API — per-USER (each Google account is unique)
  API_GENERAL: { limit: 200, windowSeconds: 60, strategy: "user" as const },
  API_WALLET: { limit: 60, windowSeconds: 60, strategy: "user" as const },
  API_WITHDRAWAL: { limit: 5, windowSeconds: 60 * 60, strategy: "user" as const },
  API_GIFT_CARD: { limit: 3, windowSeconds: 60 * 60, strategy: "user" as const },

  // Click redirect — per-user (authenticated), generous IP fallback
  REDIRECT: { limit: 100, windowSeconds: 60, strategy: "user" as const },

  // Admin — per-user (admins are authenticated)
  ADMIN_SEARCH: { limit: 120, windowSeconds: 60, strategy: "user" as const },
  ADMIN_BROADCAST: { limit: 10, windowSeconds: 60 * 60, strategy: "user" as const },
  ADMIN_ROLE_CHANGE: { limit: 20, windowSeconds: 60 * 60, strategy: "user" as const },

  // 2FA — per-user (prevents brute force on TOTP codes)
  TWO_FACTOR_VERIFY: {
    limit: 5,
    windowSeconds: 5 * 60,
    blockDurationSeconds: 15 * 60,
    strategy: "user" as const,
  },

  // CSP reporting — per-IP but VERY generous (shared campus IP)
  CSP_REPORT: { limit: 200, windowSeconds: 60, strategy: "ip" as const },

  // Security events reporting — per-fingerprint
  SECURITY_EVENT: { limit: 50, windowSeconds: 60, strategy: "fingerprint" as const },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

// ── Rate limit result ───────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  blocked?: boolean;
}

// ── Main rate limit function ────────────────────────────────────────────────

export const rateLimit = async (
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> => {
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const resetAt = now + config.windowSeconds * 1000;

  const redis = getRedis();
  if (redis) {
    return rateLimitRedis(redis, key, config, now, windowStart, resetAt);
  }
  return rateLimitMemory(key, config, now, windowStart, resetAt);
};

// ── Redis sliding window implementation ─────────────────────────────────────

const rateLimitRedis = async (
  redis: Redis,
  key: string,
  config: RateLimitConfig,
  now: number,
  windowStart: number,
  resetAt: number,
): Promise<RateLimitResult> => {
  const blockKey = `blocked:${key}`;

  try {
    // Check if currently blocked (progressive backoff)
    if (config.blockDurationSeconds) {
      const blockTTL = await redis.ttl(blockKey);
      if (blockTTL > 0) {
        return {
          success: false,
          limit: config.limit,
          remaining: 0,
          resetAt: now + blockTTL * 1000,
          retryAfter: blockTTL,
          blocked: true,
        };
      }
    }

    const setKey = `ratelimit:${key}`;

    // Remove entries outside the window
    await redis.zremrangebyscore(setKey, 0, windowStart);

    // Count current entries
    const count = await redis.zcard(setKey);

    if (count >= config.limit) {
      // Over limit — progressive backoff for repeat offenders
      if (config.blockDurationSeconds) {
        const offenseCount = await redis.incr(`offenses:${key}`);
        await redis.expire(`offenses:${key}`, config.blockDurationSeconds * 4);
        const blockDuration = Math.min(
          config.blockDurationSeconds * Math.pow(2, Math.min(offenseCount - 1, 4)),
          24 * 60 * 60,
        );
        await redis.set(blockKey, "1", { ex: Math.ceil(blockDuration) });
        return {
          success: false,
          limit: config.limit,
          remaining: 0,
          resetAt: now + blockDuration * 1000,
          retryAfter: Math.ceil(blockDuration),
          blocked: true,
        };
      }
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        resetAt,
        retryAfter: config.windowSeconds,
      };
    }

    // Add current request to the set
    await redis.zadd(setKey, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(setKey, config.windowSeconds);

    return {
      success: true,
      limit: config.limit,
      remaining: Math.max(0, config.limit - count - 1),
      resetAt,
    };
  } catch (error) {
    console.warn("[rate-limit] Redis error, falling back to memory:", error);
    return rateLimitMemory(key, config, now, windowStart, resetAt);
  }
};

// ── Memory fallback (local dev) ─────────────────────────────────────────────

const memoryStore = new Map<string, { timestamps: number[]; blockedUntil?: number; offenses?: number }>();

const rateLimitMemory = (
  key: string,
  config: RateLimitConfig,
  now: number,
  windowStart: number,
  resetAt: number,
): RateLimitResult => {
  const entry = memoryStore.get(key) ?? { timestamps: [] };

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      blocked: true,
    };
  }

  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.limit) {
    if (config.blockDurationSeconds) {
      entry.offenses = (entry.offenses ?? 0) + 1;
      const blockDuration = Math.min(
        config.blockDurationSeconds * Math.pow(2, Math.min(entry.offenses - 1, 4)),
        24 * 60 * 60,
      );
      entry.blockedUntil = now + blockDuration * 1000;
      memoryStore.set(key, entry);
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil(blockDuration),
        blocked: true,
      };
    }
    memoryStore.set(key, entry);
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt,
      retryAfter: config.windowSeconds,
    };
  }

  entry.timestamps.push(now);
  memoryStore.set(key, entry);

  return {
    success: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.timestamps.length),
    resetAt,
  };
};

// ── Build composite key ─────────────────────────────────────────────────────
// IIT campus: prefer "user" strategy. IP is only for anonymous endpoints.

export const buildRateLimitKey = (
  endpoint: RateLimitKey | string,
  config: RateLimitConfig,
  context: { ip?: string | null; userId?: number | null; fingerprint?: string | null },
): string => {
  const parts: string[] = [endpoint];
  switch (config.strategy) {
    case "user":
      // Authenticated user — primary key. Falls back to fingerprint for anon.
      parts.push(`u:${context.userId ?? `fp:${context.fingerprint ?? "anon"}`}`);
      break;
    case "ip":
      // Anonymous endpoint — IP is the only option (generous limits)
      parts.push(context.ip ?? "unknown");
      break;
    case "fingerprint":
      parts.push(`fp:${context.fingerprint ?? context.ip ?? "unknown"}`);
      break;
    case "user+ip":
      // Both user AND IP (very strict — same user from different IP)
      parts.push(`u:${context.userId ?? "anon"}`);
      parts.push(context.ip ?? "unknown");
      break;
  }
  return parts.join(":");
};

// ── Scoped flush (not flushall) ─────────────────────────────────────────────

export const flushFarebackKeys = async (): Promise<number> => {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  const prefixes = ["affiliate:", "idempotency:", "ratelimit:", "blocked:", "offenses:"];
  let deleted = 0;
  for (const prefix of prefixes) {
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, { match: `${prefix}*`, count: 500 });
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0" && cursor !== undefined);
  }
  return deleted;
};

export const getRedisStats = async (): Promise<{ connected: boolean; keys: number }> => {
  const redis = getRedis();
  if (!redis) return { connected: false, keys: 0 };
  try {
    const keys = await redis.dbsize();
    return { connected: true, keys };
  } catch {
    return { connected: false, keys: 0 };
  }
};
