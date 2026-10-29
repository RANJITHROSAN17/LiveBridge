import React from "react";
import { FaLock, FaGlobeAmericas } from "react-icons/fa";

/**
 * SessionTimeout — Shown when session is inactive
 * User must click to resume
 */
const SessionTimeout = ({ onResume }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(2,4,15,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        gap: "20px",
      }}
    >
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "rgba(0,229,255,0.06)",
          border: "2px solid rgba(0,229,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          color: "#00e5ff",
        }}
      >
        <FaLock />
      </div>

      <h2
        style={{
          color: "#c8e6ff",
          fontSize: "1.2rem",
          fontWeight: 700,
          margin: 0,
        }}
      >
        Session Inactive
      </h2>

      <p
        style={{
          color: "#6889b0",
          fontSize: "0.82rem",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.5,
        }}
      >
        Your session was paused after a period of inactivity. Resume
        to continue using LiveBridge.
      </p>

      <button
        type="button"
        aria-label="Resume LiveBridge session"
        onClick={onResume}
        style={{
          padding: "12px 36px",
          border: "1px solid rgba(0,229,255,0.3)",
          borderRadius: "6px",
          background:
            "linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,77,255,0.12))",
          color: "#00e5ff",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <FaGlobeAmericas /> Resume Session
      </button>

      <p
        style={{
          color: "#2d4466",
          fontSize: "0.6rem",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        LiveBridge · Session Inactive
      </p>
    </div>
  );
};

export default SessionTimeout;