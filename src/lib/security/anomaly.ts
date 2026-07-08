// ============================================================================
// FAREBACK — Anomaly Detection (IIT Campus Edition — IP-Agnostic)
// ============================================================================
// CRITICAL CONTEXT: All IIT students share a single public IP address.
// IP-based anomaly detection is USELESS here — every student looks identical.
//
// Therefore, anomaly detection focuses on:
//   1. Session token reuse (same token used from different device)
//   2. Device fingerprint changes (same account, different browser/device)
//   3. Brute force on 2FA codes (per-user, not per-IP)
//   4. Behavioral patterns (rapid role changes, unusual action sequences)
//   5. Concurrent session abuse (many sessions for one user)
//
// IP is logged for forensics but NEVER used as an anomaly signal.
// ============================================================================

import "server-only";
import { db } from "../db";
import { sessions, auditLogs } from "../db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export interface AnomalyContext {
  userId: number;
  sessionFingerprint?: string | null;
  requestFingerprint?: string | null;
  // IP is logged but NOT used for anomaly detection (shared campus IP)
  sessionIp?: string | null;
  requestIp?: string | null;
  sessionUa?: string | null;
  requestUa?: string | null;
}

export interface AnomalyResult {
  blocked: boolean;
  score: number; // 0-100
  reasons: string[];
}

const BLOCK_THRESHOLD = 70;

// ── Main anomaly detection (IP-agnostic) ────────────────────────────────────

export const detectAnomaly = async (ctx: AnomalyContext): Promise<AnomalyResult> => {
  let score = 0;
  const reasons: string[] = [];

  // 1. Device fingerprint change (strong signal on campus)
  // On shared IP, the device fingerprint is the primary identity differentiator.
  if (
    ctx.sessionFingerprint &&
    ctx.requestFingerprint &&
    ctx.sessionFingerprint !== ctx.requestFingerprint
  ) {
    score += 45;
    reasons.push("Device fingerprint changed (possible session hijacking)");
  }

  // 2. User-Agent change (secondary signal)
  if (ctx.sessionUa && ctx.requestUa && ctx.sessionUa !== ctx.requestUa) {
    // Same browser family but different version = minor (5 points)
    // Different browser entirely = major (30 points)
    const sameBrowserFamily =
      ctx.sessionUa.split("/")[0] === ctx.requestUa.split("/")[0] ||
      (ctx.sessionUa.includes("Chrome") && ctx.requestUa.includes("Chrome")) ||
      (ctx.sessionUa.includes("Firefox") && ctx.requestUa.includes("Firefox")) ||
      (ctx.sessionUa.includes("Safari") && ctx.requestUa.includes("Safari"));

    if (sameBrowserFamily) {
      score += 5;
      reasons.push("Browser version changed");
    } else {
      score += 30;
      reasons.push("Browser changed (possible session hijacking)");
    }
  }

  // 3. Concurrent session count for this user
  // Many active sessions = possible token theft
  const concurrentCount = await countActiveSessions(ctx.userId);
  if (concurrentCount > 10) {
    score += 40;
    reasons.push(`Excessive concurrent sessions: ${concurrentCount}`);
  } else if (concurrentCount > 5) {
    score += 15;
    reasons.push(`Multiple concurrent sessions: ${concurrentCount}`);
  }

  // 4. 2FA brute force pattern (per-user)
  const bruteForce = await check2FABruteForce(ctx.userId);
  if (bruteForce) {
    score += 60;
    reasons.push(`2FA brute force: ${bruteForce} failed attempts`);
  }

  // 5. Recent security-critical actions (rapid role changes, etc.)
  const rapidCriticalActions = await checkRapidCriticalActions(ctx.userId);
  if (rapidCriticalActions) {
    score += 35;
    reasons.push(`Rapid critical actions: ${rapidCriticalActions}`);
  }

  // NOTE: IP-based checks intentionally omitted.
  // On IIT campus, all students share one IP, so IP changes are normal
  // and would generate false positives on every legitimate request.

  return {
    blocked: score >= BLOCK_THRESHOLD,
    score,
    reasons,
  };
};

// ── Count active sessions for a user ────────────────────────────────────────

const countActiveSessions = async (userId: number): Promise<number> => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gte(sessions.expiresAt, new Date())));
  return result?.count ?? 0;
};

// ── 2FA brute force detection (per-user, not per-IP) ────────────────────────

const TWO_FACTOR_FAIL_THRESHOLD = 5;
const TWO_FACTOR_WINDOW_MS = 15 * 60 * 1000;

const check2FABruteForce = async (userId: number): Promise<number | null> => {
  const windowStart = new Date(Date.now() - TWO_FACTOR_WINDOW_MS);
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.actionType, "TWO_FACTOR_VERIFY_FAILED"),
        gte(auditLogs.createdAt, windowStart),
      ),
    );

  const count = result?.count ?? 0;
  return count >= TWO_FACTOR_FAIL_THRESHOLD ? count : null;
};

// ── Rapid critical actions detection ────────────────────────────────────────
// Detects patterns like: grant admin → withdraw money → disable 2FA in 5 min.

const CRITICAL_ACTIONS = [
  "ROLE_GRANTED",
  "ROLE_REVOKED",
  "TWO_FACTOR_DISABLED",
  "PASSWORD_CHANGED",
  "WALLET_DEBIT",
  "WITHDRAWAL_APPROVED",
  "GIFT_CARD_FULFILLED",
];

const checkRapidCriticalActions = async (userId: number): Promise<number | null> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        gte(auditLogs.createdAt, fiveMinAgo),
        sql`${auditLogs.actionType} IN (${sql.join(
          CRITICAL_ACTIONS.map((a) => sql`${a}`),
          sql`,`,
        )})`,
      ),
    );

  const count = result?.count ?? 0;
  return count >= 3 ? count : null;
};

// ── User risk score (IP-agnostic) ───────────────────────────────────────────

export const getUserRiskScore = async (userId: number): Promise<{
  score: number;
  factors: string[];
}> => {
  const factors: string[] = [];
  let score = 0;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Failed 2FA attempts
  const [failed2FA] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.actionType, "TWO_FACTOR_VERIFY_FAILED"),
        gte(auditLogs.createdAt, dayAgo),
      ),
    );

  if ((failed2FA?.count ?? 0) > 3) {
    score += 30;
    factors.push(`${failed2FA?.count} failed 2FA attempts in 24h`);
  }

  // 2FA disabled recently
  const [twoFADisabled] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.actionType, "TWO_FACTOR_DISABLED"),
        gte(auditLogs.createdAt, dayAgo),
      ),
    );

  if ((twoFADisabled?.count ?? 0) > 0) {
    score += 40;
    factors.push("2FA disabled in last 24h");
  }

  // Excessive sessions
  const sessionCount = await countActiveSessions(userId);
  if (sessionCount > 8) {
    score += 25;
    factors.push(`${sessionCount} active sessions`);
  }

  // Access denied events
  const [accessDenied] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.actionType, "ACCESS_DENIED"),
        gte(auditLogs.createdAt, dayAgo),
      ),
    );

  if ((accessDenied?.count ?? 0) > 2) {
    score += 20;
    factors.push(`${accessDenied?.count} access denied events`);
  }

  return { score: Math.min(100, score), factors };
};
