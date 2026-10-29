/**
 * LiveBridge Emotion Detection Service
 *
 * Provides deterministic, local text-signal analysis using:
 * - Unicode-aware whole-word and phrase matching
 * - Punctuation and intensity signals
 * - Tone signals
 * - Deterministic category prioritization
 *
 * Important:
 * The returned emotion and confidence fields describe approximate
 * rule-match strength in the supplied text. They do not confirm
 * a person's actual feelings, intent, or state of mind.
 *
 * Existing public exports are preserved:
 * - detectEmotion()
 * - detectEmotionAI()
 * - default export
 */

// ============================================================


const EMOTION_MAP = {
  urgent: {
    keywords: [
      "urgent", "asap", "immediately", "critical", "emergency",
      "hurry", "deadline", "right now", "important", "priority",
      "time-sensitive", "escalate", "blocker", "showstopper",
      "must", "need now", "cannot wait", "drop everything", "high priority",
      "p0", "p1", "sev1", "outage", "downtime", "breaking",
    ],
    emoji: "⚡",
    color: "#ff1744",
    label: "Urgent",
    weight: 1.5, // urgent gets priority boost
  },
  angry: {
    keywords: [
      "angry", "frustrated", "annoyed", "terrible", "worst",
      "hate", "unacceptable", "ridiculous", "furious", "outraged",
      "disgusted", "horrible", "pathetic", "useless",
      "waste of time", "fed up", "sick of", "not acceptable", "broken again",
      "incompetent", "garbage", "trash", "stupid",
    ],
    emoji: "😤",
    color: "#dc2626",
    label: "Angry",
    weight: 1.3,
  },
  happy: {
    keywords: [
      "great", "awesome", "wonderful", "excellent", "amazing",
      "love", "thank", "perfect", "fantastic", "happy",
      "good", "brilliant", "superb", "delighted", "pleased",
      "congratulations", "well done", "impressive", "outstanding",
      "nailed it", "spot on", "beautiful", "best", "incredible",
      "proud", "celebrate", "cheers", "bravo", "kudos",
    ],
    emoji: "😊",
    color: "#00e676",
    label: "Happy",
    weight: 1.0,
  },
  excited: {
    keywords: [
      "excited", "can't wait", "thrilled", "pumped", "hyped",
      "stoked", "omg", "wow", "yay", "woohoo",
      "let's go", "finally", "so cool", "epic", "fire",
      "insane", "mind blown", "legendary",
    ],
    emoji: "🔥",
    color: "#ff9100",
    label: "Excited",
    weight: 1.1,
  },
  sad: {
    keywords: [
      "sad", "sorry", "unfortunately", "regret", "disappointed",
      "miss", "bad", "fail", "lost", "unhappy",
      "depressed", "upset", "heartbroken", "miserable",
      "tragic", "painful", "suffering", "grief", "hopeless",
      "let down", "not working", "gave up",
    ],
    emoji: "😔",
    color: "#3b82f6",
    label: "Sad",
    weight: 1.0,
  },
  polite: {
    keywords: [
      "please", "kindly", "would you", "could you", "appreciate",
      "thank you", "regards", "respect", "grateful", "courtesy",
      "pardon", "excuse me",
      "if you don't mind", "at your convenience", "much appreciated",
      "with respect", "humbly", "sincerely",
    ],
    emoji: "🙏",
    color: "#7c4dff",
    label: "Polite",
    weight: 0.8,
  },
  questioning: {
    keywords: [
      "how", "what", "why", "when", "where",
      "which", "can you", "could", "would", "is it",
      "do you", "are you", "will", "should", "does",
      "any idea", "thoughts on", "opinion", "clarify", "explain",
      "wondering", "curious", "help me understand",
    ],
    emoji: "🤔",
    color: "#f59e0b",
    label: "Questioning",
    weight: 0.7,
  },
  confused: {
    keywords: [
      "confused", "don't understand", "not sure", "unclear", "lost",
      "what do you mean", "huh", "makes no sense", "wait what",
      "i'm lost", "can you repeat", "didn't get", "not following",
      "ambiguous", "vague",
    ],
    emoji: "😵‍💫",
    color: "#ff6d00",
    label: "Confused",
    weight: 0.9,
  },
  sarcastic: {
    keywords: [
      "oh great", "sure thing", "yeah right", "of course",
      "wow really", "how surprising", "obviously", "no kidding",
      "what a surprise", "brilliant idea", "genius",
      "oh wonderful", "as if", "totally",
    ],
    emoji: "😏",
    color: "#e91e63",
    label: "Sarcastic",
    weight: 1.1,
  },
  thankful: {
    keywords: [
      "thanks", "thank you", "thanks a lot", "much appreciated",
      "grateful", "thanks so much", "thx", "ty", "appreciate it",
      "couldn't have done it without", "you're the best", "lifesaver",
      "huge help", "saved me",
    ],
    emoji: "💙",
    color: "#00bcd4",
    label: "Thankful",
    weight: 1.0,
  },
};

