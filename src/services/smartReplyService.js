/**
 * LiveBridge Smart Reply Service
 *
 * Generates contextual quick-reply suggestions using
 * deterministic, offline rules.
 *
 * Features:
 * - Works fully offline
 * - Uses word-aware and phrase-aware trigger matching
 * - Returns up to three unique reply suggestions
 * - Avoids making commitments on the user's behalf
 * - Preserves the existing public function names
 *
 * This service is rule-based and does not use an AI model.
 */

// ============================================================
// Configuration
// ============================================================

const MAX_INPUT_LENGTH = 2000;
const MAX_REPLIES = 3;

const DEFAULT_REPLIES = [
  {
    text: "I understand, thank you.",
    emoji: "👍",
  },
  {
    text: "Let me review that.",
    emoji: "🤔",
  },
  {
    text: "Could you share more details?",
    emoji: "💬",
  },
];

// ============================================================
// Reply templates
// ============================================================

const REPLY_TEMPLATES = {
  greeting: {
    priority: 5,

    triggers: [
      "hello",
      "hi",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "hola",
      "bonjour",
    ],

    replies: [
      {
        text: "Hello! How can I help you?",
        emoji: "👋",
      },
      {
        text: "Hi, nice to meet you!",
        emoji: "😊",
      },
      {
        text: "Hello! Good to hear from you.",
        emoji: "🙏",
      },
    ],
  },

  urgent: {
    priority: 10,

    triggers: [
      "urgent",
      "asap",
      "immediately",
      "critical",
      "blocker",
      "emergency",
      "high priority",
      "deadline",
    ],

    replies: [
      {
        text: "I’ll review this right away.",
        emoji: "⚡",
      },
      {
        text: "I’ll confirm the priority shortly.",
        emoji: "🔴",
      },
      {
        text: "Would you like me to escalate this?",
        emoji: "📢",
      },
    ],
  },

  problem: {
    priority: 9,

    triggers: [
      "issue",
      "problem",
      "error",
      "bug",
      "broken",
      "not working",
      "failed",
      "failure",
      "exception",
      "incident",
    ],

    replies: [
      {
        text: "I’ll look into this.",
        emoji: "🔧",
      },
      {
        text: "Could you share more details?",
        emoji: "📋",
      },
      {
        text: "Let me review the logs.",
        emoji: "🖥️",
      },
    ],
  },

  meeting: {
    priority: 7,

    triggers: [
      "meet",
      "meeting",
      "schedule",
      "call",
      "discuss",
      "sync",
      "catch up",
      "calendar",
      "availability",
    ],

    replies: [
      {
        text: "I’ll check my availability.",
        emoji: "📅",
      },
      {
        text: "Could you suggest a suitable time?",
        emoji: "⏰",
      },
      {
        text: "Please share the meeting details.",
        emoji: "📧",
      },
    ],
  },

  thanks: {
    priority: 6,

    triggers: [
      "thank",
      "thanks",
      "thank you",
      "appreciate",
      "grateful",
    ],

    replies: [
      {
        text: "You’re welcome!",
        emoji: "😊",
      },
      {
        text: "Happy to help!",
        emoji: "🙌",
      },
      {
        text: "Glad I could help.",
        emoji: "👍",
      },
    ],
  },

  farewell: {
    priority: 5,

    triggers: [
      "bye",
      "goodbye",
      "see you",
      "talk later",
      "take care",
      "have a good day",
    ],

    replies: [
      {
        text: "Goodbye! Talk soon.",
        emoji: "👋",
      },
      {
        text: "See you later!",
        emoji: "🙂",
      },
      {
        text: "Have a great day!",
        emoji: "☀️",
      },
    ],
  },

  agreement: {
    priority: 4,

    triggers: [
      "agree",
      "yes",
      "correct",
      "right",
      "exactly",
      "sure",
      "okay",
      "ok",
      "fine",
      "sounds good",
    ],

    replies: [
      {
        text: "That sounds good.",
        emoji: "👍",
      },
      {
        text: "Agreed. Let’s proceed.",
        emoji: "✅",
      },
      {
        text: "Understood, thank you.",
        emoji: "✨",
      },
    ],
  },

  question: {
    priority: 3,

    triggers: [
      "?",
      "when",
      "where",
      "how",
      "what",
      "why",
      "who",
      "can you",
      "could you",
      "would you",
      "do you",
      "is there",
      "are there",
    ],

    replies: [
      {
        text: "Let me check and confirm.",
        emoji: "🔍",
      },
      {
        text: "Could you provide more context?",
        emoji: "💬",
      },
      {
        text: "I’m not sure yet. Let me verify.",
        emoji: "🤔",
      },
    ],
  },
};

// ============================================================
// Input helpers
// ============================================================

