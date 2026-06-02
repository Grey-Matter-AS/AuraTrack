import { useState, useEffect, useMemo } from 'react';
import { useMedications } from '../hooks/useMedications';
import { getScheduledDosesForDay, getDoseStatus } from '../utils/medicationSchedule';

function parseHHMM(hhMM) {
  const [h, m] = hhMM.split(':').map(Number);
  return (h * 60 + m) * 60000;
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDay(ms, todayMs) {
  const d = new Date(ms);
  const today = startOfDay(todayMs);
  const yesterday = today - 86400000;
  if (ms === today) return 'Today';
  if (ms === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const STATUS = {
  taken:    { label: 'TAKEN',    bg: '#16a34a', text: '#fff' },
  late:     { label: 'LATE',     bg: '#d97706', text: '#fff' },
  missed:   { label: 'MISSED',   bg: '#dc2626', text: '#fff' },
  upcoming: { label: 'UPCOMING', bg: 'var(--bg-raised)', text: 'var(--text-dim)', border: '1px solid var(--border)' },
  nodata:   { label: 'NO DATA',  bg: 'transparent',      text: 'var(--text-faint)', border: '1px solid var(--border)' },
};

export function MedicationHistoryTab({ settings = {} }) {
  const { medications, getLogsForPeriod, updateLog, logDoseWithStatus } = useMedications();
  const [allLogs, setAllLogs] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());

  const loadLogs = async () => {
    setLoading(true);
    const logs = await getLogsForPeriod(0, nowMs + 86400000);
    setAllLogs(logs);
    setLoading(false);
  };

  useEffect(() => {
    const id = setTimeout(loadLogs, 0);
    return () => clearTimeout(id);
  }, [medications]);

  const activeMeds = medications.filter(m => m.active && !m.isRescue);

  // Determine start date: earliest of (setting, earliest log, 30 days ago as fallback)
  const startDateMs = useMemo(() => {
    const today = startOfDay(nowMs);
    const maxBack = today - 365 * 86400000;

    const candidates = [];
    if (settings.medicationStartDate) {
      const d = startOfDay(new Date(settings.medicationStartDate).getTime());
      if (!isNaN(d)) candidates.push(d);
    }
    if (allLogs.length > 0) {
      candidates.push(startOfDay(Math.min(...allLogs.map(l => l.takenAt))));
    }

    return candidates.length > 0
      ? Math.max(Math.min(...candidates), maxBack)
      : today; // no history at all — just show today
  }, [allLogs, nowMs, settings.medicationStartDate]);

  // Build list of days from start to today, newest first
  const days = useMemo(() => {
    const today = startOfDay(nowMs);
    const result = [];
    for (let d = today; d >= startDateMs; d -= 86400000) result.push(d);
    return result;
  }, [nowMs, startDateMs]);

  // Fast log lookup: "dayStart|medId|hhMM" → log record
  const logIndex = useMemo(() => {
    const idx = {};
    for (const log of allLogs) {
      const key = `${startOfDay(log.takenAt)}|${log.medicationId}|${log.scheduledTime ?? ''}`;
      // Keep only one record per slot (prefer non-missed if duplicates exist)
      if (!idx[key] || idx[key].status === 'missed') idx[key] = log;
    }
    // Also index ad-hoc logs (scheduledTime = null) by takenAt day
    return idx;
  }, [allLogs]);

  const getLog = (dayMs, medId, hhMM) => logIndex[`${dayMs}|${medId}|${hhMM}`] ?? null;

  const getCellStatus = (dayMs, medId, hhMM) => {
    const log = getLog(dayMs, medId, hhMM);
    if (log) return log.status ?? getDoseStatus(hhMM, log.takenAt, dayMs);
    const scheduledTs = dayMs + parseHHMM(hhMM);
    const isToday = dayMs === startOfDay(nowMs);
    if (isToday && scheduledTs > nowMs) return 'upcoming';
    return 'nodata';
  };

  const openEdit = (dayMs, med, hhMM) => {
    const log = getLog(dayMs, med.id, hhMM);
    setEditCell({ dayMs, med, hhMM, log });
    if (log && log.status !== 'missed') {
      const d = new Date(log.takenAt);
      setEditTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setEditTime(hhMM);
    }
  };

  const handleMarkTaken = async () => {
    if (!editCell) return;
    const { dayMs, med, hhMM, log } = editCell;
    const targetTs = dayMs + parseHHMM(editTime || hhMM);
    const status = getDoseStatus(hhMM, targetTs, dayMs);
    if (log) {
      await updateLog(log.id, { takenAt: targetTs, status });
    } else {
      await logDoseWithStatus(med.id, hhMM, targetTs, status);
    }
    setEditCell(null);
    await loadLogs();
  };

  const handleMarkMissed = async () => {
    if (!editCell) return;
    const { dayMs, med, hhMM, log } = editCell;
    if (log) {
      await updateLog(log.id, { status: 'missed' });
    } else {
      await logDoseWithStatus(med.id, hhMM, dayMs + parseHHMM(hhMM), 'missed');
    }
    setEditCell(null);
    await loadLogs();
  };

  if (activeMeds.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>
          No scheduled medications. Add medications in Settings → Medications.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="pb-10 space-y-3">
      {/* Legend */}
      <div className="flex gap-3 flex-wrap px-1 pt-1">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.bg === 'transparent' ? 'var(--bg-raised)' : s.bg, border: '1px solid var(--border)' }} />
            <span className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>{s.label}</span>
          </div>
        ))}
        <span className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>✎ = edited</span>
      </div>

      {/* Day sections */}
      {days.map(dayMs => {
        // Build sorted dose rows for this day: sorted by scheduled time, then med name
        const doses = getScheduledDosesForDay(activeMeds, dayMs);

        // Also include ad-hoc logs for this day (scheduledTime = null)
        const adHocLogs = allLogs.filter(l =>
          startOfDay(l.takenAt) === dayMs &&
          (l.scheduledTime === null || l.scheduledTime === undefined)
        );

        if (doses.length === 0 && adHocLogs.length === 0) return null;

        return (
          <div
            key={dayMs}
            className="rounded-[1.5rem] overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Day header */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: dayMs === startOfDay(nowMs) ? 'var(--accent)' : 'var(--text-dim)' }}>
                {fmtDay(dayMs, nowMs)}
              </p>
            </div>

            {/* Dose rows — sorted by scheduled time */}
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
              {doses.map(({ medicationId, medicationName, dose, unit, scheduledHHMM }) => {
                const med = activeMeds.find(m => m.id === medicationId);
                if (!med) return null;
                const cellStatus = getCellStatus(dayMs, medicationId, scheduledHHMM);
                const s = STATUS[cellStatus] ?? STATUS.nodata;
                const log = getLog(dayMs, medicationId, scheduledHHMM);
                return (
                  <button
                    key={`${medicationId}-${scheduledHHMM}`}
                    onClick={() => openEdit(dayMs, med, scheduledHHMM)}
                    className="w-full flex items-center justify-between px-4 py-3 transition-all active:opacity-70 text-left"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {medicationName}
                        {log?.isEdited && <span className="ml-1.5 text-[9px] text-amber-400">✎</span>}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        {dose}{unit} · Due {scheduledHHMM}
                        {log && cellStatus !== 'missed' && log.status !== 'missed' && (
                          <span className="ml-1">· Taken {fmtTime(log.takenAt)}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className="ml-3 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest shrink-0"
                      style={{ backgroundColor: s.bg, color: s.text, border: s.border }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}

              {/* Ad-hoc doses */}
              {adHocLogs.map(log => {
                const med = medications.find(m => m.id === log.medicationId);
                if (!med) return null;
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {med.name}
                        {log.isEdited && <span className="ml-1.5 text-[9px] text-amber-400">✎</span>}
                      </p>
	                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
	                        {med.dose}{med.unit} · Extra dose · {fmtTime(log.takenAt)}
	                      </p>
	                      {log.note && (
	                        <p className="text-[10px] mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
	                          {log.note}
	                        </p>
	                      )}
	                    </div>
                    <span
                      className="ml-3 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest shrink-0"
                      style={{ backgroundColor: STATUS.taken.bg, color: STATUS.taken.text }}
                    >
                      TAKEN
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {days.length === 0 && (
        <div className="py-8 text-center">
          <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>No history yet.</p>
        </div>
      )}

      {/* Edit modal */}
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
              Edit Dose — {editCell.med.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {fmtDay(editCell.dayMs)} · Scheduled {editCell.hhMM}
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
