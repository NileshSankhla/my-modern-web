// ============================================================================
// FAREBACK — /api/auth/2fa/disable — Disable 2FA (requires current TOTP)
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { verify2FA, disable2FA } from "@/lib/security/two-factor";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { twoFactorVerifySchema } from "@/lib/security/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is not enabled." },
        { status: 400 },
      );
    }

    // Rate limit (per-user)
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
    const validation = twoFactorVerifySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid code format." },
        { status: 400 },
      );
    }

    // Require current TOTP code to disable (prevents account takeover)
    const result = await verify2FA(user.id, body.token);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid code. Enter your current TOTP or a backup code." },
        { status: 400 },
      );
    }

    await disable2FA(user.id);

    return NextResponse.json({
      success: true,
      message: "2FA disabled. Your account is less secure now.",
    });
  } catch (error) {
    console.error("[2fa-disable] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
