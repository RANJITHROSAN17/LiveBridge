import React, { useEffect, useState } from "react";
import { FaShieldAlt } from "react-icons/fa";

const STORAGE_KEY = "livebridge-privacy-notice-seen";

/**
 * SecurityBanner — Shows once per session.
 * Informs the user about prototype data handling.
 */
const SecurityBanner = ({ onAccept }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only once per session when session storage is available.
    try {
      if (
        typeof window === "undefined" ||
        !window.sessionStorage
      ) {
        setVisible(true);
        return;
      }

      const noticeSeen =
        window.sessionStorage.getItem(STORAGE_KEY);

      if (!noticeSeen) {
        setVisible(true);
      }
    } catch (error) {
      console.warn(
        "Session storage is unavailable for the privacy notice:",
        error
      );

      // Storage failure should not prevent the notice from appearing.
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    /*
     * "I Understand" acknowledges that the notice was seen.
     * It is not treated as legal consent.
     */
    try {
      if (
        typeof window !== "undefined" &&
        window.sessionStorage
      ) {
        window.sessionStorage.setItem(STORAGE_KEY, "true");
      }
    } catch (error) {
      console.warn(
        "Unable to remember privacy notice acknowledgement:",
        error
      );
    }

    setVisible(false);
    onAccept?.();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(6,10,30,0.98)",
        borderTop: "1px solid rgba(0,229,255,0.2)",
        padding: "16px 24px",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.5)",
      }}
    >
      <FaShieldAlt
        aria-hidden="true"
        style={{
          color: "#00e5ff",
          fontSize: "1.2rem",
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: "200px" }}>
        <div
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#c8e6ff",
            marginBottom: "4px",
          }}
        >
          🔒 Privacy & Data Notice
        </div>

        <div
          style={{
            fontSize: "0.68rem",
            color: "#6889b0",
            lineHeight: 1.5,
          }}
        >
          This application processes speech and text for
          translation. Speech recognition is managed by your
          browser. Processing may be local or use browser/platform
          services depending on browser capabilities and
          configuration. Translation text may be sent to external
          translation services to generate translations.
          Conversation transcripts are temporarily held in
          LiveBridge application memory and are not intentionally
          persisted by this prototype.
        </div>
      </div>

      <button
        type="button"
        aria-label="Acknowledge privacy and data notice"
        onClick={handleAccept}
        style={{
          padding: "8px 24px",
          border: "1px solid rgba(0,229,255,0.3)",
          borderRadius: "4px",
          background: "rgba(0,229,255,0.1)",
          color: "#00e5ff",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          transition: "all 0.2s ease",
          whiteSpace: "nowrap",
        }}
      >
        I Understand
      </button>
    </div>
  );
};

export default SecurityBanner;