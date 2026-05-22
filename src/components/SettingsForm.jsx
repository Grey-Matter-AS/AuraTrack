import React, { useState, useEffect, useRef } from 'react';
import { db } from '../data/db';
import { exportToJSON } from '../utils/exportHelpers';
import { useMedications } from '../hooks/useMedications';
import { defaultScheduledTimes } from '../utils/medicationSchedule';

// ─── Atom components ─────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)]">{title}</p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Row({ label, help, children }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
          {help && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</p>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-dim)] mb-1.5">{children}</p>;
}

function TextField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
        style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}

function Segments({ options, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => {
        const v = typeof opt === 'object' ? opt.value : opt;
        const l = typeof opt === 'object' ? opt.label : String(opt);
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="flex-1 min-w-[56px] py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'var(--bg-raised)',
              color: 'var(--text-on-raised)',
              border: active ? '2px solid transparent' : '2px solid var(--border)',
              opacity: active ? 1 : 0.7,
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="relative w-14 h-8 rounded-full transition-all shrink-0"
      style={{ backgroundColor: value ? 'var(--accent)' : 'var(--bg-raised)' }}
    >
      <span
        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all"
        style={{ left: value ? '1.75rem' : '0.25rem' }}
      />
    </button>
  );
}

function ActionBtn({ label, sub, onClick, icon, variant = 'default' }) {
  const bg = variant === 'danger' ? 'rgba(185,28,28,0.1)' : 'var(--bg-raised)';
  const color = variant === 'danger' ? '#ef4444' : 'var(--text-on-raised)';
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
      style={{ backgroundColor: bg, color, border: variant === 'danger' ? '1px solid rgba(185,28,28,0.3)' : '1px solid var(--border)' }}
    >
      {icon && <span className="text-2xl">{icon}</span>}
      <span className="text-center leading-snug whitespace-normal">{label}</span>
      {sub && <span className="text-[9px] opacity-60 font-medium normal-case tracking-normal">{sub}</span>}
    </button>
  );
}

const FREQ_OPTIONS = [
  { value: 'OD',  label: 'OD — Once daily' },
  { value: 'BD',  label: 'BD — Twice daily' },
  { value: 'TDS', label: 'TDS — Three times daily' },
  { value: 'QDS', label: 'QDS — Four times daily' },
  { value: 'PRN', label: 'PRN — As needed (rescue)' },
];
const UNIT_OPTIONS = ['mg', 'g', 'mcg', 'ml', 'IU'];
const FREQ_SHORT = { OD: 'Once daily', BD: 'Twice daily', TDS: 'Three times daily', QDS: 'Four times daily', PRN: 'As needed' };

const SLOT_LABELS = ['Morning', 'Mid-morning', 'Afternoon', 'Evening', 'Night', 'Bedtime', 'Dose 1', 'Dose 2', 'Dose 3', 'Dose 4'];

function getSlotLabel(index, frequency) {
  if (frequency === 'BD') return index === 0 ? 'Morning Dose' : 'Evening Dose';
  if (frequency === 'TDS') return ['Morning Dose', 'Afternoon Dose', 'Evening Dose'][index] || `Dose ${index + 1}`;
  if (frequency === 'QDS') return ['Morning Dose', 'Midday Dose', 'Afternoon Dose', 'Evening Dose'][index] || `Dose ${index + 1}`;
  return 'Dose Time';
}

const EMPTY_MED = { name: '', dose: '', unit: 'mg', frequency: 'BD', isRescue: false, scheduledTimes: ['08:00', '20:00'], reminderEnabled: false, showInEmergency: false };

