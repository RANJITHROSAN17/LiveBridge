import React, { useState } from "react";
import {
  FaArrowRight,
  FaCheck,
  FaCopy,
  FaShareAlt,
  FaStar,
  FaVolumeUp,
} from "react-icons/fa";

import EmotionBadge from "./EmotionBadge";
import { speak } from "../services/speechService";
import { addBookmark } from "../services/transcriptService";

const TranslationCard = ({
  original,
  translated,
  sourceLang,
  targetLang,
  emotion,
  timestamp,
  languages,
}) => {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const safeLanguages = Array.isArray(languages)
    ? languages
    : [];

  const getLanguageName = (code) => {
    const language = safeLanguages.find(
      (item) => item?.code === code
    );

    return language?.name || code || "Unknown";
  };

  const getLanguageFlag = (code) => {
    const language = safeLanguages.find(
      (item) => item?.code === code
    );

    return language?.flag || "🌐";
  };

  const getValidTranslatedText = () => {
    return typeof translated === "string"
      ? translated.trim()
      : "";
  };

  const handleCopy = async () => {
    const validTranslatedText =
      getValidTranslatedText();

    if (!validTranslatedText) {
      console.warn(
        "Copy skipped because translated text is unavailable."
      );
      return;
    }

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        throw new Error(
          "Clipboard access is unavailable."
        );
      }

      await navigator.clipboard.writeText(
        validTranslatedText
      );

      setCopied(true);
      setShowSuccess(true);

      setTimeout(() => {
        setCopied(false);
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy translation:",
        error
      );
    }
  };

  const handleSpeak = async () => {
    const validTranslatedText =
      getValidTranslatedText();

    if (!validTranslatedText) {
      console.warn(
        "Speech skipped because translated text is unavailable."
      );
      return;
    }

    try {
      setSpeaking(true);

      await speak(validTranslatedText, targetLang);
    } catch (error) {
      console.error(
        "Failed to speak translation:",
        error
      );
    } finally {
      setSpeaking(false);
    }
  };

  const handleShare = async () => {
    const validTranslatedText =
      getValidTranslatedText();

    if (!validTranslatedText) {
      console.warn(
        "Share skipped because translated text is unavailable."
      );
      return;
    }

    const safeOriginal =
      typeof original === "string"
        ? original.trim()
        : "";

    const shareText = safeOriginal
      ? `${safeOriginal}\n→ ${validTranslatedText}`
      : validTranslatedText;

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "LiveBridge Translation",
          text: shareText,
        });

        return;
      }

      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        throw new Error(
          "Sharing and clipboard access are unavailable."
        );
      }

      await navigator.clipboard.writeText(shareText);

      setCopied(true);
      setShowSuccess(true);

      setTimeout(() => {
        setCopied(false);
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      const sharingWasCancelled =
        error?.name === "AbortError";

      if (!sharingWasCancelled) {
        console.error(
          "Failed to share translation:",
          error
        );
      }
    }
  };

  const handleBookmark = () => {
    /*
     * TODO: addBookmark() currently bookmarks the latest transcript
     * entry, which may not necessarily be the TranslationCard that
     * the user clicked. Update this when the transcript API supports
     * bookmarking a specific entry ID.
     */
    addBookmark("Important");

    setBookmarked(true);

    setTimeout(() => {
      setBookmarked(false);
    }, 3000);
  };

  const formatTime = (value) => {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Communication Signal helpers retained for compatibility.
  const intensity = emotion?.intensity || null;

  const tone =
    emotion?.tone && emotion.tone !== "neutral"
      ? emotion.tone
      : null;

  const secondary = emotion?.secondary || null;

  const getIntensityStyle = (value) => {
    if (value === "high") {
      return {
        bg: "rgba(255,23,68,0.1)",
        border: "rgba(255,23,68,0.25)",
        color: "#ff1744",
        label: "HIGH",
      };
    }

    if (value === "medium") {
      return {
        bg: "rgba(255,145,0,0.08)",
        border: "rgba(255,145,0,0.2)",
        color: "#ff9100",
        label: "MED",
      };
    }

    if (value === "low") {
      return {
        bg: "rgba(0,229,255,0.06)",
        border: "rgba(0,229,255,0.15)",
        color: "#00e5ff",
        label: "LOW",
      };
    }

    return null;
  };

  const intensityData = intensity
    ? getIntensityStyle(intensity)
    : null;

  return (
    <div className="translation-card">
      <div className="card-glow-line" />

      {showSuccess && (
        <div className="card-success-overlay">
          <FaCheck className="success-check" />
          <span>Copied!</span>
        </div>
      )}

      <div className="card-header">
        <div className="card-lang-flow">
          <span className="card-lang-badge source">
            <span className="card-lang-flag">
              {getLanguageFlag(sourceLang)}
            </span>

            {getLanguageName(sourceLang)}
          </span>

          <div className="card-arrow-wrap">
            <FaArrowRight className="card-arrow" />
          </div>

          <span className="card-lang-badge target">
            <span className="card-lang-flag">
              {getLanguageFlag(targetLang)}
            </span>

            {getLanguageName(targetLang)}
          </span>
        </div>

        <span className="card-timestamp">
          {formatTime(timestamp)}
        </span>
      </div>

      <div className="card-body">
        <div className="card-text-section">
          <span className="card-section-label">
            Original
          </span>

          <p className="card-original-text">
            {original}
          </p>
        </div>

        <div className="card-divider">
          <div className="card-divider-line" />
          <div className="card-divider-icon">✦</div>
          <div className="card-divider-line" />
        </div>

        <div className="card-text-section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="card-section-label translated-label">
              Translated
            </span>
          </div>

          <p className="card-translated-text">
            {translated}
          </p>
        </div>
      </div>

      <div className="card-footer">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <EmotionBadge emotion={emotion} />

          {intensityData && (
            <span
              style={{
                padding: "1px 6px",
                fontSize: "0.48rem",
                fontWeight: 700,
                fontFamily:
                  "var(--font-mono, monospace)",
                background: intensityData.bg,
                border: `1px solid ${intensityData.border}`,
                color: intensityData.color,
                borderRadius: "2px",
                textTransform: "uppercase",
              }}
            >
              {intensityData.label}
            </span>
          )}

          {tone && (
            <span
              style={{
                padding: "1px 6px",
                fontSize: "0.48rem",
                fontWeight: 700,
                fontFamily:
                  "var(--font-mono, monospace)",
                color:
                  tone === "formal"
                    ? "#7c4dff"
                    : "#00e676",
                opacity: 0.7,
                textTransform: "uppercase",
              }}
            >
              {tone}
            </span>
          )}

          {secondary && (
            <span
              style={{
                fontSize: "0.52rem",
                color: "#6889b0",
                fontFamily:
                  "var(--font-mono, monospace)",
              }}
              title={`Also: ${
                secondary.label || "Secondary signal"
              }`}
            >
              +{secondary.emoji}
            </span>
          )}
        </div>

        <div className="card-actions">
          <button
            type="button"
            className={`card-action-btn ${
              bookmarked ? "success" : ""
            }`}
            onClick={handleBookmark}
            title="Bookmark"
            aria-label={
              bookmarked
                ? "Translation bookmarked"
                : "Bookmark translation"
            }
          >
            <FaStar aria-hidden="true" />

            <span className="action-label">
              {bookmarked ? "Saved" : "Mark"}
            </span>
          </button>

          <button
            type="button"
            className={`card-action-btn ${
              copied ? "success" : ""
            }`}
            onClick={handleCopy}
            title="Copy"
            aria-label={
              copied
                ? "Translation copied"
                : "Copy translated text"
            }
          >
            {copied ? (
              <FaCheck aria-hidden="true" />
            ) : (
              <FaCopy aria-hidden="true" />
            )}

            <span className="action-label">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>

          <button
            type="button"
            className={`card-action-btn ${
              speaking ? "active speaking" : ""
            }`}
            onClick={handleSpeak}
            title="Listen"
            aria-label={
              speaking
                ? "Translation is playing"
                : "Listen to translated text"
            }
            disabled={speaking}
          >
            <FaVolumeUp aria-hidden="true" />

            <span className="action-label">
              {speaking ? "Playing" : "Listen"}
            </span>
          </button>

          <button
            type="button"
            className="card-action-btn"
            onClick={handleShare}
            title="Share"
            aria-label="Share translation"
          >
            <FaShareAlt aria-hidden="true" />

            <span className="action-label">
              Share
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranslationCard;