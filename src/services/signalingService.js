const DEFAULT_SIGNALING_URL =
  "ws://localhost:3001";

const CONNECT_TIMEOUT_MS = 10000;

function getSignalingUrl() {
  const configuredUrl =
    import.meta.env.VITE_SIGNALING_URL;

  if (
    typeof configuredUrl === "string" &&
    configuredUrl.trim()
  ) {
    return configuredUrl.trim();
  }

  return DEFAULT_SIGNALING_URL;
}

function normalizeRoomId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

function createError(
  value,
  fallbackMessage
) {
  if (value instanceof Error) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return new Error(
      value.trim()
    );
  }

  return new Error(
    fallbackMessage
  );
}

export function createSignalingService({
  onSignal,
  onParticipantJoined,
  onParticipantLeft,
  onRoomCreated,
  onRoomJoined,
  onStateChange,
  onError,
} = {}) {
  let socket = null;
  let currentRoomId = "";
  let connectPromise = null;
  let connectionTimeoutId = null;
  let closedIntentionally = false;

  const emitState = (
    state,
    details = {}
  ) => {
    console.log(
      "[SIGNAL CLIENT] state:",
      state,
      details
    );

    if (
      typeof onStateChange ===
      "function"
    ) {
      onStateChange(
        state,
        details
      );
    }
  };

  const emitError = (
    value,
    fallbackMessage =
      "A signaling error occurred."
  ) => {
    const error = createError(
      value,
      fallbackMessage
    );

    console.error(
      "[SIGNAL CLIENT] error:",
      error
    );

    if (
      typeof onError ===
      "function"
    ) {
      onError(error);
    }

    return error;
  };

  const clearConnectionTimeout =
    () => {
      if (
        connectionTimeoutId !==
        null
      ) {
        window.clearTimeout(
          connectionTimeoutId
        );

        connectionTimeoutId =
          null;
      }
    };

  const handleMessage =
    async (event) => {
      let message;

      try {
        message = JSON.parse(
          event.data
        );
      } catch (parseError) {
        emitError(
          parseError,
          "The signaling server returned invalid JSON."
        );

        return;
      }

      console.log(
        "[SIGNAL CLIENT] received:",
        message
      );

      if (
        !message ||
        typeof message !==
          "object" ||
        Array.isArray(message)
      ) {
        emitError(
          "The signaling server returned an invalid message."
        );

        return;
      }

      try {
        switch (message.type) {
          case "signaling-ready": {
            emitState("ready");
            break;
          }

          case "room-created": {
            currentRoomId =
              normalizeRoomId(
                message.roomId
              ) ||
              currentRoomId;

            console.log(
              "[SIGNAL CLIENT] room created:",
              currentRoomId
            );

            emitState(
              "room-created",
              {
                roomId:
                  currentRoomId,
              }
            );

            if (
              typeof onRoomCreated ===
              "function"
            ) {
              onRoomCreated(
                currentRoomId
              );
            }

            break;
          }

          case "room-joined": {
            currentRoomId =
              normalizeRoomId(
                message.roomId
              ) ||
              currentRoomId;

            console.log(
              "[SIGNAL CLIENT] room joined:",
              currentRoomId
            );

            emitState(
              "room-joined",
              {
                roomId:
                  currentRoomId,
              }
            );

            if (
              typeof onRoomJoined ===
              "function"
            ) {
              onRoomJoined(
                currentRoomId
              );
            }

            break;
          }

          case "participant-joined": {
            const joinedRoomId =
              normalizeRoomId(
                message.roomId
              ) ||
              currentRoomId;

            console.log(
              "[SIGNAL CLIENT] participant joined:",
              joinedRoomId
            );

            emitState(
              "participant-joined",
              {
                roomId:
                  joinedRoomId,
              }
            );

            if (
              typeof onParticipantJoined ===
              "function"
            ) {
              await onParticipantJoined(
                joinedRoomId
              );
            }

            break;
          }

          case "participant-left": {
            console.log(
              "[SIGNAL CLIENT] participant left:",
              currentRoomId
            );

            emitState(
              "participant-left",
              {
                roomId:
                  currentRoomId,
              }
            );

            if (
              typeof onParticipantLeft ===
              "function"
            ) {
              onParticipantLeft(
                currentRoomId
              );
            }

            break;
          }

          case "signal": {
            console.log(
              "[SIGNAL CLIENT] WebRTC signal received:",
              message.payload?.type
            );

            if (
              typeof onSignal ===
              "function"
            ) {
              await onSignal(
                message.payload
              );
            }

            break;
          }

          case "pong": {
            emitState(
              "pong",
              {
                timestamp:
                  message.timestamp,
              }
            );

            break;
          }

          case "error": {
            emitError(
              message.message ||
                "The signaling server reported an error."
            );

            break;
          }

          default: {
            console.warn(
              "[SIGNAL CLIENT] unknown message:",
              message
            );
          }
        }
      } catch (handlerError) {
        emitError(
          handlerError,
          "A signaling message could not be processed."
        );
      }
    };

  const connect = () => {
    if (
      socket?.readyState ===
      WebSocket.OPEN
    ) {
      return Promise.resolve();
    }

    if (
      socket?.readyState ===
        WebSocket.CONNECTING &&
      connectPromise
    ) {
      return connectPromise;
    }

    closedIntentionally =
      false;

    clearConnectionTimeout();

    const signalingUrl =
      getSignalingUrl();

    console.log(
      "[SIGNAL CLIENT] connecting to:",
      signalingUrl
    );

    emitState(
      "connecting",
      {
        url: signalingUrl,
      }
    );

    connectPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {
          let settled = false;

          const resolveOnce =
            () => {
              if (settled) {
                return;
              }

              settled = true;

              clearConnectionTimeout();

              connectPromise =
                null;

              resolve();
            };

          const rejectOnce = (
            error
          ) => {
            if (settled) {
              return;
            }

            settled = true;

            clearConnectionTimeout();

            connectPromise =
              null;

            reject(error);
          };

          try {
            socket =
              new WebSocket(
                signalingUrl
              );
          } catch (
            creationError
          ) {
            const error =
              emitError(
                creationError,
                `Could not create a signaling connection to ${signalingUrl}.`
              );

            rejectOnce(error);
            return;
          }

          connectionTimeoutId =
            window.setTimeout(
              () => {
                const error =
                  emitError(
                    `Timed out while connecting to the signaling service at ${signalingUrl}.`
                  );

                try {
                  socket?.close();
                } catch {
                  // Ignore timeout cleanup errors.
                }

                rejectOnce(
                  error
                );
              },
              CONNECT_TIMEOUT_MS
            );

          socket.addEventListener(
            "open",
            () => {
              console.log(
                "[SIGNAL CLIENT] WebSocket connected."
              );

              emitState(
                "connected",
                {
                  url:
                    signalingUrl,
                }
              );

              resolveOnce();
            }
          );

          socket.addEventListener(
            "message",
            handleMessage
          );

          socket.addEventListener(
            "error",
            () => {
              const error =
                emitError(
                  `Could not connect to the LiveBridge signaling service at ${signalingUrl}.`
                );

              rejectOnce(
                error
              );
            }
          );

          socket.addEventListener(
            "close",
            (event) => {
              clearConnectionTimeout();

              connectPromise =
                null;

              console.log(
                "[SIGNAL CLIENT] WebSocket closed:",
                event.code,
                event.reason
              );

              emitState(
                "closed",
                {
                  code:
                    event.code,
                  reason:
                    event.reason,
                }
              );

              socket = null;

              if (
                !closedIntentionally &&
                event.code !==
                  1000
              ) {
                emitError(
                  "The LiveBridge signaling connection closed unexpectedly."
                );
              }
            }
          );
        }
      );

    return connectPromise;
  };

  const send = (message) => {
    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      throw new Error(
        "The signaling connection is not open."
      );
    }

    console.log(
      "[SIGNAL CLIENT] sending:",
      message
    );

    socket.send(
      JSON.stringify(
        message
      )
    );
  };

  const createRoom =
    async (roomId) => {
      const normalizedRoomId =
        normalizeRoomId(
          roomId
        );

      if (
        normalizedRoomId.length !==
        6
      ) {
        throw new Error(
          "Session IDs must contain six valid characters."
        );
      }

      await connect();

      currentRoomId =
        normalizedRoomId;

      send({
        type: "create-room",
        roomId:
          currentRoomId,
      });
    };

  const joinRoom =
    async (roomId) => {
      const normalizedRoomId =
        normalizeRoomId(
          roomId
        );

      if (
        normalizedRoomId.length !==
        6
      ) {
        throw new Error(
          "Enter a valid six-character session ID."
        );
      }

      await connect();

      currentRoomId =
        normalizedRoomId;

      send({
        type: "join-room",
        roomId:
          currentRoomId,
      });
    };

  const sendSignal = (
    payload
  ) => {
    if (!currentRoomId) {
      throw new Error(
        "Create or join a session before sending WebRTC signaling data."
      );
    }

    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      throw new Error(
        "The WebRTC signaling payload is invalid."
      );
    }

    console.log(
      "[SIGNAL CLIENT] sending WebRTC signal:",
      payload.type
    );

    send({
      type: "signal",
      roomId:
        currentRoomId,
      payload,
    });
  };

  const ping = () => {
    send({
      type: "ping",
      roomId:
        currentRoomId,
      timestamp:
        Date.now(),
    });
  };

  const close = () => {
    closedIntentionally =
      true;

    clearConnectionTimeout();

    if (
      socket?.readyState ===
        WebSocket.OPEN &&
      currentRoomId
    ) {
      try {
        send({
          type: "leave-room",
          roomId:
            currentRoomId,
        });
      } catch (
        leaveError
      ) {
        console.warn(
          "[SIGNAL CLIENT] unable to send leave message:",
          leaveError
        );
      }
    }

    if (
      socket?.readyState ===
        WebSocket.OPEN ||
      socket?.readyState ===
        WebSocket.CONNECTING
    ) {
      try {
        socket.close(
          1000,
          "LiveBridge session closed"
        );
      } catch (
        closeError
      ) {
        console.warn(
          "[SIGNAL CLIENT] WebSocket cleanup failed:",
          closeError
        );
      }
    }

    socket = null;
    currentRoomId = "";
    connectPromise = null;

    emitState(
      "closed-intentionally"
    );
  };

  const getState = () => {
    return {
      roomId:
        currentRoomId,

      readyState:
        socket?.readyState ??
        WebSocket.CLOSED,

      url:
        socket?.url ||
        getSignalingUrl(),
    };
  };

  return {
    connect,
    createRoom,
    joinRoom,
    sendSignal,
    ping,
    close,
    getState,
  };
}

export default createSignalingService;