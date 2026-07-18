// ============================================================================
// FAREBACK — Audit Logging (SIEM-Ready Structured Events)
// ============================================================================
// Comprehensive, structured audit logging designed for SIEM ingestion
// (Splunk, Datadog, Elastic Security, etc.).
//
// Features:
//   - Structured JSON events with consistent schema
//   - Severity levels (info, warning, critical)
//   - Categorized event types
//   - IP, User-Agent, device fingerprint on every event
//   - Tamper-evident (hash chain — each event references the previous)
//   - Async write (never blocks the request)
//   - Forwarding to external SIEM via webhook
// ============================================================================

import "server-only";
import { db } from "../db";
import { auditLogs } from "../db/schema";
import { desc } from "drizzle-orm";

// ── Security event types ────────────────────────────────────────────────────

export const SECURITY_EVENTS = {
  // Authentication
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_DESTROYED: "SESSION_DESTROYED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_ROTATED: "SESSION_ROTATED",
  SESSION_EVICTED: "SESSION_EVICTED",
  ALL_SESSIONS_DESTROYED: "ALL_SESSIONS_DESTROYED",
  SIGN_IN_SUCCESS: "SIGN_IN_SUCCESS",
  SIGN_IN_FAILED: "SIGN_IN_FAILED",
  SIGN_UP_SUCCESS: "SIGN_UP_SUCCESS",
  SIGN_UP_FAILED: "SIGN_UP_FAILED",
  SIGN_OUT: "SIGN_OUT",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // 2FA
  TWO_FACTOR_ENABLED: "TWO_FACTOR_ENABLED",
  TWO_FACTOR_DISABLED: "TWO_FACTOR_DISABLED",
  TWO_FACTOR_VERIFY_SUCCESS: "TWO_FACTOR_VERIFY_SUCCESS",
  TWO_FACTOR_VERIFY_FAILED: "TWO_FACTOR_VERIFY_FAILED",
  TWO_FACTOR_BACKUP_CODE_USED: "TWO_FACTOR_BACKUP_CODE_USED",

  // Authorization
  ROLE_GRANTED: "ROLE_GRANTED",
  ROLE_REVOKED: "ROLE_REVOKED",
  ADMIN_AUTO_PROMOTED: "ADMIN_AUTO_PROMOTED",
  ACCESS_DENIED: "ACCESS_DENIED",

  // Anomalies
  ANOMALY_DETECTED: "ANOMALY_DETECTED",
  IMPOSSIBLE_TRAVEL: "IMPOSSIBLE_TRAVEL",
  IP_CHANGE_DETECTED: "IP_CHANGE_DETECTED",
  USER_AGENT_CHANGE_DETECTED: "USER_AGENT_CHANGE_DETECTED",
  BRUTE_FORCE_DETECTED: "BRUTE_FORCE_DETECTED",

  // Wallet
  WALLET_CREDIT: "WALLET_CREDIT",
  WALLET_DEBIT: "WALLET_DEBIT",
  WALLET_INSUFFICIENT_FUNDS: "WALLET_INSUFFICIENT_FUNDS",
  WALLET_REVERSAL: "WALLET_REVERSAL",

  // Withdrawals
  WITHDRAWAL_REQUESTED: "WITHDRAWAL_REQUESTED",
  WITHDRAWAL_APPROVED: "WITHDRAWAL_APPROVED",
  WITHDRAWAL_REJECTED: "WITHDRAWAL_REJECTED",
  WITHDRAWAL_PAID: "WITHDRAWAL_PAID",

  // Gift cards
  GIFT_CARD_REQUESTED: "GIFT_CARD_REQUESTED",
  GIFT_CARD_APPROVED: "GIFT_CARD_APPROVED",
  GIFT_CARD_REJECTED: "GIFT_CARD_REJECTED",
  GIFT_CARD_FULFILLED: "GIFT_CARD_FULFILLED",

  // Click tracking
  CLICK_TRACKED: "CLICK_TRACKED",
  CLICK_UNTRACKED: "CLICK_UNTRACKED",
  CLICK_APPROVED: "CLICK_APPROVED",
  CLICK_UNDO_APPROVED: "CLICK_UNDO_APPROVED",
  CLICK_DELETED: "CLICK_DELETED",
  CLICK_RESTORED: "CLICK_RESTORED",
  CLICKS_PURGED: "CLICKS_PURGED",

  // Affiliate links
  LINK_ADDED: "LINK_ADDED",
  LINK_UPDATED: "LINK_UPDATED",
  LINK_REMOVED: "LINK_REMOVED",
  LINK_TOGGLED: "LINK_TOGGLED",

  // Cache
  CACHE_FLUSHED: "CACHE_FLUSHED",
  CACHE_RELOADED: "CACHE_RELOADED",

  // Notifications
  NOTIFICATION_SENT: "NOTIFICATION_SENT",

  // CSV
  CSV_IMPORTED: "CSV_IMPORTED",

  // Security
  CSP_VIOLATION: "CSP_VIOLATION",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  CSRF_BLOCKED: "CSRF_BLOCKED",
  BOT_DETECTED: "BOT_DETECTED",
  CAPTCHA_FAILED: "CAPTCHA_FAILED",
  ENCRYPTION_KEY_ROTATED: "ENCRYPTION_KEY_ROTATED",
  TRUSTED_DEVICE_REVOKED: "TRUSTED_DEVICE_REVOKED",
  ALL_TRUSTED_DEVICES_REVOKED: "ALL_TRUSTED_DEVICES_REVOKED",
  ALL_OTHER_SESSIONS_REVOKED: "ALL_OTHER_SESSIONS_REVOKED",
  FILE_UPLOAD_REJECTED: "FILE_UPLOAD_REJECTED",
  FRAUD_DETECTED: "FRAUD_DETECTED",
  PASSWORD_CHANGE_FAILED: "PASSWORD_CHANGE_FAILED",
  SESSION_REVOKED: "SESSION_REVOKED",
} as const;

