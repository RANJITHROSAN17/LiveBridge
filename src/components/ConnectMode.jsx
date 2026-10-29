import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaLink, FaMicrophone, FaMicrophoneSlash, FaSignOutAlt } from "react-icons/fa";
import ConnectLobby from "./ConnectLobby";
import ConnectCaptions from "./ConnectCaptions";
import { createConnectService } from "../services/connectService";
import { createSignalingService } from "../services/signalingService";
import { translateText } from "../services/translationService";
import { addTranscript } from "../services/transcriptService";

const LOCALES = { en: "en-US", es: "es-ES" };
const RETRY_DELAYS = [250, 500, 1000, 2000, 3000];

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
}

function normalizeLanguage(value) {
  return value === "es" ? "es" : "en";
}

function oppositeLanguage(value) {
  return normalizeLanguage(value) === "es" ? "en" : "es";
}

function languageName(value) {
  return normalizeLanguage(value) === "es" ? "Spanish" : "English";
}

function getSpeechRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function bestTranscript(result) {
  if (!result?.length) return "";
  let best = result[0];
  for (let index = 1; index < result.length; index += 1) {
    const candidate = result[index];
    if (Number(candidate?.confidence || 0) > Number(best?.confidence || 0)) best = candidate;
  }
  return best?.transcript?.trim() || "";
}

const buttonStyle = {
  minHeight: "42px",
  padding: "10px 18px",
  borderRadius: "9999px",
  border: "1px solid rgba(0,229,255,0.2)",
  background: "rgba(0,229,255,0.08)",
  color: "#dffbff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontWeight: 700,
};

