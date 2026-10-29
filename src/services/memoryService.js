/**
 * LiveBridge Conversation Memory Service
 *
 * Maintains a small, temporary in-memory conversation context.
 *
 * Features:
 * - Stores original and translated text
 * - Retains only the latest five entries
 * - Returns defensive copies
 * - Preserves the existing public functions
 *
 * Important:
 * This memory exists only while the application page is open.
 * It is cleared when the page is refreshed or clearMemory() is called.
 */

// ============================================================
// Configuration
// ============================================================

const DEFAULT_MAX_MEMORY_ENTRIES = 5;

// ============================================================
// Internal state
// ============================================================

let memoryBuffer = [];

// ============================================================
// Helpers
// ============================================================

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function createMemoryId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function cloneEntry(entry) {
  return {
    ...entry,
    metadata: {
      ...entry.metadata,
    },
  };
}

function enforceMemoryLimit(
  maximumEntries = DEFAULT_MAX_MEMORY_ENTRIES
) {
  const parsedLimit = Number(maximumEntries);

  const safeLimit =
    Number.isInteger(parsedLimit) &&
    parsedLimit > 0
      ? parsedLimit
      : DEFAULT_MAX_MEMORY_ENTRIES;

  if (memoryBuffer.length > safeLimit) {
    memoryBuffer = memoryBuffer.slice(
      -safeLimit
    );
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Adds a translated conversation entry to memory.
 *
 * Existing usage remains valid:
 *
 * addToMemory(original, translated);
 *
 * Optional metadata can also be supplied:
 *
 * addToMemory(original, translated, {
 *   speaker: "you",
 *   sourceLang: "en",
 *   targetLang: "ta"
 * });
 *
 * @param {string} original
 * @param {string} translated
 * @param {object} metadata
 * @returns {object|null}
 */
export function addToMemory(
  original,
  translated = "",
  metadata = {}
) {
  const normalizedOriginal =
    normalizeText(original);

  const normalizedTranslation =
    normalizeText(translated);

  if (
    !normalizedOriginal &&
    !normalizedTranslation
  ) {
    return null;
  }

  const safeMetadata =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  const entry = {
    id: createMemoryId(),
    original: normalizedOriginal,
    translated: normalizedTranslation,
    timestamp: Date.now(),
    metadata: safeMetadata,
  };

  memoryBuffer.push(entry);
  enforceMemoryLimit();

  return cloneEntry(entry);
}

/**
 * Returns the original messages as an array of strings.
 *
 * This preserves compatibility with existing code that expects:
 *
 * [
 *   "First message",
 *   "Second message"
 * ]
 *
 * @returns {string[]}
 */
export function getContext() {
  return memoryBuffer
    .map((entry) => entry.original)
    .filter(Boolean);
}

/**
 * Returns translated messages as an array of strings.
 *
 * @returns {string[]}
 */
export function getTranslatedContext() {
  return memoryBuffer
    .map((entry) => entry.translated)
    .filter(Boolean);
}

/**
 * Returns complete conversation-memory entries.
 *
 * Use this for summaries, dashboards, contextual replies,
 * or future AI features.
 *
 * @returns {Array<object>}
 */
export function getMemoryEntries() {
  return memoryBuffer.map(cloneEntry);
}

/**
 * Returns a formatted context string suitable for summaries
 * or future language-model prompts.
 *
 * @param {object} options
 * @param {boolean} options.includeTranslations
 * @returns {string}
 */
export function getFormattedContext({
  includeTranslations = true,
} = {}) {
  return memoryBuffer
    .map((entry, index) => {
      const lines = [];

      if (entry.original) {
        lines.push(
          `${index + 1}. Original: ${entry.original}`
        );
      }

      if (
        includeTranslations &&
        entry.translated
      ) {
        lines.push(
          `   Translation: ${entry.translated}`
        );
      }

      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Returns the most recent memory entry.
 *
 * @returns {object|null}
 */
export function getLatestMemoryEntry() {
  if (memoryBuffer.length === 0) {
    return null;
  }

  return cloneEntry(
    memoryBuffer[memoryBuffer.length - 1]
  );
}

/**
 * Returns the current number of stored entries.
 *
 * @returns {number}
 */
export function getMemorySize() {
  return memoryBuffer.length;
}

/**
 * Clears all temporary conversation memory.
 */
export function clearMemory() {
  memoryBuffer = [];
}

/**
 * Changes the maximum number of entries currently retained.
 *
 * This only trims the current memory. New entries continue using
 * the default five-entry limit unless a future configuration layer
 * is added.
 *
 * @param {number} maximumEntries
 * @returns {number}
 */
export function trimMemory(
  maximumEntries =
    DEFAULT_MAX_MEMORY_ENTRIES
) {
  enforceMemoryLimit(maximumEntries);
  return memoryBuffer.length;
}

export default {
  addToMemory,
  getContext,
  getTranslatedContext,
  getMemoryEntries,
  getFormattedContext,
  getLatestMemoryEntry,
  getMemorySize,
  clearMemory,
  trimMemory,
};
