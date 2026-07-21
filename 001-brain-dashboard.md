# Brain Dashboard — Frontend Specification v1.0

**Created**: 2026-07-22
**Status**: Draft
**Stack**: Vite + React + TypeScript, Tailwind CSS, ShadCN UI, Ant Design, react-force-graph-3d

---

## Overview

The Brain Dashboard is the visual interface for the ADHD Memory Layer. It renders a 3D cognitive space where nodes represent memories, opacity reflects decay, size reflects hit count, and a 7-slot working memory tray shows the agent's active context.

---

## Stack & Dependencies

- Vite, React, TypeScript
- Tailwind CSS, ShadCN UI (working memory tray, command palette, cards)
- Ant Design (data tables, drawers, sliders, timeline, radar chart)
- `react-force-graph-3d` (ThreeJS 3D brain graph)
- `zustand` (state management)
- `axios` (HTTP client)
- `framer-motion` (animations)

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  WORKING MEMORY TRAY (7 slots, TTL rings, glow)    │
├─────────────────────────────────────────────────────┤
│                                                     │
│              3D BRAIN GRAPH                          │
│         (react-force-graph-3d)                       │
│                                                     │
│  [Cmd+K]                              [Inspector]   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  DREAM CYCLE CONSOLE (timeline slider)              │
└─────────────────────────────────────────────────────┘
```

---

## Components

### A. WorkingMemoryTray (ShadCN)
- Fixed top bar, exactly 7 slots
- Framer Motion animate-in/out
- Circular progress ring per slot (TTL countdown from 15 min)
- Lowest salience memory "pushed out" when full (animates to graph)
- Purple glow if memory matches focus_topic

### B. BrainGraph (react-force-graph-3d)
- Dark background (#050505)
- Nodes: color=cyan (or purple if hyperfocus), opacity=decay_score, val=hit_count+1
- Nodes fade over time if not accessed
- Click node → opens Inspector
- Hyperfocus gravity: matching nodes pulled to center

### C. CueCommandPalette (ShadCN cmdk)
- Triggered by Cmd+K
- MUST select a cue first (#psx, #docker, etc.)
- Search disabled until cue selected
- Calls POST /recall with selected cue

### D. SnarcInspector (Ant Design Drawer)
- Slides in on node click
- Shows Descriptions (content, decay, hits, cues)
- Radar chart showing 5 SNARC dimensions
- "Force Decay" button → POST /forget

### E. DreamCycleConsole (Ant Design Timeline)
- Bottom bar with slider
- Scrub through 03:00 AM Dream Cycle steps
- Play/pause button

### F. OkfVault (Ant Design Modal + Tree)
- File tree of forgotten OKF bundles
- Browse archived memories by cue
- "Restore" tag to re-import into active memory

---

## Global State (Zustand)

```typescript
interface BrainState {
  workingMemory: Memory[];        // max 7
  focusTopic: string | null;
  graphData: { nodes: Node[], links: Link[] };
  selectedMemory: Memory | null;
  isCommandOpen: boolean;
  isVaultOpen: boolean;
  
  fetchGraph: () => Promise<void>;
  recall: (cue: string, query: string) => Promise<void>;
  setSelectedMemory: (mem: Memory | null) => void;
}
```

---

## Styling

- Tailwind dark mode
- Ant Design dark algorithm
- Body background: #050505
- Purple accent: #9d4edd (hyperfocus)
- Cyan accent: #00d9ff (default nodes)

---

## Spec Version

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-07-22 | Initial frontend specification |
