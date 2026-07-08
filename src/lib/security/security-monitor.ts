// ============================================================================
// FAREBACK — Security Monitor (Real-Time Dashboard Data)
// ============================================================================
// Aggregates security metrics for the admin security dashboard.
// Shows: active threats, blocked attacks, audit events, risk scores.
// ============================================================================

import "server-only";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, sessions, users } from "../db/schema";
import { SECURITY_EVENTS } from "./audit";
import { getUserRiskScore } from "./anomaly";

export interface SecurityDashboardData {
  // Real-time metrics
  activeSessions: number;
  activeUsers24h: number;
  failedLogins24h: number;
  blockedAttacks24h: number;
  cspViolations24h: number;
  csrfBlocked24h: number;
  rateLimited24h: number;
  fraudDetected24h: number;
  anomalyDetected24h: number;

  // Trend (7 days)
  securityEvents7d: Array<{ date: string; count: number; severity: string }>;

  // Top threats
  topThreats: Array<{ action: string; count: number }>;

  // High-risk users
  highRiskUsers: Array<{
    userId: number;
    email: string;
    riskScore: number;
    factors: string[];
  }>;

  // Recent critical events
  recentCritical: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    ipAddress: string | null;
    createdAt: Date;
  }>;
}

// ── Get dashboard data ──────────────────────────────────────────────────────

export const getSecurityDashboard = async (): Promise<SecurityDashboardData> => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    activeSessions,
    activeUsers24h,
    failedLogins24h,
    blockedAttacks24h,
    cspViolations24h,
    csrfBlocked24h,
    rateLimited24h,
    fraudDetected24h,
    anomalyDetected24h,
    events7d,
    topThreats,
    recentCritical,
  ] = await Promise.all([
    // Active sessions
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(gte(sessions.expiresAt, now)),

    // Active users in 24h (distinct users with sessions)
    db
      .select({ count: sql<number>`count(distinct user_id)::int` })
      .from(sessions)
      .where(gte(sessions.createdAt, dayAgo)),

    // Failed logins
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.SIGN_IN_FAILED),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // Total blocked attacks (sum of all blocked categories)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.actionType} IN ('CSRF_BLOCKED', 'BOT_DETECTED', 'FRAUD_DETECTED', 'ANOMALY_DETECTED', 'BRUTE_FORCE_DETECTED')`,
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // CSP violations
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.CSP_VIOLATION),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // CSRF blocked
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.CSRF_BLOCKED),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // Rate limited
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.RATE_LIMIT_EXCEEDED),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // Fraud detected
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.FRAUD_DETECTED),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // Anomaly detected
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actionType, SECURITY_EVENTS.ANOMALY_DETECTED),
          gte(auditLogs.createdAt, dayAgo),
        ),
      ),

    // Events over 7 days (grouped by day + severity)
    db
      .select({
        date: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM-DD')`,
        severity: sql<string>`coalesce((${auditLogs.metadata}->>'severity')::text, 'info')`,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, weekAgo))
      .groupBy(sql`1, 2`)
      .orderBy(sql`1`),

    // Top threats (most common security events)
    db
      .select({
        action: auditLogs.actionType,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, weekAgo))
      .groupBy(auditLogs.actionType)
      .orderBy(sql`2 desc`)
      .limit(10),

    // Recent critical events
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.actionType,
        actorEmail: users.email,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(
        and(
          sql`(${auditLogs.metadata}->>'severity')::text = 'critical'`,
          gte(auditLogs.createdAt, dayAgo),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  // Get high-risk users (sample — in production, run this as a cron job)
  const highRiskUsers = await getHighRiskUsers(5);

  return {
    activeSessions: activeSessions[0]?.count ?? 0,
    activeUsers24h: activeUsers24h[0]?.count ?? 0,
    failedLogins24h: failedLogins24h[0]?.count ?? 0,
    blockedAttacks24h: blockedAttacks24h[0]?.count ?? 0,
    cspViolations24h: cspViolations24h[0]?.count ?? 0,
    csrfBlocked24h: csrfBlocked24h[0]?.count ?? 0,
    rateLimited24h: rateLimited24h[0]?.count ?? 0,
    fraudDetected24h: fraudDetected24h[0]?.count ?? 0,
    anomalyDetected24h: anomalyDetected24h[0]?.count ?? 0,
    securityEvents7d: events7d.map((e) => ({
      date: e.date,
      count: e.count,
      severity: e.severity,
    })),
    topThreats: topThreats.map((t) => ({ action: t.action, count: t.count })),
    highRiskUsers,
    recentCritical: recentCritical.map((e) => ({
      id: e.id,
      action: e.action,
      actorEmail: e.actorEmail,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    })),
  };
};

// ── Get high-risk users ─────────────────────────────────────────────────────

const getHighRiskUsers = async (
  limit: number,
): Promise<Array<{ userId: number; email: string; riskScore: number; factors: string[] }>> => {
  // Find users with recent security events
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const flaggedUsers = await db
    .select({
      userId: auditLogs.actorId,
      email: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(
      and(
        sql`${auditLogs.actionType} IN ('SIGN_IN_FAILED', 'TWO_FACTOR_VERIFY_FAILED', 'ANOMALY_DETECTED', 'FRAUD_DETECTED')`,
        gte(auditLogs.createdAt, dayAgo),
        sql`${auditLogs.actorId} IS NOT NULL`,
      ),
    )
    .groupBy(auditLogs.actorId, users.email)
    .limit(limit * 2); // Get more, then filter by risk score

  const results: Array<{ userId: number; email: string; riskScore: number; factors: string[] }> =
    [];

  for (const user of flaggedUsers) {
    if (!user.userId) continue;
    const { score, factors } = await getUserRiskScore(user.userId);
    if (score > 0) {
      results.push({
        userId: user.userId,
        email: user.email ?? "unknown",
        riskScore: score,
        factors,
      });
    }
  }

  return results.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
};
