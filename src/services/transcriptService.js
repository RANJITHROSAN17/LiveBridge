/**
 * LiveBridge Transcript Service
 *
 * Stores temporary conversation entries and provides:
 * - Transcript history
 * - Session statistics
 * - Search
 * - Bookmarks
 * - Speaker filtering
 * - Recent conversation context
 *
 * Important:
 * Transcript data is stored only in browser memory.
 * It is removed when the page refreshes or clearTranscript() is called.
 */

// ============================================================
// Configuration
// ============================================================

const DEFAULT_RECENT_ENTRY_COUNT = 5;
const MAX_RECENT_ENTRY_COUNT = 100;
const MAX_TEXT_LENGTH = 10000;
const MAX_BOOKMARK_LABEL_LENGTH = 100;

// ============================================================
// Internal state
// ============================================================

let transcript = [];
let sessionStart = null;
let bookmarks = [];

// ============================================================
// Helpers
// ============================================================

/**
 * Creates a reasonably unique identifier.
 */
function createId() {
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

/**
 * Converts a value into safe, trimmed plain text.
 */
function normalizeText(
  value,
  maximumLength = MAX_TEXT_LENGTH
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maximumLength);
}

/**
 * Normalizes a language code.
 */
function normalizeLanguageCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

/**
 * Validates a timestamp and returns a safe numeric value.
 */
function normalizeTimestamp(value) {
  const timestamp = Number(value);

  if (
    Number.isFinite(timestamp) &&
    timestamp > 0
  ) {
    return timestamp;
  }

  return Date.now();
}

/**
 * Returns a locale-formatted time for a timestamp.
 */
function formatTime(timestamp) {
  try {
    return new Date(
      timestamp
    ).toLocaleTimeString();
  } catch {
    return "";
  }
}

/**
 * Produces an approximate word count.
 *
 * Intl.Segmenter improves counting for supported languages.
 * The whitespace fallback remains available for older browsers.
 */
function countWords(text, language = "en") {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return 0;
  }

  if (
    typeof Intl !== "undefined" &&
    typeof Intl.Segmenter === "function"
  ) {
    try {
      const segmenter = new Intl.Segmenter(
        language || "en",
        {
          granularity: "word",
        }
      );

      let count = 0;

      for (const segment of segmenter.segment(
        normalizedText
      )) {
        if (segment.isWordLike) {
          count += 1;
        }
      }

      return count;
    } catch {
      // Use whitespace fallback below.
    }
  }

  return normalizedText
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Copies emotion data so callers cannot modify internal state.
 */
function cloneEmotion(emotion) {
  if (
    !emotion ||
    typeof emotion !== "object" ||
    Array.isArray(emotion)
  ) {
    return emotion ?? null;
  }

  return {
    ...emotion,
  };
}

/**
 * Creates a defensive copy of a transcript entry.
 */
function cloneTranscriptEntry(entry) {
  return {
    ...entry,
    emotion: cloneEmotion(entry.emotion),
  };
}

/**
 * Creates a defensive copy of a bookmark.
 */
function cloneBookmark(bookmark) {
  return {
    ...bookmark,
  };
}

/**
 * Validates a requested entry count.
 */
function normalizeEntryCount(
  count,
  fallback = DEFAULT_RECENT_ENTRY_COUNT
) {
  const parsedCount = Number(count);

  if (
    !Number.isFinite(parsedCount) ||
    parsedCount <= 0
  ) {
    return fallback;
  }

  return Math.min(
    Math.floor(parsedCount),
    MAX_RECENT_ENTRY_COUNT
  );
}

// ============================================================
// Transcript management
// ============================================================

/**
 * Adds one entry to the transcript.
 *
 * Existing usage remains supported:
 *
 * addTranscript({
 *   original,
 *   translated
 * });
 *
 * Extended usage:
 *
 * addTranscript({
 *   id,
 *   original,
 *   translated,
 *   speaker,
 *   sourceLang,
 *   targetLang,
 *   emotion,
 *   timestamp
 * });
 *
 * @param {object} entry
 * @returns {object|null}
 */
