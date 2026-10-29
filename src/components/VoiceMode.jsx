import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaExclamationTriangle,
  FaUser,
  FaUsers,
  FaExchangeAlt,
  FaArrowRight,
  FaDownload,
  FaFileAlt,
  FaClosedCaptioning,
  FaCode,
} from "react-icons/fa";

import {
  startListening,
  stopListening,
  stopSpeaking,
  speak,
  isSupported,
} from "../services/speechService";

import { translateText } from "../services/translationService";
import { detectEmotion } from "../services/emotionService";
import {
  addToMemory,
  clearMemory,
} from "../services/memoryService";

import {
  addTranscript,
  getTranscriptStats,
} from "../services/transcriptService";

import {
  exportTXT,
  exportSRT,
  exportJSON,
} from "../services/exportService";

import TranslationCard from "./TranslationCard";
import SmartReplies from "./SmartReplies";
import VoiceSettings from "./VoiceSettings";
import ConversationDashboard from "./ConversationDashboard";

/**
 * Creates a stable ID for both the transcript entry and UI entry.
 */
function createEntryId() {
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

const VoiceMode = ({
  sourceLanguage,
  targetLanguage,
  languages,
}) => {
  const [mode, setMode] = useState("oneway");

  const [isListening, setIsListening] =
    useState(false);

  const [interimText, setInterimText] =
    useState("");

  const [statusText, setStatusText] =
    useState("");

  const recRef = useRef(null);

  const [activeChannel, setActiveChannel] =
    useState(null);

  const [youInterim, setYouInterim] =
    useState("");

  const [themInterim, setThemInterim] =
    useState("");

  const [youStatus, setYouStatus] =
    useState("");

  const [themStatus, setThemStatus] =
    useState("");

  const youRecRef = useRef(null);
  const themRecRef = useRef(null);

  const [translations, setTranslations] =
    useState([]);

  const [showExport, setShowExport] =
    useState(false);

  const [lastTranslated, setLastTranslated] =
    useState("");

  const timeoutRefs = useRef([]);
  const mountedRef = useRef(true);

  const supported = isSupported();

  /**
   * Creates a timeout that will automatically be cleaned up
   * when the component unmounts.
   */
  const createSafeTimeout = useCallback(
    (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        timeoutRefs.current =
          timeoutRefs.current.filter(
            (storedId) => storedId !== timeoutId
          );

        if (mountedRef.current) {
          callback();
        }
      }, delay);

      timeoutRefs.current.push(timeoutId);

      return timeoutId;
    },
    []
  );

  /**
   * Stops one-way recognition without changing unrelated state.
   */
  const stopOneWayRecognition =
    useCallback(() => {
      if (recRef.current) {
        const recognition = recRef.current;
        recRef.current = null;
        stopListening(recognition);
      }

      setIsListening(false);
      setInterimText("");
      setStatusText("");
    }, []);

  /**
   * Stops both conversation microphone channels.
   */
  const stopAllChannels = useCallback(() => {
    if (youRecRef.current) {
      const recognition = youRecRef.current;
      youRecRef.current = null;
      stopListening(recognition);
    }

    if (themRecRef.current) {
      const recognition = themRecRef.current;
      themRecRef.current = null;
      stopListening(recognition);
    }

    setActiveChannel(null);
    setYouInterim("");
    setThemInterim("");
    setYouStatus("");
    setThemStatus("");
  }, []);

  /**
   * Stops active speech recognition when the selected
   * languages change and clears conversation memory.
   *
   * Existing translation history remains visible.
   */
  useEffect(() => {
    stopOneWayRecognition();
    stopAllChannels();
    stopSpeaking();
    clearMemory();
  }, [
    sourceLanguage,
    targetLanguage,
    stopOneWayRecognition,
    stopAllChannels,
  ]);

  /**
   * Component cleanup.
   *
   * Prevents recognition, speech synthesis, and pending status
   * timers from continuing after VoiceMode is unmounted.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (recRef.current) {
        stopListening(recRef.current);
        recRef.current = null;
      }

      if (youRecRef.current) {
        stopListening(youRecRef.current);
        youRecRef.current = null;
      }

      if (themRecRef.current) {
        stopListening(themRecRef.current);
        themRecRef.current = null;
      }

      stopSpeaking();

      timeoutRefs.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });

      timeoutRefs.current = [];
    };
  }, []);

  /**
   * Returns a display name for a language code.
   */
  const getLangName = useCallback(
    (code) => {
      const language = languages.find(
        (item) => item.code === code
      );

      return language ? language.name : code;
    },
    [languages]
  );

  /**
   * Adds an utterance to the transcript service and
   * visible conversation history.
   */
  const saveTranslation = useCallback(
    ({
      original,
      translated,
      sourceLang,
      targetLang,
      direction,
      speaker,
      emotion,
    }) => {
      const id = createEntryId();
      const timestamp = Date.now();

      const entry = {
        id,
        speaker,
        original,
        translated,
        sourceLang,
        targetLang,
        emotion,
        timestamp,
        direction,
      };

      addToMemory(original, translated);

      addTranscript({
        id,
        speaker,
        original,
        translated,
        sourceLang,
        targetLang,
        emotion,
        timestamp,
      });

      setTranslations((previousTranslations) => [
        entry,
        ...previousTranslations,
      ]);

      return entry;
    },
    []
  );

  /**
   * Speaks translated text without hiding synthesis errors.
   *
   * Translation remains successful even when the browser
   * cannot play the generated speech.
   */
  const speakSafely = useCallback(
    async (text, language) => {
      try {
        await speak(text, language);
        return true;
      } catch (error) {
        console.error(
          "Speech synthesis error:",
          error
        );

        return false;
      }
    },
    []
  );

  /**
   * Smart reply handler.
   *
   * SmartReplies currently produces English reply suggestions,
   * so the reply is translated from English to the target language.
   */
  const handleSmartReply = useCallback(
    async (replyText) => {
      const normalizedReply =
        typeof replyText === "string"
          ? replyText.trim()
          : "";

      if (!normalizedReply) {
        console.warn(
          "Smart reply ignored because it was empty."
        );

        return;
      }

      try {
        const smartReplySourceLanguage = "en";

        const translated = await translateText(
          normalizedReply,
          smartReplySourceLanguage,
          targetLanguage
        );

        if (
          typeof translated !== "string" ||
          !translated.trim()
        ) {
          throw new Error(
            "Smart reply translation returned empty text."
          );
        }

        const cleanedTranslation =
          translated.trim();

        const emotion = detectEmotion(
          normalizedReply
        );

        saveTranslation({
          original: normalizedReply,
          translated: cleanedTranslation,
          sourceLang: smartReplySourceLanguage,
          targetLang: targetLanguage,
          direction: "you",
          speaker: "you",
          emotion,
        });

        setLastTranslated(cleanedTranslation);

        await speakSafely(
          cleanedTranslation,
          targetLanguage
        );
      } catch (error) {
        console.error(
          "Smart reply error:",
          error
        );
      }
    },
    [
      targetLanguage,
      saveTranslation,
      speakSafely,
    ]
  );

  // ==========================================================
  // One-way handlers
  // ==========================================================

  const handleOneWayResult = useCallback(
    async (finalText) => {
      const normalizedText =
        typeof finalText === "string"
          ? finalText.trim()
          : "";

      if (!normalizedText) {
        setInterimText("");
        return;
      }

      setInterimText("");
      setStatusText("Translating...");

      try {
        const translated = await translateText(
          normalizedText,
          sourceLanguage,
          targetLanguage
        );

        if (
          typeof translated !== "string" ||
          !translated.trim()
        ) {
          throw new Error(
            "Translation returned empty text."
          );
        }

        const cleanedTranslation =
          translated.trim();

        const emotion =
          detectEmotion(normalizedText);

        saveTranslation({
          original: normalizedText,
          translated: cleanedTranslation,
          sourceLang: sourceLanguage,
          targetLang: targetLanguage,
          direction: "you",
          speaker: "you",
          emotion,
        });

        setLastTranslated(cleanedTranslation);
        setStatusText("Speaking...");

        await speakSafely(
          cleanedTranslation,
          targetLanguage
        );

        if (mountedRef.current) {
          setStatusText("");
        }
      } catch (error) {
        console.error(
          "One-way translation error:",
          error
        );

        setStatusText("Error. Try again.");

        createSafeTimeout(() => {
          setStatusText("");
        }, 3000);
      }
    },
    [
      sourceLanguage,
      targetLanguage,
      saveTranslation,
      speakSafely,
      createSafeTimeout,
    ]
  );

  const toggleOneWay = useCallback(() => {
    if (isListening) {
      stopOneWayRecognition();
      return;
    }

    stopAllChannels();
    stopSpeaking();

    setStatusText("Listening...");
    setInterimText("");
    setIsListening(true);

    const recognition = startListening(
      sourceLanguage,

      handleOneWayResult,

      (text) => {
        setInterimText(text);
      },

      () => {
        /*
         * Ignore onend from an old recognizer that has already
         * been removed intentionally.
         */
        if (!recRef.current) {
          return;
        }

        recRef.current = null;
        setIsListening(false);
        setInterimText("");

        setStatusText((currentStatus) =>
          currentStatus === "Listening..."
            ? ""
            : currentStatus
        );
      },

      (error) => {
        recRef.current = null;
        setIsListening(false);
        setInterimText("");

        const isPermissionError =
          error?.error === "not-allowed" ||
          error?.error === "service-not-allowed";

        setStatusText(
          isPermissionError
            ? "Mic access denied."
            : "Speech recognition error. Try again."
        );

        createSafeTimeout(() => {
          setStatusText("");
        }, 4000);
      }
    );

    if (!recognition) {
      setIsListening(false);
      setInterimText("");
      setStatusText(
        "Unable to start speech recognition."
      );

      createSafeTimeout(() => {
        setStatusText("");
      }, 4000);

      return;
    }

    recRef.current = recognition;
  }, [
    isListening,
    sourceLanguage,
    handleOneWayResult,
    stopOneWayRecognition,
    stopAllChannels,
    createSafeTimeout,
  ]);

  // ==========================================================
  // Conversation handlers
  // ==========================================================

  const handleYouResult = useCallback(
    async (finalText) => {
      const normalizedText =
        typeof finalText === "string"
          ? finalText.trim()
          : "";

      if (!normalizedText) {
        setYouInterim("");
        return;
      }

      setYouInterim("");
      setYouStatus("Translating...");

      try {
        const translated = await translateText(
          normalizedText,
          sourceLanguage,
          targetLanguage
        );

        if (
          typeof translated !== "string" ||
          !translated.trim()
        ) {
          throw new Error(
            "Translation returned empty text."
          );
        }

        const cleanedTranslation =
          translated.trim();

        const emotion =
          detectEmotion(normalizedText);

        saveTranslation({
          original: normalizedText,
          translated: cleanedTranslation,
          sourceLang: sourceLanguage,
          targetLang: targetLanguage,
          direction: "you",
          speaker: "you",
          emotion,
        });

        setLastTranslated(cleanedTranslation);
        setYouStatus("Speaking...");

        await speakSafely(
          cleanedTranslation,
          targetLanguage
        );

        if (mountedRef.current) {
          setYouStatus("");
        }
      } catch (error) {
        console.error(
          "Your translation error:",
          error
        );

        setYouStatus("Error. Try again.");

        createSafeTimeout(() => {
          setYouStatus("");
        }, 3000);
      }
    },
    [
      sourceLanguage,
      targetLanguage,
      saveTranslation,
      speakSafely,
      createSafeTimeout,
    ]
  );

  const handleThemResult = useCallback(
    async (finalText) => {
      const normalizedText =
        typeof finalText === "string"
          ? finalText.trim()
          : "";

      if (!normalizedText) {
        setThemInterim("");
        return;
      }

      setThemInterim("");
      setThemStatus("Translating...");

      try {
        const translated = await translateText(
          normalizedText,
          targetLanguage,
          sourceLanguage
        );

        if (
          typeof translated !== "string" ||
          !translated.trim()
        ) {
          throw new Error(
            "Translation returned empty text."
          );
        }

        const cleanedTranslation =
          translated.trim();

        const emotion =
          detectEmotion(normalizedText);

        saveTranslation({
          original: normalizedText,
          translated: cleanedTranslation,
          sourceLang: targetLanguage,
          targetLang: sourceLanguage,
          direction: "them",
          speaker: "them",
          emotion,
        });

        setLastTranslated(cleanedTranslation);
        setThemStatus("Speaking...");

        await speakSafely(
          cleanedTranslation,
          sourceLanguage
        );

        if (mountedRef.current) {
          setThemStatus("");
        }
      } catch (error) {
        console.error(
          "Participant translation error:",
          error
        );

        setThemStatus("Error. Try again.");

        createSafeTimeout(() => {
          setThemStatus("");
        }, 3000);
      }
    },
    [
      sourceLanguage,
      targetLanguage,
      saveTranslation,
      speakSafely,
      createSafeTimeout,
    ]
  );

  const toggleYou = useCallback(() => {
    if (activeChannel === "you") {
      if (youRecRef.current) {
        const recognition =
          youRecRef.current;

        youRecRef.current = null;
        stopListening(recognition);
      }

      setActiveChannel(null);
      setYouInterim("");
      setYouStatus("");

      return;
    }

    if (themRecRef.current) {
      const recognition =
        themRecRef.current;

      themRecRef.current = null;
      stopListening(recognition);
    }

    stopSpeaking();

    setThemInterim("");
    setThemStatus("");
    setYouInterim("");
    setActiveChannel("you");
    setYouStatus("Listening...");

    const recognition = startListening(
      sourceLanguage,

      handleYouResult,

      (text) => {
        setYouInterim(text);
      },

      () => {
        /*
         * If the recognizer reference is already null,
         * it was stopped intentionally while switching channels.
         */
        if (!youRecRef.current) {
          return;
        }

        youRecRef.current = null;

        setActiveChannel((currentChannel) =>
          currentChannel === "you"
            ? null
            : currentChannel
        );

        setYouInterim("");

        setYouStatus((currentStatus) =>
          currentStatus === "Listening..."
            ? ""
            : currentStatus
        );
      },

      (error) => {
        youRecRef.current = null;

        setActiveChannel((currentChannel) =>
          currentChannel === "you"
            ? null
            : currentChannel
        );

        setYouInterim("");

        const isPermissionError =
          error?.error === "not-allowed" ||
          error?.error === "service-not-allowed";

        setYouStatus(
          isPermissionError
            ? "Mic access denied."
            : "Speech recognition error."
        );

        createSafeTimeout(() => {
          setYouStatus("");
        }, 3000);
      }
    );

    if (!recognition) {
      setActiveChannel(null);
      setYouInterim("");
      setYouStatus(
        "Unable to start speech recognition."
      );

      createSafeTimeout(() => {
        setYouStatus("");
      }, 3000);

      return;
    }

    youRecRef.current = recognition;
  }, [
    activeChannel,
    sourceLanguage,
    handleYouResult,
    createSafeTimeout,
  ]);

  const toggleThem = useCallback(() => {
    if (activeChannel === "them") {
      if (themRecRef.current) {
        const recognition =
          themRecRef.current;

        themRecRef.current = null;
        stopListening(recognition);
      }

      setActiveChannel(null);
      setThemInterim("");
      setThemStatus("");

      return;
    }

    if (youRecRef.current) {
      const recognition =
        youRecRef.current;

      youRecRef.current = null;
      stopListening(recognition);
    }

    stopSpeaking();

    setYouInterim("");
    setYouStatus("");
    setThemInterim("");
    setActiveChannel("them");
    setThemStatus("Listening...");

    const recognition = startListening(
      targetLanguage,

      handleThemResult,

      (text) => {
        setThemInterim(text);
      },

      () => {
        /*
         * Ignore the onend event from an intentionally
         * stopped recognizer.
         */
        if (!themRecRef.current) {
          return;
        }

        themRecRef.current = null;

        setActiveChannel((currentChannel) =>
          currentChannel === "them"
            ? null
            : currentChannel
        );

        setThemInterim("");

        setThemStatus((currentStatus) =>
          currentStatus === "Listening..."
            ? ""
            : currentStatus
        );
      },

      (error) => {
        themRecRef.current = null;

        setActiveChannel((currentChannel) =>
          currentChannel === "them"
            ? null
            : currentChannel
        );

        setThemInterim("");

        const isPermissionError =
          error?.error === "not-allowed" ||
          error?.error === "service-not-allowed";

        setThemStatus(
          isPermissionError
            ? "Mic access denied."
            : "Speech recognition error."
        );

        createSafeTimeout(() => {
          setThemStatus("");
        }, 3000);
      }
    );

    if (!recognition) {
      setActiveChannel(null);
      setThemInterim("");
      setThemStatus(
        "Unable to start speech recognition."
      );

      createSafeTimeout(() => {
        setThemStatus("");
      }, 3000);

      return;
    }

    themRecRef.current = recognition;
  }, [
    activeChannel,
    targetLanguage,
    handleThemResult,
    createSafeTimeout,
  ]);

  const switchMode = useCallback(
    (newMode) => {
      if (
        newMode !== "oneway" &&
        newMode !== "conversation"
      ) {
        return;
      }

      if (newMode === mode) {
        return;
      }

      stopOneWayRecognition();
      stopAllChannels();
      stopSpeaking();
      setMode(newMode);
    },
    [
      mode,
      stopOneWayRecognition,
      stopAllChannels,
    ]
  );

  if (!supported) {
    return (
      <div
        className="voice-mode"
        style={{
          textAlign: "center",
          padding: "40px",
        }}
      >
        <FaExclamationTriangle
          style={{
            fontSize: "2rem",
            color: "#f59e0b",
            marginBottom: 12,
          }}
        />

        <p style={{ color: "#94a3b8" }}>
          Speech recognition is not supported in
          this browser. Try a supported version of
          Chrome or Edge.
        </p>
      </div>
    );
  }

  const stats = getTranscriptStats();

  return (
    <div className="voice-mode">
      {/* Mode Toggle + Voice Settings */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "6px",
            background:
              "rgba(255,255,255,0.05)",
            borderRadius: "12px",
            border:
              "1px solid rgba(255,255,255,0.08)",
            maxWidth: "400px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              switchMode("oneway")
            }
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              fontWeight:
                mode === "oneway" ? 600 : 500,
              background:
                mode === "oneway"
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "transparent",
              color:
                mode === "oneway"
                  ? "white"
                  : "#94a3b8",
              boxShadow:
                mode === "oneway"
                  ? "0 0 20px rgba(99,102,241,0.3)"
                  : "none",
              transition: "all 0.3s ease",
            }}
          >
            <FaUser />
            One-Way
          </button>

          <button
            type="button"
            onClick={() =>
              switchMode("conversation")
            }
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              fontWeight:
                mode === "conversation"
                  ? 600
                  : 500,
              background:
                mode === "conversation"
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "transparent",
              color:
                mode === "conversation"
                  ? "white"
                  : "#94a3b8",
              boxShadow:
                mode === "conversation"
                  ? "0 0 20px rgba(99,102,241,0.3)"
                  : "none",
              transition: "all 0.3s ease",
            }}
          >
            <FaUsers />
            Conversation
          </button>
        </div>

        <VoiceSettings
          targetLanguage={targetLanguage}
        />
      </div>

      {/* One-way mode */}
      {mode === "oneway" && (
        <div className="mic-section">
          <div
            className={`waveform ${
              isListening ? "active" : ""
            }`}
          >
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="waveform-bar"
              />
            ))}
          </div>

          <button
            type="button"
            className={`mic-button ${
              isListening ? "listening" : ""
            }`}
            onClick={toggleOneWay}
            aria-label={
              isListening
                ? "Stop listening"
                : "Start listening"
            }
          >
            {isListening ? (
              <FaMicrophoneSlash />
            ) : (
              <FaMicrophone />
            )}
          </button>

          {statusText && (
            <p
              className={`mic-status ${
                isListening ? "active" : ""
              }`}
            >
              {statusText}
            </p>
          )}

          {interimText && (
            <p
              style={{
                color: "#94a3b8",
                fontStyle: "italic",
                fontSize: "0.9rem",
                textAlign: "center",
                maxWidth: 500,
              }}
            >
              {interimText}
            </p>
          )}

          {!isListening && !statusText && (
            <p className="mic-hint">
              Speak in{" "}
              {getLangName(sourceLanguage)} → hear
              in {getLangName(targetLanguage)}
            </p>
          )}

          <SmartReplies
            lastTranslatedText={lastTranslated}
            onSelectReply={handleSmartReply}
          />
        </div>
      )}

      {/* Conversation mode */}
      {mode === "conversation" && (
        <>
          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
              alignItems: "flex-start",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {/* You panel */}
            <div
              style={{
                flex: "1 1 240px",
                maxWidth: "360px",
                background:
                  "rgba(255,255,255,0.03)",
                border:
                  "1px solid rgba(99,102,241,0.2)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                transition: "all 0.3s ease",
                boxShadow:
                  activeChannel === "you"
                    ? "0 0 30px rgba(99,102,241,0.15)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#818cf8",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                <FaUser />
                You
              </div>

              <div
                style={{
                  padding: "4px 14px",
                  borderRadius: "9999px",
                  background:
                    "rgba(99,102,241,0.1)",
                  border:
                    "1px solid rgba(99,102,241,0.2)",
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                }}
              >
                {getLangName(sourceLanguage)}
              </div>

              <div
                className={`waveform ${
                  activeChannel === "you"
                    ? "active"
                    : ""
                }`}
              >
                {[...Array(5)].map(
                  (_, index) => (
                    <div
                      key={index}
                      className="waveform-bar"
                    />
                  )
                )}
              </div>

              <button
                type="button"
                className={`mic-button ${
                  activeChannel === "you"
                    ? "listening"
                    : ""
                }`}
                onClick={toggleYou}
                style={{
                  width: "72px",
                  height: "72px",
                  fontSize: "1.6rem",
                }}
                aria-label={
                  activeChannel === "you"
                    ? "Stop your microphone"
                    : "Start your microphone"
                }
              >
                {activeChannel === "you" ? (
                  <FaMicrophoneSlash />
                ) : (
                  <FaMicrophone />
                )}
              </button>

              {youStatus && (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color:
                      activeChannel === "you"
                        ? "#818cf8"
                        : "#94a3b8",
                    fontWeight: 500,
                  }}
                >
                  {youStatus}
                </p>
              )}

              {youInterim && (
                <p
                  style={{
                    color: "#94a3b8",
                    fontStyle: "italic",
                    fontSize: "0.8rem",
                    textAlign: "center",
                  }}
                >
                  {youInterim}
                </p>
              )}

              {!activeChannel &&
                !youStatus && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      textAlign: "center",
                    }}
                  >
                    Tap to speak{" "}
                    {getLangName(
                      sourceLanguage
                    )}
                  </p>
                )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.7rem",
                  color: "#64748b",
                  marginTop: "4px",
                }}
              >
                {getLangName(sourceLanguage)}
                <FaArrowRight
                  style={{ color: "#818cf8" }}
                />
                {getLangName(targetLanguage)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                padding: "10px 0",
              }}
            >
              <FaExchangeAlt
                style={{
                  fontSize: "1.2rem",
                  color: "#6366f1",
                  opacity: 0.5,
                }}
              />
            </div>

            {/* Them panel */}
            <div
              style={{
                flex: "1 1 240px",
                maxWidth: "360px",
                background:
                  "rgba(255,255,255,0.03)",
                border:
                  "1px solid rgba(139,92,246,0.2)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                transition: "all 0.3s ease",
                boxShadow:
                  activeChannel === "them"
                    ? "0 0 30px rgba(139,92,246,0.15)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#a78bfa",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                <FaUsers />
                Them
              </div>

              <div
                style={{
                  padding: "4px 14px",
                  borderRadius: "9999px",
                  background:
                    "rgba(139,92,246,0.1)",
                  border:
                    "1px solid rgba(139,92,246,0.2)",
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                }}
              >
                {getLangName(targetLanguage)}
              </div>

              <div
                className={`waveform ${
                  activeChannel === "them"
                    ? "active"
                    : ""
                }`}
              >
                {[...Array(5)].map(
                  (_, index) => (
                    <div
                      key={index}
                      className="waveform-bar"
                      style={{
                        background: "#a78bfa",
                      }}
                    />
                  )
                )}
              </div>

              <button
                type="button"
                className={`mic-button ${
                  activeChannel === "them"
                    ? "listening"
                    : ""
                }`}
                onClick={toggleThem}
                style={{
                  width: "72px",
                  height: "72px",
                  fontSize: "1.6rem",
                  background:
                    activeChannel === "them"
                      ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                      : "linear-gradient(135deg, #8b5cf6, #a78bfa)",
                }}
                aria-label={
                  activeChannel === "them"
                    ? "Stop participant microphone"
                    : "Start participant microphone"
                }
              >
                {activeChannel === "them" ? (
                  <FaMicrophoneSlash />
                ) : (
                  <FaMicrophone />
                )}
              </button>

              {themStatus && (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color:
                      activeChannel === "them"
                        ? "#a78bfa"
                        : "#94a3b8",
                    fontWeight: 500,
                  }}
                >
                  {themStatus}
                </p>
              )}

              {themInterim && (
                <p
                  style={{
                    color: "#94a3b8",
                    fontStyle: "italic",
                    fontSize: "0.8rem",
                    textAlign: "center",
                  }}
                >
                  {themInterim}
                </p>
              )}

              {!activeChannel &&
                !themStatus && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      textAlign: "center",
                    }}
                  >
                    Tap when they speak{" "}
                    {getLangName(
                      targetLanguage
                    )}
                  </p>
                )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.7rem",
                  color: "#64748b",
                  marginTop: "4px",
                }}
              >
                {getLangName(targetLanguage)}
                <FaArrowRight
                  style={{ color: "#a78bfa" }}
                />
                {getLangName(sourceLanguage)}
              </div>
            </div>
          </div>

          <SmartReplies
            lastTranslatedText={lastTranslated}
            onSelectReply={handleSmartReply}
          />
        </>
      )}

      {/* Conversation history */}
      {translations.length > 0 && (
        <>
          <div
            className="section-divider"
            style={{ width: "100%" }}
          />

          <div
            className="history-panel"
            style={{ width: "100%" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <h3
                className="history-title"
                style={{ margin: 0 }}
              >
                Conversation History

                {stats.totalEntries > 0 && (
                  <span
                    style={{
                      marginLeft: "10px",
                      fontSize: "0.6rem",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background:
                        "rgba(0,229,255,0.08)",
                      border:
                        "1px solid rgba(0,229,255,0.15)",
                      color: "#00e5ff",
                      fontWeight: 600,
                      fontFamily:
                        "var(--font-mono, monospace)",
                    }}
                  >
                    {stats.totalEntries} entries ·{" "}
                    {stats.totalWords} words
                    {stats.durationMin > 0 &&
                      ` · ${stats.durationMin}m`}
                  </span>
                )}
              </h3>

              <div
                style={{
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowExport(
                      (current) => !current
                    )
                  }
                  aria-expanded={showExport}
                  aria-label="Export conversation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    border:
                      "1px solid rgba(0,229,255,0.15)",
                    borderRadius: "6px",
                    background:
                      "rgba(0,229,255,0.06)",
                    color: "#00e5ff",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily:
                      "var(--font-mono, monospace)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    transition:
                      "all 0.2s ease",
                  }}
                >
                  <FaDownload />
                  Export
                </button>

                {showExport && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      background: "#0a0e22",
                      border:
                        "1px solid rgba(0,229,255,0.18)",
                      borderRadius: "8px",
                      padding: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      zIndex: 100,
                      minWidth: "160px",
                      boxShadow:
                        "0 0 30px rgba(0,229,255,0.1)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        exportTXT();
                        setShowExport(false);
                      }}
                      style={exportBtnStyle}
                    >
                      <FaFileAlt
                        style={{
                          color: "#00e5ff",
                        }}
                      />
                      Transcript (.txt)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportSRT();
                        setShowExport(false);
                      }}
                      style={exportBtnStyle}
                    >
                      <FaClosedCaptioning
                        style={{
                          color: "#7c4dff",
                        }}
                      />
                      Subtitles (.srt)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportJSON();
                        setShowExport(false);
                      }}
                      style={exportBtnStyle}
                    >
                      <FaCode
                        style={{
                          color: "#00e676",
                        }}
                      />
                      Data (.json)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
              }}
            >
              <ConversationDashboard />
            </div>

            {translations.map(
              (translation) => (
                <div
                  key={translation.id}
                  style={{
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      zIndex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background:
                        translation.direction ===
                        "you"
                          ? "rgba(99,102,241,0.15)"
                          : "rgba(139,92,246,0.15)",
                      color:
                        translation.direction ===
                        "you"
                          ? "#818cf8"
                          : "#a78bfa",
                      border: `1px solid ${
                        translation.direction ===
                        "you"
                          ? "rgba(99,102,241,0.3)"
                          : "rgba(139,92,246,0.3)"
                      }`,
                    }}
                  >
                    {translation.direction ===
                    "you" ? (
                      <FaUser />
                    ) : (
                      <FaUsers />
                    )}

                    {translation.direction ===
                    "you"
                      ? "You"
                      : "Them"}
                  </div>

                  <TranslationCard
                    original={
                      translation.original
                    }
                    translated={
                      translation.translated
                    }
                    sourceLang={
                      translation.sourceLang
                    }
                    targetLang={
                      translation.targetLang
                    }
                    emotion={
                      translation.emotion
                    }
                    timestamp={
                      translation.timestamp
                    }
                    languages={languages}
                  />
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};

const exportBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  border: "none",
  borderRadius: "6px",
  background: "transparent",
  color: "#c8e6ff",
  fontSize: "0.78rem",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.15s",
};

export default VoiceMode;