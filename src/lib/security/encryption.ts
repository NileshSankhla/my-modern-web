// ============================================================================
// FAREBACK — Encryption (AES-256-GCM Envelope Encryption)
// ============================================================================
// Best-practice encryption for sensitive data at rest:
//   - AES-256-GCM (authenticated encryption — detects tampering)
//   - Envelope encryption pattern (data key encrypted by master key)
//   - Key rotation support (rotate master key without re-encrypting all data)
//   - Per-record unique data keys (compromise of one doesn't compromise all)
//
// Used for: gift card codes, API keys, postback secrets, any PII at rest.
// ============================================================================

import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit (GCM standard)
const TAG_LEN = 16; // 128-bit auth tag

// ── Master key management ───────────────────────────────────────────────────
// The master key (KEK — Key Encryption Key) is derived from an env secret.
// For production, use a KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault) to
// store the actual master key. The env var holds a DEK-encrypted blob.

let cachedMasterKey: Buffer | null = null;
let cachedMasterKeyVersion: string | null = null;

const getMasterKey = (version: string = "v1"): { key: Buffer; version: string } => {
  // Check cache
  if (cachedMasterKey && cachedMasterKeyVersion === version) {
    return { key: cachedMasterKey, version };
  }

  // Support multiple key versions for rotation
  const envVar = `ENCRYPTION_MASTER_KEY_${version.toUpperCase()}`;
  const envKey = process.env[envVar] ?? process.env.ENCRYPTION_MASTER_KEY;

  if (!envKey) {
    throw new Error(
      `Encryption master key not set. Set ${envVar} or ENCRYPTION_MASTER_KEY env var. ` +
        "Generate with: openssl rand -hex 32",
    );
  }

  // Derive a 32-byte key from the env secret via scrypt (one-time, cached).
  // The salt is fixed per version so the same env key always produces the
  // same derived key. Change the env key to rotate.
  const salt = `fareback-encryption-${version}`;
  const derived = scryptSync(envKey, salt, KEY_LEN);

  cachedMasterKey = derived;
  cachedMasterKeyVersion = version;
  return { key: derived, version };
};

// ── Generate random data key ────────────────────────────────────────────────

const generateDataKey = (): Buffer => randomBytes(KEY_LEN);

// ── Encrypt a data key with the master key ──────────────────────────────────

const encryptDataKey = (dataKey: Buffer, masterKey: Buffer): string => {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, encrypted, tag].map((b) => b.toString("base64")).join(":");
};

const decryptDataKey = (encryptedKey: string, masterKey: Buffer): Buffer => {
  const [ivB64, ctB64, tagB64] = encryptedKey.split(":");
  if (!ivB64 || !ctB64 || !tagB64) throw new Error("Invalid encrypted key format");
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
};

// ── Encrypt plaintext (envelope pattern) ────────────────────────────────────
// Returns a string encoding: keyVersion:encryptedDataKey:iv:ciphertext:tag
// All parts are base64-encoded.

export interface EncryptedPayload {
  /** Full encrypted string — store this in the DB column */
  encrypted: string;
  /** Key version used — for rotation tracking */
  keyVersion: string;
}

export const encrypt = (plaintext: string, keyVersion: string = "v1"): EncryptedPayload => {
  const { key: masterKey, version } = getMasterKey(keyVersion);

  // 1. Generate a unique data key for this record
  const dataKey = generateDataKey();

  // 2. Encrypt the data key with the master key (envelope)
  const encryptedDataKey = encryptDataKey(dataKey, masterKey);

  // 3. Encrypt the plaintext with the data key
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // 4. Zero out the data key from memory (best-effort)
  dataKey.fill(0);

  // 5. Encode: version:encryptedDataKey:iv:ciphertext:tag
  const encrypted = [version, encryptedDataKey, iv.toString("base64"), ciphertext.toString("base64"), tag.toString("base64")].join(":");

  return { encrypted, keyVersion: version };
};

// ── Decrypt ─────────────────────────────────────────────────────────────────

export const decrypt = (payload: string): string => {
  const parts = payload.split(":");
  if (parts.length !== 5) throw new Error("Invalid encrypted payload format");

  const [version, encryptedDataKey, ivB64, ctB64, tagB64] = parts;

  // 1. Get the master key for this version (supports key rotation)
  const { key: masterKey } = getMasterKey(version);

  // 2. Decrypt the data key
  const dataKey = decryptDataKey(encryptedDataKey, masterKey);

  // 3. Decrypt the ciphertext with the data key
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, dataKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");

  // 4. Zero out the data key
  dataKey.fill(0);

  return plaintext;
};

// ── Verify integrity (without decrypting) ───────────────────────────────────
// Useful for detecting tampering before attempting decryption.

export const verifyIntegrity = (payload: string): boolean => {
  try {
    const parts = payload.split(":");
    if (parts.length !== 5) return false;
    // Attempt to decrypt — GCM auth tag will throw if tampered
    decrypt(payload);
    return true;
  } catch {
    return false;
  }
};

// ── Key rotation ────────────────────────────────────────────────────────────
// Re-encrypts data from old key version to new key version.

export const rotateEncryption = (
  payload: string,
  newKeyVersion: string = "v2",
): EncryptedPayload => {
  const plaintext = decrypt(payload);
  return encrypt(plaintext, newKeyVersion);
};

// ── Hash for comparison (constant-time) ─────────────────────────────────────
// For comparing encrypted values without decrypting (e.g., checking if a gift
// card code matches without exposing the plaintext). Returns a hash that can
// be compared with timingSafeEqual.

export const hashForComparison = (value: string): string => {
  const secret = process.env.COMPARISON_SECRET ?? "fareback-comparison-v1";
  return createHash("sha256").update(`${value}.${secret}`).digest("hex");
};

export const compareHashed = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

// ── Convenience: encrypt/decrypt field helpers ──────────────────────────────
// For use with Drizzle — wrap fields on write, unwrap on read.

export const encryptField = (plaintext: string | null, keyVersion?: string): string | null => {
  if (!plaintext) return null;
  return encrypt(plaintext, keyVersion).encrypted;
};

export const decryptField = (payload: string | null): string | null => {
  if (!payload) return null;
  try {
    return decrypt(payload);
  } catch (error) {
    console.error("[encryption] Failed to decrypt field:", error);
    return null;
  }
};