function normalizeInput(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, MAX_INPUT_LENGTH)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Escapes special characters before constructing a regular expression.
 */
function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * Determines whether a trigger appears as a complete word or phrase.
 *
 * Examples:
 * - "hi" matches "Hi there"
 * - "hi" does not match "This issue"
 * - "not working" matches as a phrase
 * - "?" is handled as punctuation
 */
function matchesTrigger(text, trigger) {
  if (!text || !trigger) {
    return false;
  }

  if (trigger === "?") {
    return text.includes("?");
  }

  const normalizedTrigger = trigger
    .trim()
    .toLowerCase();

  if (!normalizedTrigger) {
    return false;
  }

  const escapedTrigger =
    escapeRegExp(normalizedTrigger);

  const triggerPattern = escapedTrigger.replace(
    /\s+/g,
    "\\s+"
  );

  const expression = new RegExp(
    `(^|[^a-z0-9])${triggerPattern}(?=$|[^a-z0-9])`,
    "i"
  );

  return expression.test(text);
}

/**
 * Finds matching reply categories and assigns a score.
 */
function findMatchingCategories(text) {
  const matches = [];

  for (const [
    category,
    template,
  ] of Object.entries(REPLY_TEMPLATES)) {
    const matchedTriggers =
      template.triggers.filter((trigger) =>
        matchesTrigger(text, trigger)
      );

    if (matchedTriggers.length === 0) {
      continue;
    }

    /*
     * Priority determines category importance.
     * Additional matching triggers modestly improve the score.
     */
    const score =
      template.priority +
      Math.min(matchedTriggers.length - 1, 3);

    matches.push({
      category,
      score,
      matchedTriggers,
      replies: template.replies,
    });
  }

  return matches.sort((first, second) => {
    if (second.score !== first.score) {
      return second.score - first.score;
    }

    return first.category.localeCompare(
      second.category
    );
  });
}

/**
 * Validates and normalizes an individual reply.
 */
function normalizeReply(reply) {
  if (
    !reply ||
    typeof reply.text !== "string"
  ) {
    return null;
  }

  const text = reply.text.trim();

  if (!text) {
    return null;
  }

  return {
    text,
    emoji:
      typeof reply.emoji === "string" &&
      reply.emoji.trim()
        ? reply.emoji.trim()
        : "💬",
  };
}

/**
 * Collects unique replies from the matched categories.
 */
function collectUniqueReplies(
  matches,
  maximumReplies = MAX_REPLIES
) {
  const results = [];
  const seenReplies = new Set();

  for (const match of matches) {
    for (const rawReply of match.replies) {
      const reply = normalizeReply(rawReply);

      if (!reply) {
        continue;
      }

      const uniqueKey =
        reply.text.toLowerCase();

      if (seenReplies.has(uniqueKey)) {
        continue;
      }

      seenReplies.add(uniqueKey);
      results.push(reply);

      if (results.length >= maximumReplies) {
        return results;
      }
    }
  }

  return results;
}

// ============================================================
// Public API
// ============================================================

/**
 * Generates contextual offline quick replies.
 *
 * @param {string} translatedText
 * @returns {Array<{text: string, emoji: string}>}
 */
export function generateSmartReplies(
  translatedText
) {
  const normalizedText =
    normalizeInput(translatedText);

  if (!normalizedText) {
    return [];
  }

  const matches =
    findMatchingCategories(normalizedText);

  if (matches.length === 0) {
    return DEFAULT_REPLIES.map((reply) => ({
      ...reply,
    }));
  }

  const replies = collectUniqueReplies(
    matches,
    MAX_REPLIES
  );

  /*
   * Fill any remaining positions with safe generic replies.
   */
  if (replies.length < MAX_REPLIES) {
    const existingReplyTexts = new Set(
      replies.map((reply) =>
        reply.text.toLowerCase()
      )
    );

    for (const defaultReply of DEFAULT_REPLIES) {
      const uniqueKey =
        defaultReply.text.toLowerCase();

      if (!existingReplyTexts.has(uniqueKey)) {
        replies.push({
          ...defaultReply,
        });

        existingReplyTexts.add(uniqueKey);
      }

      if (replies.length >= MAX_REPLIES) {
        break;
      }
    }
  }

  return replies.slice(0, MAX_REPLIES);
}

/**
 * Backward-compatible asynchronous function.
 *
 * Ollama is not currently used, so this function returns the same
 * offline rule-based suggestions as generateSmartReplies().
 *
 * Keeping this export avoids breaking another component that may
 * still import generateSmartRepliesAI().
 *
 * @param {string} translatedText
 * @returns {Promise<Array<{text: string, emoji: string}>>}
 */
export async function generateSmartRepliesAI(
  translatedText
) {
  return generateSmartReplies(translatedText);
}

export default generateSmartReplies;