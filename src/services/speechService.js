/**
 * LiveBridge Speech Service
 *
 * Provides browser-based speech recognition and speech synthesis.
 *
 * Features:
 * - Continuous speech recognition
 * - Interim and final recognition results
 * - Text-to-speech
 * - Language-specific voice selection
 * - Voice preference
 * - Playback speed control
 *
 * Important:
 * Browser speech recognition may use either local or remote processing,
 * depending on browser capabilities and configuration.
 */

// ============================================================
// Constants
// ============================================================

const MIN_SPEECH_RATE = 0.5;
const MAX_SPEECH_RATE = 2.0;
const DEFAULT_SPEECH_RATE = 1.0;

const DEFAULT_VOICE_SETTINGS = {
  gender: "auto",
  speed: DEFAULT_SPEECH_RATE,
  voice: null,
};

const LOCALE_MAP = {
  en: "en-US",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  zh: "zh-CN",
  ar: "ar-SA",
  ko: "ko-KR",
  pt: "pt-BR",
  ru: "ru-RU",
  it: "it-IT",
  bn: "bn-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  pa: "pa-IN",
};

// ============================================================
// Voice settings
// ============================================================

let voiceSettings = {
  ...DEFAULT_VOICE_SETTINGS,
};

/**
 * Restricts a numeric value to the provided range.
 */
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Updates the speech-synthesis preferences.
 *
 * Existing components can continue passing:
 *
 * {
 *   gender: "auto" | "female" | "male",
 *   speed: number,
 *   voice: SpeechSynthesisVoice | null
 * }
 */
export function setVoiceSettings(settings = {}) {
  if (
    settings.gender === "auto" ||
    settings.gender === "female" ||
    settings.gender === "male"
  ) {
    voiceSettings.gender = settings.gender;
  }

  if (settings.speed !== undefined) {
    const parsedSpeed = Number(settings.speed);

    if (Number.isFinite(parsedSpeed)) {
      voiceSettings.speed = clamp(
        parsedSpeed,
        MIN_SPEECH_RATE,
        MAX_SPEECH_RATE
      );
    }
  }

  if (settings.voice !== undefined) {
    voiceSettings.voice = settings.voice;
  }
}

/**
 * Returns a copy of the current voice settings.
 */
export function getVoiceSettings() {
  return {
    ...voiceSettings,
  };
}

/**
 * Restores the default voice settings.
 *
 * This is optional but useful when starting a new session.
 */
export function resetVoiceSettings() {
  voiceSettings = {
    ...DEFAULT_VOICE_SETTINGS,
  };
}

// ============================================================
// Language helpers
// ============================================================

/**
 * Returns the full locale for a short language code.
 *
 * Example:
 * ta -> ta-IN
 */
export function getSpeechLocale(language) {
  if (typeof language !== "string" || !language.trim()) {
    return "en-US";
  }

  const normalizedLanguage = language.trim().toLowerCase();

  return LOCALE_MAP[normalizedLanguage] || language;
}

// ============================================================
// Capability detection
// ============================================================

/**
 * Returns individual browser speech capabilities.
 *
 * Recognition and synthesis are checked separately so that the
 * application can provide a more accurate error message.
 */
export function getSpeechCapabilities() {
  if (typeof window === "undefined") {
    return {
      recognition: false,
      synthesis: false,
    };
  }

  return {
    recognition: Boolean(
      window.SpeechRecognition ||
        window.webkitSpeechRecognition
    ),
    synthesis: Boolean(
      window.speechSynthesis &&
        window.SpeechSynthesisUtterance
    ),
  };
}

/**
 * Preserves the original function used by VoiceMode.
 *
 * Voice Mode requires recognition. Speech synthesis can still fail
 * independently and will be handled by speak().
 */
export function isSupported() {
  return getSpeechCapabilities().recognition;
}

// ============================================================
// Speech recognition
// ============================================================

/**
 * Starts speech recognition.
 *
 * Existing signature is preserved:
 *
 * startListening(
 *   language,
 *   onResult,
 *   onInterim,
 *   onEnd,
 *   onError
 * )
 */
