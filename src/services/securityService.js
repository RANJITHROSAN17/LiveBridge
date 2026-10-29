/**
 * LiveBridge Client Security Utilities
 *
 * Provides browser-side:
 * - Plain-text input normalization
 * - HTML escaping
 * - Client-side rate limiting
 * - Local diagnostic event logging
 * - Session inactivity monitoring
 * - Sensitive-data detection and masking
 *
 * Important:
 * These utilities improve client-side safety and user experience.
 * They do not replace backend authentication, authorization,
 * rate limiting, secure audit logging, encryption, or data
 * protection controls.
 */

// ============================================================
// Configuration
// ============================================================

const DEFAULT_MAX_INPUT_LENGTH = 10000;
const DEFAULT_RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AUDIT_LOGS = 500;
const MAX_AUDIT_DETAIL_LENGTH = 200;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

const VALID_AUDIT_LEVELS = new Set([
  "INFO",
  "WARN",
  "ERROR",
  "CRITICAL",
]);

// ============================================================
// Internal state
// ============================================================

const rateLimits = new Map();

let auditLogs = [];

let activeSessionCleanup = null;
let lastActivity = Date.now();

// ============================================================
// General helpers
// ============================================================

function isBrowserEnvironment() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined"
  );
}

function normalizeString(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function clampPositiveInteger(
  value,
  fallbackValue
) {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
}

/**
 * Removes control characters that are not useful in normal
 * conversation while preserving tabs and line breaks.
 */
function removeUnsafeControlCharacters(text) {
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
}

// ============================================================
// Input handling
// ============================================================

/**
 * Normalizes user input as plain text.
 *
 * React safely escapes text rendered inside normal JSX expressions.
 * Therefore, this function avoids deleting legitimate technical
 * content such as "<script>" from a spoken or translated sentence.
 *
 * This function is not an HTML sanitizer. Never pass its output
 * directly to dangerouslySetInnerHTML.
 *
 * @param {unknown} text
 * @param {number} maximumLength
 * @returns {string}
 */
export function sanitizeInput(
  text,
  maximumLength = DEFAULT_MAX_INPUT_LENGTH
) {
  if (typeof text !== "string") {
    return "";
  }

  const safeMaximumLength =
    clampPositiveInteger(
      maximumLength,
      DEFAULT_MAX_INPUT_LENGTH
    );

  const normalizedText =
    removeUnsafeControlCharacters(text);

  if (
    normalizedText.length <= safeMaximumLength
  ) {
    return normalizedText;
  }

  return normalizedText.slice(
    0,
    safeMaximumLength
  );
}

/**
 * Escapes text for situations where an HTML-encoded string
 * is explicitly required.
 *
 * Do not apply this before translation or speech synthesis,
 * because users could hear or receive encoded entities.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHTML(text) {
  const normalizedText =
    normalizeString(text);

  if (!normalizedText) {
    return "";
  }

  return normalizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// Client-side rate limiting
// ============================================================

/**
 * Checks whether a client-side action is allowed.
 *
 * This is only a browser UX safeguard. Refreshing the page resets
 * this state, so production API rate limiting must run on a backend.
 *
 * @param {string} action
 * @param {number} maxPerMinute
 * @returns {boolean}
 */
export function checkRateLimit(
  action,
  maxPerMinute = DEFAULT_RATE_LIMIT
) {
  const normalizedAction =
    normalizeString(action).trim();

  if (!normalizedAction) {
    auditLog(
      "RATE_LIMIT_INVALID_ACTION",
      "A rate-limit check was attempted without an action name.",
      "WARN"
    );

    return false;
  }

  const safeLimit = clampPositiveInteger(
    maxPerMinute,
    DEFAULT_RATE_LIMIT
  );

  const now = Date.now();

  const existingTimestamps =
    rateLimits.get(normalizedAction) || [];

  const recentTimestamps =
    existingTimestamps.filter(
      (timestamp) =>
        now - timestamp <
        RATE_LIMIT_WINDOW_MS
    );

  if (
    recentTimestamps.length >= safeLimit
  ) {
    rateLimits.set(
      normalizedAction,
      recentTimestamps
    );

    auditLog(
      "RATE_LIMIT_BLOCKED",
      `Action "${normalizedAction}" exceeded the client-side limit of ${safeLimit} per minute.`,
      "WARN"
    );

    return false;
  }

  recentTimestamps.push(now);

  rateLimits.set(
    normalizedAction,
    recentTimestamps
  );

  return true;
}

/**
 * Clears the rate-limit history for one action.
 *
 * @param {string} action
 */
export function clearRateLimit(action) {
  const normalizedAction =
    normalizeString(action).trim();

  if (normalizedAction) {
    rateLimits.delete(normalizedAction);
  }
}

/**
 * Clears all client-side rate-limit history.
 */
export function clearAllRateLimits() {
  rateLimits.clear();
}

// ============================================================
// Local diagnostic logging
// ============================================================

/**
 * Reduces the chance of line-break injection in exported logs.
 */
function sanitizeAuditDetail(detail) {
  return normalizeString(detail)
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, MAX_AUDIT_DETAIL_LENGTH);
}

