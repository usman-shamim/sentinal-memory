/**
 * Brain Store — Zustand state management for the ADHD Brain Dashboard.
 * Bridges the 3D graph, 7 working memory slots, and inspector.
 */

import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8400';

interface Memory {
  id: string;
  content: string;
  val: number;        // hit_count + 1 (node size)
  opacity: number;    // decay_score (fading effect)
  cues: string[];
  snarc: {
    surprise: number;
    novelty: number;
    arousal: number;
    reward: number;
    conflict: number;
  };
  salience: number;
  status: string;
}

interface GraphNode {
  id: string;
  content: string;
  val: number;
  opacity: number;
  cues: string[];
  snarc: any;
  salience: number;
  status: string;
}

interface GraphLink {
  source: string;
  target: string;
  cue: string;
}

interface BrainState {
  // Working Memory (7 slots)
  workingMemory: Memory[];
  focusTopic: string | null;

  // Graph Data
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  selectedMemory: Memory | null;

  // UI State
  isCommandOpen: boolean;
  isVaultOpen: boolean;
  isInspectorOpen: boolean;

  // Actions
  fetchGraph: () => Promise<void>;
  remember: (data: any) => Promise<any>;
  recall: (cue: string, query: string) => Promise<void>;
  focus: (topic: string) => Promise<void>;
  forget: (memoryId: string) => Promise<void>;
  setSelectedMemory: (mem: Memory | null) => void;
  setCommandOpen: (val: boolean) => void;
  setVaultOpen: (val: boolean) => void;
}

export const useBrainStore = create<BrainState>((set, get) => ({
  // Initial state
  workingMemory: [],
  focusTopic: null,
  graphData: { nodes: [], links: [] },
  selectedMemory: null,
  isCommandOpen: false,
  isVaultOpen: false,
  isInspectorOpen: false,

  // Fetch graph data from backend
  fetchGraph: async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph`, {
        params: { project: 'agent-launch-pad', limit: 100 },
      });

      const nodes: GraphNode[] = res.data.memories.map((m: any) => ({
        id: m.id,
        content: m.content,
        val: m.hit_count + 1,
        opacity: Math.max(0.1, m.decay_score),
        cues: m.cues,
        snarc: m.snarc,
        salience: m.salience,
        status: m.status,
      }));

      // Build links from shared cues
      const cueToNodes: Record<string, string[]> = {};
      nodes.forEach((node) => {
        node.cues.forEach((cue) => {
          cueToNodes[cue] = cueToNodes[cue] || [];
          cueToNodes[cue].push(node.id);
        });
      });

      const links: GraphLink[] = [];
      Object.entries(cueToNodes).forEach(([cue, nodeIds]) => {
        for (let i = 0; i < nodeIds.length; i++) {
          for (let j = i + 1; j < nodeIds.length; j++) {
            links.push({ source: nodeIds[i], target: nodeIds[j], cue });
          }
        }
      });

      set({ graphData: { nodes, links } });
    } catch (err) {
      console.error('Failed to fetch graph:', err);
    }
  },

  // Remember an event
  remember: async (data) => {
    const res = await axios.post(`${API_BASE}/remember`, data);
    // Refresh graph after remembering
    await get().fetchGraph();
    return res.data;
  },

  // Recall by cue
  recall: async (cue, query) => {
    const res = await axios.post(`${API_BASE}/recall`, {
      project: 'agent-launch-pad',
      cue,
      query_text: query,
    });

    // Push to working memory (hard cap 7)
    const currentWM = get().workingMemory;
    const newMems = res.data.memories.map((m: any) => ({
      ...m,
      val: m.hit_count + 1,
      opacity: m.decay_score,
    }));
    const newWM = [...currentWM, ...newMems].slice(-7);
    set({ workingMemory: newWM });
  },

  // Set hyperfocus topic
  focus: async (topic) => {
    await axios.post(`${API_BASE}/focus`, {
      project: 'agent-launch-pad',
      topic,
    });
    set({ focusTopic: topic });
    // Auto-clear after 30 min
    setTimeout(() => set({ focusTopic: null }), 1800000);
  },

  // Force decay (forget)
  forget: async (memoryId) => {
    await axios.post(`${API_BASE}/forget`, { memory_id: memoryId });
    // Remove from working memory if present
    const wm = get().workingMemory.filter((m) => m.id !== memoryId);
    set({ workingMemory: wm, selectedMemory: null });
    // Refresh graph
    await get().fetchGraph();
  },

  // UI state setters
  setSelectedMemory: (mem) => set({ selectedMemory: mem, isInspectorOpen: !!mem }),
  setCommandOpen: (val) => set({ isCommandOpen: val }),
  setVaultOpen: (val) => set({ isVaultOpen: val }),
}));
