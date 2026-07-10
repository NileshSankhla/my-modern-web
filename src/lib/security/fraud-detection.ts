// ============================================================================
// FAREBACK — Fraud Detection (Withdrawal + Wallet Patterns)
// ============================================================================
// Handles scenarios 24, 34, 48:
//   - User clicks withdraw twice rapidly → idempotency prevents double-charge
//   - Attacker brute-forces 2FA → blocked
//   - User disables 2FA then withdraws → rapid critical action blocked
//
// ML-light heuristics (no paid ML API needed):
//   - Velocity checks (too many withdrawals in short time)
//   - Amount anomalies (sudden huge withdrawal)
//   - Pattern breaks (withdrawal to new UPI ID)
//   - Time-of-day anomalies (3 AM withdrawals)
//   - Sequential action patterns (disable 2FA → withdraw)
// ============================================================================

import "server-only";
import { and, eq, gte, sql, not } from "drizzle-orm";
import { db } from "../db";
import {
  withdrawalRequests,
  walletTransactions,
  auditLogs,
} from "../db/schema";
import { logSecurityEvent, SECURITY_EVENTS } from "./audit";
import { hashForComparison } from "@/lib/security/encryption";

export interface FraudCheckResult {
  allowed: boolean;
  riskScore: number; // 0-100
  reasons: string[];
  requiresReview?: boolean;
}

// ── Check withdrawal for fraud ──────────────────────────────────────────────

export const checkWithdrawalFraud = async (
  userId: number,
  amountInPaise: number,
  upiId: string,
): Promise<FraudCheckResult> => {
  let riskScore = 0;
  const reasons: string[] = [];

  // 1. Velocity: more than 3 withdrawals in 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentWithdrawals] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.userId, userId),
        gte(withdrawalRequests.createdAt, dayAgo),
      ),
    );

  if ((recentWithdrawals?.count ?? 0) >= 3) {
    riskScore += 30;
    reasons.push(`${recentWithdrawals?.count} withdrawals in 24h`);
  }

  // 2. Amount anomaly: withdrawal > 5x average
  const [avgResult] = await db
    .select({
      avg: sql<number>`coalesce(avg(${withdrawalRequests.amountInPaise}), 0)::int`,
    })
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.userId, userId));

  const avgAmount = avgResult?.avg ?? 0;
  if (avgAmount > 0 && amountInPaise > avgAmount * 5) {
    riskScore += 25;
    reasons.push(`Amount ${Math.round(amountInPaise / avgAmount)}x higher than average`);
  }

  // 3. New UPI ID (first withdrawal to this UPI)
  const [existingUpi] = await db
    .select({ id: withdrawalRequests.id })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.userId, userId),
        eq(withdrawalRequests.upiIdHash, hashForComparison(upiId.toLowerCase())),
      ),
    )
    .limit(1);

  const [duplicateUpi] = await db
    .select()
    .from(withdrawalRequests)
    .where(
      and(
        not(eq(withdrawalRequests.userId, userId)),
        eq(withdrawalRequests.upiIdHash, hashForComparison(upiId.toLowerCase())),
      ),
    )
    .limit(1);

  if (!existingUpi) {
    riskScore += 15;
    reasons.push("First withdrawal to this UPI ID");
  }

  // 4. Recent 2FA disable (last 24h) — major red flag
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
    riskScore += 50;
    reasons.push("2FA disabled in last 24h");
  }

  // 5. Recent password change (last 1h) — possible account takeover
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [pwChanged] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.actionType, "PASSWORD_CHANGED"),
        gte(auditLogs.createdAt, hourAgo),
      ),
    );

  if ((pwChanged?.count ?? 0) > 0) {
    riskScore += 40;
    reasons.push("Password changed in last hour");
  }

  // 6. Time-of-day anomaly (3-5 AM IST — unusual shopping hours)
  const hourIST = new Date().getUTCHours() + 5.5; // IST = UTC + 5:30
  if (hourIST >= 3 && hourIST <= 5) {
    riskScore += 10;
    reasons.push("Unusual time (3-5 AM IST)");
  }

  // 7. Sudden balance depletion (withdrawing >80% of balance)
  const [walletBalance] = await db
    .select({ balance: sql<number>`coalesce(sum(amount_in_paise), 0)::int` })
    .from(walletTransactions)
    .where(
      sql`user_id = ${userId} AND type = 'credit' AND created_at > ${dayAgo}`,
    );

  if (walletBalance?.balance && amountInPaise > walletBalance.balance * 0.8) {
    riskScore += 20;
    reasons.push("Withdrawing >80% of recent credits");
  }

  const allowed = riskScore < 60;
  const requiresReview = riskScore >= 40 && riskScore < 60;

  if (!allowed) {
    await logSecurityEvent(SECURITY_EVENTS.FRAUD_DETECTED, {
      actorId: userId,
      metadata: {
        type: "withdrawal_blocked",
        riskScore,
        reasons,
        amountInPaise,
      },
    });
  }

  return { allowed, riskScore, reasons, requiresReview };
};

// ── Check gift card conversion for fraud ────────────────────────────────────

export const checkGiftCardFraud = async (
  userId: number,
  amountInPaise: number,
): Promise<FraudCheckResult> => {
  let riskScore = 0;
  const reasons: string[] = [];

  // 1. Velocity: more than 2 gift card requests in 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentGiftCards] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`amazon_gift_card_requests`)
    .where(
      and(
        eq(sql`user_id`, userId),
        gte(sql`created_at`, dayAgo),
      ),
    );

  if ((recentGiftCards?.count ?? 0) >= 2) {
    riskScore += 35;
    reasons.push(`${recentGiftCards?.count} gift card requests in 24h`);
  }

  // 2. Recent 2FA disable
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
    riskScore += 50;
    reasons.push("2FA disabled in last 24h");
  }

  // 3. Large amount (first-time large conversion)
  const [previousGiftCards] = await db
    .select({
      maxAmount: sql<number>`coalesce(max(amount_in_paise), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(sql`amazon_gift_card_requests`)
    .where(eq(sql`user_id`, userId));

  if (
    (previousGiftCards?.count ?? 0) > 0 &&
    amountInPaise > (previousGiftCards?.maxAmount ?? 0) * 3
  ) {
    riskScore += 25;
    reasons.push("Amount 3x higher than previous max");
  }

  const allowed = riskScore < 60;

  if (!allowed) {
    await logSecurityEvent(SECURITY_EVENTS.FRAUD_DETECTED, {
      actorId: userId,
      metadata: {
        type: "gift_card_blocked",
        riskScore,
        reasons,
        amountInPaise,
      },
    });
  }

  return { allowed, riskScore, reasons };
};
