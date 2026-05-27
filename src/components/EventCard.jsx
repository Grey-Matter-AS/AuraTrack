import React from 'react';
import { formatDuration } from '../utils/formatters';

function DangerBadge({ flags }) {
  if (!flags?.length) return null;
  const isCluster = flags.includes('cluster');
  const isLong    = flags.includes('long_duration');

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {isLong && (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}
          title="Seizure lasted more than 5 minutes"
        >
          ⚠ &gt;5 MIN
        </span>
      )}
      {isCluster && (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
          title="Cluster seizures / Status Epilepticus risk — 3+ events within 8 minutes without confirmed recovery"
        >
          ⚠ CLUSTER / SE RISK
        </span>
      )}
    </div>
  );
}

export function EventCard({ event, onEdit, onDelete, onViewDetail, dangerFlags, durationFormat = 'seconds' }) {
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
  const handleView = () => onViewDetail ? onViewDetail(event.id) : onEdit(event);

  return (
    <div
      className="p-4 rounded-2xl shadow-lg"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: dangerFlags?.length
          ? '1px solid rgba(239,68,68,0.4)'
          : '1px solid var(--border-subtle)',
      }}
    >
      {/* Top row */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{event.type || 'Unknown'}</p>
            {event.isEdited && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}
              >Edited</span>
            )}
            {event.isManualEntry && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >Manual Entry</span>
            )}
          </div>
          <p className="text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>
            {event.date} • {event.time}
          </p>
          <DangerBadge flags={dangerFlags} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}
          >
            <span
              className="font-mono font-black text-lg"
              style={{ color: dangerFlags?.includes('long_duration') ? '#f59e0b' : '#ef4444' }}
            >
              {fmtDur(event.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleView}
          className="flex-1 min-h-[40px] text-[10px] font-bold text-blue-400 uppercase px-2 py-2 border border-blue-900/50 rounded-xl tracking-wider active:bg-blue-600 active:text-white transition-all"
        >
          View / Edit
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="min-h-[40px] text-[10px] font-bold text-red-500 uppercase px-3 py-2 border border-red-900/50 rounded-xl tracking-wider active:bg-red-600 active:text-white transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
