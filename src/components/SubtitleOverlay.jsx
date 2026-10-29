import React, { useState, useEffect } from "react";
import { FaTimes, FaExpand, FaCompress, FaFont } from "react-icons/fa";
import { getTranscript } from "../services/transcriptService";

/**
 * SubtitleOverlay — Floating caption bar (like movie subtitles)
 * Shows latest translations in a minimal overlay.
 */
const SubtitleOverlay = ({ visible, onClose }) => {
  const [fontSize, setFontSize] = useState(1.2);
  const [isCompact, setIsCompact] = useState(false);
  const [latestEntries, setLatestEntries] = useState([]);

  // Poll transcript for latest entries
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      const all = getTranscript();
      setLatestEntries(all.slice(-3).reverse());
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: isCompact ? "60%" : "85%",
        maxWidth: "900px",
        background: "rgba(0,0,5,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0,229,255,0.15)",
        borderRadius: "12px",
        padding: isCompact ? "10px 16px" : "16px 24px",
        zIndex: 9000,
        boxShadow: "0 0 40px rgba(0,229,255,0.1), 0 20px 60px rgba(0,0,0,0.5)",
        animation: "fadeInUp 0.3s ease",
      }}
    >
      {/* Controls bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isCompact ? "6px" : "10px",
          paddingBottom: "6px",
          borderBottom: "1px solid rgba(0,229,255,0.08)",
        }}
      >
        <span
          style={{
            fontSize: "0.55rem",
            color: "#00e5ff",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
          }}
        >
          📺 Live Subtitles
        </span>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {/* Font size */}
          <button
            onClick={() => setFontSize((s) => Math.max(0.8, s - 0.1))}
            style={subtitleBtnStyle}
            title="Smaller text"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize((s) => Math.min(2.0, s + 0.1))}
            style={subtitleBtnStyle}
            title="Larger text"
          >
            A+
          </button>

          {/* Compact toggle */}
          <button
            onClick={() => setIsCompact(!isCompact)}
            style={subtitleBtnStyle}
            title={isCompact ? "Expand" : "Compact"}
          >
            {isCompact ? <FaExpand /> : <FaCompress />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            style={{ ...subtitleBtnStyle, color: "#ff1744", borderColor: "rgba(255,23,68,0.2)" }}
            title="Close subtitles"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Subtitle content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {latestEntries.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#2d4466",
              fontSize: "0.8rem",
              fontStyle: "italic",
              padding: "10px 0",
            }}
          >
            Waiting for speech...
          </p>
        ) : (
          latestEntries.map((entry, i) => (
            <div
              key={entry.id || i}
              style={{
                opacity: i === 0 ? 1 : 0.5 - i * 0.15,
                transition: "opacity 0.3s ease",
              }}
            >
              {/* Speaker tag */}
              <span
                style={{
                  fontSize: "0.5rem",
                  color: entry.speaker === "you" ? "#00e5ff" : "#7c4dff",
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginRight: "8px",
                }}
              >
                [{entry.speaker || "?"}]
              </span>

              {/* Translated text */}
              <span
                style={{
                  fontSize: `${fontSize}rem`,
                  color: i === 0 ? "#eaf4ff" : "#6889b0",
                  fontWeight: i === 0 ? 500 : 400,
                  lineHeight: 1.4,
                }}
              >
                {entry.translated || entry.original}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const subtitleBtnStyle = {
  padding: "3px 8px",
  border: "1px solid rgba(0,229,255,0.12)",
  borderRadius: "4px",
  background: "transparent",
  color: "#6889b0",
  fontSize: "0.6rem",
  cursor: "pointer",
  fontFamily: "var(--font-mono, monospace)",
  display: "flex",
  alignItems: "center",
  transition: "all 0.15s ease",
};

export default SubtitleOverlay;