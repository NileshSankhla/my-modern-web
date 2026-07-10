// ============================================================================
// FAREBACK — /api/auth/2fa/setup — Initialize TOTP 2FA
// ============================================================================
// Returns the TOTP secret + otpauth:// URI for QR code display.
// The secret is NOT saved to the user until verified (prevents lockout).
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { generateTOTPSecret, generateTOTPUri } from "@/lib/security/two-factor";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { Redis } from "@upstash/redis";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Already enabled?
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to reconfigure." },
        { status: 400 },
      );
    }

    // Rate limit (per-user — IIT campus shared IP)
    const rlKey = buildRateLimitKey("TWO_FACTOR_VERIFY", RATE_LIMITS.TWO_FACTOR_VERIFY, {
      userId: user.id,
      ip: getClientIP(request),
    });
    const rl = await rateLimit(rlKey, RATE_LIMITS.TWO_FACTOR_VERIFY);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
      );
    }

    // Generate secret
    const { secret, base32 } = generateTOTPSecret();
    const uri = generateTOTPUri(base32, user.email);

    // Store the secret temporarily in Redis for the verify step (10 min TTL)
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    });
    
    if (process.env.UPSTASH_REDIS_REST_URL) {
      await redis.set(`pending_2fa:${user.id}`, secret.toString("base64"), { ex: 600 });
    }

    return NextResponse.json({
      success: true,
      secret: base32,
      uri,
    });
  } catch (error) {
    console.error("[2fa-setup] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
