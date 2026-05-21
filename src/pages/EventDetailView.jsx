import React, { useState, useEffect } from 'react';
import { db } from '../data/db';
import { computeDangerFlags } from '../utils/dangerFlags';

const CLUSTER_WINDOW_MS = 8 * 60 * 1000;

function DangerAlert({ flags }) {
  if (!flags?.length) return null;
  return (
    <div className="space-y-2 mb-2">
      {flags.includes('long_duration') && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}
        >
          <span className="text-amber-500 text-xl shrink-0">⚠</span>
          <div>
            <p className="text-amber-500 font-black text-xs uppercase tracking-widest">Prolonged Seizure</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              This event lasted more than 5 minutes. Seek medical review if not already done.
            </p>
          </div>
        </div>
      )}
      {flags.includes('cluster') && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)' }}
        >
          <span className="text-red-500 text-xl shrink-0">⚠</span>
          <div>
            <p className="text-red-500 font-black text-xs uppercase tracking-widest">Cluster / Status Epilepticus Risk</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              3 or more seizures occurred within 8 minutes without confirmed recovery between them. Consult a neurologist immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventDetailView({ eventId, onEdit, onClose }) {
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [dangerFlags, setDangerFlags] = useState([]);

  useEffect(() => {
    if (!eventId) return;
    setNotFound(false);
    setEvent(null);
    db.events.get(eventId).then(async ev => {
      if (!ev) { setNotFound(true); return; }
      setEvent(ev);
      // Load events within ±8 min window to assess cluster risk
      const nearby = await db.events
        .where('startTime')
        .between(ev.startTime - CLUSTER_WINDOW_MS, ev.startTime + CLUSTER_WINDOW_MS, true, true)
        .toArray();
      setDangerFlags(computeDangerFlags(ev, nearby));
    }).catch(err => {
      console.error('Failed to load event:', err);
      setNotFound(true);
    });
  }, [eventId]);

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-bold" style={{ color: 'var(--text-dim)' }}>Event not found.</p>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← Back
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="italic text-sm" style={{ color: 'var(--text-dim)' }}>Loading...</p>
      </div>
    );
  }

  const m = event.manualDurations || {};
  const auraDur     = m.aura     ?? (event.laps?.aura ? Math.floor((event.laps.aura - event.startTime) / 1000) : 0);
  const seizureDur  = m.seizure  ?? (event.laps?.aura && event.laps?.seizure  ? Math.floor((event.laps.seizure  - event.laps.aura)    / 1000) : 0);
  const recoveryDur = m.recovery ?? (event.laps?.seizure && event.laps?.recovery ? Math.floor((event.laps.recovery - event.laps.seizure) / 1000) : 0);

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Event Detail</h2>
        <button
          onClick={() => onEdit(event)}
          className="ml-auto min-h-[40px] px-4 text-[10px] font-bold text-blue-400 border border-blue-900/50 rounded-xl tracking-wider uppercase active:bg-blue-600 active:text-white transition-all"
        >
          Edit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">

        {/* Danger alerts — shown above the duration card */}
        <DangerAlert flags={dangerFlags} />

        {/* Duration Summary */}
        <div
          className="p-6 rounded-[2.5rem] shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: dangerFlags.length ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>TOTAL DURATION</p>
              <p className="text-4xl font-mono font-black leading-none"
                style={{ color: dangerFlags.includes('long_duration') ? '#f59e0b' : 'var(--text-primary)' }}>
                {event.duration}<span className="text-lg ml-1 font-sans" style={{ color: 'var(--text-dim)' }}>S</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>TYPE</p>
              <p className="text-xs font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{event.type || 'Unknown'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="text-center">
              <p className="text-[9px] text-amber-500 font-black uppercase mb-1">AURA</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{auraDur}s</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-red-500 font-black uppercase mb-1">SEIZURE</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{seizureDur}s</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-blue-400 font-black uppercase mb-1">RECOVERY</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{recoveryDur}s</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Details</p>
          <div className="space-y-2 text-sm">
            {[['Date', event.date], ['Time', event.time]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
            {event.isEdited && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-dim)' }}>Status</span>
                <span className="font-medium text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>Edited</span>
              </div>
            )}
          </div>
        </div>

        {/* Symptoms */}
        {event.symptoms?.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Symptoms</p>
            <div className="space-y-3">
              {event.symptoms.map((s, i) => (
                <div key={i} className="pb-3 last:pb-0" style={{ borderBottom: i < event.symptoms.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none mb-1">{s.symptom}</p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{s.region} › {s.specificPart}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggers */}
        {event.triggers?.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Possible Triggers</p>
            <div className="flex flex-wrap gap-2">
              {event.triggers.map(t => (
                <span
                  key={t}
                  className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1.5px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Clinical Observations</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{event.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}
