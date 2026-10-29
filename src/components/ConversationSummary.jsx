import React, { useState } from "react";
import {
  FaBrain,
  FaTimes,
  FaClipboardList,
  FaCompass,
  FaUsers,
  FaArrowRight,
  FaRedo,
  FaChartBar,
} from "react-icons/fa";
import {
  getTranscript,
  getTranscriptStats,
} from "../services/transcriptService";

const ConversationSummary = ({
  messages,
  sourceLanguage,
  targetLanguage,
  languages,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeLanguages = Array.isArray(languages) ? languages : [];

  const getLangName = (code) => {
    const language = safeLanguages.find((item) => item?.code === code);
    return language ? language.name : code || "Unknown";
  };

  const getSafeTranscript = () => {
    try {
      const transcript = getTranscript();
      return Array.isArray(transcript) ? transcript : [];
    } catch (transcriptError) {
      console.error("Unable to read transcript:", transcriptError);
      return [];
    }
  };

  const getSafeStats = () => {
    try {
      const stats = getTranscriptStats();

      if (!stats || typeof stats !== "object") {
        return createFallbackStats([]);
      }

      return {
        totalEntries: toSafeNumber(stats.totalEntries),
        totalWords: toSafeNumber(stats.totalWords),
        durationMin: toSafeNumber(stats.durationMin),
        youEntries: toSafeNumber(stats.youEntries),
        themEntries: toSafeNumber(stats.themEntries),
        emotions:
          stats.emotions &&
          typeof stats.emotions === "object" &&
          !Array.isArray(stats.emotions)
            ? stats.emotions
            : {},
      };
    } catch (statsError) {
      console.error("Unable to read transcript statistics:", statsError);
      return createFallbackStats([]);
    }
  };

  const getConversationSource = () => {
    const transcriptData = getSafeTranscript();

    // Transcript service is the primary source.
    // The messages prop is used only when no transcript entries are available.
    return transcriptData.length > 0 ? transcriptData : safeMessages;
  };

  const hasConversation = () => {
    const transcriptData = getSafeTranscript();
    return transcriptData.length > 0 || safeMessages.length > 0;
  };

  // ════════════════════════════════════════
  //  LOCAL CONVERSATION ANALYSIS
  // ════════════════════════════════════════

  const generateLocalSummary = () => {
    const source = getConversationSource();

    if (source.length === 0) {
      return null;
    }

    const serviceStats = getSafeStats();
    const fallbackStats = createFallbackStats(source);

    const stats =
      serviceStats.totalEntries > 0 ? serviceStats : fallbackStats;

    // Extract validated original text.
    const allTexts = source
      .map((item) => getEntryText(item, "original"))
      .filter(Boolean);

    // Preserve translated-text extraction for existing conversation data.
    const allTranslated = source
      .map((item) => getEntryText(item, "translated"))
      .filter(Boolean);

    // Use translated text only when original text is unavailable.
    const analysisTexts =
      allTexts.length > 0 ? allTexts : allTranslated;

    if (analysisTexts.length === 0) {
      return null;
    }

    // Key topics: frequent Unicode words appearing at least twice.
    const wordFreq = {};
    const stopWords = new Set([
      "this",
      "that",
      "with",
      "from",
      "have",
      "been",
      "will",
      "would",
      "could",
      "should",
      "about",
      "there",
      "their",
      "they",
      "what",
      "when",
      "where",
      "which",
      "these",
      "those",
      "than",
      "then",
      "also",
      "just",
      "more",
      "some",
      "other",
      "into",
      "only",
      "very",
      "your",
      "does",
      "doing",
    ]);

    analysisTexts.forEach((text) => {
      extractUnicodeWords(text)
        .filter(
          (word) =>
            isSignificantTopicWord(word) && !stopWords.has(word)
        )
        .forEach((word) => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
    });

    const keyTopics = Object.entries(wordFreq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([word]) => formatTopic(word));

    // Summary: first and last message context.
    const firstMsg = analysisTexts[0] || "";
    const lastMsg = analysisTexts[analysisTexts.length - 1] || "";
    const totalEntries = stats.totalEntries || source.length;
    const durationMin = stats.durationMin || 1;

    const summaryText =
      analysisTexts.length === 1
        ? `A brief exchange: "${truncateText(firstMsg, 120)}"`
        : `Conversation with ${totalEntries} exchanges over ~${durationMin} min. ` +
          `Started with "${truncateText(firstMsg, 80)}" ` +
          `and ended with "${truncateText(lastMsg, 80)}".`;

    // Speaker summaries.
    const youMsgs = source.filter(
      (item) =>
        item?.direction === "you" ||
        normalizeSpeaker(item?.speaker) === "you"
    );

    const themMsgs = source.filter(
      (item) =>
        item?.direction === "them" ||
        normalizeSpeaker(item?.speaker) === "them"
    );

    const speakerASummary =
      youMsgs.length > 0
        ? `Spoke ${youMsgs.length} times (~${countEntryWords(
            youMsgs
          )} words)`
        : "Did not speak in this session.";

    const speakerBSummary =
      themMsgs.length > 0
        ? `Spoke ${themMsgs.length} times (~${countEntryWords(
            themMsgs
          )} words)`
        : "Did not speak in this session.";

    // Detect action-item candidates with local keyword heuristics.
    const actionKeywords = [
      "please",
      "need to",
      "must",
      "should",
      "will do",
      "action",
      "follow up",
      "next step",
      "deadline",
      "assign",
      "task",
      "todo",
      "send me",
      "let me know",
      "update",
      "schedule",
      "complete",
    ];

    const actionItems = analysisTexts
      .filter((text) => containsKeyword(text, actionKeywords))
      .slice(0, 5)
      .map((text) => truncateText(text, 100));

    // Detect decision candidates with local keyword heuristics.
    const decisionKeywords = [
      "decided",
      "agreed",
      "confirmed",
      "approved",
      "let's go with",
      "final",
      "conclusion",
      "we will",
      "plan is",
      "go ahead",
    ];

    const decisions = analysisTexts
      .filter((text) => containsKeyword(text, decisionKeywords))
      .slice(0, 3)
      .map((text) => truncateText(text, 100));

    // Overall tone from locally stored emotion statistics.
    let overallTone = "Neutral";
    const emotionEntries = getValidEmotionEntries(stats.emotions);

    if (emotionEntries.length > 0) {
      emotionEntries.sort((a, b) => b[1] - a[1]);
      overallTone = emotionEntries[0][0];
    }

    // Follow-up suggestion.
    const followUp =
      actionItems.length > 0
        ? `Review ${actionItems.length} detected action-item candidate(s) and confirm owners.`
        : themMsgs.length > 0
        ? "Share the transcript with both parties for reference."
        : "No immediate follow-up needed.";

    return {
      summary: summaryText,
      keyTopics:
        keyTopics.length > 0 ? keyTopics : ["General conversation"],
      actionItems,
      decisions,
      speakerASummary,
      speakerBSummary,
      overallTone,
      followUp,
    };
  };

  // ════════════════════════════════════════
  //  MAIN HANDLER
  // ════════════════════════════════════════

  const handleSummarize = () => {
    if (!hasConversation()) {
      setSummary(null);
      setError("No conversation to analyze");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setVisible(true);
    setSummary(null);

    try {
      const localResult = generateLocalSummary();

      if (isValidSummary(localResult)) {
        setSummary(localResult);
      } else {
        setError("Could not generate conversation analysis. Try again.");
      }
    } catch (analysisError) {
      console.error("Conversation analysis failed:", analysisError);
      setError("Conversation analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const conversationAvailable = hasConversation();

  if (!visible) {
    return (
      <button
        type="button"
        className="ai-summary-trigger"
        onClick={handleSummarize}
        disabled={!conversationAvailable}
        title={
          conversationAvailable
            ? "Conversation Insights"
            : "Start a conversation first"
        }
      >
        <FaBrain />
        <span>Conversation Insights</span>
      </button>
    );
  }

  const transcriptData = getSafeTranscript();
  const displaySource =
    transcriptData.length > 0 ? transcriptData : safeMessages;

  const serviceStats = getSafeStats();
  const stats =
    serviceStats.totalEntries > 0
      ? serviceStats
      : createFallbackStats(displaySource);

  const emotionEntries = getValidEmotionEntries(stats.emotions).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="ai-summary-panel">
      <div className="ai-summary-header">
        <div className="ai-summary-title">
          <FaBrain className="ai-icon" />
          <span>Conversation Insights</span>
          <span className="ai-badge">Conversation Analysis</span>
        </div>

        <button
          type="button"
          className="ai-close"
          onClick={() => {
            setVisible(false);
            setSummary(null);
            setError("");
            setLoading(false);
          }}
        >
          <FaTimes />
        </button>
      </div>

      {stats.totalEntries > 0 && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            padding: "8px 18px",
            borderBottom:
              "1px solid var(--border, rgba(0,229,255,0.08))",
            fontSize: "0.62rem",
            fontFamily: "var(--font-mono, monospace)",
            color: "#6889b0",
            flexWrap: "wrap",
          }}
        >
          <span>
            <FaChartBar
              style={{ marginRight: "4px", color: "#00e5ff" }}
            />
            {stats.totalEntries} exchanges
          </span>
          <span>📝 {stats.totalWords} words</span>
          <span>⏱ ~{stats.durationMin || "<1"} min</span>
          {stats.youEntries > 0 && (
            <span>🧑 You: {stats.youEntries}</span>
          )}
          {stats.themEntries > 0 && (
            <span>👥 Them: {stats.themEntries}</span>
          )}
        </div>
      )}

      {loading && (
        <div className="ai-loading">
          <div className="ai-loading-dots">
            <span />
            <span />
            <span />
          </div>
          <p>Analyzing your conversation...</p>
        </div>
      )}

      {error && <div className="ai-error">{error}</div>}

      {summary && !loading && (
        <div className="ai-summary-body">
          {/* Summary */}
          <div className="ai-section">
            <div className="ai-section-label">
              <FaClipboardList /> Summary
            </div>
            <p className="ai-section-text">{summary.summary}</p>
          </div>

          {/* Key Topics */}
          {summary.keyTopics.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-label">
                <FaCompass /> Key Topics
              </div>
              <div className="ai-tags">
                {summary.keyTopics.map((topic, index) => (
                  <span
                    key={createStableKey("topic", topic, index)}
                    className="ai-tag"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {summary.actionItems.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-label">
                ✅ Detected Action-Item Candidates
              </div>
              <ul className="ai-list">
                {summary.actionItems.map((item, index) => (
                  <li key={createStableKey("action", item, index)}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          {summary.decisions.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-label">
                📌 Detected Decision Candidates
              </div>
              <ul className="ai-list">
                {summary.decisions.map((decision, index) => (
                  <li
                    key={createStableKey(
                      "decision",
                      decision,
                      index
                    )}
                  >
                    {decision}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Emotion breakdown */}
          {emotionEntries.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-label">
                🎭 Tone Analysis
              </div>
              <div className="ai-tags">
                {emotionEntries.map(([label, count]) => (
                  <span
                    key={`emotion-${label}`}
                    className="ai-tag"
                  >
                    {label}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Speakers */}
          <div className="ai-speakers">
            <div className="ai-speaker">
              <div className="ai-speaker-label">
                <FaUsers /> You ({getLangName(sourceLanguage)})
              </div>
              <p>{summary.speakerASummary}</p>
            </div>

            <div className="ai-speaker">
              <div className="ai-speaker-label">
                <FaUsers /> Them ({getLangName(targetLanguage)})
              </div>
              <p>{summary.speakerBSummary}</p>
            </div>
          </div>

          {/* Follow Up */}
          {summary.followUp && (
            <div className="ai-followup">
              <FaArrowRight />{" "}
              <strong>Suggested next step:</strong> {summary.followUp}
            </div>
          )}

          {/* Tone */}
          <div className="ai-tone">
            Overall tone: <strong>{summary.overallTone}</strong>
          </div>

          {/* Re-analyze button */}
          <button
            type="button"
            className="ai-generate-btn"
            onClick={handleSummarize}
            style={{ marginTop: "8px" }}
          >
            <FaRedo /> Re-analyze
          </button>
        </div>
      )}

      {!loading && !summary && !error && (
        <button
          type="button"
          className="ai-generate-btn"
          onClick={handleSummarize}
        >
          <FaBrain /> Generate Conversation Insights
        </button>
      )}
    </div>
  );
};

// ════════════════════════════════════════
//  VALIDATION AND ANALYSIS HELPERS
// ════════════════════════════════════════

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function getEntryText(entry, field) {
  const value = entry?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpeaker(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function extractUnicodeWords(text) {
  if (typeof text !== "string") {
    return [];
  }

  return (
    text
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu) || []
  );
}

function isSignificantTopicWord(word) {
  if (!word) {
    return false;
  }

  // Scripts such as Chinese and Japanese commonly use shorter tokens.
  const containsCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
    word
  );

  return containsCjk ? word.length >= 2 : word.length > 4;
}

function formatTopic(word) {
  if (!word) {
    return word;
  }

  // Locale-aware uppercase preserves scripts without casing.
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

function truncateText(text, maxLength) {
  const normalized =
    typeof text === "string"
      ? text.replace(/\s+/gu, " ").trim()
      : "";

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function countWords(text) {
  return extractUnicodeWords(text).length;
}

function countEntryWords(entries) {
  return entries.reduce((total, entry) => {
    const text =
      getEntryText(entry, "original") ||
      getEntryText(entry, "translated");

    return total + countWords(text);
  }, 0);
}

function containsKeyword(text, keywords) {
  if (typeof text !== "string") {
    return false;
  }

  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function getEmotionLabel(emotion) {
  if (typeof emotion === "string") {
    return emotion.trim();
  }

  if (
    emotion &&
    typeof emotion === "object" &&
    typeof emotion.label === "string"
  ) {
    return emotion.label.trim();
  }

  return "";
}

function createFallbackStats(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const emotions = {};

  let totalWords = 0;
  let youEntries = 0;
  let themEntries = 0;

  safeEntries.forEach((entry) => {
    const text =
      getEntryText(entry, "original") ||
      getEntryText(entry, "translated");

    totalWords += countWords(text);

    const speaker = normalizeSpeaker(
      entry?.direction || entry?.speaker
    );

    if (speaker === "you") {
      youEntries += 1;
    } else if (speaker === "them") {
      themEntries += 1;
    }

    const emotionLabel = getEmotionLabel(entry?.emotion);

    if (emotionLabel) {
      emotions[emotionLabel] = (emotions[emotionLabel] || 0) + 1;
    }
  });

  return {
    totalEntries: safeEntries.length,
    totalWords,
    durationMin: 0,
    youEntries,
    themEntries,
    emotions,
  };
}

function getValidEmotionEntries(emotions) {
  if (
    !emotions ||
    typeof emotions !== "object" ||
    Array.isArray(emotions)
  ) {
    return [];
  }

  return Object.entries(emotions).filter(
    ([label, count]) =>
      typeof label === "string" &&
      label.trim() &&
      Number.isFinite(Number(count)) &&
      Number(count) >= 0
  );
}

function isValidSummary(result) {
  return Boolean(
    result &&
      typeof result === "object" &&
      typeof result.summary === "string" &&
      result.summary.trim() &&
      Array.isArray(result.keyTopics) &&
      Array.isArray(result.actionItems) &&
      Array.isArray(result.decisions) &&
      typeof result.speakerASummary === "string" &&
      typeof result.speakerBSummary === "string" &&
      typeof result.overallTone === "string" &&
      typeof result.followUp === "string"
  );
}

function createStableKey(prefix, value, index) {
  const normalized =
    typeof value === "string"
      ? value.normalize("NFKC").trim().toLocaleLowerCase()
      : "";

  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }

  return `${prefix}-${Math.abs(hash)}-${index}`;
}

export default ConversationSummary;