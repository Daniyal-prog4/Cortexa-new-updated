# Cortexa Desktop (Tauri)

This directory contains the Tauri 2 scaffold for building the Cortexa Windows desktop
binary. The React UI lives in `/app/frontend` and is loaded by Tauri in production
from `../frontend/build`.

## Prerequisites
- Rust toolchain (`rustup install stable`)
- Node.js 18+ and `yarn`
- Tauri CLI: `cargo install tauri-cli --version "^2.0.0"`
- Windows only for signed builds

## Dev
```bash
cd src-tauri
cargo tauri dev
```

## Build (Windows MSI + NSIS)
```bash
cd src-tauri
cargo tauri build
```

## Notes
- `main.rs` exposes a `telemetry` command that returns live CPU/RAM/Disk from the local machine.
- The permission engine & tool registry (per roadmap) will live in `src-tauri/src/tools/`
  in Phase 2 of the roadmap.
- The React UI runs 1:1 in the browser preview and in Tauri — no code branches required for
  the MVP shell.
