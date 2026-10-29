import React, { useState } from "react";

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSessionId() {
  let result = "";

  for (let i = 0; i < 6; i += 1) {
    result +=
      ALPHABET[
        Math.floor(
          Math.random() * ALPHABET.length
        )
      ];
  }

  return result;
}

const ConnectLobby = ({
  onCreate,
  onJoin,
  connecting,
  error,
}) => {
  const [sessionId, setSessionId] =
    useState("");

  const createSession = () => {
    const id = generateSessionId();

    setSessionId(id);
    onCreate(id);
  };

  const joinSession = () => {
    const id = sessionId
      .trim()
      .toUpperCase();

    if (id.length !== 6) {
      return;
    }

    onJoin(id);
  };

  return (
    <div
      style={{
        maxWidth: "520px",
        width: "100%",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color: "#f8fafc",
          }}
        >
          LiveBridge Connect
        </h2>

        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.8rem",
            lineHeight: 1.6,
          }}
        >
          Create a private session or join
          another participant using their
          session ID.
        </p>
      </div>

      <button
        type="button"
        disabled={connecting}
        onClick={createSession}
      >
        Create Session
      </button>

      <div
        style={{
          textAlign: "center",
          color: "#64748b",
        }}
      >
        OR
      </div>

      <input
        value={sessionId}
        disabled={connecting}
        maxLength={6}
        placeholder="SESSION ID"
        onChange={(event) =>
          setSessionId(
            event.target.value
              .toUpperCase()
              .replace(
                /[^A-HJ-NP-Z2-9]/g,
                ""
              )
          )
        }
        style={{
          padding: "12px",
          borderRadius: "8px",
          border:
            "1px solid rgba(255,255,255,0.15)",
          background: "#111827",
          color: "#f8fafc",
          textAlign: "center",
          letterSpacing: "0.2em",
        }}
      />

      <button
        type="button"
        disabled={
          connecting ||
          sessionId.length !== 6
        }
        onClick={joinSession}
      >
        Join Session
      </button>

      {error && (
        <div
          role="alert"
          style={{
            color: "#ff6b6b",
            fontSize: "0.78rem",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default ConnectLobby;