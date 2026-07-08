// ============================================================================
// FAREBACK — Email Service (Resend — free 3000/month)
// ============================================================================
// All transactional emails:
//   - Password reset
//   - Email verification
//   - 2FA enabled/disabled notifications
//   - Security alerts (suspicious login, role change)
//   - Welcome email
// ============================================================================

import "server-only";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL ?? "Fareback <support@fareback.in>";
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

// ── Helper: send email (silent fail if not configured) ─────────────────────

const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  if (!resendClient) {
    console.warn("[email] Resend not configured — skipping email to:", to);
    return false;
  }
  try {
    const { error } = await resendClient.emails.send({
      from: resendFrom,
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.error("[email] Send error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Send failed:", error);
    return false;
  }
};

// ── Password reset email ────────────────────────────────────────────────────

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string,
): Promise<boolean> => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #7c3aed; font-size: 24px; font-weight: 800; margin: 0;">Fareback</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 20px;">Reset your password</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">
        We received a request to reset your Fareback password. Click the button below
        to set a new password. This link expires in <strong>15 minutes</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background: #7c3aed; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        If you didn't request this, you can safely ignore this email. Your password
        has not been changed.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        Fareback · India's rewards community<br/>
        This is an automated email — please don't reply.
      </p>
    </div>
  `;
  return sendEmail(email, "Reset your Fareback password", html);
};

// ── Email verification ──────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verifyUrl: string,
): Promise<boolean> => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #7c3aed; font-size: 24px; font-weight: 800; margin: 0;">Fareback</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 20px;">Verify your email</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">
        Welcome to Fareback! Please verify your email address to complete your account setup.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="background: #7c3aed; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours.</p>
    </div>
  `;
  return sendEmail(email, "Verify your Fareback email", html);
};

// ── Security alert: suspicious login ────────────────────────────────────────

export const sendSuspiciousLoginAlert = async (
  email: string,
  name: string,
  details: { browser: string; os: string; location: string; time: string },
): Promise<boolean> => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #dc2626; font-size: 20px;">⚠️ Suspicious login detected</h1>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">
        We detected a login to your Fareback account from an unrecognized device.
      </p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <p style="margin: 4px 0; color: #7f1d1d;"><strong>Browser:</strong> ${details.browser}</p>
        <p style="margin: 4px 0; color: #7f1d1d;"><strong>OS:</strong> ${details.os}</p>
        <p style="margin: 4px 0; color: #7f1d1d;"><strong>Location:</strong> ${details.location}</p>
        <p style="margin: 4px 0; color: #7f1d1d;"><strong>Time:</strong> ${details.time}</p>
      </div>
      <p style="color: #475569; line-height: 1.6;">
        If this was you, no action needed. If not, please:
      </p>
      <ol style="color: #475569; line-height: 1.8;">
        <li>Change your password immediately</li>
        <li>Review your active sessions</li>
        <li>Enable 2FA if you haven't already</li>
      </ol>
    </div>
  `;
  return sendEmail(email, "⚠️ Suspicious login on your Fareback account", html);
};

// ── Security alert: 2FA disabled ────────────────────────────────────────────

export const send2FADisabledAlert = async (
  email: string,
  name: string,
): Promise<boolean> => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #dc2626; font-size: 20px;">2FA disabled</h1>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">
        Two-factor authentication has been disabled on your Fareback account.
        If you didn't do this, your account may be compromised.
      </p>
      <p style="color: #475569; line-height: 1.6;">
        Please sign in and review your security settings immediately.
      </p>
    </div>
  `;
  return sendEmail(email, "2FA disabled on your Fareback account", html);
};

// ── Welcome email ───────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (
  email: string,
  name: string,
): Promise<boolean> => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #7c3aed; font-size: 24px; font-weight: 800; margin: 0;">Fareback</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 20px;">Welcome to Fareback! 🎉</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">
        Thanks for joining Fareback — India's rewards community. Start earning
        rewards on your everyday shopping across your favorite stores.
      </p>
      <div style="background: #f5f3ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #7c3aed; font-weight: 600;">Get started:</p>
        <ol style="color: #475569; line-height: 1.8; margin: 8px 0 0 0;">
          <li>Browse stores on your dashboard</li>
          <li>Shop via Fareback links</li>
          <li>Earn rewards on every purchase</li>
        </ol>
      </div>
    </div>
  `;
  return sendEmail(email, "Welcome to Fareback! 🎉", html);
};
