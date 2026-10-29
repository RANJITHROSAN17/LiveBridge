import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaExclamationTriangle,
  FaHeadphones,
  FaPlay,
  FaStop,
} from "react-icons/fa";

import AudioSourceSelector from "./AudioSourceSelector";
import LiveCaptionPanel from "./LiveCaptionPanel";

import {
  SOURCE_TYPES,
  startAudioCapture,
  stopAudioCapture,
} from "../services/audioCaptureService";

import {
  createStreamingSpeechSession,
  isStreamingSpeechSupported,
} from "../services/streamingSpeechService";

import { translateText } from "../services/translationService";
import { addTranscript } from "../services/transcriptService";
import { detectEmotion } from "../services/emotionService";

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

function getErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return (
      "Capture permission was not granted. " +
      "Select Start Capture and authorize the required audio source."
    );
  }

  return (
    error?.message ||
    "Listen Mode could not start audio capture."
  );
}

const ListenMode = ({ languages, sessionId }) => {
  const [sourceLanguage, setSourceLanguage] =
    useState("es");

  const [targetLanguage, setTargetLanguage] =
    useState("en");

  const [audioSource, setAudioSource] =
    useState(SOURCE_TYPES.MICROPHONE);

  const [isCapturing, setIsCapturing] =
    useState(false);

  const [status, setStatus] =
    useState("Ready");

  const [error, setError] =
    useState("");

  const [interimText, setInterimText] =
    useState("");

  const [translatingText, setTranslatingText] =
    useState("");

  const [captions, setCaptions] =
    useState([]);

  const captureRef = useRef(null);
  const speechSessionRef = useRef(null);
  const mountedRef = useRef(true);

  const processingChainRef =
    useRef(Promise.resolve());

  const safeLanguages =
    Array.isArray(languages)
      ? languages
      : [];

  const getLanguageName = (code) => {
    return (
      safeLanguages.find(
        (language) =>
          language?.code === code
      )?.name || code
    );
  };

  const stopCapture = useCallback(() => {
    speechSessionRef.current?.stop?.();
    speechSessionRef.current = null;

    stopAudioCapture(captureRef.current);
    captureRef.current = null;

    if (mountedRef.current) {
      setIsCapturing(false);
      setInterimText("");
      setTranslatingText("");
      setStatus("Stopped");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      speechSessionRef.current?.stop?.();
      speechSessionRef.current = null;

      stopAudioCapture(captureRef.current);
      captureRef.current = null;
    };
  }, []);

  useEffect(() => {
    stopCapture();

    setCaptions([]);
    setError("");
    setStatus("Ready");

    processingChainRef.current =
      Promise.resolve();
  }, [sessionId, stopCapture]);

  const processFinalSegment =
    useCallback(
      async (originalText) => {
        const original =
          typeof originalText === "string"
            ? originalText.trim()
            : "";

        if (
          !original ||
          !mountedRef.current
        ) {
          return;
        }

        setInterimText("");
        setTranslatingText(original);

        try {
          const result =
            await translateText(
              original,
              sourceLanguage,
              targetLanguage
            );

          if (!mountedRef.current) {
            return;
          }

          if (
            typeof result !== "string" ||
            !result.trim()
          ) {
            throw new Error(
              "The translation service returned an empty result."
            );
          }

          const translated =
            result.trim();

          const id = createId();
          const timestamp = Date.now();

          const analysisText =
            sourceLanguage === "en"
              ? original
              : targetLanguage === "en"
                ? translated
                : original;

          const emotion =
            detectEmotion(analysisText);

          const caption = {
            id,
            timestamp,
            original,
            translated,
          };

          addTranscript({
            id,
            timestamp,
            sessionId,
            speaker: "them",
            direction: "them",
            original,
            translated,
            sourceLang:
              sourceLanguage,
            targetLang:
              targetLanguage,
            emotion,
          });

          if (!mountedRef.current) {
            return;
          }

          setCaptions((current) => [
            ...current,
            caption,
          ]);

          setTranslatingText("");
        } catch (translationError) {
          if (!mountedRef.current) {
            return;
          }

          console.error(
            "Listen Mode translation failed:",
            translationError
          );

          setTranslatingText("");

          setError(
            translationError?.message ||
              "A finalized segment could not be translated."
          );
        }
      },
      [
        sessionId,
        sourceLanguage,
        targetLanguage,
      ]
    );

  const queueFinalSegment =
    useCallback(
      (text) => {
        processingChainRef.current =
          processingChainRef.current
            .then(() =>
              processFinalSegment(text)
            )
            .catch((processingError) => {
              console.error(
                "Listen Mode segment processing failed:",
                processingError
              );
            });
      },
      [processFinalSegment]
    );

  const startCapture = async () => {
    if (isCapturing) {
      return;
    }

    setError("");
    setInterimText("");
    setTranslatingText("");

    setStatus(
      "Requesting permission..."
    );

    try {
      if (!isStreamingSpeechSupported()) {
        throw new Error(
          "This browser does not support the MediaRecorder and WebSocket features required by Listen Mode."
        );
      }

      const capture =
        await startAudioCapture(
          audioSource
        );

      if (!mountedRef.current) {
        stopAudioCapture(capture);
        return;
      }

      captureRef.current = capture;

      const handleTrackEnded = () => {
        if (!mountedRef.current) {
          return;
        }

        stopCapture();
      };

      capture.capturedStream
        .getTracks()
        .forEach((track) => {
          track.addEventListener(
            "ended",
            handleTrackEnded,
            {
              once: true,
            }
          );
        });

      setIsCapturing(true);

      setStatus(
        "Connecting to speech recognition..."
      );

      speechSessionRef.current =
        createStreamingSpeechSession({
          stream: capture.stream,

          language: sourceLanguage,

          onInterim: (text) => {
            if (!mountedRef.current) {
              return;
            }

            setInterimText(text);
          },

          onFinal: queueFinalSegment,

          onError: (speechError) => {
            if (!mountedRef.current) {
              return;
            }

            console.error(
              "Listen Mode speech recognition failed:",
              speechError
            );

            const message =
              getErrorMessage(
                speechError
              );

            speechSessionRef.current
              ?.stop?.();

            speechSessionRef.current =
              null;

            stopAudioCapture(
              captureRef.current
            );

            captureRef.current =
              null;

            setIsCapturing(false);
            setInterimText("");
            setTranslatingText("");

            setStatus(
              "Speech recognition error"
            );

            setError(message);
          },

          onStateChange: (
            nextState
          ) => {
            if (!mountedRef.current) {
              return;
            }

            if (
              nextState ===
              "connected"
            ) {
              setStatus(
                "Connected. Starting speech recognition..."
              );
              return;
            }

            if (
              nextState ===
              "streaming"
            ) {
              setStatus(
                "Capture active"
              );
              return;
            }

            if (
              nextState ===
              "recognition-stopped"
            ) {
              setStatus(
                "Speech recognition stopped"
              );
            }
          },
        });
    } catch (captureError) {
      console.error(
        "Listen Mode capture failed:",
        captureError
      );

      speechSessionRef.current?.stop?.();
      speechSessionRef.current = null;

      stopAudioCapture(
        captureRef.current
      );

      captureRef.current = null;

      if (mountedRef.current) {
        setIsCapturing(false);
        setInterimText("");
        setTranslatingText("");
        setStatus("Ready");

        setError(
          getErrorMessage(
            captureError
          )
        );
      }
    }
  };

  return (
    <div className="voice-mode">
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                margin: 0,
                color: "#f0f0f5",
                fontSize: "1.05rem",
              }}
            >
              <FaHeadphones
                aria-hidden="true"
                style={{
                  color: "#B84DFF",
                }}
              />

              Listen Mode
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "#64748b",
                fontSize: "0.75rem",
              }}
            >
              Progressive captions only.
              Listen Mode never synthesizes
              translated speech.
            </p>
          </div>

          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 12px",
              borderRadius: "9999px",
              border: isCapturing
                ? "1px solid rgba(0,200,83,0.28)"
                : "1px solid rgba(255,255,255,0.08)",
              background:
                isCapturing
                  ? "rgba(0,200,83,0.1)"
                  : "rgba(255,255,255,0.03)",
              color:
                isCapturing
                  ? "#00C853"
                  : "#94a3b8",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  isCapturing
                    ? "#00C853"
                    : "#64748b",
                boxShadow:
                  isCapturing
                    ? "0 0 10px rgba(0,200,83,0.55)"
                    : "none",
              }}
            />

            {status}
          </div>
        </div>

        <AudioSourceSelector
          value={audioSource}
          onChange={setAudioSource}
          disabled={isCapturing}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              flex: "1 1 180px",
              color: "#64748b",
              fontSize: "0.65rem",
            }}
          >
            Source language

            <select
              className="lang-select"
              value={sourceLanguage}
              disabled={isCapturing}
              onChange={(event) =>
                setSourceLanguage(
                  event.target.value
                )
              }
              style={{
                display: "block",
                width: "100%",
                marginTop: "5px",
              }}
            >
              {safeLanguages.map(
                (language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.flag}{" "}
                    {language.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label
            style={{
              flex: "1 1 180px",
              color: "#64748b",
              fontSize: "0.65rem",
            }}
          >
            Caption language

            <select
              className="lang-select"
              value={targetLanguage}
              disabled={isCapturing}
              onChange={(event) =>
                setTargetLanguage(
                  event.target.value
                )
              }
              style={{
                display: "block",
                width: "100%",
                marginTop: "5px",
              }}
            >
              {safeLanguages.map(
                (language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.flag}{" "}
                    {language.name}
                  </option>
                )
              )}
            </select>
          </label>

          <button
            type="button"
            aria-label={
              isCapturing
                ? "Stop Listen Mode capture"
                : "Start Listen Mode capture"
            }
            onClick={
              isCapturing
                ? stopCapture
                : startCapture
            }
            style={{
              minHeight: "38px",
              padding: "9px 20px",
              border: "none",
              borderRadius: "9999px",
              background:
                isCapturing
                  ? "linear-gradient(135deg, #ef4444, #dc2626)"
                  : "linear-gradient(135deg, #A100FF, #7B00CC)",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontWeight: 700,
              boxShadow:
                isCapturing
                  ? "0 0 24px rgba(239,68,68,0.25)"
                  : "0 0 24px rgba(161,0,255,0.25)",
            }}
          >
            {isCapturing ? (
              <FaStop
                aria-hidden="true"
              />
            ) : (
              <FaPlay
                aria-hidden="true"
              />
            )}

            {isCapturing
              ? "Stop"
              : "Start Capture"}
          </button>
        </div>

        {audioSource ===
          SOURCE_TYPES.SYSTEM && (
          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: "0.7rem",
            }}
          >
            System Audio availability
            depends on your browser and
            operating system. Select a
            share option that explicitly
            includes audio.
          </p>
        )}

        {audioSource ===
          SOURCE_TYPES.BROWSER && (
          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: "0.7rem",
            }}
          >
            Choose the browser tab that is
            playing audio and enable Share
            tab audio in the browser sharing
            dialog.
          </p>
        )}

        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              border:
                "1px solid rgba(255,23,68,0.22)",
              borderRadius: "8px",
              background:
                "rgba(255,23,68,0.06)",
              color: "#ff6b6b",
              fontSize: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            <FaExclamationTriangle
              aria-hidden="true"
              style={{
                marginTop: "2px",
              }}
            />

            {error}
          </div>
        )}

        <LiveCaptionPanel
          captions={captions}
          interimText={interimText}
          translatingText={
            translatingText
          }
          sourceLanguageName={
            getLanguageName(
              sourceLanguage
            )
          }
          targetLanguageName={
            getLanguageName(
              targetLanguage
            )
          }
        />
      </div>
    </div>
  );
};

export default ListenMode;