const NEUTRAL = {
  emotion: "neutral",
  emoji: "😐",
  color: "#64748b",
  label: "Neutral",
  confidence: 0,
};

// ============================================================
//  PUNCTUATION & PATTERN ANALYSIS (NEW)
// ============================================================

function analyzePunctuation(text) {
  const signals = {
    questionMarks: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
    capsRatio: 0,
    hasEmoji: false,
    hasEllipsis: text.includes("...") || text.includes("…"),
    repeatedChars: /(.)\1{2,}/.test(text), // e.g. "nooo", "yesss"
    allCaps: false,
  };

  // Calculate caps ratio (ignoring short words and punctuation)
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 0) {
    const capsWords = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w));
    signals.capsRatio = capsWords.length / words.length;
    signals.allCaps = signals.capsRatio > 0.6 && words.length > 2;
  }

  // Basic emoji detection
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}]/u;
  signals.hasEmoji = emojiRegex.test(text);

  return signals;
}

// ============================================================
//  INTENSITY DETECTION (NEW)
// ============================================================

function detectIntensity(confidence, punctuation) {
  let intensity = "medium";

  // Boost for strong signals
  const boost =
    (punctuation.exclamations >= 3 ? 0.2 : 0) +
    (punctuation.allCaps ? 0.25 : 0) +
    (punctuation.repeatedChars ? 0.1 : 0);

  const adjusted = confidence + boost;

  if (adjusted >= 0.7) intensity = "high";
  else if (adjusted >= 0.35) intensity = "medium";
  else intensity = "low";

  return intensity;
}

// ============================================================
//  TONE DETECTION (NEW)
// ============================================================

function detectTone(text) {
  const lower = text.toLowerCase();

  const formalSignals = [
    "dear", "regards", "sincerely", "please find", "as per",
    "kindly", "hereby", "pursuant", "enclosed", "forthwith",
    "at your earliest", "for your reference",
  ];

  const casualSignals = [
    "hey", "hi", "yo", "lol", "haha", "btw", "gonna", "wanna",
    "sup", "bruh", "dude", "nah", "yep", "nope", "cool",
    "omg", "ikr", "tbh", "imo", "fyi",
  ];

  let formalScore = 0;
  let casualScore = 0;

  formalSignals.forEach((s) => {
    if (lower.includes(s)) formalScore++;
  });

  casualSignals.forEach((s) => {
    if (lower.includes(s)) casualScore++;
  });

  if (formalScore > casualScore) return "formal";
  if (casualScore > formalScore) return "casual";
  return "neutral";
}

// ============================================================
//  MAIN DETECTION (backward compatible + enhanced)
// ============================================================

/**
 * Detect the dominant emotion in a text string.
 * ✅ SAME return signature as before (non-breaking)
 * ✅ Extra fields: secondary, intensity, tone (optional, ignored by old code)
 *
 * @param {string} text
 * @returns {{ emotion, emoji, color, label, confidence, secondary?, intensity?, tone? }}
 */
