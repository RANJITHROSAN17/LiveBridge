const LANGUAGE_MAP = {
  es: "es-ES",
  en: "en-US",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ko: "ko-KR",
};

function getSpeechRecognitionClass() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
}

function getRecognitionLanguage(language) {
  return LANGUAGE_MAP[language] || language || "es-ES";
}

export function isStreamingSpeechSupported() {
  const SpeechRecognition = getSpeechRecognitionClass();

  return Boolean(
    SpeechRecognition &&
    typeof SpeechRecognition.available === "function" &&
    typeof SpeechRecognition.install === "function"
  );
}

async function ensureLocalModel(SpeechRecognition, language) {
  if (typeof SpeechRecognition.available !== "function") {
    throw new Error(
      "Local speech recognition is not available in this browser. Use a supported Microsoft Edge Dev or Canary version."
    );
  }

  if (typeof SpeechRecognition.install !== "function") {
    throw new Error(
      "This browser cannot install the local speech recognition model."
    );
  }

  console.log(
    "Checking local speech model:",
    language
  );

  let availability;

  try {
    availability = await SpeechRecognition.available({
      langs: [language],
      processLocally: true,
    });
  } catch (error) {
    console.error(
      "Unable to check speech model availability:",
      error
    );

    throw new Error(
      `Unable to check the local speech model for ${language}.`
    );
  }

  console.log(
    "Speech model availability:",
    availability
  );

  if (availability === "available") {
    return true;
  }

  if (
    availability === "downloadable" ||
    availability === "downloading"
  ) {
    console.log(
      "Installing local speech model:",
      language
    );

    let installed = false;

    try {
      installed = await SpeechRecognition.install({
        langs: [language],
        processLocally: true,
      });
    } catch (error) {
      console.error(
        "Speech model installation error:",
        error
      );

      throw new Error(
        `Could not install the local speech model for ${language}.`
      );
    }

    if (!installed) {
      throw new Error(
        `The local speech model for ${language} could not be installed.`
      );
    }

    console.log(
      "Local speech model installed:",
      language
    );

    return true;
  }

  if (availability === "unavailable") {
    throw new Error(
      `The local speech model for ${language} is not available in this browser.`
    );
  }

  throw new Error(
    `Local speech recognition for ${language} is not ready. Browser status: ${availability}.`
  );
}

