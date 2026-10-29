import React, { useEffect, useRef } from "react";

const ConnectCaptions = ({
  captions,
  interimText,
  connectionStatus,
}) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [captions, interimText]);

  return (
    <div
      style={{
        border:
          "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        background: "rgba(15,23,42,0.7)",
        minHeight: "300px",
        maxHeight: "460px",
        overflowY: "auto",
        padding: "16px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "0.7rem",
          marginBottom: "14px",
        }}
      >
        Connection: {connectionStatus}
      </div>

      {captions.length === 0 &&
        !interimText && (
          <div
            style={{
              color: "#64748b",
              textAlign: "center",
              marginTop: "80px",
            }}
          >
            Waiting for conversation...
          </div>
        )}

      {captions.map((caption) => (
        <div
          key={caption.id}
          style={{
            padding: "9px 0",
            borderBottom:
              "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              color:
                caption.direction === "me"
                  ? "#00e5ff"
                  : "#d8a4ff",
              fontSize: "0.68rem",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            {caption.direction === "me"
              ? "You"
              : "Participant"}
          </div>

          {caption.original &&
            caption.original !==
              caption.translated && (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "0.72rem",
                  marginBottom: "4px",
                }}
              >
                {caption.original}
              </div>
            )}

          <div
            style={{
              color: "#f8fafc",
              fontSize: "0.92rem",
              lineHeight: 1.55,
            }}
          >
            {caption.translated ||
              caption.original}
          </div>
        </div>
      ))}

      {interimText && (
        <div
          style={{
            paddingTop: "12px",
            color: "#64748b",
            fontStyle: "italic",
          }}
        >
          {interimText}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default ConnectCaptions;