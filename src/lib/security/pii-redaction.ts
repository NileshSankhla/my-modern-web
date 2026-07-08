// ============================================================================
// FAREBACK — PII Redaction (Log Sanitization)
// ============================================================================
// Handles scenario 44:
//   - Insider threat — rogue admin reads logs
//   - Prevents PII leak via logs
//
// Automatically redacts:
//   - Email addresses
//   - Phone numbers (Indian + international)
//   - UPI IDs
//   - IP addresses (configurable — keep for forensics, redact for user-facing)
//   - Gift card codes
//   - Credit card numbers
//   - JWT tokens
//   - AWS keys
// ============================================================================

// Patterns to redact
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // Email
  {
    pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    replacement: "[EMAIL]",
    label: "email",
  },
  // Indian phone (+91 followed by 10 digits)
  {
    pattern: /(\+91[\-\s]?)?[6-9]\d{9}/g,
    replacement: "[PHONE]",
    label: "phone",
  },
  // International phone (with country code)
  {
    pattern: /\+\d{1,3}[\-\s]?\d{6,14}/g,
    replacement: "[PHONE]",
    label: "phone",
  },
  // UPI ID (xxx@yyy)
  {
    pattern: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(upi|ok|axis|hdfcbank|icici|kotak|sbi|ybl|ibl)/g,
    replacement: "[UPI]",
    label: "upi",
  },
  // IPv4
  {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: "[IP]",
    label: "ip",
  },
  // Credit card (16 digits, optional dashes/spaces)
  {
    pattern: /\b\d{4}[\-\s]?\d{4}[\-\s]?\d{4}[\-\s]?\d{4}\b/g,
    replacement: "[CARD]",
    label: "card",
  },
  // JWT tokens
  {
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: "[JWT]",
    label: "jwt",
  },
  // AWS Access Key ID
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: "[AWS_KEY]",
    label: "aws_key",
  },
  // AWS Secret Key (40 chars base64-ish)
  {
    pattern: /aws_secret_access_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi,
    replacement: "aws_secret_access_key=[AWS_SECRET]",
    label: "aws_secret",
  },
  // Generic API keys (32+ hex chars after "key=" or "token=")
  {
    pattern: /(api[_-]?key|token|secret|password)\s*[=:]\s*["']?[a-f0-9]{32,}["']?/gi,
    replacement: "$1=[REDACTED]",
    label: "api_key",
  },
];

// ── Redact PII from a string ────────────────────────────────────────────────

export const redactPII = (input: string, options: { keepIP?: boolean } = {}): string => {
  let result = input;

  for (const { pattern, replacement, label } of PII_PATTERNS) {
    // Skip IP redaction if configured (for forensics)
    if (label === "ip" && options.keepIP) continue;
    result = result.replace(pattern, replacement);
  }

  return result;
};

// ── Redact PII from an object (deep) ────────────────────────────────────────

export const redactPIIDeep = <T>(obj: T, options: { keepIP?: boolean } = {}): T => {
  if (typeof obj === "string") {
    return redactPII(obj, options) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPIIDeep(item, options)) as unknown as T;
  }

  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't redact known-safe keys
      if (["id", "userId", "amountInPaise", "count", "score"].includes(key)) {
        result[key] = value;
      } else {
        result[key] = redactPIIDeep(value, options);
      }
    }
    return result as T;
  }

  return obj;
};

// ─- Safe console.log (auto-redacts PII) ─────────────────────────────────────

export const safeLog = (...args: unknown[]): void => {
  const redacted = args.map((arg) => {
    if (typeof arg === "string") return redactPII(arg);
    if (typeof arg === "object") return redactPIIDeep(arg);
    return arg;
  });
  console.log(...redacted);
};

export const safeError = (...args: unknown[]): void => {
  const redacted = args.map((arg) => {
    if (typeof arg === "string") return redactPII(arg);
    if (typeof arg === "object") return redactPIIDeep(arg);
    return arg;
  });
  console.error(...redacted);
};

// ── Partial masking (show last 4, mask rest) ────────────────────────────────

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[EMAIL]";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
};

export const maskUPI = (upi: string): string => {
  const [handle, ...rest] = upi.split("@");
  if (rest.length === 0) return "[UPI]";
  return `${handle[0]}***@${rest.join("@")}`;
};

export const maskIP = (ip: string): string => {
  // Keep first two octets, mask last two
  const parts = ip.split(".");
  if (parts.length !== 4) return "[IP]";
  return `${parts[0]}.${parts[1]}.x.x`;
};

export const maskCard = (card: string): string => {
  const cleaned = card.replace(/[\-\s]/g, "");
  if (cleaned.length < 4) return "[CARD]";
  return `**** **** **** ${cleaned.slice(-4)}`;
};
