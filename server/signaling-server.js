/**
 * LiveBridge — WebRTC Signaling Server
 * ------------------------------------
 * Missing backend for Connect mode (peer-to-peer interpreted sessions).
 *
 * Protocol (matches src/services/signalingService.js exactly):
 *
 *   Client -> Server:
 *     { type: "create-room", roomId }
 *     { type: "join-room",   roomId }
 *     { type: "signal",      roomId, payload }   // WebRTC SDP / ICE
 *     { type: "ping",        roomId, timestamp }
 *     { type: "leave-room",  roomId }
 *
 *   Server -> Client:
 *     { type: "signaling-ready" }
 *     { type: "room-created",   roomId }
 *     { type: "room-joined",    roomId }
 *     { type: "participant-joined", roomId }     // to every member of the room
 *     { type: "participant-left",   roomId }
 *     { type: "signal", payload }                // relayed from the peer
 *     { type: "pong", timestamp }
 *     { type: "error", message }
 *
 * Rooms are 1:1 (max 2 participants). The peer that created the room is
 * the "host" and sends the WebRTC offer when notified that a
 * participant joined.
 *
 * Start:  npm run signaling      (default port 3001)
 * Env:    PORT=3001
 */

import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT) || 3001;

/** Room ids mirror the client's normalizeRoomId(): 1-6 chars of A-H J-N P-Z 2-9. */
const ROOM_ID_PATTERN = /^[A-HJ-NP-Z2-9]{1,6}$/;

/** Maximum simultaneous sockets per room (1:1 session). */
const MAX_ROOM_SIZE = 2;

/** Drop dead sockets after this many ms without a ping. */
const HEARTBEAT_TIMEOUT_MS = 60 * 1000;

/**
 * roomId -> { members: Set<WebSocket>, createdAt: number }
 */
const rooms = new Map();

const wss = new WebSocketServer({ port: PORT });

function sendTo(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(roomId, message, exceptSocket = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const member of room.members) {
    if (member !== exceptSocket) {
      sendTo(member, message);
    }
  }
}

function roomMembersFor(socket) {
  const found = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.members.has(socket)) {
      found.push({ roomId, room });
    }
  }
  return found;
}

function leaveAllRooms(socket, notify = true) {
  for (const { roomId, room } of roomMembersFor(socket)) {
    room.members.delete(socket);

    if (notify) {
      broadcast(roomId, { type: "participant-left", roomId });
    }

    if (room.members.size === 0) {
      rooms.delete(roomId);
      console.log(`[SIGNAL] room ${roomId} closed (empty)`);
    }
  }
}

function createRoom(socket, roomId) {
  if (rooms.has(roomId)) {
    // Idempotent: if the same socket re-creates, just confirm.
    const room = rooms.get(roomId);
    if (room.members.has(socket)) {
      sendTo(socket, { type: "room-created", roomId });
      return;
    }
    sendTo(socket, {
      type: "error",
      message: `Room ${roomId} already exists. Try joining instead.`,
    });
    return;
  }

  rooms.set(roomId, {
    members: new Set([socket]),
    createdAt: Date.now(),
  });

  console.log(`[SIGNAL] room ${roomId} created`);
  sendTo(socket, { type: "room-created", roomId });
}

function joinRoom(socket, roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    sendTo(socket, {
      type: "error",
      message: `Room ${roomId} does not exist. Check the session code or create a new session.`,
    });
    return;
  }

  if (room.members.has(socket)) {
    sendTo(socket, { type: "room-joined", roomId });
    return;
  }

  if (room.members.size >= MAX_ROOM_SIZE) {
    sendTo(socket, {
      type: "error",
      message: `Room ${roomId} is full. Sessions support two participants.`,
    });
    return;
  }

  room.members.add(socket);
  console.log(`[SIGNAL] participant joined room ${roomId}`);

  sendTo(socket, { type: "room-joined", roomId });

  // Both peers rely on "participant-joined":
  //  - the host starts the WebRTC offer,
  //  - the joiner shows "waiting for host offer".
  broadcast(roomId, { type: "participant-joined", roomId });
}

function relaySignal(socket, roomId, payload) {
  const room = rooms.get(roomId);

  if (!room || !room.members.has(socket)) {
    sendTo(socket, {
      type: "error",
      message: "Create or join the room before exchanging WebRTC signals.",
    });
    return;
  }

  // Relay to everyone else in the room (the one peer).
  broadcast(roomId, { type: "signal", payload }, socket);
}

wss.on("connection", (socket) => {
  console.log("[SIGNAL] client connected");

  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  // The very first frame signals readiness to the client library.
  sendTo(socket, { type: "signaling-ready" });

  socket.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      sendTo(socket, { type: "error", message: "Invalid JSON." });
      return;
    }

    if (!message || typeof message !== "object" || Array.isArray(message)) {
      sendTo(socket, { type: "error", message: "Invalid message." });
      return;
    }

    const roomId =
      typeof message.roomId === "string"
        ? message.roomId.trim().toUpperCase()
        : "";

    switch (message.type) {
      case "create-room": {
        if (!ROOM_ID_PATTERN.test(roomId)) {
          sendTo(socket, {
            type: "error",
            message: "Invalid room code. Expected 1-6 characters (A-H J-N P-Z 2-9).",
          });
          return;
        }
        createRoom(socket, roomId);
        break;
      }

      case "join-room": {
        if (!ROOM_ID_PATTERN.test(roomId)) {
          sendTo(socket, {
            type: "error",
            message: "Invalid room code. Expected 1-6 characters (A-H J-N P-Z 2-9).",
          });
          return;
        }
        joinRoom(socket, roomId);
        break;
      }

      case "signal": {
        relaySignal(socket, roomId, message.payload);
        break;
      }

      case "ping": {
        socket.isAlive = true;
        sendTo(socket, {
          type: "pong",
          timestamp: message.timestamp || Date.now(),
        });
        break;
      }

      case "leave-room": {
        leaveAllRooms(socket, true);
        break;
      }

      default: {
        sendTo(socket, {
          type: "error",
          message: `Unknown message type: ${String(message.type)}`,
        });
      }
    }
  });

  socket.on("close", () => {
    leaveAllRooms(socket, true);
    console.log("[SIGNAL] client disconnected");
  });

  socket.on("error", (error) => {
    console.error("[SIGNAL] socket error:", error?.message || error);
    leaveAllRooms(socket, true);
  });
});

// Heartbeat: terminate sockets that stopped responding.
const heartbeatTimer = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      leaveAllRooms(socket, true);
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, HEARTBEAT_TIMEOUT_MS);

wss.on("close", () => {
  clearInterval(heartbeatTimer);
});

console.log(`[SIGNAL] LiveBridge signaling server listening on ws://localhost:${PORT}`);
