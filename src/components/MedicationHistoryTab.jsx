import React, { useState, useEffect } from 'react';
import { useMedications } from '../hooks/useMedications';
import { getScheduledDosesForDay, getDoseStatus, defaultScheduledTimes } from '../utils/medicationSchedule';

function dayMs(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() + offset * 86400000;
}

function shortDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE = {
  taken:  { bg: '#16a34a', text: '#fff' },
  late:   { bg: '#d97706', text: '#fff' },
  missed: { bg: '#dc2626', text: '#fff' },
  none:   { bg: 'var(--bg-raised)', text: 'var(--text-faint)' },
};

export function MedicationHistoryTab() {
  const { medications, getLogsForDay, updateLog, logDoseWithStatus } = useMedications();
  const [dayLogs, setDayLogs] = useState({});
  const [editCell, setEditCell] = useState(null); // { medId, hhMM, dayOffset, log }
  const [editTime, setEditTime] = useState('');

  const days = [-4, -3, -2, -1, 0]; // last 5 days, today = offset 0

  useEffect(() => {
    loadAll();
  }, [medications]);

  const loadAll = async () => {
    const result = {};
    for (const offset of days) {
      const ms = dayMs(offset);
      result[offset] = await getLogsForDay(ms);
    }
    setDayLogs(result);
  };

  const activeMeds = medications.filter(m => m.active && !m.isRescue);

  const getCell = (med, hhMM, offset) => {
    const logs = dayLogs[offset] ?? [];
    return logs.find(l => l.medicationId === med.id && l.scheduledTime === hhMM) ?? null;
  };

  const getCellStatus = (med, hhMM, offset) => {
    const log = getCell(med, hhMM, offset);
    const dMs = dayMs(offset);
    const scheduledTs = dMs + parseHHMM(hhMM);
    const isToday = offset === 0;
    if (!log) {
      if (isToday && scheduledTs > Date.now()) return 'upcoming';
      return 'missed';
    }
    return log.status ?? getDoseStatus(hhMM, log.takenAt, dMs);
  };

  function parseHHMM(hhMM) {
    const [h, m] = hhMM.split(':').map(Number);
    return (h * 60 + m) * 60000;
  }

  const openEdit = (med, hhMM, offset) => {
    const log = getCell(med, hhMM, offset);
    setEditCell({ med, hhMM, offset, log });
    if (log) {
      const d = new Date(log.takenAt);
      setEditTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setEditTime(hhMM);
    }
  };

  const handleMarkTaken = async () => {
    if (!editCell) return;
    const { med, hhMM, offset, log } = editCell;
    const dMs = dayMs(offset);
    const targetTs = dMs + parseHHMM(editTime || hhMM);
    const status = getDoseStatus(hhMM, targetTs, dMs);
    if (log) {
      await updateLog(log.id, { takenAt: targetTs, status });
    } else {
      await logDoseWithStatus(med.id, hhMM, targetTs, status);
    }
    setEditCell(null);
    await loadAll();
  };

  const handleMarkMissed = async () => {
    if (!editCell) return;
    const { med, hhMM, offset, log } = editCell;
    const dMs = dayMs(offset);
    if (log) {
      await updateLog(log.id, { status: 'missed' });
    } else {
      await logDoseWithStatus(med.id, hhMM, dMs + parseHHMM(hhMM), 'missed');
    }
    setEditCell(null);
    await loadAll();
  };

  if (activeMeds.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>
          No scheduled medications. Add medications in Settings.
        </p>
      </div>
    );
  }

  // Collect all unique scheduled time slots across all meds
  const allSlots = [];
  for (const med of activeMeds) {
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const t of times) {
      if (!allSlots.find(s => s.medId === med.id && s.hhMM === t)) {
        allSlots.push({ medId: med.id, hhMM: t });
      }
    }
  }

  return (
    <div className="pb-10">
      <p className="text-[10px] font-black uppercase tracking-widest mb-4 px-1" style={{ color: 'var(--text-dim)' }}>
        Last 5 Days
      </p>

      {/* Scrollable grid */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th className="text-left pr-3 pb-2 sticky left-0 z-10 whitespace-nowrap"
                style={{ backgroundColor: 'var(--bg-base)', minWidth: 120 }}>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Medication · Time</span>
              </th>
              {days.map(offset => (
                <th key={offset} className="pb-2 px-1 text-center whitespace-nowrap" style={{ minWidth: 60 }}>
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: offset === 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
                    {offset === 0 ? 'Today' : new Date(dayMs(offset)).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeMeds.map(med => {
              const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
              return times.map((hhMM, ti) => (
                <tr key={`${med.id}-${hhMM}`}>
                  <td className="pr-3 py-1.5 sticky left-0 z-10"
                    style={{ backgroundColor: 'var(--bg-base)', minWidth: 120 }}>
                    <p className="text-xs font-black leading-tight" style={{ color: 'var(--text-primary)' }}>{med.name}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{med.dose}{med.unit} · {hhMM}</p>
                  </td>
                  {days.map(offset => {
                    const cellStatus = getCellStatus(med, hhMM, offset);
                    const log = getCell(med, hhMM, offset);
                    const style = cellStatus === 'upcoming'
                      ? { bg: 'var(--bg-raised)', text: 'var(--text-faint)' }
                      : STATUS_STYLE[cellStatus] ?? STATUS_STYLE.none;
                    return (
                      <td key={offset} className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => openEdit(med, hhMM, offset)}
                          className="w-12 h-8 rounded-xl text-[9px] font-black uppercase transition-all active:scale-90"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {cellStatus === 'upcoming' ? '—' :
                           cellStatus === 'taken' ? '✓' :
                           cellStatus === 'late'  ? 'LATE' :
                           cellStatus === 'missed'? '✗' : '—'}
                          {log?.isEdited ? '*' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-4 flex-wrap px-1">
        {[['#16a34a', 'Taken'], ['#d97706', 'Late (>90 min)'], ['#dc2626', 'Missed'], ['var(--bg-raised)', 'Upcoming / Not due']].map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: bg, border: '1px solid var(--border)' }} />
            <span className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>{label}</span>
          </div>
        ))}
        <span className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>* = edited</span>
      </div>

      {/* Edit cell modal */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditCell(null); }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
              Edit Dose — {editCell.med.name} {editCell.hhMM}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {editCell.offset === 0 ? 'Today' : new Date(dayMs(editCell.offset)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              {editCell.log?.isEdited && <span className="ml-2 text-amber-400">Previously edited</span>}
            </p>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                Actual time taken
              </p>
              <input
                type="time"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleMarkTaken}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
                style={{ backgroundColor: '#16a34a', color: '#fff' }}
              >
                Mark Taken
              </button>
              <button
                onClick={handleMarkMissed}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
              >
                Mark Missed
              </button>
            </div>
            <button
              onClick={() => setEditCell(null)}
              className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
