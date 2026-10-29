const SOURCE_TYPES = Object.freeze({
  MICROPHONE: "microphone",
  BROWSER: "browser",
  SYSTEM: "system",
});

function assertMediaDevices() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices
  ) {
    throw new Error(
      "Media capture is not available in this browser."
    );
  }
}

function createCaptureResult(source, capturedStream) {
  const audioTracks = capturedStream.getAudioTracks();

  if (audioTracks.length === 0) {
    capturedStream
      .getTracks()
      .forEach((track) => track.stop());

    throw new Error(
      source === SOURCE_TYPES.SYSTEM
        ? "No system-audio track was shared. System Audio availability depends on your browser and operating system. Choose a share option that includes audio, then try again."
        : "No audio track was supplied. Choose a source that includes audio, then try again."
    );
  }

  /*
   * Create an audio-only stream for speech recognition.
   * The original captured stream is retained so its video and audio
   * tracks can all be stopped when capture ends.
   */
  const audioStream = new MediaStream(audioTracks);
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;

    capturedStream
      .getTracks()
      .forEach((track) => track.stop());

    audioStream
      .getTracks()
      .forEach((track) => track.stop());
  };

  return {
    source,
    stream: audioStream,
    capturedStream,
    stop,
  };
}

async function captureMicrophone() {
  assertMediaDevices();

  if (
    typeof navigator.mediaDevices.getUserMedia !==
    "function"
  ) {
    throw new Error(
      "Microphone capture is not supported in this browser."
    );
  }

  const stream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

  return createCaptureResult(
    SOURCE_TYPES.MICROPHONE,
    stream
  );
}

async function captureDisplayAudio(source) {
  assertMediaDevices();

  if (
    typeof navigator.mediaDevices.getDisplayMedia !==
    "function"
  ) {
    throw new Error(
      "Browser and system audio capture are not supported in this browser."
    );
  }

  const isBrowserAudio =
    source === SOURCE_TYPES.BROWSER;

  /*
   * getDisplayMedia() always requires explicit user authorization.
   * The browser decides which capture surfaces and audio options are
   * available. These settings are preferences, not guarantees.
   */
  const stream =
    await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: isBrowserAudio
          ? "browser"
          : "monitor",
      },
      audio: {
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: isBrowserAudio,
      selfBrowserSurface: isBrowserAudio
        ? "include"
        : "exclude",
      surfaceSwitching: "include",
      systemAudio:
        source === SOURCE_TYPES.SYSTEM
          ? "include"
          : "exclude",
    });

  return createCaptureResult(source, stream);
}

/**
 * Begin explicitly authorized capture for the selected source.
 *
 * @param {"microphone" | "browser" | "system"} source
 * @returns {Promise<{
 *   source: string,
 *   stream: MediaStream,
 *   capturedStream: MediaStream,
 *   stop: Function
 * }>}
 */
export async function startAudioCapture(source) {
  if (!Object.values(SOURCE_TYPES).includes(source)) {
    throw new Error("Select a valid audio source.");
  }

  if (source === SOURCE_TYPES.MICROPHONE) {
    return captureMicrophone();
  }

  return captureDisplayAudio(source);
}

/**
 * Safely stop every track controlled by a capture result.
 */
export function stopAudioCapture(capture) {
  try {
    capture?.stop?.();
  } catch (error) {
    console.error(
      "Unable to stop audio capture cleanly:",
      error
    );
  }
}

export { SOURCE_TYPES };