/**
 * Records a local diagnostic event.
 *
 * These logs exist only in browser memory. They are not durable,
 * tamper-resistant, or equivalent to enterprise audit records.
 *
 * Avoid passing transcript content, personal information,
 * credentials, API keys, or tokens as the detail.
 *
 * @param {string} action
 * @param {unknown} detail
 * @param {"INFO"|"WARN"|"ERROR"|"CRITICAL"} level
 * @returns {object}
 */
export function auditLog(
  action,
  detail = "",
  level = "INFO"
) {
  const normalizedAction =
    normalizeString(action).trim() ||
    "UNKNOWN_ACTION";

  const requestedLevel =
    normalizeString(level).toUpperCase();

  const normalizedLevel =
    VALID_AUDIT_LEVELS.has(requestedLevel)
      ? requestedLevel
      : "INFO";

  const entry = {
    id:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    action: normalizedAction.slice(0, 100),
    detail: sanitizeAuditDetail(detail),
    level: normalizedLevel,
  };

  auditLogs.push(entry);

  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs = auditLogs.slice(
      -MAX_AUDIT_LOGS
    );
  }

  if (
    normalizedLevel === "ERROR" ||
    normalizedLevel === "CRITICAL"
  ) {
    console.warn(
      `[LiveBridge ${normalizedLevel}] ${entry.action}: ${entry.detail}`
    );
  }

  return { ...entry };
}

/**
 * Returns copies of the current local diagnostic entries.
 *
 * @returns {Array<object>}
 */
export function getAuditLog() {
  return auditLogs.map((entry) => ({
    ...entry,
  }));
}

/**
 * Clears all local diagnostic entries.
 */
export function clearAuditLog() {
  auditLogs = [];
}

/**
 * Exports the current local diagnostic entries as a text file.
 *
 * @returns {boolean} true when export starts, otherwise false
 */
export function exportAuditLog() {
  if (!isBrowserEnvironment()) {
    console.warn(
      "Audit export requires a browser environment."
    );

    return false;
  }

  if (auditLogs.length === 0) {
    console.warn(
      "There are no local diagnostic events to export."
    );

    return false;
  }

  const content = auditLogs
    .map(
      (entry) =>
        `[${entry.timestamp}] [${entry.level}] ${entry.action}: ${entry.detail}`
    )
    .join("\n");

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  });

  const objectUrl =
    URL.createObjectURL(blob);

  const downloadLink =
    document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download =
    `livebridge-audit-${new Date()
      .toISOString()
      .slice(0, 10)}.log`;

  downloadLink.style.display = "none";

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  /*
   * Revoke after the click has been processed.
   */
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);

  return true;
}

// ============================================================
// Session inactivity monitoring
// ============================================================

/**
 * Records current user activity.
 */
export function resetSessionActivity() {
  lastActivity = Date.now();
}

