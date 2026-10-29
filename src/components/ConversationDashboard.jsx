import React, { useEffect, useState } from "react";
import { FaChartBar, FaTimes } from "react-icons/fa";
import { getTranscriptStats } from "../services/transcriptService";

/**
 * ConversationDashboard
 *
 * Real-time session analytics:
 * - Exchange statistics
 * - Exchange balance
 * - Communication signals
 */
const ConversationDashboard = () => {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(null);

  // Poll transcript statistics every 2 seconds while the panel is open.
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const update = () => {
      try {
        setStats(normalizeStats(getTranscriptStats()));
      } catch (error) {
        console.error(
          "Unable to load conversation statistics:",
          error
        );
        setStats(createEmptyStats());
      }
    };

    update();

    const interval = window.setInterval(update, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [visible]);

  if (!visible) {
    return (
      <button
        type="button"
        aria-label="Open session dashboard"
        onClick={() => setVisible(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          border: "1px solid rgba(0,229,255,0.12)",
          borderRadius: "4px",
          background: "rgba(0,229,255,0.04)",
          color: "#00e5ff",
          fontSize: "0.65rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
        title="Session Dashboard"
      >
        <FaChartBar aria-hidden="true" />
        Dashboard
      </button>
    );
  }

  const safeStats = normalizeStats(stats);

  if (safeStats.totalEntries === 0) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>
            <FaChartBar
              aria-hidden="true"
              style={{ marginRight: "6px" }}
            />
            Session Dashboard
          </span>

          <button
            type="button"
            aria-label="Close session dashboard"
            title="Close session dashboard"
            onClick={() => setVisible(false)}
            style={closeBtnStyle}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#2d4466",
            fontSize: "0.8rem",
            padding: "20px",
          }}
        >
          Start speaking to see session analytics...
        </p>
      </div>
    );
  }

  /*
   * Calculate balance using only recognized You and Them entries.
   * Unknown speakers are excluded from both percentages.
   */
  const knownSpeakerEntries =
    safeStats.youEntries + safeStats.themEntries;

  const youPercent =
    knownSpeakerEntries > 0
      ? Math.round(
          (safeStats.youEntries / knownSpeakerEntries) * 100
        )
      : 0;

  const themPercent =
    knownSpeakerEntries > 0
      ? Math.round(
          (safeStats.themEntries / knownSpeakerEntries) * 100
        )
      : 0;

  const topEmotions = Object.entries(safeStats.emotions)
    .filter(
      ([label, count]) =>
        typeof label === "string" &&
        label.trim() &&
        Number.isFinite(count) &&
        count > 0
    )
    .sort(
      (first, second) =>
        second[1] - first[1] ||
        first[0].localeCompare(second[0])
    )
    .slice(0, 5);

  const statCards = [
    {
      id: "exchanges",
      label: "Exchanges",
      value: safeStats.totalEntries,
      color: "#00e5ff",
    },
    {
      id: "words",
      label: "Words",
      value: safeStats.totalWords,
      color: "#7c4dff",
    },
    {
      id: "duration",
      label: "Duration",
      value: `${safeStats.durationMin || "<1"}m`,
      color: "#00e676",
    },
  ];

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FaChartBar
            aria-hidden="true"
            style={{ color: "#00e5ff" }}
          />
          <span>Session Dashboard</span>
        </span>

        <button
          type="button"
          aria-label="Close session dashboard"
          title="Close session dashboard"
          onClick={() => setVisible(false)}
          style={closeBtnStyle}
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        {statCards.map((card) => (
          <div key={card.id} style={statCardStyle}>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: card.color,
              }}
            >
              {card.value}
            </div>

            <div
              style={{
                fontSize: "0.5rem",
                color: "#2d4466",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Exchange balance */}
      <div style={{ marginBottom: "12px" }}>
        <div style={sectionLabelStyle}>
          🗣️ Exchange Balance
        </div>

        <div
          role="img"
          aria-label={
            knownSpeakerEntries > 0
              ? `Exchange balance: You ${youPercent} percent, Them ${themPercent} percent`
              : "Exchange balance unavailable because no recognized speakers were found"
          }
          style={{
            display: "flex",
            height: "8px",
            borderRadius: "4px",
            overflow: "hidden",
            background: "rgba(0,229,255,0.06)",
          }}
        >
          <div
            style={{
              width: `${youPercent}%`,
              background:
                "linear-gradient(90deg, #00e5ff, #0099cc)",
              transition: "width 0.5s ease",
            }}
          />

          <div
            style={{
              width: `${themPercent}%`,
              background:
                "linear-gradient(90deg, #7c4dff, #5a2dcc)",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.52rem",
            color: "#6889b0",
            marginTop: "4px",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span>You {youPercent}%</span>
          <span>Them {themPercent}%</span>
        </div>
      </div>

      {/* Communication signals */}
      {topEmotions.length > 0 && (
        <div>
          <div style={sectionLabelStyle}>
            🎭 Communication Signals
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {topEmotions.map(([label, count]) => (
              <span
                key={`signal-${label}`}
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  background: "rgba(0,229,255,0.06)",
                  border:
                    "1px solid rgba(0,229,255,0.1)",
                  color: "#c8e6ff",
                  fontSize: "0.62rem",
                  fontFamily:
                    "var(--font-mono, monospace)",
                }}
              >
                {label}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Statistics validation
// ============================================================

function createEmptyStats() {
  return {
    totalEntries: 0,
    totalWords: 0,
    durationMin: 0,
    youEntries: 0,
    themEntries: 0,
    unknownEntries: 0,
    emotions: {},
  };
}

function toSafeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : 0;
}

function normalizeStats(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return createEmptyStats();
  }

  const emotions =
    value.emotions &&
    typeof value.emotions === "object" &&
    !Array.isArray(value.emotions)
      ? Object.fromEntries(
          Object.entries(value.emotions)
            .filter(
              ([label, count]) =>
                typeof label === "string" &&
                label.trim() &&
                Number.isFinite(Number(count)) &&
                Number(count) >= 0
            )
            .map(([label, count]) => [
              label.trim(),
              Number(count),
            ])
        )
      : {};

  return {
    totalEntries: toSafeNumber(value.totalEntries),
    totalWords: toSafeNumber(value.totalWords),
    durationMin: toSafeNumber(value.durationMin),
    youEntries: toSafeNumber(value.youEntries),
    themEntries: toSafeNumber(value.themEntries),
    unknownEntries: toSafeNumber(value.unknownEntries),
    emotions,
  };
}

// ============================================================
// Existing visual styles
// ============================================================

const panelStyle = {
  background: "rgba(6,10,30,0.95)",
  border: "1px solid rgba(0,229,255,0.12)",
  borderRadius: "8px",
  padding: "14px",
  width: "100%",
  boxShadow: "0 0 20px rgba(0,229,255,0.06)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: "1px solid rgba(0,229,255,0.08)",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "#c8e6ff",
  fontFamily: "var(--font-mono, monospace)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#6889b0",
  cursor: "pointer",
  fontSize: "0.8rem",
};

const statCardStyle = {
  flex: "1 1 60px",
  textAlign: "center",
  padding: "8px",
  background: "rgba(0,229,255,0.03)",
  border: "1px solid rgba(0,229,255,0.06)",
  borderRadius: "6px",
  fontFamily: "var(--font-mono, monospace)",
};

const sectionLabelStyle = {
  fontSize: "0.55rem",
  color: "#6889b0",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "6px",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 700,
};

export default ConversationDashboard;