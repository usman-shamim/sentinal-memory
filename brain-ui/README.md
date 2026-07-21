# Brain Dashboard

3D visualization for the ADHD Memory Layer.

## Setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Features

- **Working Memory Tray**: 7 slots with TTL countdown rings
- **3D Brain Graph**: Nodes fade with decay, grow with hits
- **Cue Command Palette**: Cmd+K, cue-dependent search
- **SNARC Inspector**: Radar chart showing why memories were stored
- **Dream Cycle Console**: Timeline slider for nightly consolidation
- **OKF Vault**: Browse and restore forgotten memories

## Keyboard Shortcuts

- `Cmd+K` / `Ctrl+K` — Open cue-dependent command palette

## Backend Required

The frontend expects the ADHD Memory Layer backend running at `http://localhost:8400`.
