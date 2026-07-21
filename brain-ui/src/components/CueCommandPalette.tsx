import React, { useState } from 'react';
import { Modal, Input, Tag, List, Button } from 'antd';
import { SearchOutlined, TagOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';

interface CueCommandPaletteProps {
  open: boolean;
  onOpenChange: (val: boolean) => void;
}

const AVAILABLE_CUES = [
  { name: 'PSX', description: 'Pakistan Stock Exchange' },
  { name: 'SYSTEM.KA', description: 'System knowledge articles' },
  { name: 'docker', description: 'Docker & deployment' },
  { name: 'temporal', description: 'Temporal workflows' },
  { name: 'adhd-mem', description: 'ADHD Memory Layer' },
  { name: 'warren', description: 'Warren code sentinel' },
  { name: 'n8n', description: 'n8n workflows' },
  { name: 'redis', description: 'Redis caching' },
];

export function CueCommandPalette({ open, onOpenChange }: CueCommandPaletteProps) {
  const recall = useBrainStore((s) => s.recall);
  const [selectedCue, setSelectedCue] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!selectedCue) return;
    setLoading(true);
    await recall(selectedCue, query);
    setLoading(false);
    onOpenChange(false);
    setSelectedCue(null);
    setQuery('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedCue(null);
    setQuery('');
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={500}
      styles={{ content: { padding: 0, background: '#0a0a0a', border: '1px solid #1f1f1f' } }}
    >
      {/* Search Input */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <SearchOutlined className="text-gray-500" />
        <input
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
          placeholder={
            selectedCue
              ? `Search within #${selectedCue}...`
              : 'Select a cue first (required for recall)'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={!selectedCue}
        />
        {selectedCue && (
          <Tag color="purple" closable onClose={() => setSelectedCue(null)}>
            #{selectedCue}
          </Tag>
        )}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {!selectedCue ? (
          // Show available cues
          <div className="p-2">
            <div className="px-3 py-2 text-xs text-gray-500 font-mono">
              REQUIRED: SELECT A CUE
            </div>
            <List
              dataSource={AVAILABLE_CUES}
              renderItem={(cue) => (
                <List.Item
                  className="!px-3 !py-2 cursor-pointer hover:bg-gray-800/50 rounded-lg"
                  onClick={() => setSelectedCue(cue.name)}
                >
                  <div className="flex items-center gap-3">
                    <TagOutlined className="text-purple-400" />
                    <div>
                      <div className="text-sm text-white">#{cue.name}</div>
                      <div className="text-xs text-gray-500">{cue.description}</div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        ) : (
          // Show search actions
          <div className="p-2">
            <div className="px-3 py-2 text-xs text-gray-500 font-mono">
              ACTIONS
            </div>
            <List>
              <List.Item
                className="!px-3 !py-2 cursor-pointer hover:bg-gray-800/50 rounded-lg"
                onClick={handleSearch}
              >
                <div className="flex items-center gap-3">
                  <SearchOutlined className="text-cyan-400" />
                  <div>
                    <div className="text-sm text-white">
                      Search #{selectedCue} for "{query || '...'}"
                    </div>
                    <div className="text-xs text-gray-500">
                      Recall memories with this cue
                    </div>
                  </div>
                </div>
              </List.Item>
            </List>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
        {!selectedCue
          ? 'Cue dependency enforced: free-text search is blocked'
          : 'Press Enter to search, Esc to close'}
      </div>
    </Modal>
  );
}
