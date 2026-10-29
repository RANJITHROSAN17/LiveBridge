/**
 * Quick end-to-end protocol test for server/signaling-server.js.
 * Mirrors exactly what src/services/signalingService.js sends/expects.
 */
import WebSocket from "ws";

const URL = "ws://localhost:3001";
const log = [];
let failures = 0;

function expect(label, condition, detail = "") {
  log.push(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
  if (!condition) failures += 1;
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const inbox = [];
    ws.on("message", (raw) => inbox.push(JSON.parse(raw.toString())));
    ws.on("open", () => resolve({ ws, inbox, name }));
    ws.on("error", reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await connect("host");
const b = await connect("guest");

await wait(200);
expect("signaling-ready sent on connect",
  a.inbox.some((m) => m.type === "signaling-ready") &&
  b.inbox.some((m) => m.type === "signaling-ready"));

a.ws.send(JSON.stringify({ type: "create-room", roomId: "ABCD23" }));
await wait(200);
expect("room-created echoes normalized roomId",
  a.inbox.some((m) => m.type === "room-created" && m.roomId === "ABCD23"));

b.ws.send(JSON.stringify({ type: "join-room", roomId: "ABCD23" }));
await wait(200);
expect("joiner gets room-joined",
  b.inbox.some((m) => m.type === "room-joined" && m.roomId === "ABCD23"));
expect("BOTH peers get participant-joined (host offers, joiner waits)",
  a.inbox.some((m) => m.type === "participant-joined") &&
  b.inbox.some((m) => m.type === "participant-joined"));

// signal relay: host -> guest only
a.ws.send(JSON.stringify({ type: "signal", roomId: "ABCD23", payload: { type: "offer", sdp: "x" } }));
await wait(200);
expect("signal relayed to the other peer",
  b.inbox.some((m) => m.type === "signal" && m.payload?.type === "offer"));
expect("signal NOT echoed back to sender",
  !a.inbox.some((m) => m.type === "signal"));

// ping/pong keepalive
a.ws.send(JSON.stringify({ type: "ping", roomId: "ABCD23", timestamp: 42 }));
await wait(200);
expect("ping answered with pong",
  a.inbox.some((m) => m.type === "pong" && m.timestamp === 42));

// third peer must be rejected (1:1 rooms)
const c = await connect("third");
c.ws.send(JSON.stringify({ type: "join-room", roomId: "ABCD23" }));
await wait(200);
expect("third participant rejected with error",
  c.inbox.some((m) => m.type === "error" && /full/i.test(m.message)));

// unknown room join
c.ws.send(JSON.stringify({ type: "join-room", roomId: "ZZZZZZ" }));
await wait(200);
expect("joining a missing room reports error",
  c.inbox.some((m) => m.type === "error" && /does not exist/i.test(m.message)));

// invalid room code
c.ws.send(JSON.stringify({ type: "create-room", roomId: "iiii" }));
await wait(200);
expect("invalid room code rejected",
  c.inbox.some((m) => m.type === "error" && /Invalid room code/i.test(m.message)));

// leave-room notifies the peer
b.ws.send(JSON.stringify({ type: "leave-room", roomId: "ABCD23" }));
await wait(200);
expect("participant-left delivered to remaining peer",
  a.inbox.some((m) => m.type === "participant-left"));

console.log(log.join("\n"));
console.log(failures === 0 ? "\nALL SIGNALING TESTS PASSED ✅" : `\n${failures} TEST(S) FAILED ❌`);
a.ws.close(); b.ws.close(); c.ws.close();
process.exit(failures === 0 ? 0 : 1);