export function createStreamingSpeechSession({
  stream,
  language,
  onInterim,
  onFinal,
  onError,
  onStateChange,
}) {
  const SpeechRecognition =
    getSpeechRecognitionClass();

  if (!SpeechRecognition) {
    throw new Error(
      "SpeechRecognition is not available in this browser."
    );
  }

  if (
    !stream ||
    typeof stream.getAudioTracks !== "function"
  ) {
    throw new Error(
      "A valid audio MediaStream is required."
    );
  }

  const audioTracks =
    stream.getAudioTracks();

  console.log(
    "Captured audio tracks:",
    audioTracks
  );

  if (audioTracks.length === 0) {
    throw new Error(
      "No audio track was captured. When sharing a browser tab, select the tab playing the video and enable Share tab audio."
    );
  }

  const audioTrack =
    audioTracks[0];

  console.log(
    "Captured audio track details:",
    {
      kind: audioTrack.kind,
      label: audioTrack.label,
      enabled: audioTrack.enabled,
      muted: audioTrack.muted,
      readyState: audioTrack.readyState,
    }
  );

  if (audioTrack.kind !== "audio") {
    throw new Error(
      "The selected capture source did not provide an audio track."
    );
  }

  if (audioTrack.readyState !== "live") {
    throw new Error(
      "The captured audio track is not live."
    );
  }

  const recognitionLanguage =
    getRecognitionLanguage(language);

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    recognitionLanguage;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  if (
    "processLocally" in recognition
  ) {
    recognition.processLocally = true;
  } else {
    throw new Error(
      "This browser does not support local speech recognition."
    );
  }

  let stopped = false;
  let recognitionStarted = false;

  const emitState = (state) => {
    if (
      typeof onStateChange === "function"
    ) {
      onStateChange(state);
    }
  };

  recognition.onstart = () => {
    if (stopped) {
      return;
    }

    recognitionStarted = true;

    console.log(
      "Local speech recognition started:",
      recognitionLanguage
    );

    emitState("connected");
    emitState("streaming");
  };

  recognition.onaudiostart = () => {
    if (stopped) {
      return;
    }

    console.log(
      "Speech recognition is receiving audio."
    );
  };

  recognition.onspeechstart = () => {
    if (stopped) {
      return;
    }

    console.log(
      "Speech detected in captured audio."
    );
  };

  recognition.onresult = (event) => {
    if (stopped) {
      return;
    }

    let interimText = "";

    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      const result =
        event.results[index];

      if (
        !result ||
        !result[0]
      ) {
        continue;
      }

      const transcript =
        result[0].transcript
          ?.trim();

      if (!transcript) {
        continue;
      }

      if (result.isFinal) {
        console.log(
          "Final speech:",
          transcript
        );

        if (
          typeof onFinal === "function"
        ) {
          onFinal(transcript);
        }
      } else {
        interimText +=
          `${transcript} `;

        console.log(
          "Interim speech:",
          transcript
        );
      }
    }

    interimText =
      interimText.trim();

    if (
      typeof onInterim === "function"
    ) {
      onInterim(interimText);
    }
  };

  recognition.onerror = (event) => {
    if (stopped) {
      return;
    }

    console.error(
      "SpeechRecognition error:",
      event
    );

    let message =
      "Local speech recognition failed.";

    switch (event?.error) {
      case "no-speech":
        message =
          "No speech was detected in the shared audio.";
        break;

      case "audio-capture":
        message =
          "The speech recognizer could not read the captured browser audio.";
        break;

      case "not-allowed":
        message =
          "Speech recognition permission was not allowed.";
        break;

      case "language-not-supported":
        message =
          `The local speech model for ${recognitionLanguage} is not installed or supported.`;
        break;

      case "network":
        message =
          "The browser attempted network speech recognition instead of local recognition. Make sure the on-device Speech Recognition feature and local language model are available.";
        break;

      case "aborted":
        if (stopped) {
          return;
        }

        message =
          "Speech recognition was aborted.";
        break;

      default:
        if (event?.error) {
          message =
            `Speech recognition error: ${event.error}`;
        }
    }

    if (
      typeof onError === "function"
    ) {
      onError(
        new Error(message)
      );
    }
  };

  recognition.onend = () => {
    console.log(
      "Speech recognition ended."
    );

    recognitionStarted = false;

    if (stopped) {
      return;
    }

    emitState(
      "recognition-stopped"
    );
  };

  const startRecognition =
    async () => {
      try {
        emitState(
          "checking-model"
        );

        await ensureLocalModel(
          SpeechRecognition,
          recognitionLanguage
        );

        if (stopped) {
          return;
        }

        if (
          audioTrack.readyState !==
          "live"
        ) {
          throw new Error(
            "The captured audio track ended before speech recognition could start."
          );
        }

        emitState(
          "starting-recognition"
        );

        console.log(
          "Starting local recognition from captured audio:",
          {
            language:
              recognitionLanguage,
            track:
              audioTrack.label,
            readyState:
              audioTrack.readyState,
          }
        );

        recognition.start(
          audioTrack
        );
      } catch (error) {
        if (stopped) {
          return;
        }

        console.error(
          "Unable to start local speech recognition:",
          error
        );

        if (
          typeof onError === "function"
        ) {
          onError(
            error instanceof Error
              ? error
              : new Error(
                  String(error)
                )
          );
        }
      }
    };

  const handleTrackEnded =
    () => {
      if (stopped) {
        return;
      }

      stopped = true;

      console.log(
        "Captured audio track ended."
      );

      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      emitState("stopped");
    };

  audioTrack.addEventListener(
    "ended",
    handleTrackEnded,
    {
      once: true,
    }
  );

  startRecognition();

  function stop() {
    if (stopped) {
      return;
    }

    stopped = true;

    audioTrack.removeEventListener(
      "ended",
      handleTrackEnded
    );

    try {
      if (recognitionStarted) {
        recognition.stop();
      } else {
        recognition.abort();
      }
    } catch (error) {
      console.warn(
        "Speech recognition cleanup:",
        error
      );
    }

    emitState("stopped");
  }

  return {
    stop,
    recognition,
  };
}