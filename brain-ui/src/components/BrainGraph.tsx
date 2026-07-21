import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useBrainStore } from '../store/brainStore';

// Dynamic import for react-force-graph-3d to avoid SSR issues
const ForceGraph3D = React.lazy(() => import('react-force-graph-3d'));

export function BrainGraph() {
  const fgRef = useRef<any>(null);
  const graphData = useBrainStore((s) => s.graphData);
  const setSelectedMemory = useBrainStore((s) => s.setSelectedMemory);
  const focusTopic = useBrainStore((s) => s.focusTopic);
  const [THREE, setTHREE] = useState<any>(null);

  // Load Three.js dynamically
  useEffect(() => {
    import('three').then((mod) => setTHREE(mod));
  }, []);

  // Custom node rendering with Three.js
  const nodeThreeObject = useMemo(() => {
    if (!THREE) return undefined;
    
    return (node: any) => {
      const geometry = new THREE.SphereGeometry(
        Math.max(0.5, (node.val || 1) * 0.8),
        16,
        16
      );
      const material = new THREE.MeshBasicMaterial({
        color: focusTopic && node.cues?.includes(focusTopic) ? 0x9d4edd : 0x00d9ff,
        transparent: true,
        opacity: Math.max(0.15, node.opacity || 0.5),
      });
      return new THREE.Mesh(geometry, material);
    };
  }, [THREE, focusTopic]);

  // Node hover label
  const nodeLabel = (node: any) => {
    return `
      <div style="background:#0a0a0a;border:1px solid #1f1f1f;padding:8px;border-radius:4px;max-width:200px;">
        <div style="font-size:11px;color:#9ca3af;">${node.cues?.join(', ') || 'no cues'}</div>
        <div style="font-size:12px;color:#e5e7eb;margin-top:4px;">${node.content}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px;">
          Decay: ${(node.opacity * 100).toFixed(0)}% | Hits: ${node.val - 1}
        </div>
      </div>
    `;
  };

  // Handle node click
  const handleNodeClick = (node: any) => {
    setSelectedMemory(node);
  };

  return (
    <div className="w-full h-full bg-[#050505]">
      <React.Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading 3D Graph...</div>}>
        {THREE && (
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            nodeThreeObject={nodeThreeObject}
            nodeLabel={nodeLabel}
            onNodeClick={handleNodeClick}
            backgroundColor="#050505"
            showNavInfo={false}
            nodeRelSize={1}
            linkColor={() => '#1f1f1f'}
            linkOpacity={0.3}
            d3VelocityDecay={0.3}
          />
        )}
      </React.Suspense>
    </div>
  );
}
