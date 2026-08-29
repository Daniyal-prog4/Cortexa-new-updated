# Cortexa — PRD & Delivery Log

## Original problem statement
Build **Cortexa**, a Windows-first AI desktop assistant + web platform. The UI must match the provided reference image (dark futuristic, cyan/electric-blue accents, animated Cortexa Core orb) precisely. Architecture strictly follows the attached roadmap (Tauri/Next.js stack, desktop shell, assistant orb, telemetry, agents, secure local tool execution). No unrequested features.

## User choices (confirmed)
- Stack: React web preview + FastAPI backend, **plus a Tauri-ready `src-tauri/` scaffold** for local `cargo tauri dev`
- Scope: Home + all sidebar screens (Agents, Memory, Tasks, System, History, Settings)
- LLM: **Claude Sonnet 4.6** via Emergent Universal Key
- Auth: Email + password JWT auth with automatic device activation
- Telemetry: Simulated live values in web preview; real values via Rust `sysinfo` in Tauri

## Architecture (MVP)
- **Backend**: FastAPI + MongoDB, JWT auth, agent/memory/task/history CRUD, simulated telemetry, `/api/chat` bridged to Anthropic Claude Sonnet 4.6 via `emergentintegrations`.
- **Frontend**: React 19 + Tailwind, custom dark futuristic theme, animated Cortexa Core orb, dashboard shell matching the reference exactly.
- **Desktop scaffold**: `/app/src-tauri` with `tauri.conf.json`, `Cargo.toml`, `main.rs` exposing a `telemetry` command. Ready for `cargo tauri dev` on a Windows machine.

## Screens delivered
- Auth (login/register with device activation)
- Home / Assistant (greeting, Cortexa Core orb, Speak/Type CTAs, Quick Actions, live chat mode, command bar)
- Agents (list, create custom agent, delete)
- Memory (key/value store per user)
- Tasks (add, status transitions)
- System (large telemetry stats, refreshing every 2s)
- History (activity feed)
- Settings (Account, AI, Voice/Wake-Word, Appearance, Desktop, Permissions, Privacy, About)

## Implemented (Aug 2026)
- JWT auth (register/login/me) + device activation
- Default 4 agents seeded on register (Developer, Researcher, System, File)
- Cortexa chat endpoint with per-session history in MongoDB
- Right panel: System Overview, Your Agents, Recent Activity — all live
- Rotating rings + waveform Cortexa Core orb
- Sidebar navigation + custom title bar (Online chip, search, notifications, minimize/maximize/close)
- Tauri scaffold with local `sysinfo`-driven telemetry command

## Backlog (P0 → P2)
- **P0**: Streaming chat responses (SSE) via `stream_message`; permission-engine UI for CONFIRM-risk tool calls
- **P1**: Actual local tool registry inside Tauri (open_app / read_file / write_file with allowlists)
- **P1**: Wake-word local listener (Porcupine or Snowboy) — opt-in
- **P2**: Web dashboard for device management, subscriptions/usage metering
- **P2**: Auto-updater (Tauri built-in updater with signed releases)

## Notes
- Tauri/Rust binaries are **not** built inside this preview environment; scaffold is validated statically. Run `cargo tauri dev` from a local Windows machine.