function MedForm({ form, setForm, onSave, onCancel, saveLabel = 'Save' }) {
  const selectStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  const isPRN = form.frequency === 'PRN';

  const handleFreqChange = (freq) => {
    setForm(f => ({ ...f, frequency: freq, isRescue: freq === 'PRN', scheduledTimes: defaultScheduledTimes(freq) }));
  };

  const updateTime = (i, val) => {
    setForm(f => {
      const times = [...(f.scheduledTimes || [])];
      times[i] = val;
      return { ...f, scheduledTimes: times };
    });
  };

  const times = form.scheduledTimes || defaultScheduledTimes(form.frequency);

  return (
    <div className="space-y-3 p-4 rounded-2xl" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <FieldLabel>{saveLabel === 'Save' ? 'Add Medication' : 'Edit Medication'}</FieldLabel>
      <input
        type="text"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Drug name (e.g. Levetiracetam)"
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={selectStyle}
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={form.dose}
          onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
          placeholder="Dose"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={selectStyle}
          min="0"
        />
        <select
          value={form.unit}
          onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
          className="rounded-xl px-3 py-3 text-sm outline-none"
          style={selectStyle}
        >
          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <select
        value={form.frequency}
        onChange={e => handleFreqChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={selectStyle}
      >
        {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Scheduled times — one per dose slot */}
      {!isPRN && times.length > 0 && (
        <div className="space-y-2">
          <FieldLabel>Scheduled Times</FieldLabel>
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <p className="text-xs font-bold w-32 shrink-0" style={{ color: 'var(--text-dim)' }}>{getSlotLabel(i, form.frequency)}</p>
              <input
                type="time"
                value={t}
                onChange={e => updateTime(i, e.target.value)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={selectStyle}
              />
            </div>
          ))}
        </div>
      )}

      {/* Reminder toggle */}
      {!isPRN && (
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Dose Reminders</p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Push notification at each scheduled time</p>
          </div>
          <Toggle value={form.reminderEnabled ?? false} onChange={v => setForm(f => ({ ...f, reminderEnabled: v }))} label="Dose Reminders" />
        </div>
      )}

      {/* Show in emergency toggle */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Show on Emergency Screen</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Display during prolonged seizure alert</p>
        </div>
        <Toggle value={form.showInEmergency ?? false} onChange={v => setForm(f => ({ ...f, showInEmergency: v }))} label="Show on Emergency Screen" />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!form.name.trim() || !form.dose}
          className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MedicationSection({ flash, notificationPermission, onRequestNotificationPermission }) {
  const { medications, addMedication, updateMedication, deleteMedication } = useMedications();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MED);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.dose) return;
    await addMedication({
      name: form.name.trim(),
      dose: parseFloat(form.dose),
      unit: form.unit,
      frequency: form.frequency,
      isRescue: form.frequency === 'PRN',
      scheduledTimes: form.scheduledTimes ?? defaultScheduledTimes(form.frequency),
      reminderEnabled: form.reminderEnabled ?? false,
      showInEmergency: form.showInEmergency ?? false,
    });
    setForm(EMPTY_MED);
    setShowForm(false);
    flash('Medication added.');
  };

  const startEdit = (med) => {
    setEditingId(med.id);
    setEditForm({
      name: med.name,
      dose: String(med.dose),
      unit: med.unit,
      frequency: med.frequency,
      isRescue: med.isRescue,
      scheduledTimes: med.scheduledTimes ?? defaultScheduledTimes(med.frequency),
      reminderEnabled: med.reminderEnabled ?? false,
      showInEmergency: med.showInEmergency ?? false,
    });
  };

  const handleUpdate = async () => {
    if (!editForm.name.trim() || !editForm.dose) return;
    await updateMedication(editingId, {
      name: editForm.name.trim(),
      dose: parseFloat(editForm.dose),
      unit: editForm.unit,
      frequency: editForm.frequency,
      isRescue: editForm.frequency === 'PRN',
      scheduledTimes: editForm.scheduledTimes ?? defaultScheduledTimes(editForm.frequency),
      reminderEnabled: editForm.reminderEnabled ?? false,
      showInEmergency: editForm.showInEmergency ?? false,
    });
    setEditingId(null);
    setEditForm(null);
    flash('Medication updated.');
  };

  const handleDelete = async (id) => {
    await deleteMedication(id);
    setDeleteConfirm(null);
    flash('Medication removed.');
  };

  return (
    <Section title="Medications">
      <p className="text-[11px] text-[var(--text-dim)] -mt-2">Current medication regimen. Used in reports and dose-logging.</p>

      {medications.length === 0 && !showForm && (
        <p className="text-xs italic text-center py-3" style={{ color: 'var(--text-faint)' }}>No medications recorded.</p>
      )}

      <div className="space-y-2">
        {medications.map(m => (
          <div key={m.id}>
            {editingId === m.id ? (
              <MedForm form={editForm} setForm={setEditForm} onSave={handleUpdate} onCancel={() => { setEditingId(null); setEditForm(null); }} saveLabel="Update" />
            ) : deleteConfirm === m.id ? (
              <div className="rounded-2xl p-3 space-y-2" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
                <p className="text-red-400 text-xs font-bold">Remove {m.name}?</p>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(m.id)} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Remove</button>
                  <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                      {m.showInEmergency && <span className="ml-2 text-[9px] font-black text-red-500 uppercase">🚨 Emergency</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {m.dose}{m.unit} · {m.frequency} — {FREQ_SHORT[m.frequency] || m.frequency}
                    </p>
                    {m.scheduledTimes && m.scheduledTimes.length > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {m.scheduledTimes.join(' · ')}
                        {m.reminderEnabled && <span className="ml-1.5">🔔</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-2 shrink-0">
                    <button
                      onClick={() => startEdit(m)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[11px] font-black transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
                      aria-label={`Edit ${m.name}`}
                    >✎</button>
                    <button
                      onClick={() => setDeleteConfirm(m.id)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[11px] font-black text-red-500 active:bg-red-600 active:text-white transition-all"
                      style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
                      aria-label={`Remove ${m.name}`}
                    >✕</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <MedForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => { setShowForm(false); setForm(EMPTY_MED); }} saveLabel="Add" />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + Add Medication
        </button>
      )}

      {/* Notification permissions */}
      <div className="border-t pt-4 mt-2 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <FieldLabel>Dose Reminder Notifications</FieldLabel>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {notificationPermission === 'granted' ? '🔔 Notifications enabled' :
               notificationPermission === 'denied'  ? '🔕 Notifications blocked' :
               '🔕 Notifications off'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {notificationPermission === 'granted' ? 'Reminders will fire while app is open or suspended.' :
               notificationPermission === 'denied'  ? 'Blocked in browser settings — reset site permissions to re-enable.' :
               'Enable to receive dose reminder notifications.'}
            </p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
            <button
              onClick={onRequestNotificationPermission}
              className="ml-3 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              Enable
            </button>
          )}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          On iOS, the app must be installed to your home screen for notifications to work.
          Notifications require the app to be running or suspended — they cannot be delivered when the app is fully closed.
        </p>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────

export function SettingsForm({ settings, onUpdate, onReset, pwa, activeTab, notificationPermission, onRequestNotificationPermission }) {
  const fileInputRef = useRef();
  const [storageInfo, setStorageInfo] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if ('storage' in navigator) {
      navigator.storage.estimate().then(est => {
        const usedKB = Math.round((est.usage || 0) / 1024);
        const quotaMB = Math.round((est.quota || 0) / 1024 / 1024);
        setStorageInfo({ usedKB, quotaMB });
      });
    }
  }, []);

  const flash = (msg) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(''), 4000); };

  const handleExportBackup = async () => {
    try {
      const events = await db.events.toArray();
      const medications = await db.medications.toArray().catch(() => []);
      const medicationLogs = await db.medicationLogs.toArray().catch(() => []);
      if (!events.length && !medications.length) { flash('No data to export.'); return; }
      exportToJSON(events, medications, medicationLogs);
      flash(`Exported ${events.length} event(s) and ${medications.length} medication(s).`);
    } catch (err) {
      console.error('Export failed:', err);
      flash('Export failed.');
    }
  };

  const isValidEvent = (e) =>
    e && typeof e === 'object' &&
    typeof e.startTime === 'number' &&
    typeof e.duration === 'number';

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = Array.isArray(parsed) ? parsed : (parsed.events || []);
      if (!raw.length && !parsed.medications?.length) { flash('No data found in file.'); return; }
      let eventsImported = 0, medsImported = 0, logsImported = 0;
      if (raw.length) {
        const valid = raw.filter(isValidEvent);
        if (valid.length < raw.length) {
          console.warn(`Skipped ${raw.length - valid.length} malformed records during import`);
        }
        if (valid.length) {
          const toImport = valid.map(({ id, ...rest }) => rest);
          await db.events.bulkAdd(toImport);
          eventsImported = toImport.length;
        }
      }
      if (Array.isArray(parsed.medications) && parsed.medications.length) {
        const toImport = parsed.medications.map(({ id, ...rest }) => rest);
        await db.medications.bulkAdd(toImport).catch(() => {});
        medsImported = toImport.length;
      }
      if (Array.isArray(parsed.medicationLogs) && parsed.medicationLogs.length) {
        const toImport = parsed.medicationLogs.map(({ id, ...rest }) => rest);
        await db.medicationLogs.bulkAdd(toImport).catch(() => {});
        logsImported = toImport.length;
      }
      const parts = [];
      if (eventsImported) parts.push(`${eventsImported} event(s)`);
      if (medsImported) parts.push(`${medsImported} medication(s)`);
      if (logsImported) parts.push(`${logsImported} dose log(s)`);
      flash(`Imported ${parts.join(', ') || 'nothing'} successfully.`);
    } catch {
      flash('Import failed — invalid or corrupted file.');
    }
    e.target.value = '';
  };

  const handleClearAllData = async () => {
    try {
      await db.events.clear();
      setShowClearConfirm(false);
      flash('All event data deleted.');
    } catch (err) {
      console.error('Failed to clear data:', err);
      flash('Failed to delete data. Please try again.');
    }
  };

  const handleResetSettings = async () => {
    await onReset?.();
    setShowResetConfirm(false);
    flash('Settings reset to defaults.');
  };

  const noteLabel = settings.userMode === 'CARETAKER' ? 'Person / Patient Name' : 'Your Name';
  const tab = activeTab || 'profile'; // fall back to showing all if no tab (standalone use)
  const show = (id) => !activeTab || tab === id;

  return (
    <div className="space-y-4 w-full pb-10">

      {/* ── IDENTITY / PROFILE ── */}
      {show('profile') && <Section title="Identity">
        <div>
          <FieldLabel>Mode</FieldLabel>
          <Segments
            options={[
              { value: 'CARETAKER', label: 'Caretaker' },
              { value: 'PATIENT',   label: 'Self' }
            ]}
            value={settings.userMode}
            onChange={v => onUpdate('userMode', v)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-2">
            {settings.userMode === 'CARETAKER'
              ? 'Recording for another person. Full phase timing controls visible during recording.'
              : 'Recording your own events. Simplified one-button interface.'}
          </p>
        </div>
        <TextField label={noteLabel} value={settings.personName} onChange={v => onUpdate('personName', v)} placeholder="Full name (used in reports)" />
        {settings.userMode === 'CARETAKER' && (
          <TextField label="Caretaker Name" value={settings.caretakerName} onChange={v => onUpdate('caretakerName', v)} placeholder="Your name" />
        )}
        <TextField label="Date of Birth" value={settings.dateOfBirth} onChange={v => onUpdate('dateOfBirth', v)} type="date" />
        <TextField label="Emergency Contact" value={settings.emergencyContact} onChange={v => onUpdate('emergencyContact', v)} placeholder="Phone number or name" />
      </Section>}

      {/* ── APPEARANCE + DISPLAY ── */}
      {show('display') && <Section title="Appearance">
        <div>
          <FieldLabel>Theme</FieldLabel>
          <Segments
            options={[
              { value: 'dark',   label: 'Dark' },
              { value: 'light',  label: 'Light' },
              { value: 'system', label: 'System' }
            ]}
            value={settings.theme}
            onChange={v => onUpdate('theme', v)}
          />
        </div>
        <div>
          <FieldLabel>Accent Colour</FieldLabel>
          <div className="flex gap-4 flex-wrap pt-1">
            {[
              { key: 'red',    hex: '#dc2626', label: 'Red'    },
              { key: 'blue',   hex: '#3b82f6', label: 'Blue'   },
              { key: 'green',  hex: '#16a34a', label: 'Green'  },
              { key: 'purple', hex: '#9333ea', label: 'Purple' },
              { key: 'amber',  hex: '#d97706', label: 'Amber'  },
            ].map(({ key, hex, label }) => (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <button
                  title={label}
                  onClick={() => onUpdate('accentColor', key)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    settings.accentColor === key
                      ? 'ring-4 ring-offset-2 scale-110'
                      : 'opacity-50 active:opacity-100'
                  }`}
                  style={{ backgroundColor: hex, outlineColor: hex }}
                />
                <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Text Size</FieldLabel>
          <Segments
            options={[
              { value: 'small',  label: 'S'      },
              { value: 'normal', label: 'Normal' },
              { value: 'large',  label: 'L'      },
              { value: 'xlarge', label: 'XL'     },
            ]}
            value={settings.fontSize}
            onChange={v => onUpdate('fontSize', v)}
          />
        </div>
      </Section>}

      {show('display') && <Section title="Display">
        <div>
          <FieldLabel>History Page Size</FieldLabel>
          <Segments
            options={[5, 10, 25, 50].map(n => ({ value: n, label: String(n) }))}
            value={settings.historyPageSize}
            onChange={v => onUpdate('historyPageSize', v)}
          />
        </div>
        <div>
          <FieldLabel>Date Format</FieldLabel>
          <select
            value={settings.dateFormat}
            onChange={e => onUpdate('dateFormat', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="locale">System Default</option>
            <option value="ISO">ISO  — 2025-05-14</option>
            <option value="US">US   — 05/14/2025</option>
            <option value="EU">EU   — 14/05/2025</option>
          </select>
        </div>
        <div>
          <FieldLabel>Duration Display</FieldLabel>
          <Segments
            options={[{ value: 'seconds', label: '123s' }, { value: 'human', label: '2m 3s' }]}
            value={settings.durationFormat}
            onChange={v => onUpdate('durationFormat', v)}
          />
        </div>
        <div>
          <FieldLabel>Time Format</FieldLabel>
          <Segments
            options={[{ value: '12h', label: '12h' }, { value: '24h', label: '24h' }]}
            value={settings.timeFormat}
            onChange={v => onUpdate('timeFormat', v)}
          />
        </div>
      </Section>}

      {/* ── RECORDING ── */}
      {show('recording') && <Section title="Recording">
        <Row label="Haptic Feedback" help="Vibration on button presses (device must support it)">
          <Toggle value={settings.hapticFeedback} onChange={v => onUpdate('hapticFeedback', v)} label="Haptic Feedback" />
        </Row>
        <div>
          <FieldLabel>Quick Note Labels</FieldLabel>
          <p className="text-[11px] text-[var(--text-dim)] mb-3">Customise the shortcut buttons shown during recording. Leave blank to hide a button.</p>
          <div className="grid grid-cols-2 gap-2">
            {(settings.quickNoteLabels || []).map((label, i) => (
              <input
                key={i}
                value={label}
                onChange={e => {
                  const updated = [...settings.quickNoteLabels];
                  updated[i] = e.target.value;
                  onUpdate('quickNoteLabels', updated);
                }}
                placeholder={`Button ${i + 1}`}
                className="rounded-xl px-3 py-2.5 text-xs font-bold text-center outline-none transition-all"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            ))}
          </div>
        </div>
      </Section>}

      {/* ── DATA & BACKUP ── */}
      {show('data') && <Section title="Data &amp; Backup">
        {storageInfo && (
          <Row label="Storage Used" help="Approximate browser IndexedDB usage">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {storageInfo.usedKB} KB
              <span className="text-[var(--text-dim)] font-normal"> / {storageInfo.quotaMB} MB</span>
            </p>
          </Row>
        )}

        <div>
          <FieldLabel>Auto-Backup</FieldLabel>
          <Segments
            options={[
              { value: 'never',   label: 'Never'   },
              { value: 'weekly',  label: 'Weekly'  },
              { value: 'monthly', label: 'Monthly' },
            ]}
            value={settings.autoBackupFrequency}
            onChange={v => onUpdate('autoBackupFrequency', v)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-2">Manual trigger is always available via the Export screen.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionBtn label="Export Backup" sub="JSON download" icon="⬇" onClick={handleExportBackup} />
          <ActionBtn label="Import Data"   sub="JSON file"    icon="⬆" onClick={() => fileInputRef.current?.click()} />
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        {statusMsg && (
          <p className="text-center text-xs py-2 font-bold" style={{ color: statusMsg.includes('fail') || statusMsg.includes('No') ? '#ef4444' : '#4ade80' }}>
            {statusMsg}
          </p>
        )}

        {/* Danger Zone */}
        <div className="border-t mt-2 pt-5 space-y-3" style={{ borderColor: 'rgba(185,28,28,0.3)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</p>

          {showClearConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
              <p className="text-red-400 text-sm font-bold">This permanently deletes all recorded events. Cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={handleClearAllData} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">
                  Yes, Delete All
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-xl font-bold text-xs" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label="Clear All Event Data" variant="danger" onClick={() => setShowClearConfirm(true)} />
          )}
        </div>
      </Section>}

      {/* ── MEDICATIONS ── */}
      {show('medications') && <MedicationSection flash={flash} notificationPermission={notificationPermission} onRequestNotificationPermission={onRequestNotificationPermission} />}

      {/* ── REPORTS & NEUROLOGIST ── */}
      {show('reports') && <Section title="Reports &amp; Neurologist">
        <p className="text-[11px] text-[var(--text-dim)] -mt-2">Information used to generate clinical neurologist reports.</p>
        <TextField label="Neurologist / Clinician Name" value={settings.neurologistName} onChange={v => onUpdate('neurologistName', v)} placeholder="Dr. Name" />
        <TextField label="Institution / Hospital" value={settings.neurologistInstitution} onChange={v => onUpdate('neurologistInstitution', v)} placeholder="Clinic or hospital name" />
        <TextField label="Clinician Contact" value={settings.neurologistContact} onChange={v => onUpdate('neurologistContact', v)} placeholder="Phone, email, or referral number" />
        <Row label="Include Date of Birth" help="Whether DOB appears in printed reports">
          <Toggle value={settings.includePatientDOB !== false} onChange={v => onUpdate('includePatientDOB', v)} label="Include Date of Birth in reports" />
        </Row>
        <div>
          <FieldLabel>Additional Notes for Reports</FieldLabel>
          <textarea
            value={settings.reportNotes || ''}
            onChange={e => onUpdate('reportNotes', e.target.value)}
            placeholder="Medications, known triggers, clinician instructions, or anything else to include at the end of reports..."
            rows={4}
            className="w-full rounded-[1.5rem] px-5 py-4 text-sm outline-none resize-none transition-all"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </Section>}

      {/* ── ABOUT (shown in Data tab) ── */}
      {show('data') && <Section title="About">
        <Row label="App Version"><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrack v0.1.0</p></Row>
        <Row label="Database Schema"><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrackDB v6</p></Row>
        {pwa?.canInstallManually && (
          <div>
            <ActionBtn
              label="Re-show Install Prompt"
              sub="Tap if you dismissed the install banner by mistake"
              icon="📲"
              onClick={pwa.resetDismissal}
            />
          </div>
        )}
        <div className="pt-1">
          {showResetConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
              <p className="text-red-400 text-sm font-bold">Reset all preferences to factory defaults?</p>
              <div className="flex gap-3">
                <button onClick={handleResetSettings} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">
                  Yes, Reset
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-xl font-bold text-xs" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label="Reset Settings to Defaults" variant="danger" onClick={() => setShowResetConfirm(true)} />
          )}
        </div>
      </Section>}

    </div>
  );
}
