import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBrainStore } from '../store/brainStore';

export function WorkingMemoryTray() {
  const workingMemory = useBrainStore((s) => s.workingMemory);
  const focusTopic = useBrainStore((s) => s.focusTopic);

  return (
    <div className="h-24 bg-black/50 border-b border-gray-800 flex items-center px-4 gap-4 z-20">
      <span className="text-xs text-gray-500 w-20 font-mono">WORKING MEM</span>

      <div className="flex gap-4 flex-1">
        {Array.from({ length: 7 }).map((_, i) => {
          const mem = workingMemory[i];
          const isFocused = mem && focusTopic && mem.cues?.includes(focusTopic);

          return (
            <div key={i} className="w-40 h-16">
              <AnimatePresence mode="wait">
                {mem ? (
                  <motion.div
                    key={mem.id}
                    initial={{ scale: 0.8, opacity: 0, y: -10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.5, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="h-full"
                  >
                    <div
                      className={`
                        h-full rounded-lg border p-2 flex flex-col justify-between cursor-pointer
                        transition-all duration-300
                        ${isFocused
                          ? 'bg-purple-900/30 border-purple-500 shadow-lg shadow-purple-500/20'
                          : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                        }
                      `}
                      onClick={() => useBrainStore.getState().setSelectedMemory(mem)}
                    >
                      <p className="text-xs truncate text-gray-300">{mem.content}</p>
                      <div className="flex items-center gap-2">
                        {/* TTL Progress Ring */}
                        <svg className="w-4 h-4" viewBox="0 0 36 36">
                          <circle
                            cx="18" cy="18" r="16"
                            fill="none"
                            stroke="#1f1f1f"
                            strokeWidth="2"
                          />
                          <circle
                            cx="18" cy="18" r="16"
                            fill="none"
                            stroke={isFocused ? '#9d4edd' : '#00d9ff'}
                            strokeWidth="2"
                            strokeDasharray="100"
                            strokeDashoffset={30}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                          />
                        </svg>
                        <span className="text-[10px] text-gray-500">
                          {mem.cues?.[0] || '—'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full border border-dashed border-gray-800 rounded-lg flex items-center justify-center"
                  >
                    <span className="text-[10px] text-gray-700">EMPTY</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Focus indicator */}
      {focusTopic && (
        <div className="flex items-center gap-2 px-3 py-1 bg-purple-900/30 border border-purple-500/50 rounded-full">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          <span className="text-xs text-purple-300 font-mono">{focusTopic}</span>
        </div>
      )}
    </div>
  );
}
