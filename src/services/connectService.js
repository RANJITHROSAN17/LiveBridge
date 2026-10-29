const DEFAULT_RTC_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export function createConnectService({
  onSignal,
  onMessage,
  onStateChange,
  onError,
} = {}) {
  let peerConnection = null;
  let dataChannel = null;
  let isClosed = false;

  const emitState = (state) => {
    onStateChange?.(state);
  };

  const emitError = (error) => {
    console.error("Connect service error:", error);
    onError?.(error);
  };

  const handleDataChannel = (channel) => {
    dataChannel = channel;

    dataChannel.onopen = () => {
      emitState("connected");
    };

    dataChannel.onclose = () => {
      emitState("disconnected");
    };

    dataChannel.onerror = (event) => {
      emitError(
        new Error(
          event?.error?.message ||
            "LiveBridge data channel error."
        )
      );
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        emitError(
          new Error("Invalid peer message received.")
        );
      }
    };
  };

  const createPeerConnection = () => {
    if (peerConnection) {
      return peerConnection;
    }

    peerConnection = new RTCPeerConnection(
      DEFAULT_RTC_CONFIG
    );

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onSignal?.({
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === "connected") {
        emitState("connected");
      } else if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        emitState("disconnected");
      } else {
        emitState(state);
      }
    };

    peerConnection.ondatachannel = (event) => {
      handleDataChannel(event.channel);
    };

    return peerConnection;
  };

  const createOffer = async () => {
    try {
      const pc = createPeerConnection();

      const channel = pc.createDataChannel(
        "livebridge-captions",
        {
          ordered: true,
        }
      );

      handleDataChannel(channel);

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      onSignal?.({
        type: "offer",
        sdp: pc.localDescription,
      });
    } catch (error) {
      emitError(error);
      throw error;
    }
  };

  const handleSignal = async (signal) => {
    if (!signal || isClosed) {
      return;
    }

    try {
      const pc = createPeerConnection();

      if (signal.type === "offer") {
        await pc.setRemoteDescription(signal.sdp);

        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);

        onSignal?.({
          type: "answer",
          sdp: pc.localDescription,
        });

        return;
      }

      if (signal.type === "answer") {
        await pc.setRemoteDescription(signal.sdp);
        return;
      }

      if (
        signal.type === "candidate" &&
        signal.candidate
      ) {
        await pc.addIceCandidate(signal.candidate);
      }
    } catch (error) {
      emitError(error);
    }
  };

  const sendMessage = (message) => {
    if (
      !dataChannel ||
      dataChannel.readyState !== "open"
    ) {
      return false;
    }

    dataChannel.send(JSON.stringify(message));

    return true;
  };

  const close = () => {
    isClosed = true;

    try {
      dataChannel?.close();
    } catch (error) {
      console.error(error);
    }

    try {
      peerConnection?.close();
    } catch (error) {
      console.error(error);
    }

    dataChannel = null;
    peerConnection = null;

    emitState("closed");
  };

  return {
    createOffer,
    handleSignal,
    sendMessage,
    close,
  };
}