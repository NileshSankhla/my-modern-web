// ============================================================================
// FAREBACK — Trusted Devices (Skip 2FA on Known Devices)
// ============================================================================
// Handles scenario 20, 26:
//   - User gets new phone → not trusted, must verify 2FA once, then trusted
//   - User opens 10 tabs → all same device, no re-verification needed
//
// A "trusted device" = combination of fingerprint + user. After successful 2FA,
// the device is trusted for 30 days. Subsequent logins skip 2FA.
// ============================================================================

import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { trustedDevices } from "../db/schema";
import { logSecurityEvent, SECURITY_EVENTS } from "./audit";

const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Check if a device is trusted ────────────────────────────────────────────

export const isDeviceTrusted = async (
  userId: number,
  fingerprint: string,
): Promise<boolean> => {
  const [device] = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.fingerprint, fingerprint),
      ),
    )
    .limit(1);

  if (!device) return false;
  if (device.trustedUntil < new Date()) return false;

  // Update last seen
  await db
    .update(trustedDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(trustedDevices.id, device.id));

  return true;
};

// ── Trust a device (after successful 2FA) ───────────────────────────────────

export const trustDevice = async (
  userId: number,
  fingerprint: string,
  meta: { label?: string; ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<void> => {
  const trustedUntil = new Date(Date.now() + TRUST_DURATION_MS);

  // Upsert — if device exists, update; otherwise insert
  const [existing] = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.fingerprint, fingerprint),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(trustedDevices)
      .set({
        trustedUntil,
        lastSeenAt: new Date(),
        ipAddress: meta.ipAddress ?? existing.ipAddress,
        userAgent: meta.userAgent ?? existing.userAgent,
      })
      .where(eq(trustedDevices.id, existing.id));
  } else {
    await db.insert(trustedDevices).values({
      userId,
      fingerprint,
      label: meta.label ?? null,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      trustedUntil,
      lastSeenAt: new Date(),
    });
  }
};

// ── Revoke a trusted device ─────────────────────────────────────────────────

export const revokeTrustedDevice = async (
  userId: number,
  deviceId: number,
): Promise<void> => {
  await db
    .delete(trustedDevices)
    .where(
      and(
        eq(trustedDevices.id, deviceId),
        eq(trustedDevices.userId, userId),
      ),
    );

  await logSecurityEvent(SECURITY_EVENTS.TRUSTED_DEVICE_REVOKED, {
    actorId: userId,
    entityType: "trusted_devices",
    entityId: String(deviceId),
  });
};

// ── Revoke all trusted devices (for account takeover recovery) ──────────────

export const revokeAllTrustedDevices = async (userId: number): Promise<void> => {
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));

  await logSecurityEvent(SECURITY_EVENTS.ALL_TRUSTED_DEVICES_REVOKED, {
    actorId: userId,
    entityType: "trusted_devices",
    entityId: "all",
  });
};

// ── List all trusted devices (for user settings page) ───────────────────────

export const listTrustedDevices = async (userId: number) => {
  return db
    .select()
    .from(trustedDevices)
    .where(eq(trustedDevices.userId, userId))
    .orderBy(trustedDevices.lastSeenAt);
};

// ── Cleanup expired trusted devices (cron) ──────────────────────────────────

export const cleanupExpiredTrustedDevices = async (): Promise<number> => {
  const result = await db
    .delete(trustedDevices)
    .where(lt(trustedDevices.trustedUntil, new Date()))
    .returning({ id: trustedDevices.id });
  return result.length;
};
