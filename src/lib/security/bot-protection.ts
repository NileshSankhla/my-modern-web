// ============================================================================
// FAREBACK — Bot Protection (Cloudflare Turnstile + Heuristics)
// ============================================================================
// Multi-layered bot protection:
//   1. Cloudflare Turnstile (privacy-preserving CAPTCHA alternative)
//   2. Heuristic scoring (User-Agent analysis, request patterns)
//   3. Honeypot field detection (hidden form fields)
//
// Turnstile is free, privacy-preserving, and doesn't require user interaction
// in most cases. It replaces reCAPTCHA which tracks users.
// ============================================================================

import "server-only";
import type { NextRequest } from "next/server";

// ── Turnstile verification ──────────────────────────────────────────────────

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  score?: number; // 0-1, higher is more likely human
  action?: string;
  error?: string;
}

export const verifyTurnstile = async (
  token: string,
  ip?: string,
): Promise<TurnstileResult> => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // If Turnstile is not configured, fail open (don't block legitimate users)
    console.warn("[bot-protection] Turnstile not configured — skipping verification");
    return { success: true };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (ip) body.append("remoteip", ip);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
    });

    const data = await response.json();

    return {
      success: data.success ?? false,
      score: data.score,
      action: data.action,
      error: data["error-codes"]?.[0],
    };
  } catch (error) {
    console.error("[bot-protection] Turnstile verification failed:", error);
    // Fail open on network errors — don't block legitimate users
    return { success: true };
  }
};

// ── Heuristic bot scoring ───────────────────────────────────────────────────
// Scores requests based on User-Agent and header patterns without external
// API calls. Fast, free, but less accurate than Turnstile.

export interface BotScore {
  score: number; // 0-100, higher = more likely bot
  reasons: string[];
}

const BOT_UA_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python-requests/i, /python/i, /go-http-client/i, /java\//i,
  /httpclient/i, /okhttp/i, /node-fetch/i, /axios/i, /postman/i,
  /insomnia/i, /httpie/i, /headless/i, /phantomjs/i, /selenium/i,
  /puppeteer/i, /playwright/i, /webdriver/i, /automated/i,
];

const MISSING_HEADER_INDICATORS = [
  "accept-language", "accept-encoding", "accept",
];

export const scoreRequest = (request: NextRequest): BotScore => {
  let score = 0;
  const reasons: string[] = [];

  const ua = request.headers.get("user-agent") ?? "";

  // 1. Check User-Agent against bot patterns
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(ua)) {
      score += 60;
      reasons.push(`Bot User-Agent pattern: ${pattern.source}`);
      break;
    }
  }

  // 2. Empty or very short User-Agent
  if (ua.length < 20) {
    score += 30;
    reasons.push("Suspiciously short User-Agent");
  }

  // 3. Missing standard browser headers
  for (const header of MISSING_HEADER_INDICATORS) {
    if (!request.headers.get(header)) {
      score += 10;
      reasons.push(`Missing ${header} header`);
    }
  }

  // 4. Headless browser indicators
  if (/headless/i.test(ua)) {
    score += 40;
    reasons.push("Headless browser detected");
  }

  // 5. WebDriver indicator
  if (request.headers.get("x-selenium") || request.headers.get("x-webdriver")) {
    score += 80;
    reasons.push("WebDriver header present");
  }

  return {
    score: Math.min(100, score),
    reasons,
  };
};

// ── Honeypot field validation ───────────────────────────────────────────────
// Add a hidden field to forms with a tempting name (e.g., "website", "url").
// Humans won't fill it (it's hidden via CSS), but bots will. If filled, reject.

export const isHoneypotTriggered = (formData: FormData, field: string = "website"): boolean => {
  const value = formData.get(field);
  return value !== null && value !== "";
};

// ─- Combined bot check ──────────────────────────────────────────────────────

export const checkBot = async (
  request: NextRequest,
  options: { turnstileToken?: string; blockThreshold?: number } = {},
): Promise<{ allowed: boolean; score: number; reasons: string[] }> => {
  const blockThreshold = options.blockThreshold ?? 70;

  // 1. Heuristic scoring (always runs)
  const heuristicScore = scoreRequest(request);

  // 2. Turnstile verification (if token provided)
  let turnstileScore = 0;
  if (options.turnstileToken) {
    const ip = (request as any).ip ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const turnstileResult = await verifyTurnstile(options.turnstileToken, ip);
    if (!turnstileResult.success) {
      return {
        allowed: false,
        score: 100,
        reasons: ["Turnstile verification failed", turnstileResult.error ?? "unknown"],
      };
    }
    // Turnstile success → likely human → reduce score
    turnstileScore = -50;
  }

  const finalScore = Math.max(0, Math.min(100, heuristicScore.score + turnstileScore));

  return {
    allowed: finalScore < blockThreshold,
    score: finalScore,
    reasons: heuristicScore.reasons,
  };
};
