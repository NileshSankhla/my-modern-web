// ============================================================================
// FAREBACK — File Upload Security (Bill/Receipt Uploads)
// ============================================================================
// Handles scenario 37:
//   - User uploads malicious SVG as bill
//   - Prevents file type spoofing
//   - Strips EXIF metadata
//   - Virus scanning hook (ClamAV — free, optional)
//
// Bill uploads are stored as static files. Security measures:
//   - Magic number validation (not just extension)
//   - File size limits
//   - Filename sanitization
//   - EXIF stripping (privacy)
//   - Serve from separate domain (prevents XSS)
// ============================================================================

import "server-only";
import { createHash } from "node:crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Magic numbers (file signatures) — verify actual content, not just extension
const MAGIC_NUMBERS: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  sanitizedFilename?: string;
}

// ── Validate uploaded file ──────────────────────────────────────────────────

export const validateFileUpload = (
  file: { name: string; type: string; size: number; buffer: Buffer },
): FileValidationResult => {
  // 1. Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large. Maximum 5 MB." };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  // 2. Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Use JPEG, PNG, WebP, or PDF.`,
    };
  }

  // 3. Verify magic number (prevents extension spoofing)
  const expectedMagic = MAGIC_NUMBERS[file.type];
  if (expectedMagic) {
    const actualMagic = Array.from(file.buffer.slice(0, expectedMagic.length));
    if (!expectedMagic.every((byte, i) => actualMagic[i] === byte)) {
      return {
        valid: false,
        error: "File content doesn't match its type. Possible spoofing attempt.",
      };
    }
  }

  // 4. Sanitize filename (prevent path traversal, XSS via filename)
  const sanitizedFilename = sanitizeFilename(file.name);

  return { valid: true, mimeType: file.type, sanitizedFilename };
};

// ── Sanitize filename ───────────────────────────────────────────────────────

const sanitizeFilename = (filename: string): string => {
  // Remove path components (prevent directory traversal)
  const basename = filename.split(/[\/\\]/).pop() ?? filename;

  // Remove or replace dangerous characters
  const cleaned = basename
    .replace(/[<>"'&;|`$]/g, "_") // Shell-injection chars
    .replace(/\.\./g, "_") // Path traversal
    .replace(/[^\w.\-]/g, "_") // Only word chars, dots, hyphens
    .slice(0, 100); // Max length

  // Ensure it has an allowed extension
  const ext = cleaned.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "pdf"];
  if (!ext || !allowedExtensions.includes(ext)) {
    return `${cleaned}.jpg`; // Default to .jpg
  }

  return cleaned;
};

// ── Generate safe storage key ───────────────────────────────────────────────
// Use a hash-based filename to prevent enumeration and collisions.

export const generateStorageKey = (
  userId: number,
  originalFilename: string,
  buffer: Buffer,
): string => {
  const hash = createHash("sha256")
    .update(`${userId}-${originalFilename}-${Date.now()}-${buffer.length}`)
    .digest("hex")
    .substring(0, 32);

  const ext = originalFilename.split(".").pop()?.toLowerCase() ?? "jpg";
  const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `bills/${datePrefix}/${userId}-${hash}.${ext}`;
};

// ── Strip EXIF metadata from images ─────────────────────────────────────────
// EXIF can contain GPS coordinates, device info, etc.

export const stripExifMetadata = async (
  buffer: Buffer,
  mimeType: string,
): Promise<Buffer> => {
  if (mimeType === "image/jpeg") {
    // JPEG EXIF starts with 0xFF 0xE1
    // For production, use a proper library like `piexifjs` or `sharp`
    // This is a simplified version that strips the APP1 marker
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[3] === 0xe1) {
      // Find end of EXIF block
      const exifLength = buffer.readUInt16BE(4);
      return Buffer.concat([
        buffer.slice(0, 2), // SOI
        buffer.slice(2, 4), // marker
        buffer.slice(4 + exifLength + 2), // rest of image
      ]);
    }
  }
  // For PNG, WebP, PDF — no simple EXIF stripping without a library.
  // In production, use `sharp` for images.
  return buffer;
};

// ── Optional: virus scanning hook (ClamAV — free, self-hosted) ──────────────

export const scanForViruses = async (buffer: Buffer): Promise<{
  clean: boolean;
  threat?: string;
}> => {
  // If ClamAV is not configured, skip (fail open)
  const clamavUrl = process.env.CLAMAV_URL;
  if (!clamavUrl) {
    return { clean: true };
  }

  try {
    const response = await fetch(`${clamavUrl}/scan`, {
      method: "POST",
      body: new Uint8Array(buffer),
      headers: { "Content-Type": "application/octet-stream" },
    });
    const result = await response.json();
    return {
      clean: result.clean ?? true,
      threat: result.threat,
    };
  } catch (error) {
    console.error("[file-upload] ClamAV scan failed:", error);
    // Fail open — don't block uploads if scanner is down
    return { clean: true };
  }
};
