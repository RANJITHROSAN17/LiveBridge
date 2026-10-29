/**
 * LiveBridge — App Shell
 * ----------------------
 * Wires together the four interpreter modes and the global widgets:
 *   - Voice Interpreter  (VoiceMode)
 *   - Chat Translator    (ChatMode)
 *   - Live Listener      (ListenMode)
 *   - Connect            (ConnectMode)
 *
 * Plus global overlays/widgets:
 *   - SecurityBanner      privacy notice (once per session)
 *   - PrivacyBadge        data-handling indicator
 *   - SessionTimeout      shown after 30 min of inactivity (securityService)
 *   - SubtitleOverlay     movie-style live captions of the transcript
 *   - VoiceAssistant      hands-free Q&A panel (needs server/search-api.js)
 *   - ConversationSummary AI conversation insights (uses transcript service)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FaGlobeAmericas,
  FaComments,
  FaHeadphones,
  FaLink,
  FaRobot,
  FaClosedCaptioning,
  FaExchangeAlt,
  FaTimes,
  FaWifi,
} from "react-icons/fa";

import VoiceMode from "./components/VoiceMode.jsx";
import ChatMode from "./components/ChatMode.jsx";
import ListenMode from "./components/ListenMode.jsx";
import ConnectMode from "./components/ConnectMode.jsx";
import VoiceAssistant from "./components/VoiceAssistant.jsx";
import ConversationSummary from "./components/ConversationSummary.jsx";
import SubtitleOverlay from "./components/SubtitleOverlay.jsx";
import SessionTimeout from "./components/SessionTimeout.jsx";
import SecurityBanner from "./components/SecurityBanner.jsx";
import PrivacyBadge from "./components/PrivacyBadge.jsx";

import { checkOllamaStatus } from "./services/aiService.js";
import {
  startSessionMonitor,
  stopSessionMonitor,
  resetSessionActivity,
} from "./services/securityService.js";

/**
 * Languages exposed across LiveBridge.
 * Codes match translationService's SUPPORTED_LANGUAGES and
 * speechService's LOCALE_MAP (en, hi, ta, te, es, fr, de, ja, zh,
 * ar, ko, pt, ru, it, bn, kn, ml, mr, gu, pa).
 */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "it", name: "Italian" },
  { code: "bn", name: "Bengali" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "pa", name: "Punjabi" },
];

