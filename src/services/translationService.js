/**
 * LiveBridge Translation Service
 *
 * Prototype translation service that:
 * - Validates and sanitizes input
 * - Applies client-side rate limiting
 * - Detects potentially sensitive input
 * - Uses request timeouts
 * - Validates API responses
 * - Records audit events
 *
 * Important:
 * Client-side rate limiting and audit logging are not sufficient
 * for production security. Production translation should be routed
 * through an authenticated backend.
 */

import {
  sanitizeInput,
  checkRateLimit,
  containsSensitiveData,
  auditLog,
} from "./securityService";

// ============================================================
// Configuration
// ============================================================

const GOOGLE_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single";

const MYMEMORY_ENDPOINT =
  "https://api.mymemory.translated.net/get";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_INPUT_CHARACTERS = 5000;
const MAX_TRANSLATIONS_PER_MINUTE = 60;

/*
 * These are the language codes currently exposed by App.jsx.
 */
const SUPPORTED_LANGUAGES = new Set([
  "en",
  "hi",
  "ta",
  "te",
  "es",
  "fr",
  "de",
  "ja",
  "zh",
  "ar",
  "ko",
  "pt",
  "ru",
  "it",
  "bn",
  "kn",
  "ml",
  "mr",
  "gu",
  "pa",
]);

// ============================================================
// Custom error type
// ============================================================

export class TranslationError extends Error {
  constructor(
    message,
    code = "TRANSLATION_ERROR",
    cause = null
  ) {
    super(message);

    this.name = "TranslationError";
    this.code = code;
    this.cause = cause;
  }
}

// ============================================================
// Validation helpers
// ============================================================

function normalizeLanguageCode(language) {
  if (typeof language !== "string") {
    return "";
  }

  return language.trim().toLowerCase();
}

function validateLanguage(language, fieldName) {
  const normalizedLanguage =
    normalizeLanguageCode(language);

  if (!normalizedLanguage) {
    throw new TranslationError(
      `${fieldName} language is required.`,
      "INVALID_LANGUAGE"
    );
  }

  if (
    !SUPPORTED_LANGUAGES.has(normalizedLanguage)
  ) {
    throw new TranslationError(
      `Unsupported ${fieldName.toLowerCase()} language: ${normalizedLanguage}`,
      "UNSUPPORTED_LANGUAGE"
    );
  }

  return normalizedLanguage;
}

function prepareInput(text) {
  if (typeof text !== "string") {
    throw new TranslationError(
      "Translation input must be text.",
      "INVALID_INPUT"
    );
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    return "";
  }

  if (
    trimmedText.length > MAX_INPUT_CHARACTERS
  ) {
    throw new TranslationError(
      `Translation input cannot exceed ${MAX_INPUT_CHARACTERS} characters.`,
      "INPUT_TOO_LONG"
    );
  }

  const sanitizedText =
    sanitizeInput(trimmedText);

  if (
    typeof sanitizedText !== "string" ||
    !sanitizedText.trim()
  ) {
    throw new TranslationError(
      "Translation input became empty after validation.",
      "INVALID_INPUT"
    );
  }

  return sanitizedText.trim();
}

