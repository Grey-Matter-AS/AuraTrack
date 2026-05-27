import React, { useState } from 'react';
import { ScrollFade } from './ScrollFade';

// ─── Min/sec duration input pair ─────────────────────────────
function DurField({ label, value, onChange }) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  const setMin = (raw) => {
    const m = Math.max(0, parseInt(raw, 10) || 0);
    onChange(m * 60 + seconds);
  };
  const setSec = (raw) => {
    const s = Math.max(0, Math.min(59, parseInt(raw, 10) || 0));
    onChange(minutes * 60 + s);
  };

  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="999"
          value={minutes}
          onChange={e => setMin(e.target.value)}
          className="w-16 text-center rounded-xl px-2 py-2 font-mono font-black text-lg outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>min</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={seconds}
          onChange={e => setSec(e.target.value)}
          className="w-16 text-center rounded-xl px-2 py-2 font-mono font-black text-lg outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>sec</span>
      </div>
    </div>
  );
}

// ─── Bottom-sheet modal ───────────────────────────────────────
export function ManualEntrySheet({ onConfirm, onClose }) {
  const today    = new Date().toISOString().slice(0, 10);
  const nowTime  = new Date().toTimeString().slice(0, 5);

  const [date,        setDate]        = useState(today);
  const [time,        setTime]        = useState(nowTime);
  const [totalSec,    setTotalSec]    = useState(0);
  const [showPhases,  setShowPhases]  = useState(false);
  const [auraSec,     setAuraSec]     = useState(0);
  const [seizureSec,  setSeizureSec]  = useState(0);
  const [recoverySec, setRecoverySec] = useState(0);
  const [error,       setError]       = useState('');

  const inputStyle = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const handleContinue = () => {
    if (totalSec <= 0) {
      setError('Total duration must be greater than 0.');
      return;
    }
    setError('');

    const manualDurations = { total: totalSec };
    if (showPhases) {
      if (auraSec     > 0) manualDurations.aura     = auraSec;
      if (seizureSec  > 0) manualDurations.seizure  = seizureSec;
      if (recoverySec > 0) manualDurations.recovery = recoverySec;
    }

    onConfirm({ date, time, durationSec: totalSec, manualDurations });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] flex flex-col overflow-hidden max-h-[90dvh]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
            Log Past Seizure
          </p>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center font-black text-sm active:opacity-60"
            style={{ color: 'var(--text-faint)' }}
          >
            ✕
          </button>
        </div>

        <ScrollFade className="px-6 pt-4 pb-2 space-y-5" bgVar="--bg-card">

          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Enter the date, time, and duration of the seizure. You can then add the seizure type, symptoms, triggers, and notes.
          </p>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                Date
              </p>
              <input
                type="date"
                max={today}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                Time
              </p>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Total duration */}
          <DurField label="Total Duration" value={totalSec} onChange={setTotalSec} />

          {/* Phase breakdown toggle */}
          <button
            onClick={() => setShowPhases(p => !p)}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest active:opacity-60 transition-opacity"
            style={{ color: 'var(--text-faint)' }}
          >
            <span>{showPhases ? '▾' : '▸'}</span>
            <span>Phase Breakdown (optional)</span>
          </button>

          {showPhases && (
            <div className="space-y-4 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
              <DurField label="Aura" value={auraSec} onChange={setAuraSec} />
              <DurField label="Seizure (Ictal)" value={seizureSec} onChange={setSeizureSec} />
              <DurField label="Post-Ictal / Recovery" value={recoverySec} onChange={setRecoverySec} />
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-red-500">{error}</p>
          )}

        </ScrollFade>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 space-y-3 shrink-0">
          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Continue to Details →
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
