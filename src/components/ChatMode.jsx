import React, { useEffect, useRef, useState } from "react";
import { FaComments, FaPaperPlane } from "react-icons/fa";
import { translateText } from "../services/translationService";
import { detectEmotion } from "../services/emotionService";
import { addToMemory, clearMemory } from "../services/memoryService";
import { addTranscript } from "../services/transcriptService";
import { scanBeforeSending } from "../services/dataGuardService";
import EmotionBadge from "./EmotionBadge";

/**
 * Format text by detecting code blocks and paragraphs.
 * Handles triple-backtick code blocks, inline code, and multiline text.
 */
function formatText(text) {
  if (!text) return null;

  const parts = [];
  const remaining = text;
  let key = 0;

  // Split by triple-backtick code blocks first.
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(remaining)) !== null) {
    // Text before the code block.
    if (match.index > lastIndex) {
      const before = remaining.slice(lastIndex, match.index);
      parts.push(...formatInlineText(before, key));
      key += 100;
    }

    // Code block itself, without the triple backticks.
    const codeContent = match[0]
      .replace(/^```\w*\n?/, "")
      .replace(/\n?```$/, "");

    parts.push(
      <code
        key={`code-${key++}`}
        className="msg-code-block"
      >
        {codeContent}
      </code>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the final code block.
  if (lastIndex < remaining.length) {
    const after = remaining.slice(lastIndex);
    parts.push(...formatInlineText(after, key));
  }

  // If no code blocks were found, format the text inline.
  if (parts.length === 0) {
    return formatInlineText(remaining, 0);
  }

  return parts;
}

/**
 * Format inline text by handling inline code and line breaks.
 */
function formatInlineText(text, startKey) {
  if (!text || !text.trim()) return [];

  const parts = [];
  const key = startKey;

  // Split by inline-code backticks.
  const segments = text.split(/(`[^`]+`)/g);

  const content = segments.map((segment, index) => {
    if (
      segment.startsWith("`") &&
      segment.endsWith("`") &&
      segment.length > 2
    ) {
      return (
        <span
          key={`inline-${key}-${index}`}
          className="msg-inline-code"
        >
          {segment.slice(1, -1)}
        </span>
      );
    }

    return segment;
  });

  parts.push(
    <span
      key={`text-${key}`}
      style={{ display: "inline" }}
    >
      {content}
    </span>
  );

  return parts;
}

/**
 * Creates one stable message identifier.
 */
