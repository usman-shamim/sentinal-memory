/**
 * Brain Store v2.0 — Zustand state management with real API calls + auth.
 */

import { create } from 'zustand';
import axios from 'axios';

const API_BASE = '/api';

// Auth token from env or localStorage
const AUTH_TOKEN = localStorage.getItem('brain_auth_token') || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
  },
});

interface Memory {
  id: string;
  content: string;
  val: number;
  opacity: number;
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

interface DreamCycleRun {
  id: string;
  status: string;
  start_time: string | null;
}

interface BrainState {
  workingMemory: Memory[];
  focusTopic: string | null;
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  selectedMemory: Memory | null;
  isCommandOpen: boolean;
  isVaultOpen: boolean;
  isInspectorOpen: boolean;
  dreamCycleStatus: string;
  dreamCycleRuns: DreamCycleRun[];
  vaultTree: any[];

  fetchGraph: () => Promise<void>;
  remember: (data: any) => Promise<any>;
  recall: (cue: string, query: string) => Promise<void>;
  focus: (topic: string) => Promise<void>;
  forget: (memoryId: string) => Promise<void>;
  fetchDreamCycleStatus: () => Promise<void>;
  fetchVault: () => Promise<void>;
  restoreMemory: (memoryId: string) => Promise<void>;
  setSelectedMemory: (mem: Memory | null) => void;
  setCommandOpen: (val: boolean) => void;
  setVaultOpen: (val: boolean) => void;
  setAuthToken: (token: string) => void;
}

export const useBrainStore = create<BrainState>((set, get) => ({
  workingMemory: [],
  focusTopic: null,
  graphData: { nodes: [], links: [] },
  selectedMemory: null,
  isCommandOpen: false,
  isVaultOpen: false,
  isInspectorOpen: false,
  dreamCycleStatus: 'not_started',
  dreamCycleRuns: [],
  vaultTree: [],

  fetchGraph: async () => {
    try {
      const res = await api.get('/graph', {
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

  remember: async (data) => {
    const res = await api.post('/remember', data);
    await get().fetchGraph();
    return res.data;
  },

  recall: async (cue, query) => {
    const res = await api.post('/recall', {
      project: 'agent-launch-pad',
      cue,
      query_text: query,
    });

    const currentWM = get().workingMemory;
    const newMems = res.data.memories.map((m: any) => ({
      ...m,
      val: m.hit_count + 1,
      opacity: m.decay_score,
    }));
    const newWM = [...currentWM, ...newMems].slice(-7);
    set({ workingMemory: newWM });
  },

  focus: async (topic) => {
    await api.post('/focus', {
      project: 'agent-launch-pad',
      topic,
    });
    set({ focusTopic: topic });
    setTimeout(() => set({ focusTopic: null }), 1800000);
  },

  forget: async (memoryId) => {
    await api.post('/forget', { memory_id: memoryId });
    const wm = get().workingMemory.filter((m) => m.id !== memoryId);
    set({ workingMemory: wm, selectedMemory: null });
    await get().fetchGraph();
  },

  fetchDreamCycleStatus: async () => {
    try {
      const res = await api.get('/dream-cycle/status');
      set({
        dreamCycleStatus: res.data.status,
        dreamCycleRuns: res.data.runs || [],
      });
    } catch (err) {
      console.error('Failed to fetch dream cycle status:', err);
    }
  },

  fetchVault: async () => {
    try {
      const res = await api.get('/vault', {
        params: { project: 'agent-launch-pad' },
      });
      set({ vaultTree: res.data.tree || [] });
    } catch (err) {
      console.error('Failed to fetch vault:', err);
    }
  },

  restoreMemory: async (memoryId) => {
    await api.post('/restore', null, {
      params: { memory_id: memoryId, project: 'agent-launch-pad' },
    });
    await get().fetchVault();
    await get().fetchGraph();
  },

  setSelectedMemory: (mem) => set({ selectedMemory: mem, isInspectorOpen: !!mem }),
  setCommandOpen: (val) => set({ isCommandOpen: val }),
  setVaultOpen: (val) => set({ isVaultOpen: val }),
  setAuthToken: (token) => {
    localStorage.setItem('brain_auth_token', token);
    api.defaults.headers['Authorization'] = `Bearer ${token}`;
  },
}));
