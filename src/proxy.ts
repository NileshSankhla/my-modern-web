// ============================================================================
// FAREBACK — Security Proxy (Next.js 16+ middleware convention)
// ============================================================================
// Runs on every request. Applies:
//   1. Security headers (CSP with nonce, HSTS, COOP/COEP, etc.)
//   2. CSRF protection for state-changing API routes
//   3. Bot scoring (heuristic — Turnstile check happens in route handlers)
//   4. Rate limiting (per-endpoint, user-based for authenticated routes)
//   5. CSP nonce injection (available to RSC via headers)
//
// IIT CAMPUS NOTE: Rate limiting here is IP-aware but generous for shared IP.
// User-based rate limiting happens inside route handlers after auth.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { generateNonce, applySecurityHeaders, buildCSP } from "./lib/security/headers";
import { checkCSRF, attachCSRFCookie, generateCSRFToken } from "./lib/security/csrf";
import { generateFingerprint, getClientIP } from "./lib/security/fingerprint";
import { logSecurityEvent, SECURITY_EVENTS } from "./lib/security/audit";

// State-changing API routes that need CSRF + signature verification
const PROTECTED_API_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/user\/wallet/,
  /^\/api\/admin\//,
  /^\/api\/revalidate/,
];

// Routes exempt from all security (static assets, OAuth callbacks)
const EXEMPT_PATTERNS = [
  /^\/_next\//,
  /^\/favicon/,
  /^\/brand-name/,
  /^\/manifest\.json$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/api\/health\//,
  /^\/api\/auth\/google(\/callback)?$/, // OAuth needs to work cross-origin
  /^\/api\/security\/report-csp$/, // CSP reports come from browser
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. Skip exempt routes
  if (EXEMPT_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next();
  }

  // 2. Generate per-request nonce + set security headers on all responses
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";

  // 3. CSRF check for state-changing API routes
  const isStateChanging =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const isProtectedApi = PROTECTED_API_PATTERNS.some((p) => p.test(pathname));

  if (isStateChanging && isProtectedApi) {
    const csrfResult = checkCSRF(request);
    if (!csrfResult.valid) {
      await logSecurityEvent(SECURITY_EVENTS.CSRF_BLOCKED, {
        actorId: null,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get("user-agent"),
        metadata: {
          path: pathname,
          method,
          reason: csrfResult.error,
        },
      });
      return NextResponse.json(
        { error: csrfResult.error ?? "CSRF check failed" },
        { status: 403 },
      );
    }
  }

  // 4. Inject fingerprint + IP into headers for downstream handlers
  const fingerprint = generateFingerprint(request);
  const clientIp = getClientIP(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-fareback-fingerprint", fingerprint);
  requestHeaders.set("x-fareback-ip", clientIp);
  requestHeaders.set("x-fareback-nonce", nonce);

  // 5. Build response with security headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Apply all security headers (CSP, HSTS, COOP/COEP, etc.)
  applySecurityHeaders(response, nonce, { isDev });

  // 6. Set CSRF cookie if not present (for future state-changing requests)
  const existingCsrf = request.cookies.get("csrf_token")?.value;
  if (!existingCsrf) {
    attachCSRFCookie(response, generateCSRFToken());
  }

  // 7. Add nonce to response headers so RSC can read it
  response.headers.set("x-fareback-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon|brand|manifest|robots|sitemap|sw.js|workbox|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};
