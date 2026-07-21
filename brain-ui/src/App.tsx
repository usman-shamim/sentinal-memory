import React, { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import { WorkingMemoryTray } from './components/WorkingMemoryTray';
import { BrainGraph } from './components/BrainGraph';
import { CueCommandPalette } from './components/CueCommandPalette';
import { SnarcInspector } from './components/SnarcInspector';
import { DreamCycleConsole } from './components/DreamCycleConsole';
import { OkfVault } from './components/OkfVault';
import { useBrainStore } from './store/brainStore';

export default function App() {
  const fetchGraph = useBrainStore((s) => s.fetchGraph);
  const isCommandOpen = useBrainStore((s) => s.isCommandOpen);
  const setCommandOpen = useBrainStore((s) => s.setCommandOpen);
  const setVaultOpen = useBrainStore((s) => s.setVaultOpen);

  useEffect(() => {
    fetchGraph();
    // Poll graph every 30s to update decay visually
    const interval = setInterval(fetchGraph, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#9d4edd',
          colorBgContainer: '#0a0a0a',
          colorBorder: '#1f1f1f',
        },
      }}
    >
      <div className="flex flex-col h-screen bg-brain-bg text-white overflow-hidden">
        {/* Top Bar: 7 Working Memory Slots */}
        <WorkingMemoryTray />

        {/* Main Area: 3D Brain Graph */}
        <div className="flex-1 relative">
          <BrainGraph />

          {/* Floating Action Buttons */}
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Search Memory (⌘K)
            </button>
            <button
              onClick={() => setVaultOpen(true)}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Brain Vault
            </button>
          </div>
        </div>

        {/* Bottom Bar: Dream Cycle Console */}
        <DreamCycleConsole />

        {/* Overlays & Modals */}
        <CueCommandPalette open={isCommandOpen} onOpenChange={setCommandOpen} />
        <SnarcInspector />
        <OkfVault />
      </div>
    </ConfigProvider>
  );
}
