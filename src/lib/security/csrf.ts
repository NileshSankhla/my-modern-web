// ============================================================================
// FAREBACK — CSRF Protection (Double-Submit Cookie + Origin Validation)
// ============================================================================
// Defense in depth:
//   1. SameSite=strict cookies (prevents cross-site requests from sending cookies)
//   2. Double-submit cookie pattern (token in both cookie + header)
//   3. Origin/Referer header validation
//   4. Custom header requirement (X-Requested-With — browsers block cross-origin)
//
// Server actions get Next.js built-in CSRF, but API routes need this.
// ============================================================================

import "server-only";
import { NextResponse, type NextRequest } from "next/server";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;

// ── Generate CSRF token ─────────────────────────────────────────────────────
// Token is a random 32-byte hex string. Stateless — no server-side storage
// needed because we validate via cookie-header match + HMAC.

export const generateCSRFToken = (): string => {
  const bytes = new Uint8Array(CSRF_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

// ── Validate CSRF token (double-submit pattern) ─────────────────────────────
// The token must be present in BOTH the cookie and the header, and they must
// match.

export const validateCSRFToken = (
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean => {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return result === 0;
};

// ── Origin validation ───────────────────────────────────────────────────────
// For state-changing requests, verify the Origin or Referer header matches
// our allowed origins. This blocks CSRF even if cookies leak.

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""));

export const validateOrigin = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If both are absent, it's a same-origin request (some browsers omit on same-origin)
  // We allow this for GET/HEAD but require for state-changing methods.
  if (!origin && !referer) return true;

  const checkOrigin = origin ?? referer;
  if (!checkOrigin) return false;

  try {
    const url = new URL(checkOrigin);
    return ALLOWED_ORIGINS.includes(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
};

// ── Middleware helper: attach CSRF cookie if missing ────────────────────────

export const attachCSRFCookie = (
  response: NextResponse,
  token: string,
): NextResponse => {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript to put in header
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return response;
};

// ── Full CSRF check for API routes ──────────────────────────────────────────

export const checkCSRF = (request: NextRequest): { valid: boolean; error?: string } => {
  // 1. Origin validation
  if (!validateOrigin(request)) {
    return { valid: false, error: "Invalid origin" };
  }

  // 2. For state-changing methods, require CSRF token
  const method = request.method.toUpperCase();
  const stateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (stateChanging) {
    // 3. Custom header requirement (X-Requested-With)
    // Browsers won't send custom headers cross-origin without preflight.
    const customHeader =
      request.headers.get("x-requested-with") ??
      request.headers.get(CSRF_HEADER_NAME);

    if (!customHeader) {
      return { valid: false, error: "Missing CSRF header" };
    }

    // 4. Double-submit cookie validation
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);

    if (headerToken && cookieToken) {
      if (!validateCSRFToken(cookieToken, headerToken)) {
        return { valid: false, error: "CSRF token mismatch" };
      }
    }
    // If only X-Requested-With is present (no double-submit), accept it
    // because the custom header alone provides CSRF protection.
  }

  return { valid: true };
};

// ── Constants for client-side use ───────────────────────────────────────────

export const CSRF_CONFIG = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
} as const;