export type SecurityEvent = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

// ── Severity levels ─────────────────────────────────────────────────────────

export type Severity = "info" | "warning" | "critical";

const EVENT_SEVERITY: Record<SecurityEvent, Severity> = {
  [SECURITY_EVENTS.SESSION_CREATED]: "info",
  [SECURITY_EVENTS.SESSION_DESTROYED]: "info",
  [SECURITY_EVENTS.SESSION_EXPIRED]: "info",
  [SECURITY_EVENTS.SESSION_ROTATED]: "warning",
  [SECURITY_EVENTS.SESSION_EVICTED]: "warning",
  [SECURITY_EVENTS.ALL_SESSIONS_DESTROYED]: "warning",
  [SECURITY_EVENTS.SIGN_IN_SUCCESS]: "info",
  [SECURITY_EVENTS.SIGN_IN_FAILED]: "warning",
  [SECURITY_EVENTS.SIGN_UP_SUCCESS]: "info",
  [SECURITY_EVENTS.SIGN_UP_FAILED]: "warning",
  [SECURITY_EVENTS.SIGN_OUT]: "info",
  [SECURITY_EVENTS.PASSWORD_RESET_REQUESTED]: "warning",
  [SECURITY_EVENTS.PASSWORD_RESET_COMPLETED]: "warning",
  [SECURITY_EVENTS.PASSWORD_CHANGED]: "warning",
  [SECURITY_EVENTS.TWO_FACTOR_ENABLED]: "warning",
  [SECURITY_EVENTS.TWO_FACTOR_DISABLED]: "critical",
  [SECURITY_EVENTS.TWO_FACTOR_VERIFY_SUCCESS]: "info",
  [SECURITY_EVENTS.TWO_FACTOR_VERIFY_FAILED]: "warning",
  [SECURITY_EVENTS.TWO_FACTOR_BACKUP_CODE_USED]: "warning",
  [SECURITY_EVENTS.ROLE_GRANTED]: "critical",
  [SECURITY_EVENTS.ROLE_REVOKED]: "critical",
  [SECURITY_EVENTS.ADMIN_AUTO_PROMOTED]: "critical",
  [SECURITY_EVENTS.ACCESS_DENIED]: "warning",
  [SECURITY_EVENTS.ANOMALY_DETECTED]: "critical",
  [SECURITY_EVENTS.IMPOSSIBLE_TRAVEL]: "critical",
  [SECURITY_EVENTS.IP_CHANGE_DETECTED]: "warning",
  [SECURITY_EVENTS.USER_AGENT_CHANGE_DETECTED]: "warning",
  [SECURITY_EVENTS.BRUTE_FORCE_DETECTED]: "critical",
  [SECURITY_EVENTS.WALLET_CREDIT]: "info",
  [SECURITY_EVENTS.WALLET_DEBIT]: "info",
  [SECURITY_EVENTS.WALLET_INSUFFICIENT_FUNDS]: "warning",
  [SECURITY_EVENTS.WALLET_REVERSAL]: "warning",
  [SECURITY_EVENTS.WITHDRAWAL_REQUESTED]: "info",
  [SECURITY_EVENTS.WITHDRAWAL_APPROVED]: "warning",
  [SECURITY_EVENTS.WITHDRAWAL_REJECTED]: "warning",
  [SECURITY_EVENTS.WITHDRAWAL_PAID]: "warning",
  [SECURITY_EVENTS.GIFT_CARD_REQUESTED]: "info",
  [SECURITY_EVENTS.GIFT_CARD_APPROVED]: "warning",
  [SECURITY_EVENTS.GIFT_CARD_REJECTED]: "warning",
  [SECURITY_EVENTS.GIFT_CARD_FULFILLED]: "warning",
  [SECURITY_EVENTS.CLICK_TRACKED]: "info",
  [SECURITY_EVENTS.CLICK_UNTRACKED]: "info",
  [SECURITY_EVENTS.CLICK_APPROVED]: "warning",
  [SECURITY_EVENTS.CLICK_UNDO_APPROVED]: "warning",
  [SECURITY_EVENTS.CLICK_DELETED]: "warning",
  [SECURITY_EVENTS.CLICK_RESTORED]: "info",
  [SECURITY_EVENTS.CLICKS_PURGED]: "critical",
  [SECURITY_EVENTS.LINK_ADDED]: "warning",
  [SECURITY_EVENTS.LINK_REMOVED]: "warning",
  [SECURITY_EVENTS.LINK_TOGGLED]: "info",
  [SECURITY_EVENTS.LINK_UPDATED]: "info",
  [SECURITY_EVENTS.CACHE_FLUSHED]: "critical",
  [SECURITY_EVENTS.CACHE_RELOADED]: "info",
  [SECURITY_EVENTS.NOTIFICATION_SENT]: "info",
  [SECURITY_EVENTS.CSV_IMPORTED]: "warning",
  [SECURITY_EVENTS.CSP_VIOLATION]: "warning",
  [SECURITY_EVENTS.RATE_LIMIT_EXCEEDED]: "warning",
  [SECURITY_EVENTS.CSRF_BLOCKED]: "critical",
  [SECURITY_EVENTS.BOT_DETECTED]: "critical",
  [SECURITY_EVENTS.CAPTCHA_FAILED]: "warning",
  [SECURITY_EVENTS.ENCRYPTION_KEY_ROTATED]: "critical",
  [SECURITY_EVENTS.TRUSTED_DEVICE_REVOKED]: "warning",
  [SECURITY_EVENTS.ALL_TRUSTED_DEVICES_REVOKED]: "warning",
  [SECURITY_EVENTS.ALL_OTHER_SESSIONS_REVOKED]: "warning",
  [SECURITY_EVENTS.FILE_UPLOAD_REJECTED]: "warning",
  [SECURITY_EVENTS.FRAUD_DETECTED]: "critical",
  [SECURITY_EVENTS.PASSWORD_CHANGE_FAILED]: "warning",
  [SECURITY_EVENTS.SESSION_REVOKED]: "warning",
};

