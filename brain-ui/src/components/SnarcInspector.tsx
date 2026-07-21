import React, { useMemo } from 'react';
import { Drawer, Descriptions, Button, Empty, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';

// Simple SVG Radar Chart (no external dependency needed)
function RadarChart({ data }: { data: { dimension: string; value: number }[] }) {
  const size = 200;
  const center = size / 2;
  const radius = 80;
  const levels = 5;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = radius * value;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate polygon points for data
  const dataPoints = data
    .map((d, i) => {
      const p = getPoint(i, d.value);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid circles */}
      {Array.from({ length: levels }).map((_, i) => {
        const r = (radius * (i + 1)) / levels;
        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="#1f1f1f"
            strokeWidth="1"
          />
        );
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const p = getPoint(i, 1);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="#1f1f1f"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill="rgba(157, 78, 221, 0.3)"
        stroke="#9d4edd"
        strokeWidth="2"
      />

      {/* Data points */}
      {data.map((d, i) => {
        const p = getPoint(i, d.value);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#9d4edd"
          />
        );
      })}

      {/* Labels */}
      {data.map((d, i) => {
        const p = getPoint(i, 1.2);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            {d.dimension}
          </text>
        );
      })}
    </svg>
  );
}

export function SnarcInspector() {
  const selectedMemory = useBrainStore((s) => s.selectedMemory);
  const isInspectorOpen = useBrainStore((s) => s.isInspectorOpen);
  const setSelectedMemory = useBrainStore((s) => s.setSelectedMemory);
  const forget = useBrainStore((s) => s.forget);

  const handleForceDecay = async () => {
    if (selectedMemory) {
      await forget(selectedMemory.id);
    }
  };

  const radarData = useMemo(() => {
    if (!selectedMemory?.snarc) return [];
    return [
      { dimension: 'Surprise', value: selectedMemory.snarc.surprise || 0 },
      { dimension: 'Novelty', value: selectedMemory.snarc.novelty || 0 },
      { dimension: 'Arousal', value: selectedMemory.snarc.arousal || 0 },
      { dimension: 'Reward', value: selectedMemory.snarc.reward || 0 },
      { dimension: 'Conflict', value: selectedMemory.snarc.conflict || 0 },
    ];
  }, [selectedMemory]);

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <span>Memory Inspector</span>
          {selectedMemory && (
            <Tag color={selectedMemory.status === 'active' ? 'cyan' : 'default'}>
              {selectedMemory.status}
            </Tag>
          )}
        </div>
      }
      open={isInspectorOpen}
      onClose={() => setSelectedMemory(null)}
      width={420}
      styles={{ body: { background: '#0a0a0a' } }}
      extra={
        selectedMemory && (
          <Button danger icon={<DeleteOutlined />} onClick={handleForceDecay}>
            Force Decay
          </Button>
        )
      }
    >
      {selectedMemory ? (
        <div className="space-y-6">
          {/* Memory Details */}
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Content">
              <span className="text-white">{selectedMemory.content}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Decay Score">
              <span className="text-cyan-400 font-mono">
                {(selectedMemory.opacity * 100).toFixed(1)}%
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Hit Count">
              <span className="text-white font-mono">{selectedMemory.val - 1}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Salience">
              <span className="text-purple-400 font-mono">
                {(selectedMemory.salience * 100).toFixed(1)}%
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Cues">
              <div className="flex flex-wrap gap-1">
                {selectedMemory.cues?.map((cue) => (
                  <Tag key={cue} color="purple">#{cue}</Tag>
                ))}
              </div>
            </Descriptions.Item>
          </Descriptions>

          {/* SNARC Radar Chart */}
          <div>
            <h3 className="text-sm text-gray-400 mb-3 font-mono">SNARC SALIENCE PROFILE</h3>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex justify-center">
              <RadarChart data={radarData} />
            </div>
          </div>

          {/* Status */}
          <div className="text-xs text-gray-600">
            Status: {selectedMemory.status} | Decay: {(selectedMemory.opacity * 100).toFixed(1)}%
          </div>
        </div>
      ) : (
        <Empty description="Select a memory node from the graph" />
      )}
    </Drawer>
  );
}
