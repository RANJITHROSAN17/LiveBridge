# LiveBridge — AI Language Interpreter

Real-time interpretation suite with four modes:

| Mode | Component | What it does |
|---|---|---|
| **Voice Interpreter** | `VoiceMode` | Two-way speech translation with emotion detection, smart replies, voice output, exports |
| **Chat Translator** | `ChatMode` | Typed text translation with emotion badges and data-guard privacy scanning |
| **Live Listener** | `ListenMode` | Captions & translates any audio source (mic / tab / system audio) |
| **Connect** | `ConnectMode` | Peer-to-peer interpreted session over WebRTC with live translated captions |

Plus global widgets: live subtitle overlay, voice assistant, conversation insights,
privacy badge, security banner, and a 30-minute inactivity lock.

---

## 1. Prerequisites

- **Node.js 18+** (this project is tested on Node 20) — https://nodejs.org
- **Chrome or Edge (desktop)** — required for Speech Recognition and system-audio capture.
  Firefox/Safari work for chat & translation only.
- **(Optional) Ollama** — for the local-AI extras (conversation insights, AI emotion,
  assistant answers) — https://ollama.com

## 2. Quick start (VS Code)

```bash
# 1. install dependencies
npm install

# 2. start the local backends (signaling + search API) — keep this terminal open
npm run servers

# 3. in a second VS Code terminal, start the app
npm run dev
```

Open the printed URL (default **http://localhost:5173**) in Chrome/Edge and allow
microphone (and tab audio, for Live Listener) when prompted.

### Optional — local AI with Ollama

```bash
ollama pull qwen2.5:1.5b   # ~1GB, fast — the default model
ollama serve               # if the Ollama app is not already running
```

The header chip shows **AI · qwen2.5:1.5b** when Ollama is reachable
(http://localhost:11434). Without it, everything still works using rule-based
fallbacks. To use a different model, change `PREFERRED_MODELS` in
`src/services/aiService.js` (smallest-first ordering is respected).

## 3. Environment files

| File | Purpose |
|---|---|
| `.env` | Active Vite config (loaded by `npm run dev`) |
| `.env.example` | Template to copy from |

Currently exposed variable:

```ini
VITE_SIGNALING_URL=ws://localhost:3001   # Connect-mode signaling server
```

Fixed local endpoints (by design, see code):

| Service | URL | Used by |
|---|---|---|
| Ollama LLM | `http://localhost:11434` | `aiService`, `emotionService` |
| Voice Assistant search | `http://localhost:5000/search` | `VoiceAssistant` (start with `npm run servers`) |
| Signaling (WebSocket) | `ws://localhost:3001` | `signalingService` (start with `npm run servers`) |

## 4. NPM scripts

| Script | What it runs |
|---|---|
| `npm run dev` | Vite dev server (the app) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serves the production build |
| `npm run signaling` | WebRTC signaling server only (port 3001) |
| `npm run search-api` | Voice Assistant search API only (port 5000) |
| `npm run servers` | Both backends together |
| `node server/test-signaling.mjs` | Protocol self-test for the signaling server (11 checks) |

## 5. Project structure

```
livebridge/
├── index.html                  # Vite entry page
├── package.json
├── vite.config.js
├── .env / .env.example         # environment configuration
├── server/
│   ├── signaling-server.js     # WebSocket signaling for Connect mode (3001)
│   ├── search-api.js           # Voice Assistant backend (5000)
│   └── index.js                # runs both backends
└── src/
    ├── main.jsx                # React entry
    ├── App.jsx                 # app shell: modes, languages, overlays
    ├── styles.css              # global theme (all shared classNames)
    ├── components/             # 19 UI components (your files)
    └── services/               # 14 logic services (your files)
```

## 6. What was added vs. what was yours

**Everything under `src/components/` and `src/services/` is your copied code**
(renamed from `.txt` to `.jsx`/`.js`, line endings normalized only).

Missing files that were reconstructed to make the project run:

- `src/App.jsx` — the shell (missing): language list, mode tabs, overlays,
  session monitor, Ollama status chip
- `src/main.jsx`, `index.html`, `vite.config.js`, `package.json` — Vite bootstrap
- `src/styles.css` — global stylesheet (your components reference ~90 shared
  classNames, `--font-mono`, `--border`, and the `fadeInUp` keyframe that had no
  definition anywhere)
- `server/signaling-server.js` — Connect mode needed a WebSocket signaling server
  on port 3001 (protocol matched to `signalingService.js` exactly)
- `server/search-api.js` — the Voice Assistant calls `GET /search?q=…` on port
  5000; this provides it (local knowledge base + optional Ollama answers)
- `.env`, `.env.example`, `.gitignore`, this README

**Two small fixes inside your copied files** (marked `✅ FIXED` in code comments):

1. `src/services/aiService.js` — `PREFERRED_MODELS` only listed
   `qwen2.5-coder:7b` although the file header promises "smallest model first
   (qwen2.5:1.5b)… no more qwen2.5-coder:7b (4.5GB = too slow)". Restored the
   smallest-first list and made `checkOllamaStatus` prefer exact matches.
2. `src/components/ChatMode.jsx` — `dataGuardService` existed but nothing
   imported it. The send path now runs `scanBeforeSending()` (blocks passwords /
   keys / personal IDs, asks before sending confidential wording).

## 7. Feature → dependency map (troubleshooting)

| If this feature fails… | Check |
|---|---|
| Speech recognition (Voice/Listen/Connect) | Use Chrome/Edge; allow mic permission |
| System/tab audio in Live Listener | Chrome/Edge "Share system audio" checkbox |
| Translation | Internet access (Google Translate / MyMemory, no API key needed) |
| Voice output | Browser speech voices installed for the target language |
| Connect mode | `npm run servers` running; `VITE_SIGNALING_URL` correct; both peers reach it |
| Voice Assistant answers | `npm run servers` running (port 5000 free) |
| Conversation Insights | Works offline (rule-based); better with Ollama running |
| AI emotion (`detectEmotionAI`) | Optional Ollama; falls back to keyword detection |
| Exports (TXT/SRT/JSON) | Nothing extra — downloads straight from the browser |

## 8. Notes

- Transcripts live in memory only (per the privacy notice) — refreshing the page
  clears the conversation.
- The session monitor pauses the app after 30 minutes of inactivity
  (`securityService.startSessionMonitor`); click **Resume Session** to continue.
- Connect-mode rooms are 1:1 and use a 6-character code (A–H J–N P–Z 2–9).
