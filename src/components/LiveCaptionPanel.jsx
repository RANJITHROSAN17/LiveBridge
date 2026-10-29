import React, { useEffect, useRef } from "react";
import { FaClosedCaptioning } from "react-icons/fa";

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const LiveCaptionPanel = ({
  captions,
  interimText,
  translatingText,
  sourceLanguageName,
  targetLanguageName,
}) => {
  const endRef = useRef(null);
  const safeCaptions = Array.isArray(captions) ? captions : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [safeCaptions, interimText, translatingText]);

  return (
    <section
      aria-label="Live translated captions"
      style={{
        width: "100%",
        minHeight: "260px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(161,0,255,0.15)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          color: "#c8e6ff",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <FaClosedCaptioning aria-hidden="true" style={{ color: "#B84DFF" }} />
          Live Captions
        </span>
        <span style={{ color: "#64748b", fontSize: "0.65rem" }}>
          {sourceLanguageName} → {targetLanguageName}
        </span>
      </header>

      <div
        aria-live="polite"
        aria-relevant="additions text"
        style={{
          maxHeight: "360px",
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {safeCaptions.length === 0 && !interimText && !translatingText && (
          <div
            style={{
              padding: "42px 16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.8rem",
            }}
          >
            Start capture to see progressive source text and finalized translations.
          </div>
        )}

        {safeCaptions.map((caption) => (
          <article
            key={caption.id}
            style={{
              padding: "12px 14px",
              background: "rgba(161,0,255,0.06)",
              border: "1px solid rgba(161,0,255,0.12)",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "6px",
                color: "#64748b",
                fontSize: "0.62rem",
              }}
            >
              <span>{sourceLanguageName}</span>
              <span>{formatTime(caption.timestamp)}</span>
            </div>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
              {caption.original}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                color: "#C266FF",
                fontSize: "1rem",
                fontWeight: 600,
                lineHeight: 1.55,
              }}
            >
              {caption.translated}
            </p>
          </article>
        ))}

        {translatingText && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px dashed rgba(161,0,255,0.22)",
              color: "#94a3b8",
              fontStyle: "italic",
              fontSize: "0.82rem",
            }}
          >
            {translatingText}
            <span style={{ color: "#B84DFF" }}> · Translating…</span>
          </div>
        )}

        {interimText && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.025)",
              color: "#64748b",
              fontStyle: "italic",
              fontSize: "0.82rem",
            }}
          >
            {interimText}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </section>
  );
};

export default LiveCaptionPanel;
