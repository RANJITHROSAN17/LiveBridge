/**
 * LiveBridge — AI Service (Ollama Local LLM)
 * ✅ FIXED: Uses smallest model first (qwen2.5:1.5b)
 * ✅ FIXED: No more picking qwen2.5-coder:7b (4.5GB = too slow)
 */

import { getTranscript, getTranscriptStats } from "./transcriptService";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const TIMEOUT_MS = 300000; // ✅ 5 minutes
const MAX_RETRIES = 1;

// ✅ FIXED: Smallest & fastest models FIRST
const PREFERRED_MODELS = [
  "qwen2.5:1.5b",
  "qwen2.5:3b",
  "qwen2.5-coder:7b",
];

// ════════════════════════════════════════
//  CORE — askOllama
// ════════════════════════════════════════

async function askOllama(prompt, options = {}) {
  const timeout = options.timeout || TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model || PREFERRED_MODELS[0],
          prompt,
          stream: false,
          keep_alive: -1,
          options: {
            temperature: options.temperature || 0.3,
            num_predict: options.maxTokens || 500,
            num_ctx: 2048,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

      const data = await response.json();
      return data.response?.trim() || "";
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        console.warn(`Ollama timeout (${timeout}ms) attempt ${attempt + 1}`);
        if (attempt < MAX_RETRIES) continue;
        throw new Error("Ollama request timed out");
      }
      console.warn(`Ollama attempt ${attempt + 1} failed:`, error.message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
    }
  }
  throw lastError || new Error("Ollama request failed");
}

// ════════════════════════════════════════
//  JSON PARSING
// ════════════════════════════════════════

function extractJSON(text) {
  if (!text) return null;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {
      let repaired = jsonMatch[0]
        .replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
        .replace(/'/g, '"').replace(/(\w+):/g, '"$1":').replace(/""+/g, '"');
      try { return JSON.parse(repaired); } catch {}
    }
  }
  try { return JSON.parse(text.trim()); } catch {}
  return null;
}

// ════════════════════════════════════════
//  STATUS CHECK — picks SMALLEST model
// ════════════════════════════════════════

export async function checkOllamaStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("http://localhost:11434/api/tags", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return { running: false, model: null, models: [] };

    const data = await res.json();
    const models = data.models?.map((m) => m.name) || [];

    // ✅ FIXED: Pick SMALLEST model first (fast load)
    // 1) exact tag match (e.g. "qwen2.5:1.5b")
    // 2) same-family match (e.g. any "qwen2.5:xxx")
    // 3) first installed model as a last resort
    let bestModel = null;
    for (const preferred of PREFERRED_MODELS) {
      const exact = models.find((m) => m === preferred);
      if (exact) { bestModel = exact; break; }
    }
    if (!bestModel) {
      for (const preferred of PREFERRED_MODELS) {
        const family = preferred.split(":")[0];
        const found = models.find((m) => m.split(":")[0] === family);
        if (found) { bestModel = found; break; }
      }
    }
    if (!bestModel && models.length > 0) bestModel = models[0];

    return { running: true, model: bestModel, models };
  } catch {
    return { running: false, model: null, models: [] };
  }
}

// ════════════════════════════════════════
//  AI TRANSLATE
// ════════════════════════════════════════

export async function aiTranslate(text, sourceLang, targetLang, conversationHistory = []) {
  const historyContext = conversationHistory.length > 0
    ? `\nContext:\n${conversationHistory.slice(-4).map((m) => `[${m.direction || "?"}] ${m.original}`).join("\n")}\n`
    : "";

  const prompt = `Translate ${sourceLang} to ${targetLang}. Output ONLY the translation, nothing else.
${historyContext}
Translate: ${text}

Translation:`;

  return await askOllama(prompt, { temperature: 0.2, maxTokens: 300 });
}

// ════════════════════════════════════════
//  AI EMOTION ANALYSIS
// ════════════════════════════════════════

