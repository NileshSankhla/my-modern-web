// ============================================================================
// FAREBACK — /api/auth/forgot-password — Request password reset
// ============================================================================
// Always returns success (prevents user enumeration).
// Sends reset email ONLY if the email exists and has a password.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { requestPasswordReset } from "@/lib/security/password-reset";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit (per-IP — generous for campus, prevents spam)
    const ip = getClientIP(request);
    const rlKey = buildRateLimitKey("PASSWORD_RESET", RATE_LIMITS.PASSWORD_RESET, { ip });
    const rl = await rateLimit(rlKey, RATE_LIMITS.PASSWORD_RESET);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
      );
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Always returns success — prevents user enumeration
    await requestPasswordReset(validation.data.email, {
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
