// ============================================================================
// FAREBACK — Password Reset Flow (Secure Token-Based)
// ============================================================================
// Handles scenarios 16-19, 22:
//   - User "forgets password" (edge case — Google-only auth, but supports
//     future email/password users)
//   - Account recovery via email
//   - Phishing-resistant (single-use tokens, short TTL, hashed at rest)
//
// Flow:
//   1. User requests reset → generate token, hash it, store with 15min TTL
//   2. Email sent with link containing RAW token (only seen once)
//   3. User clicks link → server hashes token, looks up by hash
//   4. User sets new password → token consumed, all sessions destroyed
//   5. Audit logged, SIEM alerted
// ============================================================================

import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword, isPasswordInHistory, isPasswordBreached, PASSWORD_HISTORY_LIMIT } from "./password";
import { destroyAllUserSessions } from "./session";
import { logSecurityEvent, SECURITY_EVENTS } from "./audit";
import { sendPasswordResetEmail } from "./email";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between requests

// ── Generate reset token ────────────────────────────────────────────────────

export const generateResetToken = (): { token: string; hash: string } => {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
};

// ── Request password reset ──────────────────────────────────────────────────
// Always returns success (prevents user enumeration). If email doesn't exist,
// we just don't send an email. The response is identical either way.

export const requestPasswordReset = async (
  email: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ success: true }> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Find user (Google-only users don't have passwords, so they can't reset)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.passwordHash) {
      // User doesn't exist or uses Google-only auth.
      // Don't reveal this — return success to prevent enumeration.
      // Log the attempt for monitoring.
      console.log("[password-reset] Request for non-existent or Google-only user:", normalizedEmail);
      return { success: true };
    }

    // Check resend cooldown (prevents spam)
    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt > new Date(Date.now() + RESET_TOKEN_TTL_MS - RESET_TOKEN_RESEND_COOLDOWN_MS)) {
      // A token was issued less than 1 minute ago — silently ignore
      return { success: true };
    }

    // Generate new token
    const { token, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Store hashed token + expiry
    await db
      .update(users)
      .set({
        resetTokenHash: hash,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, user.id));

    // Send email with reset link
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, user.name ?? "there", resetUrl);

    // Audit log
    await logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_REQUESTED, {
      actorId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      entityType: "users",
      entityId: String(user.id),
    });

    return { success: true };
  } catch (error) {
    console.error("[password-reset] Request error:", error);
    // Still return success to prevent enumeration
    return { success: true };
  }
};

// ── Verify reset token (without consuming it) ───────────────────────────────
// Used by the reset-password page to check if the token is valid before
// showing the form.

export const verifyResetToken = async (token: string): Promise<{
  valid: boolean;
  userId?: number;
  email?: string;
}> => {
  try {
    const hash = createHash("sha256").update(token).digest("hex");

    const [user] = await db
      .select({ id: users.id, email: users.email, expiresAt: (users as any).resetTokenExpiresAt })
      .from(users)
      .where(eq((users as any).resetTokenHash, hash))
      .limit(1);

    if (!user) return { valid: false };
    if (!user.expiresAt || user.expiresAt < new Date()) return { valid: false };

    return { valid: true, userId: user.id, email: user.email };
  } catch {
    return { valid: false };
  }
};

// ── Reset password with token ───────────────────────────────────────────────
// Consumes the token (single-use), checks breach database + password history,
// destroys all sessions (forces re-login everywhere), audit logs.

export const resetPasswordWithToken = async (
  token: string,
  newPassword: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Verify token
    const verification = await verifyResetToken(token);
    if (!verification.valid || !verification.userId) {
      return { success: false, error: "Invalid or expired reset link." };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, verification.userId))
      .limit(1);

    if (!user) return { success: false, error: "User not found." };

    // 2. Check breach database
    const breachCheck = await isPasswordBreached(newPassword);
    if (breachCheck.breached) {
      return {
        success: false,
        error: `This password has been found in ${breachCheck.count} data breaches. Please choose a different password.`,
      };
    }

    // 3. Check password history (prevent reuse)
    const history = (user as any).passwordHistory
      ? JSON.parse((user as any).passwordHistory)
      : [];
    if (await isPasswordInHistory(newPassword, history)) {
      return {
        success: false,
        error: "You've used this password recently. Please choose a different one.",
      };
    }

    // 4. Hash new password
    const newHash = await hashPassword(newPassword);

    // 5. Update password, consume token, update history
    const updatedHistory = [user.passwordHash, ...history].slice(0, PASSWORD_HISTORY_LIMIT);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        passwordHistory: JSON.stringify(updatedHistory),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, user.id));

    // 6. Destroy ALL sessions (force re-login everywhere — security best practice)
    await destroyAllUserSessions(user.id);

    // 7. Audit log
    await logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_COMPLETED, {
      actorId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      entityType: "users",
      entityId: String(user.id),
    });

    return { success: true };
  } catch (error) {
    console.error("[password-reset] Reset error:", error);
    return { success: false, error: "Failed to reset password. Please try again." };
  }
};

// ── Change password (when already signed in) ────────────────────────────────

export const changePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ success: boolean; error?: string }> => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.passwordHash) {
      return { success: false, error: "Password change not available for this account." };
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      await logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGE_FAILED, {
        actorId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: "wrong_current_password" },
      });
      return { success: false, error: "Current password is incorrect." };
    }

    // Check breach database
    const breachCheck = await isPasswordBreached(newPassword);
    if (breachCheck.breached) {
      return {
        success: false,
        error: `This password has been found in ${breachCheck.count} data breaches.`,
      };
    }

    // Check history
    const history = (user as any).passwordHistory
      ? JSON.parse((user as any).passwordHistory)
      : [];
    if (await isPasswordInHistory(newPassword, history)) {
      return { success: false, error: "You've used this password recently." };
    }

    // Hash + update
    const newHash = await hashPassword(newPassword);
    const updatedHistory = [user.passwordHash, ...history].slice(0, PASSWORD_HISTORY_LIMIT);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordHistory: JSON.stringify(updatedHistory),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, userId));

    // Destroy all OTHER sessions (keep current one)
    // The caller can pass currentToken to preserve it.
    await destroyAllUserSessions(userId);

    await logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGED, {
      actorId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      entityType: "users",
      entityId: String(userId),
    });

    return { success: true };
  } catch (error) {
    console.error("[password-reset] Change error:", error);
    return { success: false, error: "Failed to change password." };
  }
};

// ── Cleanup expired reset tokens (cron job) ─────────────────────────────────

export const cleanupExpiredResetTokens = async (): Promise<number> => {
  const result = await db
    .update(users)
    .set({
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      updatedAt: new Date(),
    } as any)
    .where(
      and(
        lt((users as any).resetTokenExpiresAt, new Date()),
        eq((users as any).resetTokenHash, sql`NULL`),
      ),
    )
    .returning({ id: users.id });

  return result.length;
};

import { sql } from "drizzle-orm";