/**
 * Stops the currently active session monitor, if one exists.
 */
export function stopSessionMonitor() {
  if (
    typeof activeSessionCleanup ===
    "function"
  ) {
    const cleanup = activeSessionCleanup;
    activeSessionCleanup = null;
    cleanup();
  }
}

/**
 * Starts one browser inactivity monitor.
 *
 * Starting a new monitor automatically removes the previous monitor,
 * preventing duplicate listeners and intervals.
 *
 * The timeout callback runs only once per monitor.
 *
 * @param {Function} onTimeout
 * @returns {Function} cleanup function
 */
export function startSessionMonitor(
  onTimeout
) {
  if (!isBrowserEnvironment()) {
    console.warn(
      "Session monitoring requires a browser environment."
    );

    return () => {};
  }

  /*
   * Ensure only one monitor is active.
   */
  stopSessionMonitor();

  lastActivity = Date.now();

  let hasTimedOut = false;

  const activityEvents = [
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
  ];

  const activityHandler = () => {
    if (!hasTimedOut) {
      resetSessionActivity();
    }
  };

  activityEvents.forEach((eventName) => {
    window.addEventListener(
      eventName,
      activityHandler,
      { passive: true }
    );
  });

  const sessionTimer = window.setInterval(
    () => {
      const elapsedTime =
        Date.now() - lastActivity;

      if (
        !hasTimedOut &&
        elapsedTime >= SESSION_TIMEOUT_MS
      ) {
        hasTimedOut = true;

        auditLog(
          "SESSION_TIMEOUT",
          "The local session expired because of inactivity.",
          "WARN"
        );

        /*
         * Stop monitoring before calling consumer code.
         * This prevents onTimeout from firing repeatedly.
         */
        stopSessionMonitor();

        try {
          onTimeout?.();
        } catch (error) {
          auditLog(
            "SESSION_TIMEOUT_HANDLER_ERROR",
            error?.message ||
              "The session timeout handler failed.",
            "ERROR"
          );
        }
      }
    },
    SESSION_CHECK_INTERVAL_MS
  );

  let locallyCleanedUp = false;

  const cleanup = () => {
    if (locallyCleanedUp) {
      return;
    }

    locallyCleanedUp = true;

    window.clearInterval(sessionTimer);

    activityEvents.forEach((eventName) => {
      window.removeEventListener(
        eventName,
        activityHandler
      );
    });
  };

  activeSessionCleanup = cleanup;

  auditLog(
    "SESSION_MONITOR_STARTED",
    "Local inactivity monitoring started."
  );

  /*
   * Return an idempotent cleanup function.
   */
  return () => {
    cleanup();

    if (
      activeSessionCleanup === cleanup
    ) {
      activeSessionCleanup = null;
    }
  };
}

// ============================================================
// Sensitive-data detection
// ============================================================