function createMessageId() {
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
 * Returns a safe error message for the visible failed-message state.
 */
function getErrorMessage(error) {
  if (
    error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return "Translation failed. Please try again.";
}

const ChatMode = ({
  sourceLanguage,
  targetLanguage,
  languages,
}) => {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);

  /*
   * Protect state updates made after asynchronous translation work.
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /*
   * Clear only contextual conversation memory when the language pair
   * changes. Existing visible message history remains unchanged.
   */
  useEffect(() => {
    clearMemory();
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTranslating]);

  const getLanguageName = (code) => {
    const languageList = Array.isArray(languages)
      ? languages
      : [];

    const language = languageList.find(
      (item) => item?.code === code
    );

    return language ? language.name : code;
  };

  const handleSend = async () => {
    const text = inputText.trim();

    if (!text || isTranslating) {
      return;
    }

    /*
     * Data Guard — scan before the text leaves the device for the
     * external translation API. Hard secrets/IDs are blocked outright;
     * possible confidential wording is confirmed by the user first.
     */
    const guard = scanBeforeSending(text);

    if (guard.level === "blocked") {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: createMessageId(),
          original: text,
          translated: "",
          sourceLang: sourceLanguage,
          targetLang: targetLanguage,
          emotion: {
            emotion: "neutral",
            emoji: "🛡️",
            color: "#ff4d6d",
            label: "Blocked",
            confidence: 1,
            intensity: "high",
            tone: "neutral",
          },
          timestamp: Date.now(),
          status: "error",
          errorMessage: `${guard.reason}. Nothing was sent for translation.`,
        },
      ]);
      return;
    }

    if (
      guard.level === "warning" &&
      !window.confirm(
        `${guard.reason}.\n\nSend this text for translation anyway?`
      )
    ) {
      return;
    }

    /*
     * Generate these values once and reuse them for the visible
     * message and successful transcript entry.
     */
    const id = createMessageId();
    const timestamp = Date.now();

    setInputText("");

    if (inputRef.current) {
      inputRef.current.style.height = "36px";
    }

    setIsTranslating(true);

    try {
      const translated = await translateText(
        text,
        sourceLanguage,
        targetLanguage
      );

      /*
       * Do not update component state or session services if this
       * component was unmounted while translation was in progress.
       */
      if (!isMountedRef.current) {
        return;
      }

      if (
        typeof translated !== "string" ||
        !translated.trim()
      ) {
        throw new Error(
          "The translation service returned an empty result."
        );
      }

      const cleanTranslation = translated.trim();

      /*
       * Analyze English text where available:
       * - Source English: analyze the original text.
       * - Target English: analyze the translated English text.
       * - Otherwise: analyze the original text.
       */
      const textForAnalysis =
        sourceLanguage === "en"
          ? text
          : targetLanguage === "en"
          ? cleanTranslation
          : text;

      const emotion = detectEmotion(textForAnalysis);

      const message = {
        id,
        original: text,
        translated: cleanTranslation,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        emotion,
        timestamp,
        status: "success",
      };

      /*
       * Store only successful translations in conversation memory
       * and the shared transcript service.
       */
      addToMemory(text, cleanTranslation);

      addTranscript({
        id,
        original: text,
        translated: cleanTranslation,
        speaker: "you",
        direction: "you",
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        emotion,
        timestamp,
      });

      setMessages((previousMessages) => [
        ...previousMessages,
        message,
      ]);
    } catch (error) {
      console.error("Chat translation error:", error);

      if (!isMountedRef.current) {
        return;
      }

      /*
       * Failed translations remain visible in Chat Mode but are not
       * added to conversation memory or the shared transcript.
       */
      const failedMessage = {
        id,
        original: text,
        translated: "",
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        emotion: {
          emotion: "neutral",
          emoji: "😐",
          color: "#64748b",
          label: "Neutral",
          confidence: 0,
          intensity: "low",
          tone: "neutral",
        },
        timestamp,
        status: "error",
        errorMessage: getErrorMessage(error),
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        failedMessage,
      ]);
    } finally {
      if (isMountedRef.current) {
        setIsTranslating(false);
        inputRef.current?.focus();
      }
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-mode">
      <div className="chat-messages">
        {messages.length === 0 && !isTranslating ? (
          <div className="chat-messages-empty">
            <FaComments className="empty-icon" />
            <p>Start typing to translate...</p>

            <p
              style={{
                fontSize: "0.75rem",
                opacity: 0.5,
              }}
            >
              {getLanguageName(sourceLanguage)} →{" "}
              {getLanguageName(targetLanguage)}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className="message-group"
              >
                <div className="message-meta left">
                  <span className="message-lang-tag">
                    {getLanguageName(message.sourceLang)}
                  </span>

                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                </div>

                <div className="message-bubble original">
                  {formatText(message.original)}
                </div>

                {message.status === "error" ? (
                  <div
                    className="message-bubble translated"
                    role="alert"
                    style={{
                      color: "#ff6b6b",
                      borderColor: "rgba(255,107,107,0.25)",
                      background: "rgba(255,107,107,0.06)",
                    }}
                  >
                    <strong>Translation failed.</strong>
                    <br />
                    {message.errorMessage}
                  </div>
                ) : (
                  <div className="message-bubble translated">
                    {formatText(message.translated)}
                  </div>
                )}

                <div className="message-meta right">
                  {message.status !== "error" && (
                    <EmotionBadge emotion={message.emotion} />
                  )}

                  <span className="message-lang-tag">
                    {getLanguageName(message.targetLang)}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {isTranslating && (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />

            <span style={{ marginLeft: "6px" }}>
              Translating...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputText}
          onChange={(event) =>
            setInputText(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={`Type in ${getLanguageName(
            sourceLanguage
          )}... (Shift+Enter for new line)`}
          disabled={isTranslating}
          maxLength={5000}
          rows={1}
          style={{
            resize: "none",
            minHeight: "36px",
            maxHeight: "100px",
            overflowY: "auto",
            lineHeight: "1.4",
            padding: "8px 14px",
            borderRadius: "22px",
            whiteSpace: "pre-wrap",
            fontSize: "0.88rem",
          }}
          onInput={(event) => {
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(
              event.currentTarget.scrollHeight,
              100
            )}px`;
          }}
        />

        <button
          type="button"
          className="send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || isTranslating}
          aria-label="Send message for translation"
        >
          <FaPaperPlane aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default ChatMode;