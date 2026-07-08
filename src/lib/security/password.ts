// ============================================================================
// FAREBACK — Password Security (Argon2id + Breach Checking)
// ============================================================================
// OWASP recommends Argon2id as the primary password hashing algorithm (2023+).
// Parameters tuned for ~250ms hashing time on a typical server CPU (prevents
// brute-force while keeping login responsive).
//
// Also includes HaveIBeenPwned password breach checking via the k-anonymity
// API (only sends first 5 chars of SHA-1 hash — full password never leaves
// the server).
// ============================================================================

import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Argon2id parameters — OWASP recommended (2024)
// Memory: 19 MiB, Iterations: 2, Parallelism: 1
// Adjust based on your server CPU benchmarks. Target: 250ms per hash.
const ARGON2_OPTIONS = {
  type: 2, // argon2id
  memoryCost: 19456, // 19 MiB in KiB
  timeCost: 2, // iterations
  parallelism: 1,
  hashLength: 32,
} as const;

// ── Argon2id hashing ───────────────────────────────────────────────────────
// Dynamic import because argon2 is a native module that may not be available
// in all environments. Falls back to scrypt if argon2 is not installed.

let argon2Module: any = null;
const getArgon2 = async () => {
  if (argon2Module) return argon2Module;
  try {
    argon2Module = await import("argon2" as string);
    return argon2Module;
  } catch {
    console.warn(
      "[password] argon2 module not installed. Falling back to scrypt. " +
        "Install with: npm install argon2",
    );
    return null;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  const argon2 = await getArgon2();
  if (argon2) {
    // Argon2 includes salt + params in the hash string, so we don't need
    // to store them separately.
    return argon2.hash(password, ARGON2_OPTIONS);
  }
  // Scrypt fallback (still secure, just less modern)
  const { scryptSync, randomBytes: rb } = await import("node:crypto");
  const salt = rb(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  try {
    // Argon2 hashes start with "$argon2"
    if (stored.startsWith("$argon2")) {
      const argon2 = await getArgon2();
      if (!argon2) return false;
      return argon2.verify(stored, password);
    }
    // Scrypt fallback format: "scrypt$salt$hash"
    if (stored.startsWith("scrypt$")) {
      const { scryptSync } = await import("node:crypto");
      const [, salt, hash] = stored.split("$");
      if (!salt || !hash) return false;
      const computed = scryptSync(password, salt, 64).toString("hex");
      if (computed.length !== hash.length) return false;
      return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
    }
    // Legacy format: "salt:hash" (from old scrypt impl)
    if (stored.includes(":") && !stored.startsWith("$")) {
      const { scryptSync } = await import("node:crypto");
      const [salt, hash] = stored.split(":");
      if (!salt || !hash) return false;
      const computed = scryptSync(password, salt, 64).toString("hex");
      if (computed.length !== hash.length) return false;
      return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
    }
    return false;
  } catch {
    return false;
  }
};

// ── Password strength estimation ───────────────────────────────────────────
// Uses zxcvbn-style estimation (simplified). Returns 0-4 score.
// 0 = very weak, 4 = very strong

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  suggestions: string[];
  crackTimeDisplay: string;
}

export const estimatePasswordStrength = (password: string): PasswordStrength => {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (variety >= 3) score++;
  if (variety === 4) score++;

  // Penalize common patterns
  const commonPatterns = [
    /^123/, /abc/i, /qwerty/i, /password/i, /letmein/i,
    /^admin/i, /^welcome/i, /monkey/i, /dragon/i,
  ];
  if (commonPatterns.some((p) => p.test(password))) {
    score = Math.max(0, score - 2);
    suggestions.push("Avoid common patterns and sequences");
  }

  // Penalize repetition
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push("Avoid repeated characters");
  }

  if (password.length < 8) suggestions.push("Use at least 8 characters");
  if (!hasUpper) suggestions.push("Add uppercase letters");
  if (!hasDigit) suggestions.push("Add numbers");
  if (!hasSpecial) suggestions.push("Add special characters");

  const clamped = Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordStrength["label"][] = [
    "Very weak", "Weak", "Fair", "Strong", "Very strong",
  ];
  const crackTimes = [
    "instant", "< 1 minute", "< 1 hour", "< 1 day", "centuries",
  ];

  return {
    score: clamped,
    label: labels[clamped],
    suggestions: suggestions.slice(0, 3),
    crackTimeDisplay: crackTimes[clamped],
  };
};

// ── Password breach checking (HaveIBeenPwned k-anonymity API) ──────────────
// Sends ONLY the first 5 characters of the SHA-1 hash. The full hash never
// leaves the server. HIBP returns all breached hashes starting with those 5
// chars; we check locally if our full hash is in the list.
//
// This is cryptographically private — HIBP cannot learn the password.

export const isPasswordBreached = async (
  password: string,
): Promise<{ breached: boolean; count: number }> => {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "Add-Padding": "true" }, // reduces caching privacy leak
        cache: "no-store",
      },
    );

    if (!response.ok) {
      // If HIBP is down, fail open (don't block signups) but log.
      console.warn("[password] HIBP API unavailable, skipping breach check");
      return { breached: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        return { breached: true, count: parseInt(countStr, 10) };
      }
    }
    return { breached: false, count: 0 };
  } catch (error) {
    console.warn("[password] Breach check failed:", error);
    return { breached: false, count: 0 };
  }
};

// ── Password history (prevent reuse) ───────────────────────────────────────
// Store last N password hashes. Check against this list on password change.

export const PASSWORD_HISTORY_LIMIT = 5;

export const isPasswordInHistory = async (
  password: string,
  history: string[],
): Promise<boolean> => {
  for (const oldHash of history) {
    if (await verifyPassword(password, oldHash)) return true;
  }
  return false;
};

// ── Generate secure random password (for resets) ───────────────────────────

export const generateSecurePassword = (length = 20): string => {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
};
