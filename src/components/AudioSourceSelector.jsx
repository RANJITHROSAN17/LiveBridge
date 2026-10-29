import React from "react";
import {
  FaDesktop,
  FaMicrophone,
  FaWindowMaximize,
} from "react-icons/fa";
import { SOURCE_TYPES } from "../services/audioCaptureService";

const SOURCES = [
  {
    id: SOURCE_TYPES.MICROPHONE,
    label: "Microphone",
    description: "Capture your selected microphone",
    Icon: FaMicrophone,
  },
  {
    id: SOURCE_TYPES.BROWSER,
    label: "Browser Audio",
    description: "Share a browser tab and include its audio",
    Icon: FaWindowMaximize,
  },
  {
    id: SOURCE_TYPES.SYSTEM,
    label: "System Audio",
    description: "Share an available screen or system-audio source",
    Icon: FaDesktop,
  },
];

const AudioSourceSelector = ({ value, onChange, disabled = false }) => {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        width: "100%",
      }}
      disabled={disabled}
    >
      <legend
        style={{
          color: "#94a3b8",
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: "10px",
          textTransform: "uppercase",
        }}
      >
        Audio source
      </legend>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "10px",
        }}
      >
        {SOURCES.map(({ id, label, description, Icon }) => {
          const selected = value === id;

          return (
            <button
              key={id}
              type="button"
              aria-label={`Select ${label}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange?.(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minHeight: "72px",
                padding: "12px",
                borderRadius: "10px",
                border: selected
                  ? "1px solid rgba(161,0,255,0.55)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: selected
                  ? "rgba(161,0,255,0.12)"
                  : "rgba(255,255,255,0.03)",
                color: selected ? "#C266FF" : "#94a3b8",
                cursor: disabled ? "default" : "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                opacity: disabled && !selected ? 0.45 : 1,
              }}
            >
              <Icon aria-hidden="true" style={{ fontSize: "1.15rem" }} />
              <span>
                <strong style={{ display: "block", fontSize: "0.8rem" }}>
                  {label}
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "3px",
                    color: "#64748b",
                    fontSize: "0.65rem",
                    lineHeight: 1.35,
                  }}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default AudioSourceSelector;
