import React, { useState } from "react";
import { FaShieldAlt } from "react-icons/fa";

const PrivacyBadge = () => {
  const [showDetails, setShowDetails] = useState(false);

  const color = "#00e5ff";

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
      title="Privacy & data handling info"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          borderRadius: "2px",
          background: `${color}0a`,
          border: `1px solid ${color}25`,
          fontSize: "0.5rem",
          color,
          fontWeight: 700,
          fontFamily: "var(--font-mono, monospace)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "default",
          transition: "all 0.2s ease",
        }}
      >
        <FaShieldAlt style={{ fontSize: "0.5rem" }} />
        Privacy Info
      </div>

      {showDetails && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 84px)",
            right: 0,
            background: "#0a0e22",
            border: "1px solid rgba(0,229,255,0.18)",
            borderRadius: "8px",
            padding: "12px 16px",
            zIndex: 999,
            minWidth: "240px",
            boxShadow:
              "0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.08)",
            fontSize: "0.7rem",
            color: "#c8e6ff",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: "6px",
              color,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            <FaShieldAlt style={{ marginRight: "4px" }} />
            Privacy Info
          </div>

          <p
            style={{
              margin: "0 0 8px",
              color: "#6889b0",
            }}
          >
            LiveBridge uses browser speech capabilities and external
            translation services as part of its prototype workflow.
          </p>

          <div
            style={{
              borderTop:
                "1px solid rgba(0,229,255,0.08)",
              paddingTop: "8px",
              fontSize: "0.58rem",
              color: "#2d4466",
              fontFamily:
                "var(--font-mono, monospace)",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            <span>
              🎤 Speech recognition is managed by the browser.
              Processing location depends on browser capabilities
              and configuration.
            </span>

            <span>
              🌐 Translation text may be sent to an external
              translation service.
            </span>

            <span>
              📝 LiveBridge transcript data is temporarily held in
              application memory and is not intentionally persisted
              by this prototype.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyBadge;