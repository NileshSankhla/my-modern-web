// ============================================================================
// FAREBACK — /api/user/sessions — List & revoke active sessions
// ============================================================================
// Handles scenarios 5, 10, 25, 43:
//   - User sees all their active sessions
//   - User can revoke any session (sign out other devices)
//   - Admin can revoke all sessions during account takeover
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getSessionToken, hashSessionToken } from "@/lib/security/session";
import {
  listUserSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "@/lib/security/session-management";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { maskIP } from "@/lib/security/pii-redaction";

// ── GET: list active sessions ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getSessionToken();
    const currentHash = token ? hashSessionToken(token) : undefined;

    const sessions = await listUserSessions(user.id, currentHash);

    // Mask IPs for user-facing display (privacy)
    const masked = sessions.map((s) => ({
      ...s,
      ipAddress: s.ipAddress ? maskIP(s.ipAddress) : null,
    }));

    return NextResponse.json({ sessions: masked });
  } catch (error) {
    console.error("[sessions] GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── DELETE: revoke a session (or all others) ────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const rlKey = buildRateLimitKey("API_GENERAL", RATE_LIMITS.API_GENERAL, {
      userId: user.id,
      ip: getClientIP(request),
    });
    const rl = await rateLimit(rlKey, RATE_LIMITS.API_GENERAL);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const { searchParams } = request.nextUrl;
    const sessionId = searchParams.get("id");
    const all = searchParams.get("all") === "true";

    if (all) {
      // Revoke all OTHER sessions (keep current)
      const token = await getSessionToken();
      if (!token) {
        return NextResponse.json({ error: "No active session" }, { status: 400 });
      }
      const currentHash = hashSessionToken(token);
      const count = await revokeAllOtherSessions(user.id, currentHash);
      return NextResponse.json({
        success: true,
        message: `${count} session(s) revoked.`,
      });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    await revokeSession(user.id, parseInt(sessionId, 10));

    return NextResponse.json({ success: true, message: "Session revoked." });
  } catch (error) {
    console.error("[sessions] DELETE error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