export function startListening(
  language,
  onResult,
  onInterim,
  onEnd,
  onError
) {
  if (typeof window === "undefined") {
    onError?.(
      new Error("Speech recognition requires a browser environment.")
    );

    return null;
  }

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError?.(
      new Error("Speech recognition is not supported in this browser.")
    );

    return null;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = getSpeechLocale(language);
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let encounteredError = false;
  let manuallyStopped = false;

  recognition.onstart = () => {
    encounteredError = false;
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      const result = event.results[index];
      const bestAlternative = result?.[0];
      const transcript = bestAlternative?.transcript || "";

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const cleanedFinalTranscript = finalTranscript.trim();
    const cleanedInterimTranscript = interimTranscript.trim();

    if (cleanedFinalTranscript) {
      onResult?.(cleanedFinalTranscript);
    }

    /*
     * Always send the interim value, including an empty value.
     * This allows the UI to clear an outdated interim transcript.
     */
    onInterim?.(cleanedInterimTranscript);
  };

  recognition.onerror = (event) => {
    encounteredError = true;

    console.error(
      "Speech recognition error:",
      event?.error || event
    );

    onError?.(event);
  };

  recognition.onend = () => {
    /*
     * Do not call the normal end handler immediately after an error.
     * Otherwise the error message in VoiceMode may be cleared.
     */
    if (!encounteredError) {
      onEnd?.({
        manuallyStopped,
      });
    }
  };

  /*
   * Store controlled state on the recognizer so stopListening()
   * can identify an intentional stop.
   */
  recognition.__liveBridgeMarkStopped = () => {
    manuallyStopped = true;
  };

  try {
    recognition.start();
    return recognition;
  } catch (error) {
    encounteredError = true;

    console.error(
      "Unable to start speech recognition:",
      error
    );

    onError?.(error);

    return null;
  }
}

/**
 * Stops an active recognition session safely.
 */
export function stopListening(recognition) {
  if (!recognition) {
    return;
  }

  try {
    recognition.__liveBridgeMarkStopped?.();

    recognition.stop();
  } catch (error) {
    /*
     * InvalidStateError can occur if recognition already stopped.
     * It is safe to log it instead of crashing the application.
     */
    console.warn(
      "Unable to stop speech recognition:",
      error
    );
  }
}

/**
 * Immediately aborts recognition without waiting for a final result.
 *
 * Existing components do not need to use this, but it is useful for
 * component cleanup and emergency cancellation.
 */
export function abortListening(recognition) {
  if (!recognition) {
    return;
  }

  try {
    recognition.__liveBridgeMarkStopped?.();
    recognition.abort();
  } catch (error) {
    console.warn(
      "Unable to abort speech recognition:",
      error
    );
  }
}

// ============================================================
// Voice loading
// ============================================================

/**
 * Returns the voices currently loaded by the browser.
 *
 * The first call may return an empty array because some browsers load
 * synthesis voices asynchronously.
 */
export function getAvailableVoices() {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis
  ) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

/**
 * Notifies a component whenever browser voices become available or change.
 *
 * Example usage inside VoiceSettings:
 *
 * useEffect(() => {
 *   return subscribeToVoiceChanges(setVoices);
 * }, []);
 */
export function subscribeToVoiceChanges(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  if (
    typeof window === "undefined" ||
    !window.speechSynthesis
  ) {
    callback([]);
    return () => {};
  }

  const synthesis = window.speechSynthesis;

  const updateVoices = () => {
    callback(synthesis.getVoices());
  };

  /*
   * Attempt immediate loading first.
   */
  updateVoices();

  synthesis.addEventListener(
    "voiceschanged",
    updateVoices
  );

  /*
   * Return cleanup function for React useEffect.
   */
  return () => {
    synthesis.removeEventListener(
      "voiceschanged",
      updateVoices
    );
  };
}

/**
 * Waits briefly for browser voices to become available.
 *
 * If they remain unavailable, speech synthesis can still use the
 * browser's default voice.
 */
