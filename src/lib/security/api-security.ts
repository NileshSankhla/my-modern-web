// ============================================================================
// FAREBACK — API Security (Request Signing + Nonce + Replay Prevention)
// ============================================================================
// For sensitive API endpoints (wallet mutations, admin actions), requires:
//   1. HMAC-signed requests (proves the request came from our frontend)
//   2. Per-request nonce (prevents replay attacks)
//   3. Timestamp window (rejects requests older than 5 minutes)
//
// Client-side: use the `signRequest()` helper to add headers.
// Server-side: use `verifyRequestSignature()` in API route handlers.
// ============================================================================

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

const SIGNATURE_HEADER = "x-signature";
const NONCE_HEADER = "x-nonce";
const TIMESTAMP_HEADER = "x-timestamp";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

let redisClient: Redis | null = null;
const getRedis = (): Redis | null => {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
};

// ── Server-side: verify request signature ───────────────────────────────────

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

export const verifyRequestSignature = async (
  method: string,
  path: string,
  body: string,
  headers: { signature?: string; nonce?: string; timestamp?: string },
): Promise<SignatureVerificationResult> => {
  const secret = process.env.API_SIGNING_SECRET;
  if (!secret) {
    return { valid: false, error: "Signing secret not configured" };
  }

  const { signature, nonce, timestamp } = headers;

  // 1. All three headers must be present
  if (!signature || !nonce || !timestamp) {
    return { valid: false, error: "Missing signature headers" };
  }

  // 2. Timestamp must be within 5 minutes
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: "Invalid timestamp" };
  }
  if (Math.abs(Date.now() - ts) > MAX_AGE_MS) {
    return { valid: false, error: "Request expired" };
  }

  // 3. Nonce must not have been used before (replay prevention)
  const redis = getRedis();
  if (redis) {
    try {
      const nonceKey = `nonce:${nonce}`;
      const set = await redis.set(nonceKey, "1", { nx: true, ex: MAX_AGE_MS / 1000 });
      if (!set) {
        return { valid: false, error: "Nonce already used (replay attempt)" };
      }
    } catch {
      // Redis down — fail open for nonce (signature still validates)
    }
  }

  // 4. Verify HMAC signature
  const payload = `${method.toUpperCase()}|${path}|${ts}|${nonce}|${body}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: "Signature length mismatch" };
  }

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: "Invalid signature" };
    }
  } catch {
    return { valid: false, error: "Signature comparison failed" };
  }

  return { valid: true };
};

// ── Helper to extract signature headers from a Request ──────────────────────

export const extractSignatureHeaders = (request: Request): {
  signature?: string;
  nonce?: string;
  timestamp?: string;
} => {
  return {
    signature: request.headers.get(SIGNATURE_HEADER) ?? undefined,
    nonce: request.headers.get(NONCE_HEADER) ?? undefined,
    timestamp: request.headers.get(TIMESTAMP_HEADER) ?? undefined,
  };
};

export const SIGNATURE_HEADERS = {
  SIGNATURE: SIGNATURE_HEADER,
  NONCE: NONCE_HEADER,
  TIMESTAMP: TIMESTAMP_HEADER,
} as const;
