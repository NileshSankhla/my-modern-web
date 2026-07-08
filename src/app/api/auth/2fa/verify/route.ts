// ============================================================================
// FAREBACK — /api/auth/2fa/verify — Verify TOTP and enable 2FA
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import {
  storeTOTPSecret,
  generateBackupCodes,
  verifyTOTP,
} from "@/lib/security/two-factor";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { twoFactorSetupSchema } from "@/lib/security/validation";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/security/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit (per-user — prevents brute force on TOTP codes)
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

    const body = await request.json();
    const validation = twoFactorSetupSchema.safeParse(body);
    if (!validation.success) {
      await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_VERIFY_FAILED, {
        actorId: user.id,
        metadata: { reason: "invalid_format" },
      });
      return NextResponse.json(
        { error: "Invalid code format. Enter the 6-digit code from your app." },
        { status: 400 },
      );
    }

    // The secret comes from the setup step (client holds it temporarily)
    const { token, secret: secretBase64 } = body;
    if (!secretBase64) {
      return NextResponse.json(
        { error: "Missing secret. Start setup again." },
        { status: 400 },
      );
    }

    // Decode the secret
    const secret = Buffer.from(secretBase64, "base64");

    // Verify the TOTP code
    if (!verifyTOTP(secret, token)) {
      await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_VERIFY_FAILED, {
        actorId: user.id,
        ipAddress: getClientIP(request),
        metadata: { reason: "wrong_code" },
      });
      return NextResponse.json(
        { error: "Invalid code. Try again." },
        { status: 400 },
      );
    }

    // Success — store the secret (encrypted at rest)
    await storeTOTPSecret(user.id, secret);

    // Generate backup codes (shown ONCE to the user)
    const backupCodes = await generateBackupCodes(user.id);

    await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_VERIFY_SUCCESS, {
      actorId: user.id,
      ipAddress: getClientIP(request),
      metadata: { method: "totp" },
    });

    return NextResponse.json({
      success: true,
      backupCodes,
      message: "2FA enabled. Save your backup codes — they won't be shown again.",
    });
  } catch (error) {
    console.error("[2fa-verify] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