function waitForVoices(timeoutMilliseconds = 1000) {
  return new Promise((resolve) => {
    const existingVoices = getAvailableVoices();

    if (existingVoices.length > 0) {
      resolve(existingVoices);
      return;
    }

    if (
      typeof window === "undefined" ||
      !window.speechSynthesis
    ) {
      resolve([]);
      return;
    }

    const synthesis = window.speechSynthesis;

    let completed = false;

    const finish = (voices) => {
      if (completed) {
        return;
      }

      completed = true;

      synthesis.removeEventListener(
        "voiceschanged",
        handleVoiceChange
      );

      clearTimeout(timeoutId);

      resolve(voices);
    };

    const handleVoiceChange = () => {
      const loadedVoices = synthesis.getVoices();

      if (loadedVoices.length > 0) {
        finish(loadedVoices);
      }
    };

    const timeoutId = setTimeout(() => {
      finish(synthesis.getVoices());
    }, timeoutMilliseconds);

    synthesis.addEventListener(
      "voiceschanged",
      handleVoiceChange
    );
  });
}

// ============================================================
// Voice matching
// ============================================================

/*
 * Kept for backward compatibility with your current VoiceSettings UI.
 *
 * This is only a name-based preference and is not guaranteed to classify
 * every browser voice correctly. For the portfolio version, displaying
 * the actual browser voice names is more accurate.
 */
const FEMALE_HINTS = [
  "female",
  "woman",
  "helena",
  "sabina",
  "paulina",
  "zira",
  "hazel",
  "susan",
  "linda",
  "karen",
  "samantha",
  "victoria",
  "monica",
  "lucia",
  "google uk english female",
  "google us english female",
  "fiona",
  "moira",
  "tessa",
  "veena",
  "lekha",
  "isha",
  "sara",
  "nora",
  "amelie",
  "anna",
  "alva",
  "damayanti",
  "ioana",
  "kanya",
];

const MALE_HINTS = [
  "male",
  "man",
  "pablo",
  "david",
  "mark",
  "james",
  "daniel",
  "george",
  "google uk english male",
  "google us english male",
  "enrique",
  "jorge",
  "thomas",
  "rishi",
  "alex",
  "fred",
  "junior",
  "diego",
  "luca",
  "carlos",
  "ivan",
];

function classifyVoiceGender(voice) {
  const voiceName = String(voice?.name || "").toLowerCase();

  if (
    FEMALE_HINTS.some((hint) =>
      voiceName.includes(hint)
    )
  ) {
    return "female";
  }

  if (
    MALE_HINTS.some((hint) =>
      voiceName.includes(hint)
    )
  ) {
    return "male";
  }

  return "unknown";
}

/**
 * Determines whether a voice supports the requested language.
 */
function voiceMatchesLanguage(
  voice,
  language,
  targetLocale
) {
  const voiceLocale = String(
    voice?.lang || ""
  ).toLowerCase();

  const normalizedLanguage = String(
    language || ""
  ).toLowerCase();

  const normalizedTargetLocale = String(
    targetLocale || ""
  ).toLowerCase();

  return (
    voiceLocale === normalizedTargetLocale ||
    voiceLocale === normalizedLanguage ||
    voiceLocale.startsWith(`${normalizedLanguage}-`)
  );
}

/**
 * Selects the most appropriate browser voice.
 */
