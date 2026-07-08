// ============================================================================
// FAREBACK — /api/security/report-csp — CSP Violation Reporting Endpoint
// ============================================================================
// Receives Content-Security-Policy violation reports from browsers.
// Logs them as security events for monitoring.
// Rate-limited per-IP (generous — shared campus IP).
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/security/audit";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";

export async function POST(request: NextRequest) {
  try {
    // Rate limit (generous — campus shared IP)
    const ip = getClientIP(request);
    const rlKey = buildRateLimitKey("CSP_REPORT", RATE_LIMITS.CSP_REPORT, { ip });
    const rl = await rateLimit(rlKey, RATE_LIMITS.CSP_REPORT);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    // Parse the CSP report
    const body = await request.json();
    const report = body?.["csp-report"] ?? body;

    if (!report) {
      return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    }

    // Log as a security event
    await logSecurityEvent(SECURITY_EVENTS.CSP_VIOLATION, {
      actorId: null,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
      metadata: {
        documentUri: report["document-uri"]?.substring(0, 200),
        violatedDirective: report["violated-directive"],
        blockedUri: report["blocked-uri"]?.substring(0, 200),
        sourceFile: report["source-file"]?.substring(0, 200),
        lineNumber: report["line-number"],
        columnNumber: report["column-number"],
      },
    });

    // In production, forward to SIEM/Slack if severity is high
    // (e.g., script-src violations are more concerning than img-src)
    if (report["violated-directive"]?.startsWith("script-src")) {
      // Forward to Slack webhook if configured
      const slackWebhook = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhook) {
        fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 CSP script-src violation on ${report["document-uri"]?.substring(0, 100)}`,
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[csp-report] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
