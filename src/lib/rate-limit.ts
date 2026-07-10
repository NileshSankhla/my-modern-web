import "server-only";

import { Redis } from "@upstash/redis";

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

let redisClient: Redis | null = null;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

const getRedisClient = (): Redis | null => {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
};

export const rateLimitByKey = async (
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> => {
  const now = Date.now();
  const resetAt = now + options.windowSeconds * 1000;
  const redis = getRedisClient();

  if (redis) {
    try {
      const namespacedKey = `ratelimit:${key}`;
      const count = await redis.incr(namespacedKey);
      if (count === 1) {
        await redis.expire(namespacedKey, options.windowSeconds);
      }

      return {
        success: count <= options.limit,
        remaining: Math.max(0, options.limit - count),
        resetAt,
      };
    } catch {
      // Fall through to in-memory limiter.
    }
  }

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
    };
  }

  existing.count += 1;
  memoryStore.set(key, existing);

  return {
    success: existing.count <= options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
};