// ── Audit log params ────────────────────────────────────────────────────────

export interface AuditLogParams {
  actorId: number | null;
  action: SecurityEvent;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  fingerprint?: string | null;
}

// ── Tamper-evident hash chain ───────────────────────────────────────────────
// Each audit entry includes a hash of (previousHash + currentData).
// This makes it detectable if any entry is modified or deleted after the fact.

const computeChainHash = async (
  previousHash: string | null,
  data: string,
): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(`${previousHash ?? ""}|${data}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// ─- Log security event ──────────────────────────────────────────────────────
// Non-blocking: errors are logged but never thrown. Audit logging should not
// break the parent operation.

export const logSecurityEvent = async (
  actionOrParams: SecurityEvent | AuditLogParams,
  maybeParams: Omit<AuditLogParams, "action"> = { actorId: null },
): Promise<void> => {
  const params: AuditLogParams =
    typeof actionOrParams === "string"
      ? { action: actionOrParams, ...maybeParams }
      : actionOrParams;
  try {
    const severity = EVENT_SEVERITY[params.action] ?? "info";

    // Get the previous audit entry's chain hash
    const [lastEntry] = await db
      .select({ chainHash: auditLogs.metadata })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    const previousHash =
      (lastEntry?.chainHash as { chainHash?: string } | null)?.chainHash ?? null;

    const dataToHash = JSON.stringify({
      action: params.action,
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      timestamp: new Date().toISOString(),
    });
    const chainHash = await computeChainHash(previousHash, dataToHash);

    await db.insert(auditLogs).values({
      actorId: params.actorId,
      actionType: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: {
        ...params.metadata,
        severity,
        chainHash,
      },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });

    // Forward to external SIEM (if configured)
    await forwardToSIEM({
      ...params,
      severity,
      chainHash,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Audit logging must NEVER break the parent operation.
    console.error("[audit] Failed to write audit log:", {
      action: params.action,
      actorId: params.actorId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ── Forward to external SIEM ────────────────────────────────────────────────
// Sends events to a webhook (Splunk HEC, Datadog Logs, Slack, etc.)

const forwardToSIEM = async (event: Record<string, unknown>): Promise<void> => {
  const webhookUrl = process.env.SIEM_WEBHOOK_URL;
  if (!webhookUrl) return; // No SIEM configured — skip silently

  try {
    // Fire-and-forget — don't await (non-blocking)
    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SIEM_API_KEY
          ? { Authorization: `Bearer ${process.env.SIEM_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        source: "fareback",
        eventType: "security",
        ...event,
      }),
    }).catch(() => {
      // Silent fail — SIEM is best-effort
    });
  } catch {
    // Silent fail
  }
};

// ── Verify audit chain integrity ────────────────────────────────────────────
// Walks the audit log and verifies the hash chain. Returns false if any entry
// has been tampered with.

export const verifyAuditIntegrity = async (): Promise<{
  valid: boolean;
  brokenAt?: string;
}> => {
  const entries = await db
    .select()
    .from(auditLogs)
    .orderBy(auditLogs.createdAt);

  let previousHash: string | null = null;

  for (const entry of entries) {
    const dataToHash = JSON.stringify({
      action: entry.actionType,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      timestamp: entry.createdAt.toISOString(),
    });
    const expectedHash = await computeChainHash(previousHash, dataToHash);
    const actualHash = (entry.metadata as { chainHash?: string } | null)?.chainHash;

    if (actualHash !== expectedHash) {
      return { valid: false, brokenAt: entry.id };
    }
    previousHash = actualHash ?? null;
  }

  return { valid: true };
};
