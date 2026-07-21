import React from 'react';
import { Drawer, Descriptions, Button, Empty, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';

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

  const radarData = selectedMemory?.snarc
    ? [
        { dimension: 'Surprise', value: selectedMemory.snarc.surprise || 0 },
        { dimension: 'Novelty', value: selectedMemory.snarc.novelty || 0 },
        { dimension: 'Arousal', value: selectedMemory.snarc.arousal || 0 },
        { dimension: 'Reward', value: selectedMemory.snarc.reward || 0 },
        { dimension: 'Conflict', value: selectedMemory.snarc.conflict || 0 },
      ]
    : [];

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

          {/* SNARC Radar Chart (CSS-based) */}
          <div>
            <h3 className="text-sm text-gray-400 mb-3 font-mono">SNARC SALIENCE PROFILE</h3>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              {/* Simple bar visualization instead of Ant Design radar */}
              <div className="space-y-3">
                {radarData.map((item) => (
                  <div key={item.dimension} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">{item.dimension}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.value * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono w-10 text-right">
                      {(item.value * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
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
