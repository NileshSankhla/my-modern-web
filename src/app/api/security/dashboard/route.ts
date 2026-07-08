// ============================================================================
// FAREBACK — /api/security/dashboard — Admin security dashboard data
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { getSecurityDashboard } from "@/lib/security/security-monitor";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { maskIP, maskEmail } from "@/lib/security/pii-redaction";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const rlKey = buildRateLimitKey("ADMIN_SEARCH", RATE_LIMITS.ADMIN_SEARCH, {
      userId: user.id,
      ip: getClientIP(request),
    });
    const rl = await rateLimit(rlKey, RATE_LIMITS.ADMIN_SEARCH);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const data = await getSecurityDashboard();

    // Mask PII before returning
    const masked = {
      ...data,
      highRiskUsers: data.highRiskUsers.map((u) => ({
        ...u,
        email: maskEmail(u.email),
      })),
      recentCritical: data.recentCritical.map((e) => ({
        ...e,
        actorEmail: e.actorEmail ? maskEmail(e.actorEmail) : null,
        ipAddress: e.ipAddress ? maskIP(e.ipAddress) : null,
      })),
    };

    return NextResponse.json(masked);
  } catch (error) {
    console.error("[security-dashboard] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