const MODES = [
  {
    id: "voice",
    label: "Voice Interpreter",
    hint: "Real-time two-way speech translation",
    Icon: FaGlobeAmericas,
  },
  {
    id: "chat",
    label: "Chat Translator",
    hint: "Type text and translate instantly",
    Icon: FaComments,
  },
  {
    id: "listen",
    label: "Live Listener",
    hint: "Caption & translate any audio source",
    Icon: FaHeadphones,
  },
  {
    id: "connect",
    label: "Connect",
    hint: "Peer-to-peer interpreted session",
    Icon: FaLink,
  },
];

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const App = () => {
  const [mode, setMode] = useState("voice");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ta");

  const [sessionExpired, setSessionExpired] = useState(false);
  const [subtitlesVisible, setSubtitlesVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState({
    running: false,
    model: null,
    models: [],
  });

  // Stable per-visit session id (used by ListenMode transcript entries).
  const sessionIdRef = useRef(createSessionId());

  /* ────────────────────────────────────────────────
   *  Ollama status (AI features availability)
   * ──────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const status = await checkOllamaStatus();
      if (!cancelled) {
        setOllamaStatus(status);
      }
    };

    refresh();
    const interval = setInterval(refresh, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* ────────────────────────────────────────────────
   *  Inactivity monitor (30 min -> SessionTimeout)
   * ──────────────────────────────────────────────── */
  useEffect(() => {
    startSessionMonitor(() => setSessionExpired(true));
    return () => stopSessionMonitor();
  }, []);

  const handleResumeSession = useCallback(() => {
    resetSessionActivity();
    setSessionExpired(false);
    startSessionMonitor(() => setSessionExpired(true));
  }, []);

  /* ────────────────────────────────────────────────
   *  Language helpers
   * ──────────────────────────────────────────────── */
  const handleSwapLanguages = useCallback(() => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  }, [sourceLanguage, targetLanguage]);

  const getLanguageName = useCallback(
    (code) => {
      const language = LANGUAGES.find((item) => item.code === code);
      return language ? language.name : code;
    },
    []
  );

  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────────────────── */}
      <header className="app-header">
        <div className="app-brand">
          <div className="app-logo">
            <FaGlobeAmericas />
          </div>
          <div>
            <h1 className="app-title">LiveBridge</h1>
            <p className="app-subtitle">AI Language Interpreter</p>
          </div>
        </div>

        <div className="app-header-tools">
          <div
            className={`ai-status-chip ${ollamaStatus.running ? "online" : "offline"}`}
            title={
              ollamaStatus.running
                ? `Local AI ready (Ollama · ${ollamaStatus.model || "model loaded"})`
                : "Ollama is not running — AI extras fall back to rule-based mode"
            }
          >
            <FaWifi />
            <span>
              AI{" "}
              {ollamaStatus.running
                ? `· ${ollamaStatus.model || "local"}`
                : "· offline"}
            </span>
          </div>

          <PrivacyBadge />

          <button
            type="button"
            className={`header-tool-btn ${subtitlesVisible ? "active" : ""}`}
            onClick={() => setSubtitlesVisible((visible) => !visible)}
            title="Toggle floating live subtitles"
          >
            <FaClosedCaptioning />
            <span>Subtitles</span>
          </button>

          <button
            type="button"
            className={`header-tool-btn ${assistantVisible ? "active" : ""}`}
            onClick={() => setAssistantVisible((visible) => !visible)}
            title="Toggle voice assistant"
          >
            <FaRobot />
            <span>Assistant</span>
          </button>
        </div>
      </header>

      {/* ── Language bar ───────────────────────────── */}
      <div className="language-bar">
        <label className="language-field">
          <span className="language-label">I speak</span>
          <select
            className="lang-select"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.target.value)}
            aria-label="Source language"
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="swap-languages-btn"
          onClick={handleSwapLanguages}
          title="Swap languages"
          aria-label="Swap source and target languages"
        >
          <FaExchangeAlt />
        </button>

        <label className="language-field">
          <span className="language-label">Translate to</span>
          <select
            className="lang-select"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            aria-label="Target language"
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </label>

        <div className="language-route">
          {getLanguageName(sourceLanguage)} → {getLanguageName(targetLanguage)}
        </div>
      </div>

      {/* ── Mode tabs ──────────────────────────────── */}
      <nav className="mode-tabs" aria-label="Interpreter modes">
        {MODES.map(({ id, label, hint, Icon }) => (
          <button
            key={id}
            type="button"
            className={`mode-tab ${mode === id ? "active" : ""}`}
            onClick={() => setMode(id)}
            title={hint}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Active mode ────────────────────────────── */}
      <main className="app-main">
        {mode === "voice" && (
          <VoiceMode
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            languages={LANGUAGES}
          />
        )}

        {mode === "chat" && (
          <ChatMode
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            languages={LANGUAGES}
          />
        )}

        {mode === "listen" && (
          <ListenMode
            languages={LANGUAGES}
            sessionId={sessionIdRef.current}
          />
        )}

        {mode === "connect" && (
          <ConnectMode sourceLanguage={sourceLanguage} />
        )}
      </main>

      {/* ── Footer strip ───────────────────────────── */}
      <footer className="app-footer">
        <span>LiveBridge · local-first prototype</span>
        <span>
          Session {sessionIdRef.current.slice(0, 8)}
        </span>
      </footer>

      {/* ── Floating: conversation insights ────────── */}
      <div className="floating-insights">
        <ConversationSummary
          messages={[]}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          languages={LANGUAGES}
        />
      </div>

      {/* ── Floating: voice assistant ──────────────── */}
      {assistantVisible && (
        <div className="assistant-panel">
          <div className="assistant-panel-header">
            <span>
              <FaRobot /> Voice Assistant
            </span>
            <button
              type="button"
              className="assistant-panel-close"
              onClick={() => setAssistantVisible(false)}
              aria-label="Close voice assistant"
            >
              <FaTimes />
            </button>
          </div>
          <div className="assistant-panel-body">
            <VoiceAssistant />
          </div>
        </div>
      )}

      {/* ── Overlays ───────────────────────────────── */}
      <SubtitleOverlay
        visible={subtitlesVisible}
        onClose={() => setSubtitlesVisible(false)}
      />

      <SecurityBanner />

      {sessionExpired && <SessionTimeout onResume={handleResumeSession} />}
    </div>
  );
};

export default App;
