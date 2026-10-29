import React, { useState } from "react";

const EmotionBadge = ({ emotion }) => {
  const [hovered, setHovered] = useState(false);

  if (!emotion) return null;

  if (
    emotion.emotion === "neutral" &&
    (!emotion.confidence || emotion.confidence < 0.2)
  ) {
    return null;
  }

  const color =
    typeof emotion.color === "string" && emotion.color.trim()
      ? emotion.color.trim()
      : "#64748b";

  const bgColor = color + "18";
  const glowColor = color + "40";

  // Keep "confidence" internally for backward compatibility.
  // It represents approximate rule-based signal strength.
  const rawConfidence = Number(emotion.confidence);

  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(100, Math.max(0, Math.round(rawConfidence * 100)))
    : 0;

  const intensity = emotion.intensity || null;

  const glowStrength =
    intensity === "high"
      ? `0 0 20px ${glowColor}, 0 0 40px ${color}25`
      : intensity === "medium"
      ? `0 0 14px ${glowColor}`
      : hovered
      ? `0 0 16px ${glowColor}`
      : "none";

  const intensityDot =
    intensity === "high"
      ? { color: "#ff1744", symbol: "▲" }
      : intensity === "medium"
      ? { color: "#ff9100", symbol: "●" }
      : intensity === "low"
      ? { color: "#00e676", symbol: "●" }
      : null;

  const secondary = emotion.secondary || null;

  const tone =
    emotion.tone && emotion.tone !== "neutral"
      ? emotion.tone
      : null;

  return (
    <span
      className="emotion-badge"
      style={{
        backgroundColor: bgColor,
        color,
        border: `1px solid ${color}33`,
        boxShadow: glowStrength,
        transition: "all 0.25s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${emotion.label} — ${confidence}% signal strength${
        intensity ? ` · ${intensity} intensity` : ""
      }${tone ? ` · ${tone} tone` : ""}`}
    >
      <span className="emotion-emoji">{emotion.emoji}</span>

      <span className="emotion-label">{emotion.label}</span>

      {/* Intensity indicator */}
      {intensityDot && (
        <span
          style={{
            fontSize: "0.45rem",
            color: intensityDot.color,
            marginLeft: "2px",
            lineHeight: 1,
          }}
        >
          {intensityDot.symbol}
        </span>
      )}

      {/* Secondary signal */}
      {secondary && (
        <span
          style={{
            fontSize: "0.7rem",
            marginLeft: "2px",
            opacity: 0.7,
          }}
          title={`Also: ${secondary.label}`}
        >
          {secondary.emoji}
        </span>
      )}

      {/* Signal-strength bar + percentage on hover */}
      {hovered && confidence > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            marginLeft: "3px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "20px",
              height: "3px",
              background: `${color}22`,
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${confidence}%`,
                height: "100%",
                background: color,
                borderRadius: "2px",
                transition: "width 0.3s ease",
              }}
            />
          </span>

          <span className="emotion-confidence">
            {confidence}%
          </span>
        </span>
      )}

      {/* Tone tag on hover */}
      {hovered && tone && (
        <span
          style={{
            fontSize: "0.5rem",
            marginLeft: "3px",
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {tone}
        </span>
      )}
    </span>
  );
};

export default EmotionBadge;