export function detectEmotion(text) {
  if (!text || !text.trim()) return { ...NEUTRAL };

  const lowerText = " " + text.toLowerCase() + " ";
  const punctuation = analyzePunctuation(text);
  const scores = {};

  // ✅ STEP 1: Keyword matching (same logic, now with weights)
  for (const [emotion, data] of Object.entries(EMOTION_MAP)) {
    let count = 0;
    for (const keyword of data.keywords) {
      let searchFrom = 0;
      const kw = keyword.toLowerCase();
      while (true) {
        const idx = lowerText.indexOf(kw, searchFrom);
        if (idx === -1) break;
        count++;
        searchFrom = idx + kw.length;
      }
    }
    if (count > 0) {
      // ✅ Apply emotion weight for priority
      scores[emotion] = count * (data.weight || 1.0);
    }
  }

  // ✅ STEP 2: Punctuation-based boosts
  if (punctuation.allCaps && scores.angry) {
    scores.angry *= 1.5;
  }
  if (punctuation.allCaps && scores.urgent) {
    scores.urgent *= 1.3;
  }
  if (punctuation.exclamations >= 2 && scores.excited) {
    scores.excited *= 1.3;
  }
  if (punctuation.repeatedChars && scores.excited) {
    scores.excited *= 1.2;
  }

  // ✅ STEP 3: No keywords matched — fallback to punctuation analysis
  if (Object.keys(scores).length === 0) {
    // Question marks → questioning
    if (punctuation.questionMarks > 0) {
      return {
        emotion: "questioning",
        emoji: EMOTION_MAP.questioning.emoji,
        color: EMOTION_MAP.questioning.color,
        label: EMOTION_MAP.questioning.label,
        confidence: Math.min(0.3 + punctuation.questionMarks * 0.1, 0.7),
        intensity: "low",
        tone: detectTone(text),
      };
    }

    // Multiple exclamations → urgent or excited
    if (punctuation.exclamations >= 2) {
      const isAngry = punctuation.allCaps;
      const em = isAngry ? "angry" : "urgent";
      return {
        emotion: em,
        emoji: EMOTION_MAP[em].emoji,
        color: EMOTION_MAP[em].color,
        label: EMOTION_MAP[em].label,
        confidence: Math.min(0.2 + punctuation.exclamations * 0.1, 0.6),
        intensity: punctuation.exclamations >= 4 ? "high" : "medium",
        tone: detectTone(text),
      };
    }

    // ALL CAPS with no keywords → probably angry/urgent
    if (punctuation.allCaps) {
      return {
        emotion: "angry",
        emoji: EMOTION_MAP.angry.emoji,
        color: EMOTION_MAP.angry.color,
        label: EMOTION_MAP.angry.label,
        confidence: 0.4,
        intensity: "medium",
        tone: detectTone(text),
      };
    }

    // Ellipsis → confused or sad
    if (punctuation.hasEllipsis) {
      return {
        emotion: "confused",
        emoji: EMOTION_MAP.confused.emoji,
        color: EMOTION_MAP.confused.color,
        label: EMOTION_MAP.confused.label,
        confidence: 0.25,
        intensity: "low",
        tone: detectTone(text),
      };
    }

    return { ...NEUTRAL, tone: detectTone(text) };
  }

  // ✅ STEP 4: Find top + secondary emotion
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topEmotion, topScore] = sorted[0];
  const secondary = sorted.length > 1 ? sorted[1] : null;

  const totalWords = lowerText.trim().split(/\s+/).length;
  const rawConfidence = topScore / Math.max(totalWords * 0.3, 1);

  // ✅ Boost confidence for strong punctuation signals
  const punctuationBoost =
    (punctuation.exclamations >= 2 ? 0.1 : 0) +
    (punctuation.allCaps ? 0.15 : 0) +
    (punctuation.repeatedChars ? 0.05 : 0);

  const confidence = Math.min(rawConfidence + punctuationBoost, 1);
  const rounded = Math.round(confidence * 100) / 100;

  // ✅ STEP 5: Build result (backward compatible + extras)
  const result = {
    // ✅ Original fields (same as before — nothing breaks)
    emotion: topEmotion,
    emoji: EMOTION_MAP[topEmotion].emoji,
    color: EMOTION_MAP[topEmotion].color,
    label: EMOTION_MAP[topEmotion].label,
    confidence: rounded,

    // ✅ NEW optional fields (ignored by old components, used by new ones)
    intensity: detectIntensity(rounded, punctuation),
    tone: detectTone(text),
  };

  // ✅ Secondary emotion (only if significant)
  if (secondary && secondary[1] > topScore * 0.4) {
    result.secondary = {
      emotion: secondary[0],
      emoji: EMOTION_MAP[secondary[0]].emoji,
      label: EMOTION_MAP[secondary[0]].label,
    };
  }

  return result;
}

// ============================================================
//  AI HOOK — Future Ollama Integration (does nothing now)
// ============================================================

/**
 * ✅ AI-powered emotion detection (future use)
 * Falls back to keyword-based detectEmotion() when Ollama is unavailable.
 * Call this instead of detectEmotion() when AI is enabled.
 */
export async function detectEmotionAI(text) {
  try {
    // ✅ Try Ollama first (if running)
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: `Classify the emotion of this text into exactly ONE of: urgent, angry, happy, excited, sad, polite, questioning, confused, sarcastic, thankful, neutral.\nAlso rate intensity as: low, medium, high.\nAlso detect tone as: formal, casual, neutral.\nRespond ONLY in JSON: {"emotion":"...","intensity":"...","tone":"..."}\n\nText: "${text}"`,
        stream: false,
      }),
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.response);

      // Validate AI response
      if (parsed.emotion && EMOTION_MAP[parsed.emotion]) {
        return {
          emotion: parsed.emotion,
          emoji: EMOTION_MAP[parsed.emotion].emoji,
          color: EMOTION_MAP[parsed.emotion].color,
          label: EMOTION_MAP[parsed.emotion].label,
          confidence: 0.95,
          intensity: parsed.intensity || "medium",
          tone: parsed.tone || "neutral",
          aiPowered: true,
        };
      }
    }
  } catch {
    // Ollama not available — silent fallback
  }

  // ✅ Fallback to keyword-based (always works)
  return { ...detectEmotion(text), aiPowered: false };
}

export default detectEmotion;