const SENSITIVE_PATTERNS = [
  {
    type: "email",
    pattern:
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    type: "payment-card",
    pattern:
      /\b(?:\d[ -]*?){13,19}\b/,
  },
  {
    type: "us-ssn",
    pattern:
      /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    type: "india-pan",
    pattern:
      /\b[A-Z]{5}\d{4}[A-Z]\b/i,
  },
  {
    type: "india-aadhaar",
    pattern:
      /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
  },
  {
    type: "password",
    pattern:
      /\bpassword\s*[:=]\s*\S+/i,
  },
  {
    type: "secret",
    pattern:
      /\bsecret\s*[:=]\s*\S+/i,
  },
  {
    type: "api-key",
    pattern:
      /\bapi[_ -]?key\s*[:=]\s*\S+/i,
  },
  {
    type: "access-token",
    pattern:
      /\b(?:access[_ -]?)?token\s*[:=]\s*\S+/i,
  },
  {
    type: "private-key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  },
];

/**
 * Returns categories of potentially sensitive information.
 *
 * Detection is approximate and may produce false positives or
 * miss sensitive values.
 *
 * @param {unknown} text
 * @returns {Array<string>}
 */
export function detectSensitiveDataTypes(
  text
) {
  const normalizedText =
    normalizeString(text);

  if (!normalizedText) {
    return [];
  }

  return SENSITIVE_PATTERNS
    .filter(({ pattern }) =>
      pattern.test(normalizedText)
    )
    .map(({ type }) => type);
}

/**
 * Checks whether text may contain sensitive information.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
export function containsSensitiveData(
  text
) {
  return (
    detectSensitiveDataTypes(text).length >
    0
  );
}

// ============================================================
// Sensitive-data masking
// ============================================================

function maskEmailAddress(
  match,
  localPart,
  domain
) {
  const visiblePrefix =
    localPart.slice(
      0,
      Math.min(2, localPart.length)
    );

  return `${visiblePrefix}***@${domain}`;
}

function maskNumericValue(value) {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }

  const firstDigits = digits.slice(0, 2);
  const lastDigits = digits.slice(-2);

  return `${firstDigits}${"*".repeat(
    Math.max(digits.length - 4, 4)
  )}${lastDigits}`;
}

/**
 * Masks common sensitive values before display or external transfer.
 *
 * This function is a best-effort privacy helper. It does not guarantee
 * discovery or removal of all confidential information.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function maskSensitiveData(text) {
  let maskedText = normalizeString(text);

  if (!maskedText) {
    return "";
  }

  /*
   * Private keys must be masked before more general patterns.
   */
  maskedText = maskedText.replace(
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    "[PRIVATE KEY REDACTED]"
  );

  maskedText = maskedText.replace(
    /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
    maskEmailAddress
  );

  maskedText = maskedText.replace(
    /\b(password|secret|api[_ -]?key|(?:access[_ -]?)?token)\s*([:=])\s*(\S+)/gi,
    (_, label, separator) =>
      `${label}${separator} [REDACTED]`
  );

  /*
   * India PAN.
   */
  maskedText = maskedText.replace(
    /\b([A-Z]{2})[A-Z]{3}(\d{2})\d{2}([A-Z])\b/gi,
    "$1***$2**$3"
  );

  /*
   * Aadhaar-like 12-digit value.
   * This pattern does not validate whether the number is genuine.
   */
  maskedText = maskedText.replace(
    /\b(\d{4})[ -]?\d{4}[ -]?(\d{4})\b/g,
    "$1 **** $2"
  );

  /*
   * US SSN-like value.
   */
  maskedText = maskedText.replace(
    /\b(\d{3})-\d{2}-(\d{4})\b/g,
    "$1-**-$2"
  );

  /*
   * Payment-card-like sequences.
   */
  maskedText = maskedText.replace(
    /\b(?:\d[ -]*?){13,19}\b/g,
    (match) => maskNumericValue(match)
  );

  /*
   * Phone-like values with 10 to 15 digits.
   * Kept after Aadhaar and card replacement to reduce overlap.
   */
  maskedText = maskedText.replace(
    /(?:\+?\d[\d\s().-]{8,}\d)/g,
    (match) => {
      const digitCount =
        match.replace(/\D/g, "").length;

      if (
        digitCount < 10 ||
        digitCount > 15
      ) {
        return match;
      }

      return maskNumericValue(match);
    }
  );

  return maskedText;
}

// ============================================================
// In-memory cleanup
// ============================================================

/**
 * Clears local diagnostic logs, rate-limit state, and session monitoring.
 *
 * JavaScript cannot guarantee cryptographic erasure of memory.
 * This function resets references maintained by this service only.
 *
 * @param {object} options
 * @param {boolean} options.recordEvent
 */
export function secureWipe(
  { recordEvent = false } = {}
) {
  stopSessionMonitor();
  auditLogs = [];
  rateLimits.clear();
  lastActivity = Date.now();

  if (recordEvent) {
    auditLog(
      "LOCAL_STATE_RESET",
      "LiveBridge client security state was reset.",
      "WARN"
    );
  }
}