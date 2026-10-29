/**
 * LiveBridge — run all local backend services with one command.
 *
 *   npm run servers
 *
 * Starts:
 *   - WebSocket signaling server  (Connect mode)        -> ws://localhost:3001
 *   - Voice Assistant search API  (Voice Assistant)     -> http://localhost:5000
 *
 * The Ollama LLM (http://localhost:11434) is external — install and
 * start it separately if you want the AI features (see README).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const services = [
  { name: "signaling", script: path.join(here, "signaling-server.js") },
  { name: "search-api", script: path.join(here, "search-api.js") },
];

const children = [];

for (const service of services) {
  const child = spawn(process.execPath, [service.script], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    console.log(`[SERVERS] ${service.name} exited with code ${code}`);
  });

  children.push(child);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
