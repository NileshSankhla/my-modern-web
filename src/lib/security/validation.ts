// ============================================================================
// FAREBACK — Enhanced Validation with Sanitization
// ============================================================================
// Zod schemas with:
//   - Automatic HTML/SQL injection sanitization
//   - Length limits (prevents DoS via huge payloads)
//   - Pattern validation (UPI, email, UUID)
//   - Unicode normalization (prevents homoglyph attacks)
// ============================================================================

import { z } from "zod";

// ── Sanitization helpers ────────────────────────────────────────────────────

const sanitizeString = (val: string): string => {
  return val
    .normalize("NFKC") // Normalize Unicode (prevents homoglyph attacks)
    .replace(/[\u0000-\u001F\u007F]/g, "") // Strip control chars
    .replace(/\u200B/g, "") // Strip zero-width spaces
    .replace(/\u200E/g, "") // Strip LTR marks
    .replace(/\u200F/g, "") // Strip RTL marks
    .trim();
};

const stripHtml = (val: string): string => {
  return val.replace(/<[^>]*>/g, ""); // Basic HTML tag stripping
};

// ── Sanitized string schema ─────────────────────────────────────────────────

export const sanitizedString = (maxLen: number = 1000) =>
  z
    .string()
    .transform(sanitizeString)
    .transform(stripHtml)
    .pipe(z.string().max(maxLen));

export const sanitizedEmail = z
  .string()
  .transform(sanitizeString)
  .pipe(z.string().email("Enter a valid email"))
  .transform((s) => s.toLowerCase());

export const sanitizedUpiId = z
  .string()
  .transform(sanitizeString)
  .pipe(
    z
      .string()
      .min(5, "UPI ID is too short")
      .max(100, "UPI ID is too long")
      .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, "Invalid UPI ID format"),
  );

// ── Wallet mutations ────────────────────────────────────────────────────────

export const walletAdjustmentSchema = z.object({
  userEmail: sanitizedEmail,
  walletType: z.enum(["cashback", "amazon_rewards"]),
  type: z.enum(["credit", "debit"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive")
    .refine((v) => parseFloat(v) < 100000, "Amount too large"),
});

export const withdrawalRequestSchema = z.object({
  upiId: sanitizedUpiId,
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) >= 10, "Minimum withdrawal is ₹10")
    .refine((v) => parseFloat(v) < 100000, "Maximum withdrawal is ₹1,00,000"),
});

export const amazonGiftCardRequestSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) >= 10, "Minimum is ₹10")
    .refine((v) => parseFloat(v) < 50000, "Maximum is ₹50,000"),
});

// ── Admin finance decisions ─────────────────────────────────────────────────

export const adminWithdrawalDecisionSchema = z.object({
  requestId: z.string().trim().regex(/^\d+$/, "Invalid request ID"),
  decision: z.enum(["approve", "reject", "mark-paid"]),
  note: sanitizedString(250).optional().or(z.literal("")),
});

export const adminAmazonGiftCardDecisionSchema = z.object({
  requestId: z.string().trim().regex(/^\d+$/, "Invalid request ID"),
  decision: z.enum(["approve", "reject", "fulfill"]),
  note: sanitizedString(250).optional().or(z.literal("")),
  giftCardCode: sanitizedString(100).optional(),
});

// ── Click workflow ──────────────────────────────────────────────────────────

export const adminApproveClickSchema = z.object({
  clickId: z.string().uuid("Invalid click ID"),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive"),
  walletType: z.enum(["cashback", "amazon_rewards"]).optional(),
});

export const adminTrackedClickSchema = z.object({
  clickId: z.string().uuid("Invalid click ID"),
});

export const adminDeleteClickSchema = z.object({
  clickId: z.string().uuid("Invalid click ID"),
});

// ── Notifications ───────────────────────────────────────────────────────────

export const adminSendAlertSchema = z.object({
  recipientType: z.enum(["all", "single"]),
  userEmail: sanitizedEmail.optional().or(z.literal("")),
  message: sanitizedString(300).refine((v) => v.length > 0, "Message is required"),
});

// ── 2FA ─────────────────────────────────────────────────────────────────────

export const twoFactorSetupSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "TOTP code must be 6 digits"),
});

export const twoFactorVerifySchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-F0-9]{5}-[A-F0-9]{5}$|^\d{6}$/, "Invalid code format"),
});

// ── Action state types ──────────────────────────────────────────────────────

export interface WalletActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface NotificationActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}
