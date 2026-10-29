import React, { useState, useEffect } from "react";
import { FaVolumeUp } from "react-icons/fa";
import {
  setVoiceSettings,
  getAllVoicesGrouped,
} from "../services/speechService";

/**
 * VoiceSettings — Shows ALL 45+ voices, grouped by gender,
 * with target-language voices highlighted as "Recommended".
 */
const VoiceSettings = ({ targetLanguage }) => {
  const [gender, setGender] = useState("auto");
  const [speed, setSpeed] = useState(1.0);
  const [expanded, setExpanded] = useState(false);
  const [voiceData, setVoiceData] = useState({
    all: [], recommended: [], others: [],
    female: [], male: [], unknown: [], totalCount: 0,
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [previewing, setPreviewing] = useState(false);

  // Load ALL voices
  useEffect(() => {
    const load = () => {
      const data = getAllVoicesGrouped(targetLanguage);
      setVoiceData(data);

      // Auto-select first recommended voice if nothing selected
      if (!selectedVoiceName || !data.all.find((v) => v.name === selectedVoiceName)) {
        if (data.recommended.length > 0) {
          setSelectedVoiceName(data.recommended[0].name);
        } else if (data.all.length > 0) {
          setSelectedVoiceName(data.all[0].name);
        }
      }
    };

    load();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [targetLanguage]);

  // Get filtered list based on gender
  const getFilteredVoices = () => {
    const source = voiceData.all;
    if (gender === "female") return source.filter((v) => voiceData.female.includes(v));
    if (gender === "male") return source.filter((v) => voiceData.male.includes(v));
    return source;
  };

  const filteredVoices = getFilteredVoices();

  // Check if a voice is recommended (matches target language)
  const isRecommended = (voice) => voiceData.recommended.includes(voice);

  // Push settings to speechService
  useEffect(() => {
    let selectedVoice = voiceData.all.find((v) => v.name === selectedVoiceName);

    if (!selectedVoice && filteredVoices.length > 0) {
      selectedVoice = filteredVoices[0];
      setSelectedVoiceName(selectedVoice.name);
    }

    setVoiceSettings({ voice: selectedVoice || null, speed, gender });
  }, [gender, speed, selectedVoiceName, voiceData]);

  // Preview a voice
  const handlePreview = (voiceName) => {
    if (previewing) return;

    const voice = voiceData.all.find((v) => v.name === voiceName);
    if (!voice) return;

    setPreviewing(true);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance("Hello, this is how I sound.");
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = speed;
    utterance.onend = () => setPreviewing(false);
    utterance.onerror = () => setPreviewing(false);

    window.speechSynthesis.speak(utterance);
  };

  // Gender symbol
  const getGenderSymbol = (voice) => {
    if (voiceData.female.includes(voice)) return "♀";
    if (voiceData.male.includes(voice)) return "♂";
    return "?";
  };

  // Short name
  const getShortName = (voice) => {
    return voice.name
      .replace("Microsoft ", "")
      .replace("Google ", "G·")
      .replace(" Online (Natural)", " ✨")
      .replace(" Desktop", "");
  };

  // Split filtered voices into recommended + others for display
  const recommendedFiltered = filteredVoices.filter((v) => isRecommended(v));
  const othersFiltered = filteredVoices.filter((v) => !isRecommended(v));

  return (
    <div style={{ position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          border: "1px solid rgba(0,229,255,0.15)",
          borderRadius: "4px",
          background: expanded ? "rgba(0,229,255,0.1)" : "rgba(0,229,255,0.04)",
          color: "#00e5ff",
          fontSize: "0.68rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
          transition: "all 0.2s ease",
        }}
        title="Voice settings"
      >
        {gender === "female" ? "♀" : gender === "male" ? "♂" : "🔊"}{" "}
        {gender === "auto" ? "Auto" : gender === "female" ? "Female" : "Male"}
        {speed !== 1.0 && ` · ${speed}x`}
        <span style={{ fontSize: "0.5rem", opacity: 0.6 }}>
          ({voiceData.totalCount})
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#0a0e22",
            border: "1px solid rgba(0,229,255,0.18)",
            borderRadius: "10px",
            padding: "14px",
            zIndex: 200,
            minWidth: "300px",
            maxWidth: "360px",
            boxShadow: "0 0 40px rgba(0,229,255,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* ── Gender filter ── */}
          <div>
            <div style={sectionLabel}>Filter by Gender</div>
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { key: "auto", label: "🔊 All", count: voiceData.all.length },
                { key: "female", label: "♀ Female", count: voiceData.female.length },
                { key: "male", label: "♂ Male", count: voiceData.male.length },
              ].map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGender(g.key)}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    border: `1px solid ${gender === g.key ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.1)"}`,
                    borderRadius: "4px",
                    background: gender === g.key ? "rgba(0,229,255,0.12)" : "transparent",
                    color: gender === g.key ? "#00e5ff" : "#6889b0",
                    fontSize: "0.65rem",
                    fontWeight: gender === g.key ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                  }}
                >
                  {g.label}
                  <span style={{ display: "block", fontSize: "0.48rem", opacity: 0.5, marginTop: "1px" }}>
                    {g.count} voice{g.count !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Voice list (scrollable) ── */}
          <div>
            <div style={{ ...sectionLabel, display: "flex", justifyContent: "space-between" }}>
              <span>Select Voice</span>
              <span style={{ color: "#00e5ff", fontWeight: 400 }}>
                {filteredVoices.length} shown
              </span>
            </div>

            <div
              style={{
                maxHeight: "280px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                paddingRight: "4px",
              }}
            >
              {/* ── Recommended section (target language) ── */}
              {recommendedFiltered.length > 0 && (
                <>
                  <div style={groupHeader}>
                    ⭐ Recommended ({targetLanguage.toUpperCase()})
                  </div>
                  {recommendedFiltered.map((voice) => (
                    <VoiceRow
                      key={voice.name}
                      voice={voice}
                      isSelected={voice.name === selectedVoiceName}
                      isRecommended={true}
                      genderSymbol={getGenderSymbol(voice)}
                      shortName={getShortName(voice)}
                      onSelect={() => setSelectedVoiceName(voice.name)}
                      onPreview={() => handlePreview(voice.name)}
                      previewing={previewing}
                    />
                  ))}
                </>
              )}

              {/* ── All other voices ── */}
              {othersFiltered.length > 0 && (
                <>
                  <div style={{ ...groupHeader, marginTop: recommendedFiltered.length > 0 ? "8px" : "0" }}>
                    🌐 All Languages ({othersFiltered.length})
                  </div>
                  {othersFiltered.map((voice) => (
                    <VoiceRow
                      key={voice.name}
                      voice={voice}
                      isSelected={voice.name === selectedVoiceName}
                      isRecommended={false}
                      genderSymbol={getGenderSymbol(voice)}
                      shortName={getShortName(voice)}
                      onSelect={() => setSelectedVoiceName(voice.name)}
                      onPreview={() => handlePreview(voice.name)}
                      previewing={previewing}
                    />
                  ))}
                </>
              )}

              {filteredVoices.length === 0 && (
                <p style={{ fontSize: "0.7rem", color: "#2d4466", textAlign: "center", padding: "10px 0" }}>
                  No {gender !== "auto" ? gender : ""} voices found.
                  {gender !== "auto" && (
                    <button
                      onClick={() => setGender("auto")}
                      style={{
                        display: "block", margin: "6px auto 0", padding: "4px 10px",
                        border: "1px solid rgba(0,229,255,0.15)", borderRadius: "4px",
                        background: "transparent", color: "#00e5ff",
                        fontSize: "0.6rem", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Show all voices
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* ── Speed slider ── */}
          <div>
            <div style={{ ...sectionLabel, display: "flex", justifyContent: "space-between" }}>
              <span>Speed</span>
              <span style={{ color: "#00e5ff" }}>{speed}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#00e5ff", height: "4px", cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              {[
                { label: "Slow", value: 0.7 },
                { label: "Normal", value: 1.0 },
                { label: "Fast", value: 1.3 },
                { label: "2x", value: 2.0 },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setSpeed(p.value)}
                  style={{
                    flex: 1, padding: "5px 2px",
                    border: `1px solid ${speed === p.value ? "rgba(0,229,255,0.35)" : "rgba(0,229,255,0.08)"}`,
                    borderRadius: "4px",
                    background: speed === p.value ? "rgba(0,229,255,0.1)" : "transparent",
                    color: speed === p.value ? "#00e5ff" : "#2d4466",
                    fontSize: "0.58rem", fontWeight: speed === p.value ? 700 : 500,
                    cursor: "pointer", fontFamily: "var(--font-mono, monospace)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Active voice summary ── */}
          {selectedVoiceName && (
            <div
              style={{
                padding: "8px 10px", borderRadius: "6px",
                background: "rgba(0,229,255,0.04)",
                border: "1px solid rgba(0,229,255,0.08)",
                fontSize: "0.58rem", color: "#6889b0",
                fontFamily: "var(--font-mono, monospace)",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <span style={{ color: "#00e5ff", fontWeight: 700 }}>Active:</span>
              <span style={{ color: "#c8e6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {selectedVoiceName}
              </span>
              <span style={{ color: "#00e5ff" }}>{speed}x</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Voice Row Component ── */
const VoiceRow = ({ voice, isSelected, isRecommended, genderSymbol, shortName, onSelect, onPreview, previewing }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 8px",
      borderRadius: "6px",
      background: isSelected
        ? "rgba(0,229,255,0.1)"
        : isRecommended
        ? "rgba(0,229,255,0.02)"
        : "transparent",
      border: `1px solid ${isSelected ? "rgba(0,229,255,0.3)" : "transparent"}`,
      cursor: "pointer",
      transition: "all 0.15s ease",
    }}
    onClick={onSelect}
    onMouseEnter={(e) => {
      if (!isSelected) e.currentTarget.style.background = "rgba(0,229,255,0.05)";
    }}
    onMouseLeave={(e) => {
      if (!isSelected) {
        e.currentTarget.style.background = isRecommended ? "rgba(0,229,255,0.02)" : "transparent";
      }
    }}
  >
    {/* Radio dot */}
    <span
      style={{
        width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${isSelected ? "#00e5ff" : "rgba(0,229,255,0.2)"}`,
        background: isSelected ? "#00e5ff" : "transparent",
        transition: "all 0.15s ease",
        boxShadow: isSelected ? "0 0 8px rgba(0,229,255,0.3)" : "none",
      }}
    />

    {/* Gender */}
    <span
      style={{
        fontSize: "0.7rem", width: "14px", textAlign: "center", flexShrink: 0,
        color: genderSymbol === "♀" ? "#ff69b4" : genderSymbol === "♂" ? "#4fc3f7" : "#6889b0",
      }}
    >
      {genderSymbol}
    </span>

    {/* Name + lang */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.68rem",
          color: isSelected ? "#00e5ff" : "#c8e6ff",
          fontWeight: isSelected ? 600 : 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {shortName}
      </div>
      <div style={{ fontSize: "0.46rem", color: "#2d4466", fontFamily: "var(--font-mono, monospace)" }}>
        {voice.lang}{voice.localService ? " · local" : " · network"}
      </div>
    </div>

    {/* Preview */}
    <button
      onClick={(e) => { e.stopPropagation(); onPreview(); }}
      disabled={previewing}
      style={{
        padding: "2px 6px",
        border: "1px solid rgba(0,229,255,0.12)",
        borderRadius: "3px",
        background: "transparent",
        color: previewing ? "#2d4466" : "#6889b0",
        fontSize: "0.52rem",
        cursor: previewing ? "not-allowed" : "pointer",
        fontFamily: "var(--font-mono, monospace)",
        display: "flex", alignItems: "center", gap: "3px",
        flexShrink: 0, transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!previewing) e.currentTarget.style.color = "#00e5ff"; }}
      onMouseLeave={(e) => { if (!previewing) e.currentTarget.style.color = "#6889b0"; }}
    >
      <FaVolumeUp /> Test
    </button>
  </div>
);

const sectionLabel = {
  fontSize: "0.55rem", color: "#6889b0", textTransform: "uppercase",
  letterSpacing: "0.1em", marginBottom: "6px",
  fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
};

const groupHeader = {
  fontSize: "0.5rem",
  color: "#00e5ff",
  fontFamily: "var(--font-mono, monospace)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
  padding: "4px 8px",
  marginBottom: "2px",
  borderBottom: "1px solid rgba(0,229,255,0.06)",
};

export default VoiceSettings;