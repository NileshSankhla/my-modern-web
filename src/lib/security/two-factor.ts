// ============================================================================
// FAREBACK — Two-Factor Authentication (TOTP — RFC 6238)
// ============================================================================
// Time-based One-Time Password using the standard TOTP algorithm (RFC 6238).
// Compatible with Google Authenticator, Authy, 1Password, etc.
//
// Features:
//   - Secret generation (160-bit, Base32 encoded)
//   - QR code URI generation (otpauth://)
//   - TOTP verification with ±1 time step tolerance
//   - Backup codes (single-use, hashed at rest)
//   - Trusted device tracking (skip 2FA for known devices)
// ============================================================================

import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { logSecurityEvent, SECURITY_EVENTS } from "./audit";

// ── Base32 encoding (RFC 4648) ──────────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (str: string): Buffer => {
  const cleaned = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

// ── Generate TOTP secret ────────────────────────────────────────────────────

export const generateTOTPSecret = (): { secret: Buffer; base32: string } => {
  const secret = randomBytes(20); // 160-bit
  return { secret, base32: base32Encode(secret) };
};

// ── Generate otpauth:// URI (for QR codes) ──────────────────────────────────

export const generateTOTPUri = (
  secretBase32: string,
  email: string,
  issuer: string = "Fareback",
): string => {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

// ── Generate TOTP code (for verification) ───────────────────────────────────

const generateTOTP = (secret: Buffer, timeStep: number = 30): string => {
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const buffer = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
};

// ── Verify TOTP code (with ±1 time step tolerance) ──────────────────────────

export const verifyTOTP = (
  secret: Buffer,
  token: string,
  window: number = 1,
): boolean => {
  if (!/^\d{6}$/.test(token)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / 30);

  for (let i = -window; i <= window; i++) {
    const testCounter = currentCounter + i;
    const testBuffer = Buffer.alloc(8);
    testBuffer.writeBigUInt64BE(BigInt(testCounter));
    const hmac = createHmac("sha1", secret).update(testBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) %
      1000000;
    const expectedToken = code.toString().padStart(6, "0");

    if (timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return true;
    }
  }

  return false;
};

// ── Store TOTP secret (encrypted at rest) ───────────────────────────────────

export const storeTOTPSecret = async (userId: number, secret: Buffer): Promise<void> => {
  const encrypted = encrypt(secret.toString("base64"));
  await db
    .update(users)
    .set({
      twoFactorSecret: encrypted.encrypted,
      twoFactorEnabled: true,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));

  await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_ENABLED, {
    actorId: userId,
    entityType: "users",
    entityId: String(userId),
  });
};

// ── Get TOTP secret (decrypted) ─────────────────────────────────────────────

export const getTOTPSecret = async (userId: number): Promise<Buffer | null> => {
  const [user] = await db
    .select({ twoFactorSecret: (users as any).twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.twoFactorSecret) return null;

  try {
    const decrypted = decrypt(user.twoFactorSecret);
    return Buffer.from(decrypted, "base64");
  } catch {
    return null;
  }
};

// ── Disable 2FA ─────────────────────────────────────────────────────────────

export const disable2FA = async (userId: number): Promise<void> => {
  await db
    .update(users)
    .set({
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));

  await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_DISABLED, {
    actorId: userId,
    entityType: "users",
    entityId: String(userId),
  });
};

// ── Backup codes ────────────────────────────────────────────────────────────
// Generate 10 single-use backup codes. Store them hashed (sha256) at rest.
// Show the plaintext codes to the user ONCE on generation.

export const generateBackupCodes = async (
  userId: number,
): Promise<string[]> => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }

  // Hash each code for storage
  const { createHash } = await import("node:crypto");
  const hashedCodes = codes.map((c) =>
    createHash("sha256").update(c).digest("hex"),
  );

  await db
    .update(users)
    .set({
      twoFactorBackupCodes: JSON.stringify(hashedCodes),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));

  return codes;
};

// ── Verify backup code (consumes it on use) ─────────────────────────────────

export const verifyBackupCode = async (
  userId: number,
  code: string,
): Promise<boolean> => {
  const [user] = await db
    .select({ backupCodes: (users as any).twoFactorBackupCodes })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.backupCodes) return false;

  const { createHash } = await import("node:crypto");
  const hashedInput = createHash("sha256").update(code).digest("hex");

  const stored: string[] = JSON.parse(user.backupCodes);
  const idx = stored.indexOf(hashedInput);
  if (idx === -1) return false;

  // Remove the used code
  stored.splice(idx, 1);
  await db
    .update(users)
    .set({
      twoFactorBackupCodes: JSON.stringify(stored),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));

  await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_BACKUP_CODE_USED, {
    actorId: userId,
    entityType: "users",
    entityId: String(userId),
    metadata: { remainingCodes: stored.length },
  });

  return true;
};

// ── Verify 2FA (TOTP or backup code) ────────────────────────────────────────

export const verify2FA = async (
  userId: number,
  token: string,
): Promise<{ success: boolean; method?: "totp" | "backup" }> => {
  // Try TOTP first
  const secret = await getTOTPSecret(userId);
  if (secret) {
    if (verifyTOTP(secret, token)) {
      await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_VERIFY_SUCCESS, {
        actorId: userId,
        metadata: { method: "totp" },
      });
      return { success: true, method: "totp" };
    }
  }

  // Try backup code (format: XXXXX-XXXXX)
  if (/^[A-F0-9]{5}-[A-F0-9]{5}$/.test(token.toUpperCase())) {
    if (await verifyBackupCode(userId, token.toUpperCase())) {
      return { success: true, method: "backup" };
    }
  }

  await logSecurityEvent(SECURITY_EVENTS.TWO_FACTOR_VERIFY_FAILED, {
    actorId: userId,
    metadata: { tokenProvided: token.substring(0, 2) + "****" },
  });

  return { success: false };
};
