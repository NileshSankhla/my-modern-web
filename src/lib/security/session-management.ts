// ============================================================================
// FAREBACK — Session Management (Active Sessions UI + Revoke)
// ============================================================================
// Handles scenarios 5, 10, 25, 43:
//   - User signed in on phone + laptop → see both, revoke either
//   - Admin account compromised → revoke all sessions instantly
//   - User walks away → admin can see active sessions
//
// Users can view all their active sessions and revoke any of them.
// ============================================================================

import "server-only";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "../db";
import { sessions } from "../db/schema";
import { logSecurityEvent, SECURITY_EVENTS } from "./audit";
import { parseUserAgent } from "./fingerprint";

// ── List active sessions for a user ─────────────────────────────────────────

export interface SessionInfo {
  id: number;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string;
  os: string;
  device: string;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export const listUserSessions = async (
  userId: number,
  currentSessionTokenHash?: string,
): Promise<SessionInfo[]> => {
  const activeSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.createdAt);

  return activeSessions.map((s) => {
    const ua = parseUserAgent(s.userAgent ?? "");
    return {
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      browser: ua.browser,
      os: ua.os,
      device: ua.device,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentSessionTokenHash === s.tokenHash,
    };
  });
};

// ── Revoke a specific session ───────────────────────────────────────────────

export const revokeSession = async (
  userId: number,
  sessionId: number,
): Promise<void> => {
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  await logSecurityEvent(SECURITY_EVENTS.SESSION_REVOKED, {
    actorId: userId,
    entityType: "sessions",
    entityId: String(sessionId),
  });
};

// ── Revoke all other sessions (keep current) ────────────────────────────────

export const revokeAllOtherSessions = async (
  userId: number,
  currentSessionTokenHash: string,
): Promise<number> => {
  const result = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.tokenHash, currentSessionTokenHash),
      ),
    )
    .returning({ id: sessions.id });

  await logSecurityEvent(SECURITY_EVENTS.ALL_OTHER_SESSIONS_REVOKED, {
    actorId: userId,
    metadata: { count: result.length },
  });

  return result.length;
};

// ─- Revoke all sessions (account takeover recovery) ─────────────────────────

export const revokeAllSessions = async (userId: number): Promise<number> => {
  const result = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });

  await logSecurityEvent(SECURITY_EVENTS.ALL_SESSIONS_DESTROYED, {
    actorId: userId,
    metadata: { count: result.length, reason: "account_takeover_recovery" },
  });

  return result.length;
};
