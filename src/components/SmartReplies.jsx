import React from "react";
import { generateSmartReplies } from "../services/smartReplyService";

/**
 * SmartReplies — Shows 3 contextual reply suggestions
 * User taps one → it gets spoken + translated
 */
const SmartReplies = ({ lastTranslatedText, onSelectReply }) => {
  if (!lastTranslatedText) return null;

  const result = generateSmartReplies(lastTranslatedText);
  const replies = Array.isArray(result) ? result : [];

  if (replies.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "8px 0",
        animation: "fadeInUp 0.3s ease",
      }}
    >
      <span
        style={{
          fontSize: "0.55rem",
          color: "#2d4466",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          width: "100%",
          textAlign: "center",
          marginBottom: "2px",
        }}
      >
        💡 Quick replies
      </span>

      {replies.map((reply, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelectReply?.(reply.text)}
          style={{
            padding: "6px 14px",
            border: "1px solid rgba(0,229,255,0.15)",
            borderRadius: "20px",
            background: "rgba(0,229,255,0.05)",
            color: "#c8e6ff",
            fontSize: "0.76rem",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0,229,255,0.12)";
            e.currentTarget.style.borderColor = "rgba(0,229,255,0.35)";
            e.currentTarget.style.boxShadow =
              "0 0 15px rgba(0,229,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0,229,255,0.05)";
            e.currentTarget.style.borderColor = "rgba(0,229,255,0.15)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span>{reply.emoji}</span>
          <span>{reply.text}</span>
        </button>
      ))}
    </div>
  );
};

export default SmartReplies;