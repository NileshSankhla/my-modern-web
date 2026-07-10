// ============================================================================
// FAREBACK — Security Headers (CSP, HSTS, COOP/COEP/CORP, Trusted Types)
// ============================================================================
// Latest 2026 security headers:
//   - Content-Security-Policy with per-request nonces
//   - Strict-Transport-Security with preload + includeSubDomains
//   - Cross-Origin-Opener-Policy (COOP) — same-origin isolation
//   - Cross-Origin-Embedder-Policy (COEP) — require-corp
//   - Cross-Origin-Resource-Policy (CORP) — same-origin
//   - X-Content-Type-Options: nosniff
//   - X-Frame-Options: DENY
//   - Referrer-Policy: strict-origin-when-cross-origin
//   - Permissions-Policy (restrict camera, mic, geolocation, etc.)
//   - Trusted Types (experimental CSP layer 3)
// ============================================================================

import "server-only";
import type { NextResponse } from "next/server";

const NONCE_BYTES = 16;

// ── Generate per-request nonce ──────────────────────────────────────────────

export const generateNonce = (): string => {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
};

// ── Build Content-Security-Policy ───────────────────────────────────────────
// Strict CSP with nonces for scripts. 'unsafe-inline' only for styles (Tailwind).

export const buildCSP = (nonce: string, isDev: boolean = false): string => {
  const directives: string[] = [
    "default-src 'self'",
    // Scripts: nonce-based. In production, 'unsafe-inline' is ignored by
    // browsers that support nonces, so it only serves as a fallback for
    // older browsers. 'strict-dynamic' propagates trust to dynamically
    // added scripts (e.g. Next.js RSC chunks, analytics).
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    // Styles: Tailwind and Next.js inject inline styles.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images: allow from anywhere (user uploads, CDN, brand logos, etc.)
    "img-src 'self' data: https: blob:",
    // Connections: our API + Neon + Upstash + Google + Vercel telemetry
    "connect-src 'self' https://*.neon.tech https://*.upstash.io https://www.googleapis.com https://api.pwnedpasswords.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    // Frames: none (prevents clickjacking)
    "frame-ancestors 'none'",
    "frame-src 'none'",
    // Forms: only to self
    "form-action 'self'",
    // Base URI: self (prevents base tag injection)
    "base-uri 'self'",
    // Object: none (prevents Flash/Java plugin attacks)
    "object-src 'none'",
    // Manifest: self
    "manifest-src 'self'",
    // Workers: self
    "worker-src 'self' blob:",
    // Upgrade insecure requests
    "upgrade-insecure-requests",
    // Report violations to our endpoint
    `report-uri /api/security/report-csp`,
    "report-to fareback-csp",
  ];

  // NOTE: `require-trusted-types-for 'script'` is intentionally excluded.
  // React and Next.js use innerHTML and dynamic script injection internally,
  // which violates Trusted Types and causes a white screen in production.
  // Re-enable only after auditing and patching all React DOM writes.

  return directives.join("; ");
};

// ── HSTS (Strict-Transport-Security) ────────────────────────────────────────
// 2 years + preload + includeSubDomains. Submit to hstspreload.org after deploy.

export const HSTS_HEADER = "max-age=63072000; includeSubDomains; preload";

// ── Permissions-Policy ──────────────────────────────────────────────────────
// Deny everything by default, allow only what we need.

export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "battery=()",
  "camera=()",
  "cross-origin-isolated=()",
  "display-capture=()",
  "document-domain=()",
  "encrypted-media=()",
  "execution-while-not-rendered=()",
  "execution-while-out-of-viewport=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "keyboard-map=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "navigation-override=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "web-share=()",
  "xr-spatial-tracking=()",
].join(", ");

// ── Apply all security headers to a response ────────────────────────────────

export const applySecurityHeaders = (
  response: NextResponse,
  nonce: string,
  options: { isDev?: boolean } = {},
): NextResponse => {
  const isDev = options.isDev ?? process.env.NODE_ENV !== "production";

  // CSP with nonce
  response.headers.set("Content-Security-Policy", buildCSP(nonce, isDev));

  // HSTS (production only — would break localhost dev)
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", HSTS_HEADER);
  }

  // COOP — isolates browsing context while allowing popups (needed for affiliate links)
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  // COEP — unsafe-none allows third-party images/favicons (Google favicons, brand logos) to load
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");

  // CORP — allow cross-origin resource sharing for images/logos
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  // X-Content-Type-Options — prevents MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-Frame-Options — prevents clickjacking (defense in depth with CSP frame-ancestors)
  response.headers.set("X-Frame-Options", "DENY");

  // Referrer-Policy — only send origin for cross-origin, full for same-origin
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy — deny all sensitive APIs
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);

  // X-DNS-Prefetch-Control — disable DNS prefetching (privacy)
  response.headers.set("X-DNS-Prefetch-Control", "off");

  // X-Permitted-Cross-Domain-Policies — prevents Adobe Flash/PDF cross-domain
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // Cache-Control for sensitive pages
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  // Return same-origin for our resources
  response.headers.set("Access-Control-Allow-Origin", "same-origin");

  return response;
};

// ── Report-To header (for CSP violation reporting) ──────────────────────────

export const REPORT_TO_HEADER = JSON.stringify({
  group: "fareback-csp",
  max_age: 6 * 60 * 60, // 6 hours
  endpoints: [{ url: "/api/security/report-csp" }],
});