export function addTranscript(entry) {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry)
  ) {
    console.warn(
      "Transcript entry was ignored because it was invalid."
    );

    return null;
  }

  const original = normalizeText(
    entry.original
  );

  const translated = normalizeText(
    entry.translated
  );

  /*
   * Avoid creating completely empty transcript entries.
   */
  if (!original && !translated) {
    console.warn(
      "Transcript entry was ignored because it contained no text."
    );

    return null;
  }

  const timestamp = normalizeTimestamp(
    entry.timestamp
  );

  const sourceLang =
    normalizeLanguageCode(entry.sourceLang);

  const targetLang =
    normalizeLanguageCode(entry.targetLang);

  const speaker =
    normalizeText(entry.speaker, 50) ||
    "unknown";

  const id =
    entry.id !== undefined &&
    entry.id !== null &&
    String(entry.id).trim()
      ? String(entry.id).trim()
      : createId();

  if (sessionStart === null) {
    sessionStart = timestamp;
  }

  const transcriptEntry = {
    id,
    original,
    translated,
    speaker,
    sourceLang,
    targetLang,
    emotion: cloneEmotion(entry.emotion),
    timestamp,
    time: formatTime(timestamp),
    wordCount: countWords(
      original,
      sourceLang
    ),
  };

  transcript.push(transcriptEntry);

  return cloneTranscriptEntry(
    transcriptEntry
  );
}

/**
 * Returns defensive copies of all transcript entries.
 *
 * @returns {Array<object>}
 */
export function getTranscript() {
  return transcript.map(
    cloneTranscriptEntry
  );
}

/**
 * Returns one transcript entry by ID.
 *
 * @param {string|number} entryId
 * @returns {object|null}
 */
export function getTranscriptEntry(
  entryId
) {
  if (
    entryId === undefined ||
    entryId === null
  ) {
    return null;
  }

  const normalizedId =
    String(entryId).trim();

  const entry = transcript.find(
    (item) =>
      String(item.id) === normalizedId
  );

  return entry
    ? cloneTranscriptEntry(entry)
    : null;
}

/**
 * Returns the number of transcript entries.
 *
 * @returns {number}
 */
export function getTranscriptSize() {
  return transcript.length;
}

/**
 * Returns the session-start timestamp.
 *
 * @returns {number|null}
 */
export function getSessionStart() {
  return sessionStart;
}

/**
 * Clears transcript entries, session metadata, and bookmarks.
 */
export function clearTranscript() {
  transcript = [];
  sessionStart = null;
  bookmarks = [];
}

// ============================================================
// Transcript statistics
// ============================================================

/**
 * Returns current session statistics.
 *
 * Duration represents elapsed time since the first transcript entry.
 * It does not represent exact speaking time.
 *
 * @returns {object}
 */
export function getTranscriptStats() {
  const totalEntries = transcript.length;

  const youEntries = transcript.filter(
    (entry) => entry.speaker === "you"
  ).length;

  const themEntries = transcript.filter(
    (entry) => entry.speaker === "them"
  ).length;

  const unknownEntries =
    totalEntries -
    youEntries -
    themEntries;

  const totalWords = transcript.reduce(
    (total, entry) =>
      total +
      (Number.isFinite(entry.wordCount)
        ? entry.wordCount
        : 0),
    0
  );

  const durationMs =
    sessionStart !== null
      ? Math.max(
          0,
          Date.now() - sessionStart
        )
      : 0;

  /*
   * Floor avoids displaying one minute immediately
   * after a session begins.
   */
  const durationMin = Math.floor(
    durationMs / 60000
  );

  const langPairs = {};
  const emotions = {};

  transcript.forEach((entry) => {
    if (
      entry.sourceLang &&
      entry.targetLang
    ) {
      const languagePair =
        `${entry.sourceLang}→${entry.targetLang}`;

      langPairs[languagePair] =
        (langPairs[languagePair] || 0) +
        1;
    }

    const emotionLabel =
      typeof entry.emotion === "string"
        ? entry.emotion
        : entry.emotion?.label;

    if (
      typeof emotionLabel === "string" &&
      emotionLabel.trim()
    ) {
      const normalizedLabel =
        emotionLabel.trim();

      emotions[normalizedLabel] =
        (emotions[normalizedLabel] || 0) +
        1;
    }
  });

  return {
    totalEntries,
    youEntries,
    themEntries,
    unknownEntries,
    totalWords,
    durationMs,
    durationMin,
    langPairs: {
      ...langPairs,
    },
    emotions: {
      ...emotions,
    },
    sessionStart,
  };
}

