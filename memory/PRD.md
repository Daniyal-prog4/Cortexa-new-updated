# Cortexa — PRD & Delivery Log

## Original problem statement
Build **Cortexa**, a Windows-first AI desktop assistant + web platform. The UI must match the provided reference image (dark futuristic, animated Cortexa Core orb) precisely. Architecture strictly follows the attached roadmap (Tauri/Next.js stack, desktop shell, assistant orb, telemetry, agents, secure local tool execution). No unrequested features.

## User choices (confirmed)
- Stack: React web preview + FastAPI backend, **plus a Tauri-ready `src-tauri/` scaffold** for local `cargo tauri dev`
- Scope: Home + all sidebar screens (Agents, Memory, Tasks, System, History, Settings)
- LLM: **Claude Sonnet 4.6** via Emergent Universal Key
- Auth: Email + password JWT auth with automatic device activation
- Telemetry: Simulated live values in web preview; real values via Rust `sysinfo` in Tauri
- **Design v2 (Aug 2026)**: cyan accent fully REMOVED — deep dark theme + rich royal/neon blue default accent; Cortexa Core orb redesigned (HUD rings + waveforms)
- Wake word: browser SpeechRecognition-based for web preview (desktop gets Porcupine later)
- Permission prompts: real confirm/cancel flow with SIMULATED execution logged to History
- Themes: Royal Blue (default) + Violet + Emerald + Crimson

## Architecture
- **Backend**: FastAPI + MongoDB, JWT auth, agent/memory/task/history CRUD, simulated telemetry, `/api/chat` (single-shot) and `/api/chat/stream` (SSE token streaming) bridged to Claude Sonnet 4.6 via `emergentintegrations`; permission engine (`detect_tool_request` — CONFIRM + BLOCKED tiers) with `tool_requests` collection and `/api/tools/{id}/resolve`.
- **Frontend**: React 19 + Tailwind, CSS-variable theme system (`data-theme` on root, ThemeContext), redesigned SVG-HUD Cortexa Core orb, streaming chat UI with caret + permission cards, WakeWordContext (SpeechRecognition wake word + dictation), dashboard shell matching the reference.
- **Desktop scaffold**: `/app/src-tauri` (validated statically; not built in preview).

## Implemented (Aug 2026)
### Sprint 1 (MVP)
- JWT auth (register/login/me) + device activation; 4 default agents seeded on register
- All screens: Auth, Home/Assistant, Agents, Memory, Tasks, System, History, Settings
- Chat endpoint with per-session transcript in MongoDB; simulated telemetry (2s refresh)
- Tauri scaffold with `sysinfo` telemetry command

### Sprint 2 (this session)
- **Streaming chat**: `POST /api/chat/stream` (SSE: session → delta* → [tool_request] → done); frontend fetch-reader with live token rendering + streaming caret; plain-text replies (markdown-safe renderer as fallback)
- **Permission engine**: keyword classifier with CONFIRM tier (write/delete/move file, run command, install app) and BLOCKED tier (format disk, rm -rf, system wipe, disable antivirus); confirm-or-cancel cards in chat; simulated execution results; resolutions logged to Activity/History; double-resolve → 400, unknown id → 404
- **Wake word (web)**: WakeWordContext using browser SpeechRecognition — says "Cortexa" → navigates Home, starts dictation, sends the spoken command; Settings toggle (persisted), listening chips in Settings + TitleBar; mic button/Speak CTA drive real dictation
- **Custom themes**: Royal Blue (default), Violet, Emerald, Crimson — swatch picker in Settings > Appearance, persisted in localStorage, instant app-wide switch via CSS vars
- **Design v2**: cyan removed everywhere (accent variables + color-mix), redesigned Cortexa Core (tick ring, segmented counter-rotating arcs, bright sweep arc, orbit dot, glass orb with aurora + glowing C, enveloped waveforms; listening state speeds animations)

## Testing
- Iteration 1: full MVP e2e — passed (fixes applied for 404/400 error handling)
- Iteration 2 (`/app/test_reports/iteration_2.json`): backend 13/13 pytest (SSE ordering, tool_request emission, resolve approve/deny/400/404, activity log, regression); frontend 100% (streaming UI, permission confirm+cancel flows, 4 themes + persistence, wake toggle + indicators, orb render, page regression)
- Post-iteration-2 fixes (all verified via curl + screenshot): broadened classifier + BLOCKED tier e2e, user-turn persistence on stream error, markdown handling, resolve error surfacing, id-based testids, single onDone

## Backlog (P0 → P2)
- **P1**: Real local tool registry inside Tauri (open_app / read_file / write_file with allowlists) replacing simulated execution
- **P1**: Native OS telemetry via Tauri/Rust `sysinfo` (replace simulated values)
- **P1**: Deep Memory & local file indexing integration
- **P2**: Offline always-on wake word in desktop build (Porcupine)
- **P2**: Web dashboard for device management, subscriptions/usage metering
- **P2**: Auto-updater (Tauri signed releases); full desktop build & test

## Notes
- Tool execution is **SIMULATED** in the web preview (canned results, nothing touches disk)
- Telemetry values are **SIMULATED** in web preview
- Wake word requires Chrome/Edge (SpeechRecognition) and mic permission; runs locally in browser
- Test creds: see `/app/memory/test_credentials.md`
