/**
 * Data Guard Service
 * Blocks or warns when sensitive/confidential data is about to
 * leave the device (sent to external APIs like Google).
 */

const BLOCKED_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /\b[A-Z0-9]{20,}\b/,
];

const WARNING_PATTERNS = [
  /confidential/i,
  /internal\s+only/i,
  /do\s+not\s+(share|distribute)/i,
  /proprietary/i,
  /trade\s+secret/i,
  /under\s+nda/i,
  /merger/i,
  /acquisition/i,
  /revenue/i,
  /salary/i,
  /termination/i,
  /lawsuit/i,
  /patient/i,
  /diagnosis/i,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scanBeforeSending(text) {
  if (!text || !text.trim()) {
    return { safe: true, level: "safe", reason: "", cleaned: text };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        level: "blocked",
        reason: "Contains sensitive data (passwords, keys, or personal IDs)",
        cleaned: redactText(text),
      };
    }
  }

  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: true,
        level: "warning",
        reason: "May contain confidential business information",
        cleaned: text,
      };
    }
  }

  if (EMAIL_PATTERN.test(text)) {
    return {
      safe: true,
      level: "warning",
      reason: "Contains email addresses",
      cleaned: text.replace(EMAIL_PATTERN, "[email]"),
    };
  }

  return { safe: true, level: "safe", reason: "", cleaned: text };
}

function redactText(text) {
  let redacted = text;
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]");
  redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD-REDACTED]");
  redacted = redacted.replace(/(password|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
  redacted = redacted.replace(EMAIL_PATTERN, "[EMAIL-REDACTED]");
  return redacted;
}