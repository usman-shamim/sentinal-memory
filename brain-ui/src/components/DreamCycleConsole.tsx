import React, { useState } from 'react';
import { Slider, Button, Tooltip } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';

const DREAM_STEPS = [
  { time: '00:00', label: 'Idle', description: 'System waiting for consolidation' },
  { time: '03:00', label: 'Decay Sweep', description: 'Applying Ebbinghaus decay to stale memories' },
  { time: '03:15', label: 'Archive to OKF', description: 'Moving decayed memories to OKF bundles' },
  { time: '03:45', label: 'Promote to Graph', description: 'High-hit memories become semantic nodes' },
  { time: '04:00', label: 'Complete', description: 'Consolidation finished, memory optimized' },
];

export function DreamCycleConsole() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const currentStep = DREAM_STEPS[step];

  return (
    <div className="h-16 bg-black/50 border-t border-gray-800 flex items-center px-6 gap-6 z-20">
      {/* Play/Pause */}
      <Button
        type="text"
        icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        onClick={() => setPlaying(!playing)}
        className="text-purple-400 !text-xl"
      />

      {/* Timeline Slider */}
      <div className="flex-1 flex items-center gap-4">
        <span className="text-xs text-gray-500 font-mono w-12">{currentStep.time}</span>
        <Slider
          className="flex-1 !w-full"
          min={0}
          max={DREAM_STEPS.length - 1}
          value={step}
          onChange={setStep}
          tooltip={{ formatter: () => currentStep.label }}
          styles={{
            track: { background: '#9d4edd' },
            handle: { borderColor: '#9d4edd' },
          }}
        />
      </div>

      {/* Step Label */}
      <div className="w-48 text-right">
        <div className="text-xs text-purple-400 font-mono">{currentStep.label}</div>
        <div className="text-[10px] text-gray-600">{currentStep.description}</div>
      </div>
    </div>
  );
}
