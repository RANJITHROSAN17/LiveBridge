/**
 * LiveBridge – Export Service (AI Enhanced)
 * Downloads transcript as TXT, SRT, or JSON.
 * ✅ exportTXT() — same function name, better output
 * ✅ exportSRT(), exportJSON()
 */
import {
  getTranscript,
  getTranscriptStats,
  getBookmarks,
} from "./transcriptService";

// ════════════════════════════════════════
//  TXT EXPORT (upgraded, same function name)
// ════════════════════════════════════════

/**
 * Export transcript as professional .txt file
 * ✅ Same function name — old code that calls exportTXT() still works
 */
export function exportTXT() {
  const entries = getSortedTranscript();

  if (entries.length === 0) {
    showAlert("No transcript to export yet. Start a conversation first.");
    return;
  }

  const stats = getTranscriptStats();
  const bookmarks = getBookmarks();

  // ✅ Professional header
  const header = [
    "═══════════════════════════════════════════════════════",
    "  LiveBridge — Meeting Transcript",
    `  Date     : ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    `  Entries  : ${stats.totalEntries}`,
    `  Words    : ${stats.totalWords}`,
    `  Duration : ~${stats.durationMin} min`,
    `  Speakers : You (${stats.youEntries}) · Them (${stats.themEntries})`,
    "═══════════════════════════════════════════════════════",
    "",
  ].join("\n");

  // ✅ Main transcript body
  const body = entries
    .map((e) => {
      const speaker = e.speaker ? `[${e.speaker.toUpperCase()}]` : "";
      const langs =
        e.sourceLang && e.targetLang
          ? `(${e.sourceLang} → ${e.targetLang})`
          : "";

      const emotion = normalizeEmotion(e.emotion);
      const emotionTag =
        emotion && emotion.label !== "Neutral"
          ? ` ${emotion.emoji ? `${emotion.emoji} ` : ""}${emotion.label}`
          : "";

      return (
        `[${e.time}] ${speaker} ${langs}${emotionTag}\n` +
        `  Original   : ${e.original}\n` +
        `  Translated : ${e.translated}`
      );
    })
    .join("\n\n");

  // ✅ Bookmarks section (if any)
  let bookmarkSection = "";

  if (Array.isArray(bookmarks) && bookmarks.length > 0) {
    bookmarkSection =
      "\n\n" +
      "───────────── BOOKMARKS ─────────────\n" +
      bookmarks
        .map(
          (b) =>
            `  [${b.time}] ★ ${b.label}${
              b.entryText ? ': "' + b.entryText.slice(0, 60) + '"' : ""
            }`
        )
        .join("\n");
  }

  // ✅ Emotion summary
  let emotionSection = "";

  if (
    stats.emotions &&
    typeof stats.emotions === "object" &&
    Object.keys(stats.emotions).length > 0
  ) {
    emotionSection =
      "\n\n" +
      "───────────── EMOTION SUMMARY ─────────────\n" +
      Object.entries(stats.emotions)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `  ${label}: ${count}`)
        .join("\n");
  }

  const content = header + body + bookmarkSection + emotionSection + "\n";

  downloadFile(
    content,
    "livebridge-transcript.txt",
    "text/plain;charset=utf-8"
  );
}

// ════════════════════════════════════════
//  SRT EXPORT
// ════════════════════════════════════════

/**
 * Export as SRT subtitles (for video overlay / accessibility)
 */
export function exportSRT() {
  const entries = getSortedTranscript();

  if (entries.length === 0) {
    showAlert("No transcript to export yet.");
    return;
  }

  const firstTimestamp = getTimestamp(entries[0]);
  const firstTs = firstTimestamp ?? Date.now();

  const srt = entries
    .map((e, i) => {
      const timestamp = getTimestamp(e) ?? firstTs;
      const startSec = Math.max(0, (timestamp - firstTs) / 1000);

      const subtitleText = normalizeSubtitleText(
        e.translated || e.original || ""
      );

      // Estimate display duration: ~60ms per character, minimum 3s
      const estimatedEndSec =
        startSec + Math.max(3, subtitleText.length * 0.06);

      const nextEntry = entries[i + 1];
      const nextTimestamp = nextEntry ? getTimestamp(nextEntry) : null;

      let endSec = estimatedEndSec;

      if (nextTimestamp !== null) {
        const nextStartSec = Math.max(0, (nextTimestamp - firstTs) / 1000);

        // End at least 1ms before the next subtitle to prevent overlap.
        endSec = Math.min(estimatedEndSec, nextStartSec - 0.001);

        // Keep the SRT range valid when entries have identical timestamps.
        endSec = Math.max(startSec, endSec);
      }

      const speaker = e.speaker
        ? `[${normalizeSubtitleText(e.speaker).toUpperCase()}] `
        : "";

      return [
        i + 1,
        `${formatSRTTime(startSec)} --> ${formatSRTTime(endSec)}`,
        `${speaker}${subtitleText}`,
        "",
      ].join("\n");
    })
    .join("\n");

  downloadFile(
    srt,
    "livebridge-subtitles.srt",
    "application/x-subrip;charset=utf-8"
  );
}

// ════════════════════════════════════════
//  JSON EXPORT
// ════════════════════════════════════════

/**
 * Export as JSON (for AI processing / integrations)
 */
export function exportJSON() {
  const entries = getSortedTranscript();
  const stats = getTranscriptStats();
  const bookmarks = getBookmarks();

  if (entries.length === 0) {
    showAlert("No transcript to export yet.");
    return;
  }

  const data = {
    meta: {
      app: "LiveBridge — AI Real-Time Interpreter",
      exportDate: new Date().toISOString(),
      stats,
    },
    bookmarks,
    transcript: entries.map((e, index) => {
      const emotion = normalizeEmotion(e.emotion);
      const textForWordCount = e.translated || e.original || "";

      return {
        id: e.id ?? index + 1,
        timestamp: e.timestamp ?? null,
        time: e.time,
        speaker: e.speaker || "unknown",
        sourceLang: e.sourceLang || "",
        targetLang: e.targetLang || "",
        original: e.original,
        translated: e.translated,
        wordCount:
          Number.isFinite(e.wordCount) && e.wordCount >= 0
            ? e.wordCount
            : countWords(textForWordCount),
        emotion,
      };
    }),
  };

  const content = JSON.stringify(data, null, 2);

  downloadFile(
    content,
    "livebridge-transcript.json",
    "application/json;charset=utf-8"
  );
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════

/**
 * Return transcript entries ordered chronologically.
 * Entries without valid timestamps remain in their original relative order.
 */
function getSortedTranscript() {
  const transcript = getTranscript();
  const entries = Array.isArray(transcript) ? transcript : [];

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aTimestamp = getTimestamp(a.entry);
      const bTimestamp = getTimestamp(b.entry);

      if (aTimestamp === null && bTimestamp === null) {
        return a.index - b.index;
      }

      if (aTimestamp === null) return 1;
      if (bTimestamp === null) return -1;

      return aTimestamp - bTimestamp || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/**
 * Convert numeric or date-string timestamps into milliseconds.
 */
function getTimestamp(entry) {
  if (!entry || entry.timestamp === null || entry.timestamp === undefined) {
    return null;
  }

  if (
    typeof entry.timestamp === "number" &&
    Number.isFinite(entry.timestamp)
  ) {
    return entry.timestamp;
  }

  const timestamp = new Date(entry.timestamp).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Normalize subtitle content to a safe single-line caption.
 */
function normalizeSubtitleText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Support emotion values stored as strings or objects.
 */
function normalizeEmotion(emotion) {
  if (!emotion) {
    return null;
  }

  if (typeof emotion === "string") {
    const label = emotion.trim();

    return label
      ? {
          label,
          emoji: "",
          confidence: null,
        }
      : null;
  }

  if (typeof emotion === "object") {
    return {
      label:
        typeof emotion.label === "string" ? emotion.label.trim() : "",
      emoji: typeof emotion.emoji === "string" ? emotion.emoji : "",
      confidence: emotion.confidence ?? null,
    };
  }

  return null;
}

function countWords(value) {
  const normalized = normalizeSubtitleText(value);
  return normalized ? normalized.split(/\s+/).length : 0;
}

function formatSRTTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = Math.floor(safeSeconds % 60);
  const ms = Math.floor((safeSeconds % 1) * 1000);

  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function showAlert(message) {
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
}

/**
 * Safe browser file download with delayed object URL cleanup.
 */
function downloadFile(content, filename, type) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}