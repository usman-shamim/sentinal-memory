import React, { useEffect, useState } from 'react';
import { Button, Timeline, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useBrainStore } from '../store/brainStore';

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode }> = {
  Completed: { color: 'green', icon: <CheckCircleOutlined /> },
  Running: { color: 'blue', icon: <SyncOutlined spin /> },
  'Not Started': { color: 'gray', icon: <ClockCircleOutlined /> },
  Failed: { color: 'red', icon: <CloseCircleOutlined /> },
  error: { color: 'red', icon: <CloseCircleOutlined /> },
};

export function DreamCycleConsole() {
  const dreamCycleStatus = useBrainStore((s) => s.dreamCycleStatus);
  const dreamCycleRuns = useBrainStore((s) => s.dreamCycleRuns);
  const fetchDreamCycleStatus = useBrainStore((s) => s.fetchDreamCycleStatus);

  useEffect(() => {
    fetchDreamCycleStatus();
    const interval = setInterval(fetchDreamCycleStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusInfo = STATUS_MAP[dreamCycleStatus] || STATUS_MAP['Not Started'];

  const timelineItems = dreamCycleRuns.length > 0
    ? dreamCycleRuns.map((run) => ({
        color: STATUS_MAP[run.status]?.color || 'gray',
        children: (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">{run.id?.slice(0, 12) || 'N/A'}</span>
            <Tag color={STATUS_MAP[run.status]?.color}>{run.status}</Tag>
            {run.start_time && (
              <span className="text-xs text-gray-500">
                {new Date(run.start_time).toLocaleString()}
              </span>
            )}
          </div>
        ),
      }))
    : [
        {
          color: 'gray',
          children: (
            <span className="text-sm text-gray-500">No workflow runs yet</span>
          ),
        },
      ];

  return (
    <div className="h-24 bg-black/50 border-t border-gray-800 flex items-center px-6 gap-6 z-20">
      {/* Status indicator */}
      <div className="flex items-center gap-3 min-w-[200px]">
        {statusInfo.icon}
        <div>
          <div className="text-xs text-gray-500 font-mono">DREAM CYCLE</div>
          <div className="text-sm text-white">{dreamCycleStatus}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <Timeline
          items={timelineItems.slice(0, 3)}
          className="!mb-0"
        />
      </div>

      {/* Refresh button */}
      <Button
        type="text"
        icon={<SyncOutlined />}
        onClick={fetchDreamCycleStatus}
        className="text-gray-500"
      />
    </div>
  );
}
