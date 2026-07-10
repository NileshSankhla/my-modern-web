// ============================================================================
// FAREBACK — Webhook Security (HMAC Signature Verification)
// ============================================================================
// Handles scenario 35, 37:
//   - Verifies incoming webhooks from external services (Resend, Stripe, etc.)
//   - Prevents webhook spoofing attacks
//   - Replay prevention via timestamp check
//
// All webhooks must be verified before processing.
// ============================================================================

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

// ── Verify webhook signature ────────────────────────────────────────────────

export const verifyWebhook = (
  payload: string | Buffer,
  signature: string,
  secret: string,
  timestamp?: string,
): WebhookVerificationResult => {
  // 1. Check timestamp freshness (if provided)
  if (timestamp) {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      return { valid: false, error: "Invalid timestamp" };
    }
    if (Math.abs(Date.now() - ts) > MAX_WEBHOOK_AGE_MS) {
      return { valid: false, error: "Webhook expired" };
    }
  }

  // 2. Compute expected signature
  const payloadStr = typeof payload === "string" ? payload : payload.toString("utf8");
  const data = timestamp ? `${timestamp}.${payloadStr}` : payloadStr;
  const expectedSignature = createHmac("sha256", secret)
    .update(data)
    .digest("hex");

  // 3. Timing-safe comparison
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

// ── Resend webhook verification ─────────────────────────────────────────────
// Resend signs webhooks with a secret you set in their dashboard.

export const verifyResendWebhook = (
  payload: string,
  signature: string,
): WebhookVerificationResult => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] RESEND_WEBHOOK_SECRET not configured");
    return { valid: false, error: "Webhook secret not configured" };
  }
  return verifyWebhook(payload, signature, secret);
};

// ── Generic webhook verification (for any service) ──────────────────────────

export const verifyGenericWebhook = (
  payload: string,
  signature: string,
  secretEnvVar: string,
  timestamp?: string,
): WebhookVerificationResult => {
  const secret = process.env[secretEnvVar];
  if (!secret) {
    return { valid: false, error: `Secret ${secretEnvVar} not configured` };
  }
  return verifyWebhook(payload, signature, secret, timestamp);
};

// ── Helper: extract signature from headers (supports multiple formats) ──────

export const extractWebhookSignature = (
  headers: Headers,
): { signature?: string; timestamp?: string } => {
  // Common header formats
  const signature =
    headers.get("x-signature") ??
    headers.get("x-webhook-signature") ??
    headers.get("signatures") ??
    headers.get("resend-signature") ??
    undefined;

  const timestamp =
    headers.get("x-signature-timestamp") ??
    headers.get("x-webhook-timestamp") ??
    undefined;

  return { signature, timestamp };
};