export async function aiAnalyzeEmotion(text) {
  const prompt = `Analyze emotion. Respond ONLY with JSON:
{"emotion":"<happy|sad|angry|neutral|excited|confused|frustrated>","confidence":0.8,"tone":"word","summary":"sentence"}

Text: "${text}"`;

  try {
    const response = await askOllama(prompt, { temperature: 0.1, maxTokens: 100 });
    const parsed = extractJSON(response);

    if (parsed && parsed.emotion) {
      const emotionMap = {
        happy: { emoji: "😊", color: "#00e676", label: "Happy" },
        sad: { emoji: "😢", color: "#3b82f6", label: "Sad" },
        angry: { emoji: "😠", color: "#dc2626", label: "Angry" },
        fearful: { emoji: "😨", color: "#7c4dff", label: "Fearful" },
        surprised: { emoji: "😲", color: "#f59e0b", label: "Surprised" },
        disgusted: { emoji: "🤢", color: "#00bcd4", label: "Disgusted" },
        urgent: { emoji: "🚨", color: "#ff1744", label: "Urgent" },
        sarcastic: { emoji: "😏", color: "#e91e63", label: "Sarcastic" },
        grateful: { emoji: "🙏", color: "#00e676", label: "Grateful" },
        frustrated: { emoji: "😤", color: "#dc2626", label: "Frustrated" },
        excited: { emoji: "🎉", color: "#ff9100", label: "Excited" },
        confused: { emoji: "🤔", color: "#ff6d00", label: "Confused" },
        neutral: { emoji: "😐", color: "#64748b", label: "Neutral" },
      };
      const em = emotionMap[parsed.emotion] || emotionMap.neutral;
      return { emotion: parsed.emotion, confidence: parsed.confidence || 0.5, tone: parsed.tone || "", summary: parsed.summary || "", emoji: em.emoji, color: em.color, label: em.label, aiPowered: true };
    }
  } catch (e) { console.warn("AI emotion failed:", e.message); }
  return null;
}

// ════════════════════════════════════════
//  AI CONVERSATION SUMMARY
// ════════════════════════════════════════

export async function aiSummarizeConversation(messages, sourceLanguageName, targetLanguageName) {
  const transcriptData = getTranscript();
  const source = transcriptData.length >= (messages || []).length ? transcriptData : messages || [];
  if (source.length === 0) return null;

  const conversation = source.map((m) => {
    const dir = m.direction || m.speaker || "unknown";
    const speaker = dir === "you" ? `A (${sourceLanguageName})` : `B (${targetLanguageName})`;
    return `${speaker}: ${m.original}`;
  }).slice(-10).join("\n");

  const stats = getTranscriptStats();
  const statsCtx = stats.totalEntries > 0 ? `${stats.totalEntries} exchanges, ~${stats.totalWords} words.\n` : "";

  const prompt = `Summarize this conversation. Respond ONLY with JSON:
{"summary":"2-3 sentences","keyTopics":["t1","t2"],"actionItems":["a1"],"decisions":["d1"],"overallTone":"word","speakerASummary":"summary","speakerBSummary":"summary","followUp":"next step"}

${statsCtx}${conversation}`;

  try {
    const response = await askOllama(prompt, { temperature: 0.2, maxTokens: 500 });
    const parsed = extractJSON(response);
    if (parsed && parsed.summary) return parsed;
  } catch (e) { console.error("AI summary failed:", e.message); }
  return null;
}

// ════════════════════════════════════════
//  AI LANGUAGE DETECTION
// ════════════════════════════════════════

export async function aiDetectLanguage(text) {
  const prompt = `What language is this? Reply with ONLY the 2-letter ISO code (en, hi, ta, etc):
"${text.slice(0, 100)}"`;

  try {
    const response = await askOllama(prompt, { temperature: 0, maxTokens: 5 });
    const code = response.trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
    if (code.length === 2) return code;
  } catch (e) { console.warn("AI language detection failed:", e.message); }
  return null;
}

export default { checkOllamaStatus, aiTranslate, aiAnalyzeEmotion, aiSummarizeConversation, aiDetectLanguage };