// ============================================================
// Request helper
// ============================================================

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new TranslationError(
        "The translation request timed out.",
        "REQUEST_TIMEOUT",
        error
      );
    }

    throw new TranslationError(
      "Unable to connect to the translation service.",
      "NETWORK_ERROR",
      error
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// ============================================================
// Google prototype provider
// ============================================================

/**
 * Uses the existing public Google Translate web endpoint.
 *
 * This preserves the behavior of your current prototype.
 * It is not the official authenticated Google Cloud Translation API
 * and should not be used as the production provider.
 */
async function translateWithGooglePrototype(
  text,
  sourceLanguage,
  targetLanguage
) {
  const query = new URLSearchParams({
    client: "gtx",
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: "t",
    q: text,
  });

  const response = await fetchWithTimeout(
    `${GOOGLE_TRANSLATE_ENDPOINT}?${query.toString()}`
  );

  if (!response.ok) {
    throw new TranslationError(
      `Primary translation provider returned HTTP ${response.status}.`,
      "PRIMARY_HTTP_ERROR"
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new TranslationError(
      "Primary translation provider returned invalid JSON.",
      "PRIMARY_INVALID_JSON",
      error
    );
  }

  if (
    !Array.isArray(data) ||
    !Array.isArray(data[0])
  ) {
    throw new TranslationError(
      "Primary translation provider returned an unexpected response.",
      "PRIMARY_INVALID_RESPONSE"
    );
  }

  const translatedText = data[0]
    .filter(
      (item) =>
        Array.isArray(item) &&
        typeof item[0] === "string"
    )
    .map((item) => item[0])
    .join("")
    .trim();

  if (!translatedText) {
    throw new TranslationError(
      "Primary translation provider returned empty text.",
      "PRIMARY_EMPTY_RESPONSE"
    );
  }

  return translatedText;
}

// ============================================================
// MyMemory fallback provider
// ============================================================

/**
 * MyMemory limits an individual query to 500 UTF-8 bytes.
 * This helper measures the actual UTF-8 size.
 */
function getUtf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * Splits text into chunks that fit within MyMemory's
 * 500-byte request limit.
 */
function splitIntoUtf8Chunks(
  text,
  maximumBytes = 500
) {
  if (getUtf8ByteLength(text) <= maximumBytes) {
    return [text];
  }

  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = "";

  for (const word of words) {
    /*
     * Handle a single word that exceeds the byte limit.
     */
    if (
      getUtf8ByteLength(word) > maximumBytes
    ) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      let characterChunk = "";

      for (const character of word) {
        const candidate =
          characterChunk + character;

        if (
          getUtf8ByteLength(candidate) >
          maximumBytes
        ) {
          if (characterChunk) {
            chunks.push(characterChunk);
          }

          characterChunk = character;
        } else {
          characterChunk = candidate;
        }
      }

      if (characterChunk) {
        currentChunk = characterChunk;
      }

      continue;
    }

    const candidate = currentChunk
      ? `${currentChunk} ${word}`
      : word;

    if (
      getUtf8ByteLength(candidate) >
      maximumBytes
    ) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      currentChunk = word;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function translateMyMemoryChunk(
  text,
  sourceLanguage,
  targetLanguage
) {
  const query = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage}|${targetLanguage}`,
  });

  const response = await fetchWithTimeout(
    `${MYMEMORY_ENDPOINT}?${query.toString()}`
  );

  if (!response.ok) {
    throw new TranslationError(
      `Fallback provider returned HTTP ${response.status}.`,
      "FALLBACK_HTTP_ERROR"
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new TranslationError(
      "Fallback provider returned invalid JSON.",
      "FALLBACK_INVALID_JSON",
      error
    );
  }

  if (data?.quotaFinished === true) {
    throw new TranslationError(
      "Fallback translation quota has been reached.",
      "FALLBACK_QUOTA_EXCEEDED"
    );
  }

  const isSuccessful =
    Number(data?.responseStatus) === 200;

  const translatedText =
    data?.responseData?.translatedText;

  if (
    !isSuccessful ||
    typeof translatedText !== "string" ||
    !translatedText.trim()
  ) {
    const responseDetails =
      typeof data?.responseDetails === "string"
        ? data.responseDetails
        : "Fallback translation failed.";

    throw new TranslationError(
      responseDetails,
      "FALLBACK_INVALID_RESPONSE"
    );
  }

  return translatedText.trim();
}

async function fallbackTranslate(
  text,
  sourceLanguage,
  targetLanguage
) {
  const chunks = splitIntoUtf8Chunks(text);

  const translatedChunks = [];

  /*
   * Translate sequentially to avoid sending a burst of
   * requests to the fallback provider.
   */
  for (const chunk of chunks) {
    const translatedChunk =
      await translateMyMemoryChunk(
        chunk,
        sourceLanguage,
        targetLanguage
      );

    translatedChunks.push(translatedChunk);
  }

  const translatedText = translatedChunks
    .join(" ")
    .trim();

  if (!translatedText) {
    throw new TranslationError(
      "Fallback translation returned empty text.",
      "FALLBACK_EMPTY_RESPONSE"
    );
  }

  return translatedText;
}

// ============================================================
// Public translation function
// ============================================================

export async function translateText(
  text,
  sourceLang,
  targetLang
) {
  const cleanText = prepareInput(text);

  if (!cleanText) {
    return "";
  }

  const sourceLanguage = validateLanguage(
    sourceLang,
    "Source"
  );

  const targetLanguage = validateLanguage(
    targetLang,
    "Target"
  );

  if (sourceLanguage === targetLanguage) {
    return cleanText;
  }

  /*
   * This is useful for prototype UX only.
   * Real API abuse prevention must run on the backend.
   */
  if (
    !checkRateLimit(
      "translate",
      MAX_TRANSLATIONS_PER_MINUTE
    )
  ) {
    auditLog(
      "TRANSLATE_BLOCKED",
      "Client-side translation rate limit exceeded.",
      "WARN"
    );

    throw new TranslationError(
      "Translation rate limit exceeded. Please try again shortly.",
      "RATE_LIMIT_EXCEEDED"
    );
  }

  /*
   * Detection currently creates a warning only.
   * It does not remove or protect the sensitive value.
   */
  if (containsSensitiveData(cleanText)) {
    auditLog(
      "SENSITIVE_DATA_WARNING",
      "Potentially sensitive translation input detected.",
      "WARN"
    );
  }

  try {
    const translatedText =
      await translateWithGooglePrototype(
        cleanText,
        sourceLanguage,
        targetLanguage
      );

    auditLog(
      "TRANSLATE_SUCCESS",
      `${sourceLanguage}→${targetLanguage} (${cleanText.length} characters)`
    );

    return translatedText;
  } catch (primaryError) {
    console.warn(
      "Primary translation provider failed. Trying fallback:",
      primaryError
    );

    auditLog(
      "TRANSLATE_PRIMARY_ERROR",
      primaryError?.message ||
        "Primary translation provider failed.",
      "WARN"
    );

    try {
      const fallbackResult =
        await fallbackTranslate(
          cleanText,
          sourceLanguage,
          targetLanguage
        );

      auditLog(
        "TRANSLATE_FALLBACK_SUCCESS",
        `${sourceLanguage}→${targetLanguage} using MyMemory`
      );

      return fallbackResult;
    } catch (fallbackError) {
      console.error(
        "All translation providers failed:",
        fallbackError
      );

      auditLog(
        "TRANSLATE_ERROR",
        fallbackError?.message ||
          "All translation providers failed.",
        "ERROR"
      );

      /*
       * Do not return "[Translation unavailable] original text".
       * VoiceMode could mistakenly speak that system message aloud
       * and save it as a successful translation.
       */
      throw new TranslationError(
        "Translation is currently unavailable.",
        "ALL_PROVIDERS_FAILED",
        fallbackError
      );
    }
  }
}

export default translateText;