// ============================================================
// Search and filtering
// ============================================================

/**
 * Searches original and translated transcript text.
 *
 * An empty query returns the complete transcript.
 *
 * @param {string} query
 * @returns {Array<object>}
 */
export function searchTranscript(query) {
  const normalizedQuery =
    normalizeText(query).toLowerCase();

  if (!normalizedQuery) {
    return getTranscript();
  }

  return transcript
    .filter((entry) => {
      const original =
        entry.original.toLowerCase();

      const translated =
        entry.translated.toLowerCase();

      return (
        original.includes(
          normalizedQuery
        ) ||
        translated.includes(
          normalizedQuery
        )
      );
    })
    .map(cloneTranscriptEntry);
}

/**
 * Returns transcript entries belonging to one speaker.
 *
 * @param {string} speaker
 * @returns {Array<object>}
 */
export function getTranscriptBySpeaker(
  speaker
) {
  const normalizedSpeaker =
    normalizeText(speaker, 50).toLowerCase();

  if (!normalizedSpeaker) {
    return [];
  }

  return transcript
    .filter(
      (entry) =>
        entry.speaker.toLowerCase() ===
        normalizedSpeaker
    )
    .map(cloneTranscriptEntry);
}

/**
 * Returns the latest transcript entries.
 *
 * @param {number} count
 * @returns {Array<object>}
 */
export function getRecentTranscript(
  count = DEFAULT_RECENT_ENTRY_COUNT
) {
  const safeCount =
    normalizeEntryCount(count);

  return transcript
    .slice(-safeCount)
    .map(cloneTranscriptEntry);
}

// ============================================================
// Bookmark management
// ============================================================

/**
 * Adds a bookmark linked to the latest transcript entry.
 *
 * @param {string} label
 * @returns {object|null}
 */
export function addBookmark(
  label = "Important"
) {
  const normalizedLabel =
    normalizeText(
      label,
      MAX_BOOKMARK_LABEL_LENGTH
    ) || "Important";

  const lastEntry =
    transcript.length > 0
      ? transcript[
          transcript.length - 1
        ]
      : null;

  const timestamp = Date.now();

  const bookmark = {
    id: createId(),
    label: normalizedLabel,
    time: formatTime(timestamp),
    timestamp,
    entryId: lastEntry?.id ?? null,

    /*
     * Keep only a short preview to avoid unnecessarily
     * duplicating complete transcript content.
     */
    entryText: lastEntry?.original
      ? lastEntry.original.slice(0, 200)
      : "",
  };

  bookmarks.push(bookmark);

  return cloneBookmark(bookmark);
}

/**
 * Returns defensive copies of all bookmarks.
 *
 * @returns {Array<object>}
 */
export function getBookmarks() {
  return bookmarks.map(cloneBookmark);
}

/**
 * Removes a bookmark by ID.
 *
 * @param {string|number} bookmarkId
 * @returns {boolean}
 */
export function removeBookmark(
  bookmarkId
) {
  if (
    bookmarkId === undefined ||
    bookmarkId === null
  ) {
    return false;
  }

  const normalizedId =
    String(bookmarkId).trim();

  const initialLength =
    bookmarks.length;

  bookmarks = bookmarks.filter(
    (bookmark) =>
      String(bookmark.id) !==
      normalizedId
  );

  return (
    bookmarks.length <
    initialLength
  );
}

/**
 * Clears bookmarks without clearing the transcript.
 */
export function clearBookmarks() {
  bookmarks = [];
}

// ============================================================
// Default export
// ============================================================

export default {
  addTranscript,
  getTranscript,
  getTranscriptEntry,
  getTranscriptSize,
  getSessionStart,
  clearTranscript,
  getTranscriptStats,
  searchTranscript,
  getTranscriptBySpeaker,
  getRecentTranscript,
  addBookmark,
  getBookmarks,
  removeBookmark,
  clearBookmarks,
};