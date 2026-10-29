import React, { useState, useRef, useEffect } from "react";
import { FaMicrophone, FaStop, FaVolumeUp, FaTrash } from "react-icons/fa";

const VoiceAssistant = () => {
  const [listening, setListening] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState([]);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // ✅ Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join("");

        setQuery(transcript);

        // ✅ When final result → auto search
        if (event.results[0].isFinal) {
          setListening(false);
          handleSearch(transcript);
        }
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognition.onerror = (e) => {
        console.error("❌ Speech error:", e.error);
        setListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // ✅ Start listening
  const startListening = () => {
    if (recognitionRef.current) {
      setQuery("");
      setAnswer("");
      setResults([]);
      recognitionRef.current.start();
      setListening(true);
    }
  };

  // ✅ Stop listening
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  // ✅ Stop speaking
  const stopSpeaking = () => {
    synthRef.current.cancel();
    setSpeaking(false);
  };

  // ✅ Speak text
  const speakText = (text) => {
    if (!text) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  };

  // ✅ Search and get answer
  const handleSearch = async (searchQuery) => {
    if (!searchQuery) return;

    console.log("✅ SEARCHING:", searchQuery);

    setLoading(true);
    setAnswer("");
    setResults([]);

    try {
      // ✅ Call backend
      const res = await fetch(
        `http://localhost:5000/search?q=${encodeURIComponent(searchQuery)}`
      );

      const data = await res.json();

      console.log("✅ RESULTS:", data);

      // ✅ Set results
      if (data.results && data.results.length > 0) {
        setResults(data.results);
      }

      // ✅ Set answer
      if (data.answer && data.answer.length > 20) {
        setAnswer(data.answer);
        speakText(data.answer);
      } else if (data.results && data.results.length > 0) {
        // ✅ Build answer from results
        const topResult = data.results[0];
        const builtAnswer = topResult.snippet || topResult.title;
        setAnswer(builtAnswer);
        speakText(builtAnswer);
      } else {
        setAnswer("No results found for your query.");
        speakText("No results found.");
      }

      // ✅ Add to history
      setHistory((prev) => [
        { query: searchQuery, answer: data.answer || "No answer" },
        ...prev,
      ]);
    } catch (err) {
      console.error("❌ ERROR:", err);
      setAnswer("Failed to search. Please try again.");
      speakText("Failed to search.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "400px",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {/* ✅ Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(161,0,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaVolumeUp style={{ color: "#A100FF", fontSize: "1rem" }} />
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#e8e8f0",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            ARIA Voice
          </span>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              setHistory([]);
              setQuery("");
              setAnswer("");
              setResults([]);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              border: "1px solid rgba(255,23,68,0.15)",
              borderRadius: "4px",
              background: "transparent",
              color: "#8888a0",
              fontSize: "0.6rem",
              cursor: "pointer",
            }}
          >
            <FaTrash /> Clear
          </button>
        )}
      </div>

      {/* ✅ Main Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* ✅ Mic Button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <button
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              border: listening
                ? "3px solid #FF1744"
                : "3px solid rgba(161,0,255,0.3)",
              background: listening
                ? "rgba(255,23,68,0.15)"
                : "rgba(161,0,255,0.08)",
              color: listening ? "#FF1744" : "#A100FF",
              fontSize: "1.5rem",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: listening
                ? "pulse 1.5s ease-in-out infinite"
                : "none",
              transition: "all 0.3s ease",
            }}
          >
            {listening ? <FaStop /> : <FaMicrophone />}
          </button>

          <span
            style={{
              fontSize: "0.7rem",
              color: listening ? "#FF1744" : "#8888a0",
            }}
          >
            {listening
              ? "🔴 Listening..."
              : loading
              ? "⏳ Searching..."
              : "Tap to speak"}
          </span>
        </div>

        {/* ✅ Query Display */}
        {query && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              background: "rgba(161,0,255,0.08)",
              border: "1px solid rgba(161,0,255,0.15)",
              color: "#e8e8f0",
              fontSize: "0.85rem",
              textAlign: "center",
              maxWidth: "90%",
            }}
          >
            🎤 "{query}"
          </div>
        )}

        {/* ✅ Answer Display */}
        {answer && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "12px",
              background: "rgba(0,229,255,0.05)",
              border: "1px solid rgba(0,229,255,0.15)",
              color: "#e8e8f0",
              fontSize: "0.82rem",
              lineHeight: 1.7,
              maxWidth: "90%",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "0.6rem", color: "#00e5ff" }}>
                📌 Top Answer
              </span>

              {speaking ? (
                <button
                  onClick={stopSpeaking}
                  style={{
                    padding: "2px 8px",
                    border: "1px solid rgba(255,23,68,0.2)",
                    borderRadius: "8px",
                    background: "rgba(255,23,68,0.1)",
                    color: "#FF1744",
                    fontSize: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  🔇 Stop
                </button>
              ) : (
                <button
                  onClick={() => speakText(answer)}
                  style={{
                    padding: "2px 8px",
                    border: "1px solid rgba(0,229,255,0.2)",
                    borderRadius: "8px",
                    background: "rgba(0,229,255,0.1)",
                    color: "#00e5ff",
                    fontSize: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  🔊 Speak
                </button>
              )}
            </div>

            {answer}
          </div>
        )}

        {/* ✅ Search Results */}
        {results.length > 0 && (
          <div style={{ width: "100%", maxWidth: "90%" }}>
            <span
              style={{
                fontSize: "0.6rem",
                color: "#8888a0",
                marginBottom: "8px",
                display: "block",
              }}
            >
              ── Search Results ──
            </span>

            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  marginBottom: "8px",
                  borderRadius: "8px",
                  background: "rgba(161,0,255,0.04)",
                  border: "1px solid rgba(161,0,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#B84DFF",
                    fontWeight: 600,
                  }}
                >
                  {i + 1}. {r.title}
                </div>

                {r.snippet && r.snippet !== r.title && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#8888a0",
                      marginTop: "4px",
                      lineHeight: 1.5,
                    }}
                  >
                    {r.snippet.slice(0, 200)}
                  </div>
                )}

                {r.url && !r.url.includes("duckduckgo.com") && (
                  <div
                    style={{
                      fontSize: "0.55rem",
                      color: "#00e5ff",
                      marginTop: "4px",
                    }}
                  >
                    🔗 {r.url}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ✅ Loading */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#A100FF",
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ✅ Animations */}
      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;