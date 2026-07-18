// ============================================================================
// FAREBACK — Device Fingerprinting
// ============================================================================
// Generates a device fingerprint from request headers (User-Agent, Accept,
// Accept-Language, etc.). Used for:
//   - Anomaly detection (different device on same account)
//   - Rate limiting (per-device, not just per-IP)
//   - Trusted device tracking
//
// Privacy-preserving: the fingerprint is a hash of headers, not personally
// identifiable. It cannot reverse to identify the user's device specs.
// ============================================================================

import "server-only";
import type { NextRequest } from "next/server";

const hashString32 = (str: string): string => {
  let h1 = 0xdeadbeef | 0, h2 = 0x41c6ce57 | 0, h3 = 0x546b6b77 | 0, h4 = 0x247a8f11 | 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}`;
};

// ── Generate fingerprint from request ───────────────────────────────────────

export const generateFingerprint = (request: NextRequest): string => {
  const components = [
    request.headers.get("user-agent") ?? "",
    request.headers.get("accept-language") ?? "",
    request.headers.get("accept-encoding") ?? "",
    request.headers.get("accept") ?? "",
    request.headers.get("sec-ch-ua") ?? "", // Client Hints (Chrome)
    request.headers.get("sec-ch-ua-platform") ?? "",
    request.headers.get("sec-ch-ua-mobile") ?? "",
    request.headers.get("sec-fetch-mode") ?? "",
    request.headers.get("sec-fetch-site") ?? "",
  ].join("|");

  return hashString32(components);
};

// ── Generate fingerprint from headers object ────────────────────────────────

export const generateFingerprintFromHeaders = (headers: Record<string, string | null>): string => {
  const components = [
    headers["user-agent"] ?? "",
    headers["accept-language"] ?? "",
    headers["accept-encoding"] ?? "",
    headers["accept"] ?? "",
    headers["sec-ch-ua"] ?? "",
    headers["sec-ch-ua-platform"] ?? "",
    headers["sec-ch-ua-mobile"] ?? "",
  ].join("|");

  return hashString32(components);
};

// ── Get client IP (handles proxies) ─────────────────────────────────────────

export const getClientIP = (request: NextRequest): string => {
  // Use Next.js provided IP first (most secure, set by Vercel/Next.js)
  if ((request as any).ip) return (request as any).ip;

  // Check X-Forwarded-For (most common proxy header)
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // Take the first IP (closest to the client)
    return xff.split(",")[0].trim();
  }

  // Check X-Real-IP (Nginx)
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Check True-Client-IP (Cloudflare Enterprise)
  const trueIp = request.headers.get("true-client-ip");
  if (trueIp) return trueIp.trim();

  return "unknown";
};

// ─- Parse User-Agent for device info ────────────────────────────────────────

export interface DeviceInfo {
  browser: string;
  os: string;
  device: "mobile" | "tablet" | "desktop";
  bot: boolean;
}

export const parseUserAgent = (ua: string): DeviceInfo => {
  const lower = ua.toLowerCase();

  // Bot detection
  const botPatterns = [
    "bot", "crawler", "spider", "scraper", "curl", "wget",
    "python-requests", "postman", "insomnia", "headless",
  ];
  const isBot = botPatterns.some((p) => lower.includes(p));

  // Browser detection
  let browser = "Unknown";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browser = "Safari";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";

  // OS detection
  let os = "Unknown";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macos")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  // Device type detection
  let device: DeviceInfo["device"] = "desktop";
  if (lower.includes("ipad") || (lower.includes("android") && !lower.includes("mobile"))) {
    device = "tablet";
  } else if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) {
    device = "mobile";
  }

  return { browser, os, device, bot: isBot };
};

// ── Trusted device storage ──────────────────────────────────────────────────
// In production, store trusted devices in a `trusted_devices` table:
//   { userId, fingerprint, trustedAt, lastSeenAt, label }
// Users can view and revoke trusted devices from their account settings.
