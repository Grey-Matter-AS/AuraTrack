import React, { useState } from 'react';
import { slotLabel, scheduledTimestampForDay } from '../utils/medicationSchedule';

export function MedicationDosePanel({ medicationGroups, allActiveMedications, onSaveDoses }) {
  const nowMs = Date.now();
  // toggledKeys: Set of "medicationId|hhMM" strings
  const [toggledKeys, setToggledKeys] = useState(new Set());
  const [saved, setSaved] = useState(false);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [adHocNote, setAdHocNote] = useState('');

  const timeSlots = Object.keys(medicationGroups);
  if (timeSlots.length === 0 && allActiveMedications.length === 0) return null;
  const allDoneToday = timeSlots.length === 0 && allActiveMedications.length > 0;

  const toggle = (medId, hhMM) => {
    const key = `${medId}|${hhMM}`;
    setToggledKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const doses = [...toggledKeys].map(k => {
      const [medicationId, scheduledHHMM] = k.split('|');
      return { medicationId: Number(medicationId), scheduledHHMM };
    });
    await onSaveDoses(doses);
    setToggledKeys(new Set());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdHocSave = async (med) => {
    await onSaveDoses([{ medicationId: med.id, scheduledHHMM: null, note: adHocNote }]);
    setShowAdHoc(false);
    setAdHocNote('');
  };

  const selectStyle = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="w-full mb-4">
      {/* Section header row */}
      <div className="flex justify-between items-center mb-3 px-1">
        <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          Medication Dosage Tracker
        </h3>
        {saved ? (
          <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">✓ Saved</span>
        ) : (
          <button
            onClick={handleSave}
            disabled={toggledKeys.size === 0}
            className="px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Save
          </button>
        )}
      </div>

      <div
        className="rounded-[1.5rem] p-4 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {timeSlots.length === 0 ? (
          <p className="text-xs italic text-center py-1" style={{ color: allDoneToday ? '#16a34a' : 'var(--text-faint)' }}>
            {allDoneToday ? '✓ All doses for today are up to date' : 'No scheduled doses today. Add medications in Settings → Medications.'}
          </p>
        ) : (
          timeSlots.map(hhMM => {
            const scheduledTs = scheduledTimestampForDay(hhMM, nowMs);
            const diffMin = (nowMs - scheduledTs) / 60000;
            const slotIsMissed = diffMin > 90;
            const slotIsLate = diffMin > 0 && !slotIsMissed;
            const slotColor = slotIsMissed ? '#dc2626' : slotIsLate ? '#d97706' : 'var(--text-faint)';
            const slotTag = slotIsMissed ? ' · MISSED' : slotIsLate ? ' · LATE' : '';
            return (
              <div key={hhMM}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: slotColor }}>
                  {slotLabel(hhMM)} · {hhMM}{slotTag}
                </p>
                <div className="flex flex-wrap gap-2">
                  {medicationGroups[hhMM].map(med => {
                    const key = `${med.id}|${hhMM}`;
                    const active = toggledKeys.has(key);
                    const btnStyle = active
                      ? { backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid transparent' }
                      : slotIsMissed
                      ? { backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid #dc2626' }
                      : slotIsLate
                      ? { backgroundColor: 'rgba(217,119,6,0.12)', color: '#d97706', border: '1px solid #d97706' }
                      : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' };
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(med.id, hhMM)}
                        className="px-4 py-2 rounded-full font-black text-xs transition-all active:scale-95"
                        style={btnStyle}
                      >
                        {med.name} {med.dose}{med.unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <button
          onClick={() => setShowAdHoc(true)}
          className="text-[10px] font-black uppercase tracking-widest pt-1 active:opacity-60 transition-opacity"
          style={{ color: 'var(--text-faint)' }}
        >
          + Extra / On-Demand Dose
        </button>
      </div>

      {/* Ad-hoc dose bottom sheet */}
      {showAdHoc && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdHoc(false); }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
              Log Extra / On-Demand Dose
            </p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Doctor-advised extra dose, rescue medication, or any unscheduled dose.
            </p>
            <input
              type="text"
              value={adHocNote}
              onChange={e => setAdHocNote(e.target.value)}
              placeholder="Reason (optional, e.g. doctor advised)"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={selectStyle}
            />
            <div className="space-y-2">
              {allActiveMedications.map(med => (
                <button
                  key={med.id}
                  onClick={() => handleAdHocSave(med)}
                  className="w-full py-3 px-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                >
                  <span className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{med.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                    {med.dose}{med.unit} · {med.frequency}
                    {med.isRescue && <span className="ml-1 text-amber-500">· Rescue</span>}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdHoc(false)}
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