function selectVoice(
  voices,
  language,
  targetLocale
) {
  const languageVoices = voices.filter((voice) =>
    voiceMatchesLanguage(
      voice,
      language,
      targetLocale
    )
  );

  /*
   * Use the specifically selected voice where possible.
   * Match by voice name and locale as object references can change
   * when a browser reloads its voice list.
   */
  if (voiceSettings.voice) {
    const selectedVoice = voices.find(
      (voice) =>
        voice.name === voiceSettings.voice.name &&
        voice.lang === voiceSettings.voice.lang
    );

    if (
      selectedVoice &&
      voiceMatchesLanguage(
        selectedVoice,
        language,
        targetLocale
      )
    ) {
      return selectedVoice;
    }
  }

  if (
    voiceSettings.gender &&
    voiceSettings.gender !== "auto"
  ) {
    const preferredVoice = languageVoices.find(
      (voice) =>
        classifyVoiceGender(voice) ===
        voiceSettings.gender
    );

    if (preferredVoice) {
      return preferredVoice;
    }
  }

  const exactLocaleVoice = languageVoices.find(
    (voice) =>
      voice.lang.toLowerCase() ===
      targetLocale.toLowerCase()
  );

  if (exactLocaleVoice) {
    return exactLocaleVoice;
  }

  const defaultLanguageVoice = languageVoices.find(
    (voice) => voice.default
  );

  if (defaultLanguageVoice) {
    return defaultLanguageVoice;
  }

  return languageVoices[0] || null;
}

// ============================================================
// Speech synthesis
// ============================================================

/**
 * Speaks translated text.
 *
 * Existing calls still work:
 *
 * await speak(text, language);
 *
 * Optional enhanced usage:
 *
 * await speak(text, language, {
 *   interrupt: true
 * });
 */
export async function speak(
  text,
  language,
  options = {}
) {
  const {
    interrupt = true,
  } = options;

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw new Error("Cannot speak empty text.");
  }

  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    !window.SpeechSynthesisUtterance
  ) {
    throw new Error(
      "Speech synthesis is not supported in this browser."
    );
  }

  const synthesis = window.speechSynthesis;
  const targetLocale = getSpeechLocale(language);
  const normalizedText = text.trim();

  /*
   * Wait for browser voice loading before selecting a voice.
   */
  const voices = await waitForVoices();

  return new Promise((resolve, reject) => {
    if (interrupt) {
      synthesis.cancel();
    }

    const utterance =
      new SpeechSynthesisUtterance(normalizedText);

    utterance.lang = targetLocale;
    utterance.rate = clamp(
      Number(voiceSettings.speed) ||
        DEFAULT_SPEECH_RATE,
      MIN_SPEECH_RATE,
      MAX_SPEECH_RATE
    );
    utterance.pitch = 1;
    utterance.volume = 1;

    const selectedVoice = selectVoice(
      voices,
      language,
      targetLocale
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      /*
       * "canceled" and "interrupted" can occur intentionally when
       * another utterance starts. Rejecting still allows the calling
       * component to decide how to display the result.
       */
      reject(
        new Error(
          event?.error
            ? `Speech synthesis failed: ${event.error}`
            : "Speech synthesis failed."
        )
      );
    };

    try {
      synthesis.speak(utterance);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stops all current and queued speech output.
 */
export function stopSpeaking() {
  if (
    typeof window !== "undefined" &&
    window.speechSynthesis
  ) {
    window.speechSynthesis.cancel();
  }
}

// ============================================================
// Grouped voice data
// ============================================================

/**
 * Returns browser voices grouped for the VoiceSettings component.
 *
 * Existing return structure is preserved:
 * - all
 * - recommended
 * - others
 * - female
 * - male
 * - unknown
 * - totalCount
 */
export function getAllVoicesGrouped(langCode) {
  const voices = getAvailableVoices();
  const locale = getSpeechLocale(langCode);

  const recommended = [];
  const others = [];

  voices.forEach((voice) => {
    if (
      voiceMatchesLanguage(
        voice,
        langCode,
        locale
      )
    ) {
      recommended.push(voice);
    } else {
      others.push(voice);
    }
  });

  const all = [
    ...recommended,
    ...others,
  ];

  return {
    all,
    recommended,
    others,
    female: all.filter(
      (voice) =>
        classifyVoiceGender(voice) === "female"
    ),
    male: all.filter(
      (voice) =>
        classifyVoiceGender(voice) === "male"
    ),
    unknown: all.filter(
      (voice) =>
        classifyVoiceGender(voice) === "unknown"
    ),
    totalCount: voices.length,
  };
}