const ConnectMode = ({ sourceLanguage }) => {
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [connecting, setConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("idle");
  const [error, setError] = useState("");
  const [interimText, setInterimText] = useState("");
  const [captions, setCaptions] = useState([]);

  const mountedRef = useRef(false);
  const peerRef = useRef(null);
  const signalingRef = useRef(null);
  const recognitionRef = useRef(null);
  const sourceRef = useRef(normalizeLanguage(sourceLanguage));
  const connectionRef = useRef(connectionStatus);
  const keepListeningRef = useRef(false);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const generationRef = useRef(0);
  const startRecognizerRef = useRef(null);
  const offerStartedRef = useRef(false);
  const translationQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    sourceRef.current = normalizeLanguage(sourceLanguage);
  }, [sourceLanguage]);

  useEffect(() => {
    connectionRef.current = connectionStatus;
  }, [connectionStatus]);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    keepListeningRef.current = false;
    retryCountRef.current = 0;
    generationRef.current += 1;
    clearRetry();

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch { try { recognition.abort(); } catch { /* stopped */ } }
    }

    if (mountedRef.current) {
      setIsListening(false);
      setSpeechStatus("idle");
      setInterimText("");
    }
  }, [clearRetry]);

  const closeConnections = useCallback(() => {
    offerStartedRef.current = false;
    try { peerRef.current?.close?.(); } catch (closeError) { console.warn(closeError); }
    try { signalingRef.current?.close?.(); } catch (closeError) { console.warn(closeError); }
    peerRef.current = null;
    signalingRef.current = null;
  }, []);

  const leaveSession = useCallback(() => {
    stopListening();
    closeConnections();
    if (!mountedRef.current) return;
    setRoomId("");
    setRole("");
    setConnecting(false);
    setConnectionStatus("disconnected");
    setError("");
    setInterimText("");
    setCaptions([]);
  }, [closeConnections, stopListening]);

  const addCaption = useCallback((direction, original, translated, source, target, id = createId(), timestamp = Date.now()) => {
    setCaptions((current) => [
      ...current,
      { id, timestamp, direction, original, translated, sourceLanguage: source, targetLanguage: target },
    ]);
    addTranscript({
      id,
      timestamp,
      speaker: direction === "me" ? "you" : "them",
      original,
      translated,
      sourceLang: source,
      targetLang: target,
      emotion: null,
    });
  }, []);

  const receiveMessage = useCallback((message) => {
    if (message?.type !== "caption" || typeof message.text !== "string") return;

    translationQueueRef.current = translationQueueRef.current
      .then(async () => {
        const original = message.text.trim();
        if (!original) return;

        const incomingLanguage = normalizeLanguage(message.language);
        const targetLanguage = oppositeLanguage(incomingLanguage);
        const result = incomingLanguage === targetLanguage
          ? original
          : await translateText(original, incomingLanguage, targetLanguage);
        const translated = typeof result === "string" ? result.trim() : "";
        if (!translated) throw new Error("The translation service returned an empty caption.");
        if (!mountedRef.current) return;

        addCaption(
          "them",
          original,
          translated,
          incomingLanguage,
          targetLanguage,
          message.id || createId(),
          Number(message.timestamp) || Date.now()
        );
      })
      .catch((translationError) => {
        console.error("Incoming caption failed:", translationError);
        if (mountedRef.current) setError(translationError?.message || "The incoming caption could not be translated.");
      });
  }, [addCaption]);

  const createServices = useCallback(({ isHost }) => {
    closeConnections();
    offerStartedRef.current = false;

    const peer = createConnectService({
      onSignal: (signal) => signalingRef.current?.sendSignal(signal),
      onMessage: receiveMessage,
      onStateChange: (state) => {
        connectionRef.current = state;
        if (!mountedRef.current) return;
        setConnectionStatus(state);
        if (state === "connected") {
          setConnecting(false);
          setError("");
        }
        if (state === "failed") {
          stopListening();
          setConnecting(false);
          setError("The peer connection failed. This network may require a TURN relay.");
        }
        if (state === "disconnected" || state === "closed") stopListening();
      },
      onError: (peerError) => {
        if (mountedRef.current) setError(peerError?.message || "The peer connection failed.");
      },
    });

    peerRef.current = peer;

    const signaling = createSignalingService({
      onSignal: (signal) => peer.handleSignal(signal),
      onParticipantJoined: async () => {
        if (mountedRef.current) setConnectionStatus(isHost ? "connecting" : "waiting for host offer");
        if (!isHost || offerStartedRef.current) return;
        offerStartedRef.current = true;
        try { await peer.createOffer(); }
        catch (offerError) {
          offerStartedRef.current = false;
          if (mountedRef.current) setError(offerError?.message || "Could not start peer negotiation.");
        }
      },
      onParticipantLeft: () => {
        stopListening();
        offerStartedRef.current = false;
        if (mountedRef.current) {
          setConnecting(false);
          setConnectionStatus("participant left");
          setError("The other participant left the session.");
        }
      },
      onError: (signalingError) => {
        if (mountedRef.current) {
          setConnecting(false);
          setError(signalingError?.message || "Could not connect to the signaling service.");
        }
      },
    });

    signalingRef.current = signaling;
    return signaling;
  }, [closeConnections, receiveMessage, stopListening]);

  const createSession = useCallback(async (requestedRoomId) => {
    const normalized = normalizeRoomId(requestedRoomId);
    if (normalized.length !== 6) {
      setError("Session IDs must contain six valid characters.");
      return;
    }
    setError("");
    setConnecting(true);
    setRoomId(normalized);
    setRole("host");
    setConnectionStatus("waiting for participant");
    try { await createServices({ isHost: true }).createRoom(normalized); }
    catch (sessionError) {
      closeConnections();
      if (mountedRef.current) {
        setConnecting(false);
        setConnectionStatus("disconnected");
        setError(sessionError?.message || "Could not create the session.");
      }
    }
  }, [closeConnections, createServices]);

  const joinSession = useCallback(async (requestedRoomId) => {
    const normalized = normalizeRoomId(requestedRoomId);
    if (normalized.length !== 6) {
      setError("Enter a valid six-character session ID.");
      return;
    }
    setError("");
    setConnecting(true);
    setRoomId(normalized);
    setRole("participant");
    setConnectionStatus("joining");
    try { await createServices({ isHost: false }).joinRoom(normalized); }
    catch (sessionError) {
      closeConnections();
      if (mountedRef.current) {
        setConnecting(false);
        setConnectionStatus("disconnected");
        setError(sessionError?.message || "Could not join the session.");
      }
    }
  }, [closeConnections, createServices]);

  const sendFinalCaption = useCallback((text) => {
    const cleanText = typeof text === "string" ? text.trim() : "";
    if (!cleanText) return;

    const spokenLanguage = normalizeLanguage(sourceRef.current);
    const message = {
      type: "caption",
      id: createId(),
      text: cleanText,
      language: spokenLanguage,
      timestamp: Date.now(),
    };

    if (!peerRef.current?.sendMessage(message)) {
      setError("The participant is not connected, so the caption was not sent.");
      return;
    }

    addCaption("me", cleanText, cleanText, spokenLanguage, spokenLanguage, message.id, message.timestamp);
    setInterimText("");
  }, [addCaption]);

  const scheduleRestart = useCallback((reason) => {
    if (!keepListeningRef.current || !mountedRef.current || connectionRef.current !== "connected") return;
    if (retryTimerRef.current !== null) return;

    if (retryCountRef.current >= RETRY_DELAYS.length) {
      keepListeningRef.current = false;
      setIsListening(false);
      setSpeechStatus("temporarily unavailable");
      setError("Speech recognition is temporarily unavailable. Select Start Listening to try again.");
      return;
    }

    const attempt = retryCountRef.current;
    const delay = RETRY_DELAYS[attempt];
    retryCountRef.current += 1;
    setIsListening(true);
    setSpeechStatus("reconnecting");
    console.warn(`Restarting speech recognition after ${reason}. Attempt ${attempt + 1}.`);

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (keepListeningRef.current && mountedRef.current && connectionRef.current === "connected") {
        startRecognizerRef.current?.({ recovery: true });
      }
    }, delay);
  }, []);

  const startRecognizer = useCallback(({ recovery = false } = {}) => {
    if (!keepListeningRef.current || recognitionRef.current) return;
    if (connectionRef.current !== "connected") {
      stopListening();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) {
      keepListeningRef.current = false;
      setIsListening(false);
      setSpeechStatus("unavailable");
      setError("Speech recognition is not available in this browser.");
      return;
    }

    const spokenLanguage = normalizeLanguage(sourceRef.current);
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const recognition = new SpeechRecognition();

    recognition.lang = LOCALES[spokenLanguage];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = spokenLanguage === "es" ? 3 : 1;

    let recoverable = false;
    let fatal = false;

    recognition.onstart = () => {
      if (generation !== generationRef.current || !keepListeningRef.current) return;
      retryCountRef.current = 0;
      if (mountedRef.current) {
        setIsListening(true);
        setSpeechStatus(recovery ? "listening again" : "listening");
        setError("");
      }
    };

    recognition.onresult = (event) => {
      if (generation !== generationRef.current || !keepListeningRef.current) return;
      retryCountRef.current = 0;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = bestTranscript(result);
        if (!text) continue;
        if (result.isFinal) sendFinalCaption(text);
        else interim += `${text} `;
      }
      if (mountedRef.current) {
        setInterimText(interim.trim());
        setSpeechStatus("listening");
      }
    };

    recognition.onerror = (event) => {
      if (generation !== generationRef.current) return;
      if (event.error === "network" || event.error === "no-speech") {
        recoverable = true;
        if (mountedRef.current && keepListeningRef.current) setSpeechStatus("reconnecting");
        return;
      }
      if (event.error === "aborted") {
        recoverable = keepListeningRef.current;
        return;
      }
      fatal = true;
      keepListeningRef.current = false;
      if (!mountedRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone or speech recognition permission was denied.");
      } else if (event.error === "audio-capture") {
        setError("LiveBridge could not access the microphone.");
      } else {
        setError(`Speech recognition stopped: ${event.error}.`);
      }
    };

    recognition.onend = () => {
      if (generation !== generationRef.current) return;
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (fatal || !keepListeningRef.current || connectionRef.current !== "connected") {
        if (mountedRef.current) {
          setIsListening(false);
          setSpeechStatus("idle");
          setInterimText("");
        }
        return;
      }
      scheduleRestart(recoverable ? "a temporary recognition interruption" : "the recognition session ending");
    };

    recognitionRef.current = recognition;
    if (mountedRef.current) {
      setIsListening(true);
      setSpeechStatus(recovery ? "reconnecting" : "starting");
    }

    try { recognition.start(); }
    catch (recognitionError) {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      const alreadyStarted = recognitionError?.name === "InvalidStateError";
      if (alreadyStarted && keepListeningRef.current) scheduleRestart("the browser recognizer still closing");
      else {
        keepListeningRef.current = false;
        if (mountedRef.current) {
          setIsListening(false);
          setSpeechStatus("idle");
          setError(recognitionError?.message || "Could not start microphone recognition.");
        }
      }
    }
  }, [scheduleRestart, sendFinalCaption, stopListening]);

  useEffect(() => { startRecognizerRef.current = startRecognizer; }, [startRecognizer]);

  const startListening = useCallback(() => {
    if (connectionRef.current !== "connected") {
      setError("Connect to the other participant before starting recognition.");
      return;
    }
    if (keepListeningRef.current) return;
    keepListeningRef.current = true;
    retryCountRef.current = 0;
    clearRetry();
    setError("");
    setInterimText("");
    setSpeechStatus("starting");
    setIsListening(true);
    startRecognizerRef.current?.({ recovery: false });
  }, [clearRetry]);

  useEffect(() => {
    if (recognitionRef.current || keepListeningRef.current) stopListening();
  }, [sourceLanguage, stopListening]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      keepListeningRef.current = false;
      clearRetry();
      generationRef.current += 1;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try { recognition?.abort?.(); } catch { /* stopped */ }
    };
  }, [clearRetry]);

  if (!roomId) {
    return (
      <ConnectLobby
        onCreate={createSession}
        onJoin={joinSession}
        connecting={connecting}
        error={error}
      />
    );
  }

  const isConnected = connectionStatus === "connected";
  const selectedSource = normalizeLanguage(sourceLanguage);
  const selectedTarget = oppositeLanguage(selectedSource);

  return (
    <div className="voice-mode">
      <div style={{ width: "100%", maxWidth: "920px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, color: "#f8fafc" }}>
              <FaLink aria-hidden="true" style={{ color: "#00e5ff" }} />
              LiveBridge Connect
            </h2>
            <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
              Session: <strong>{roomId}</strong> · {role === "host" ? "Host" : "Participant"}
            </p>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.72rem" }}>
              Speak <strong>{languageName(selectedSource)}</strong>; incoming captions are automatically shown in <strong>{languageName(selectedTarget)}</strong>.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <div role="status" aria-live="polite" style={{ padding: "6px 10px", borderRadius: "9999px", border: `1px solid ${isConnected ? "rgba(0,200,83,0.3)" : "rgba(255,255,255,0.1)"}`, background: isConnected ? "rgba(0,200,83,0.1)" : "rgba(255,255,255,0.03)", color: isConnected ? "#00C853" : "#94a3b8", fontSize: "0.68rem", fontWeight: 700 }}>
              Connection: {connectionStatus}
            </div>
            {isListening && (
              <div style={{ color: speechStatus === "reconnecting" ? "#fbbf24" : "#00e5ff", fontSize: "0.65rem", fontWeight: 700 }}>
                Microphone: {speechStatus}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,23,68,0.2)", background: "rgba(255,23,68,0.06)", color: "#ff6b6b", fontSize: "0.75rem" }}>
            {error}
          </div>
        )}

        <ConnectCaptions captions={captions} interimText={interimText} connectionStatus={connectionStatus} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" disabled={!isConnected || isListening} onClick={startListening} style={{ ...buttonStyle, background: isConnected && !isListening ? "linear-gradient(135deg, #00b8d4, #007c91)" : "rgba(100,116,139,0.15)", opacity: !isConnected || isListening ? 0.5 : 1, cursor: !isConnected || isListening ? "not-allowed" : "pointer" }}>
            <FaMicrophone aria-hidden="true" />
            {isListening ? (speechStatus === "reconnecting" ? "Reconnecting" : "Listening") : "Start Listening"}
          </button>
          <button type="button" disabled={!isListening} onClick={stopListening} style={{ ...buttonStyle, opacity: !isListening ? 0.5 : 1, cursor: !isListening ? "not-allowed" : "pointer" }}>
            <FaMicrophoneSlash aria-hidden="true" /> Stop Listening
          </button>
          <button type="button" onClick={leaveSession} style={buttonStyle}>
            <FaSignOutAlt aria-hidden="true" /> Leave Session
          </button>
        </div>

        <div style={{ color: "#64748b", fontSize: "0.68rem", lineHeight: 1.5, textAlign: "center" }}>
          English speech is translated to Spanish. Spanish speech, including recognized English terms, is translated as one complete phrase to English.
        </div>
      </div>
    </div>
  );
};

export default ConnectMode;
