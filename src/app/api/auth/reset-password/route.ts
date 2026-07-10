// ============================================================================
// FAREBACK — /api/auth/reset-password — Reset password with token
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { resetPasswordWithToken } from "@/lib/security/password-reset";
import { estimatePasswordStrength } from "@/lib/security/password";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(64, "Invalid token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rlKey = buildRateLimitKey("PASSWORD_RESET", RATE_LIMITS.PASSWORD_RESET, { ip });
    const rl = await rateLimit(rlKey, RATE_LIMITS.PASSWORD_RESET);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
      );
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    // Check password strength client-side feedback
    const strength = estimatePasswordStrength(validation.data.password);
    if (strength.score < 2) {
      return NextResponse.json(
        { error: "Password too weak. " + strength.suggestions.join(" ") },
        { status: 400 },
      );
    }

    const result = await resetPasswordWithToken(
      validation.data.token,
      validation.data.password,
      {
        ipAddress: ip,
        userAgent: request.headers.get("user-agent"),
      },
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. Please sign in with your new password.",
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
