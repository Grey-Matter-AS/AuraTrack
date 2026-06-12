import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { assertImportFileSafe } from '../utils/importSanitizer';
import { mergeRemoteData } from '../utils/syncHelpers';
import { useMedications } from '../hooks/useMedications';
import { BackupTransferModal } from './BackupTransferModal';
import { parseBackupFileText } from '../utils/backupFiles';
import { defaultScheduledTimes, scheduledDaysLabel } from '../utils/medicationSchedule';
import { CloseIcon, DownloadIcon, EditIcon, InstallIcon, ResetIcon, SyncIcon, TrashIcon, UploadIcon } from './AppIcons';
import pkg from '../../package.json';
import i18n from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Dansk' },
  { code: 'nb', label: 'Norsk Bokmål' },
  { code: 'nn', label: 'Nynorsk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'sv', label: 'Svenska' },
  { code: 'fi', label: 'Suomi' },
];

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
          {typeof help === 'string' && help && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</p>}
          {help && typeof help !== 'string' && <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</div>}
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
      style={{
        backgroundColor: value ? 'var(--accent)' : 'var(--bg-input)',
        border: value ? '1px solid transparent' : '1px solid var(--border)',
      }}
    >
      <span
        className="absolute top-1 w-6 h-6 rounded-full shadow transition-all"
        style={{ left: value ? '1.75rem' : '0.25rem', backgroundColor: value ? '#fff' : 'var(--text-dim)' }}
      />
    </button>
  );
}

function ActionBtn({ label, sub, onClick, icon, variant = 'default' }) {
  const isDanger = variant === 'danger';
  const bg = isDanger ? '#dc2626' : 'var(--bg-raised)';
  const color = isDanger ? '#ffffff' : 'var(--text-on-raised)';
  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-center rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${isDanger ? 'gap-2 px-4 py-6 min-h-[9rem] text-[11px]' : 'gap-1 py-5 text-[10px]'}`}
      style={{ backgroundColor: bg, color, border: isDanger ? '1px solid rgba(127,29,29,0.9)' : '1px solid var(--border)' }}
    >
      {icon && (
        <span
          className={`rounded-2xl flex items-center justify-center ${isDanger ? 'w-14 h-14' : 'w-10 h-10'}`}
          style={{ backgroundColor: isDanger ? 'rgba(255,255,255,0.14)' : 'var(--bg-card)' }}
        >
          {icon}
        </span>
      )}
      <span className={`text-center whitespace-normal ${isDanger ? 'leading-tight max-w-[18ch]' : 'leading-snug'}`}>{label}</span>
      {sub && <span className={`font-medium normal-case tracking-normal ${isDanger ? 'text-[10px] opacity-90' : 'text-[9px] opacity-60'}`}>{sub}</span>}
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

function getSlotLabel(index, frequency, t) {
  if (frequency === 'BD') return index === 0 ? t('settings.medications.slot_morning') : t('settings.medications.slot_evening');
  if (frequency === 'TDS') return [t('settings.medications.slot_morning'), t('settings.medications.slot_afternoon'), t('settings.medications.slot_evening')][index] || t('settings.medications.slot_dose_n', { n: index + 1 });
  if (frequency === 'QDS') return [t('settings.medications.slot_morning'), t('settings.medications.slot_midday'), t('settings.medications.slot_afternoon'), t('settings.medications.slot_evening')][index] || t('settings.medications.slot_dose_n', { n: index + 1 });
  return t('settings.medications.slot_dose_time');
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_MED = { name: '', dose: '', unit: 'mg', frequency: 'BD', isRescue: false, scheduledTimes: ['08:00', '20:00'], scheduledDays: ALL_DAYS, reminderEnabled: false, showInEmergency: false };

function MedForm({ form, setForm, onSave, onCancel, saveLabel = 'Save' }) {
  const { t } = useTranslation();
  const selectStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  const isPRN = form.frequency === 'PRN';

  const handleFreqChange = (freq) => {
    setForm(f => ({ ...f, frequency: freq, isRescue: freq === 'PRN', scheduledTimes: defaultScheduledTimes(freq) }));
  };

  const scheduledDays = form.scheduledDays ?? ALL_DAYS;
  const isDaily = scheduledDays.length === 7;

  const toggleDay = (day) => {
    setForm(f => {
      const days = f.scheduledDays ?? ALL_DAYS;
      const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
      return { ...f, scheduledDays: next.length > 0 ? next : days };
    });
  };

  const setDaily = () => setForm(f => ({ ...f, scheduledDays: ALL_DAYS }));

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
      <FieldLabel>{saveLabel === 'Save' ? t('settings.medications.add_form_title') : t('settings.medications.edit_form_title')}</FieldLabel>
      <input
        type="text"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder={t('settings.medications.name_placeholder')}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={selectStyle}
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={form.dose}
          onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
          placeholder={t('settings.medications.dose_placeholder')}
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
          <FieldLabel>{t('settings.medications.scheduled_times')}</FieldLabel>
          {times.map((time, i) => (
            <div key={i} className="flex items-center gap-3">
              <p className="text-xs font-bold w-32 shrink-0" style={{ color: 'var(--text-dim)' }}>{getSlotLabel(i, form.frequency, t)}</p>
              <input
                type="time"
                value={time}
                onChange={e => updateTime(i, e.target.value)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={selectStyle}
              />
            </div>
          ))}
        </div>
      )}

      {/* Days of week */}
      {!isPRN && (
        <div className="space-y-2">
          <FieldLabel>{t('settings.medications.active_days')}</FieldLabel>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={setDaily}
              className="px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
              style={{
                backgroundColor: isDaily ? 'var(--accent)' : 'var(--bg-raised)',
                color: isDaily ? '#fff' : 'var(--text-dim)',
                border: isDaily ? '1px solid transparent' : '1px solid var(--border)',
              }}
            >
              {t('settings.medications.daily')}
            </button>
            {DAY_LABELS.map((label, day) => {
              const active = scheduledDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className="px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'var(--bg-raised)',
                    color: active ? '#fff' : 'var(--text-dim)',
                    border: active ? '1px solid transparent' : '1px solid var(--border)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reminder toggle */}
      {!isPRN && (
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings.medications.dose_reminders')}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('settings.medications.dose_reminders_help')}</p>
          </div>
          <Toggle value={form.reminderEnabled ?? false} onChange={v => setForm(f => ({ ...f, reminderEnabled: v }))} label={t('settings.medications.dose_reminders')} />
        </div>
      )}

      {/* Show in emergency toggle */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings.medications.show_emergency')}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('settings.medications.show_emergency_help')}</p>
        </div>
        <Toggle value={form.showInEmergency ?? false} onChange={v => setForm(f => ({ ...f, showInEmergency: v }))} label={t('settings.medications.show_emergency')} />
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
          {t('settings.medications.cancel')}
        </button>
      </div>
    </div>
  );
}

function MedicationSection({ flash, notificationPermission, onRequestNotificationPermission, settings, onUpdate }) {
  const { t } = useTranslation();
  const { medications, addMedication, updateMedication, deleteMedication } = useMedications();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MED);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.dose) return;
    try {
      await addMedication({
        name: form.name.trim(),
        dose: parseFloat(form.dose),
        unit: form.unit,
        frequency: form.frequency,
        isRescue: form.frequency === 'PRN',
        scheduledTimes: form.scheduledTimes ?? defaultScheduledTimes(form.frequency),
        scheduledDays: form.frequency === 'PRN' ? ALL_DAYS : (form.scheduledDays ?? ALL_DAYS),
        reminderEnabled: form.reminderEnabled ?? false,
        showInEmergency: form.showInEmergency ?? false,
      });
      setForm(EMPTY_MED);
      setShowForm(false);
      flash(t('settings.medications.added'));
    } catch {
      flash('Failed to add medication.');
    }
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
      scheduledDays: med.scheduledDays ?? ALL_DAYS,
      reminderEnabled: med.reminderEnabled ?? false,
      showInEmergency: med.showInEmergency ?? false,
    });
  };

  const handleUpdate = async () => {
    if (!editForm.name.trim() || !editForm.dose) return;
    try {
      await updateMedication(editingId, {
        name: editForm.name.trim(),
        dose: parseFloat(editForm.dose),
        unit: editForm.unit,
        frequency: editForm.frequency,
        isRescue: editForm.frequency === 'PRN',
        scheduledTimes: editForm.scheduledTimes ?? defaultScheduledTimes(editForm.frequency),
        scheduledDays: editForm.frequency === 'PRN' ? ALL_DAYS : (editForm.scheduledDays ?? ALL_DAYS),
        reminderEnabled: editForm.reminderEnabled ?? false,
        showInEmergency: editForm.showInEmergency ?? false,
      });
      setEditingId(null);
      setEditForm(null);
      flash(t('settings.medications.updated'));
    } catch {
      flash('Failed to update medication.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMedication(id);
      setDeleteConfirm(null);
      flash(t('settings.medications.removed'));
    } catch {
      flash(t('settings.data.delete_failed'));
    }
  };

  return (
    <Section title={t('settings.medications.section')}>
      <p className="text-[11px] text-[var(--text-dim)] -mt-2">{t('settings.medications.section_desc')}</p>

      {medications.length === 0 && !showForm && (
        <p className="text-xs italic text-center py-3" style={{ color: 'var(--text-faint)' }}>{t('settings.medications.none_recorded')}</p>
      )}

      <div className="space-y-2">
        {medications.map(m => (
          <div key={m.id}>
            {editingId === m.id ? (
              <MedForm form={editForm} setForm={setEditForm} onSave={handleUpdate} onCancel={() => { setEditingId(null); setEditForm(null); }} saveLabel={t('settings.medications.update')} />
            ) : deleteConfirm === m.id ? (
              <div className="rounded-2xl p-3 space-y-2" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
                <p className="text-red-400 text-xs font-bold">{t('settings.medications.remove_confirm', { name: m.name })}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(m.id)} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{t('settings.medications.remove')}</button>
                  <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>{t('settings.medications.cancel')}</button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                      {m.showInEmergency && <span className="ml-2 text-[9px] font-black text-red-500 uppercase">{t('settings.medications.emergency_badge')}</span>}
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
                    {scheduledDaysLabel(m.scheduledDays) && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {scheduledDaysLabel(m.scheduledDays)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-2 shrink-0">
                    <button
                      onClick={() => startEdit(m)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[11px] font-black transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
                      aria-label={`Edit ${m.name}`}
                    ><EditIcon className="w-4 h-4" /></button>
                    <button
                      onClick={() => setDeleteConfirm(m.id)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[11px] font-black text-red-500 active:bg-red-600 active:text-white transition-all"
                      style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
                      aria-label={`Remove ${m.name}`}
                    ><CloseIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <MedForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => { setShowForm(false); setForm(EMPTY_MED); }} saveLabel={t('settings.medications.add')} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {t('settings.medications.add_btn')}
        </button>
      )}

      {/* Medication tracking start date */}
      <div className="border-t pt-4 mt-2 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <FieldLabel>{t('settings.medications.start_date')}</FieldLabel>
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {t('settings.medications.start_date_help')}
        </p>
        <input
          type="date"
          value={settings?.medicationStartDate || ''}
          onChange={e => onUpdate?.('medicationStartDate', e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Notification permissions */}
      <div className="border-t pt-4 mt-2 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <FieldLabel>{t('settings.medications.reminder_section')}</FieldLabel>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {notificationPermission === 'granted' ? t('settings.medications.reminder_granted') :
               notificationPermission === 'denied'  ? t('settings.medications.reminder_denied') :
               t('settings.medications.reminder_off')}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {notificationPermission === 'granted' ? t('settings.medications.reminder_granted_help') :
               notificationPermission === 'denied'  ? t('settings.medications.reminder_denied_help') :
               t('settings.medications.reminder_off_help')}
            </p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
            <button
              onClick={onRequestNotificationPermission}
              className="ml-3 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {t('settings.medications.reminder_enable')}
            </button>
          )}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {t('settings.medications.ios_reminder_note')}
        </p>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────

export function SettingsForm({ settings, onUpdate, onReset, pwa, activeTab, notificationPermission, onRequestNotificationPermission, onSync, storagePersistence, onBackupSuccess }) {
  const { t } = useTranslation();
  const fileInputRef = useRef();
  const [storageInfo, setStorageInfo] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [backupModal, setBackupModal] = useState({ mode: null, fileName: '', fileText: '' });

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
  const summarizeImportResult = (result) => {
    const parts = [];
    if (result.settings) parts.push(`${result.settings} setting(s)`);
    if (result.events) parts.push(`${result.events} event(s)`);
    if (result.medications) parts.push(`${result.medications} medication(s)`);
    if (result.logs) parts.push(`${result.logs} dose log(s)`);
    if (result.eegSessions) parts.push(`${result.eegSessions} EEG session(s)`);
    if (result.eegActivities) parts.push(`${result.eegActivities} EEG activity record(s)`);
    const conflicts = result.conflicts?.length
      ? ` ${result.conflicts.length} conflict(s) kept local data intact.`
      : '';
    return `${parts.join(', ') || t('settings.data.imported_nothing')}.${conflicts}`;
  };

  const handleExportBackup = () => setBackupModal({ mode: 'export', fileName: '', fileText: '' });

  const processImport = async (file) => {
    try {
      assertImportFileSafe(file);
      const text = await file.text();
      const parsed = parseBackupFileText(text);
      if (parsed.kind === 'encrypted') {
        setBackupModal({ mode: 'import', fileName: file.name, fileText: text });
        return;
      }
      const result = await mergeRemoteData(parsed.parsed);
      flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
    } catch (err) {
      console.error('Import failed:', err);
      flash(t('settings.data.import_failed'));
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processImport(file);
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'AuraTrack Backup', accept: { 'application/json': ['.json', '.atbak'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        await processImport(file);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleClearAllData = async () => {
    try {
      await Promise.all([
        db.events.clear(),
        db.medications.clear().catch(() => {}),
        db.medicationLogs.clear().catch(() => {}),
      ]);
      setShowClearConfirm(false);
      flash(t('settings.data.all_deleted'));
    } catch (err) {
      console.error('Failed to clear data:', err);
      flash(t('settings.data.delete_failed'));
    }
  };

  const handleResetSettings = async () => {
    await onReset?.();
    setShowResetConfirm(false);
    flash(t('settings.data.settings_reset'));
  };

  const handleEncryptedImportSuccess = (result) => {
    flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
  };

  const handleEncryptedExportSuccess = async (summary) => {
    await onBackupSuccess?.(summary);
    flash(t('settings.data.exported', { events: summary.events, meds: summary.medications }));
  };

  const persistenceStatusLabel = {
    checking: t('settings.data.persistence_checking', 'Checking storage protection…'),
    granted: t('settings.data.persistence_granted', 'Persistent storage enabled'),
    not_requested: t('settings.data.persistence_not_requested', 'Permission can be requested'),
    denied: t('settings.data.persistence_denied', 'Best-effort storage only'),
    unsupported: t('settings.data.persistence_unsupported', 'Persistent storage not supported'),
    error: t('settings.data.persistence_error', 'Persistent storage request failed'),
  }[storagePersistence?.status || 'checking'];

  const persistenceStatusHelp = {
    checking: t('settings.data.persistence_help_checking', 'AuraTrack is checking whether the browser will protect this PWA storage from eviction.'),
    granted: t('settings.data.persistence_help_granted', 'Browser-managed storage has been marked persistent. Data should not be evicted except by explicit user action.'),
    not_requested: t('settings.data.persistence_help_not_requested', 'This browser may show a permission prompt, so AuraTrack waits for you to request storage protection manually.'),
    denied: t('settings.data.persistence_help_denied', 'The browser did not grant persistent storage. Backups remain the main protection against data loss.'),
    unsupported: t('settings.data.persistence_help_unsupported', 'This browser does not expose persistent storage controls. Backups remain the main protection against data loss.'),
    error: t('settings.data.persistence_help_error', 'AuraTrack could not confirm persistent storage protection on this device. Backups remain the main protection against data loss.'),
  }[storagePersistence?.status || 'checking'];

  const persistenceFlowDetail = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_detail_flow_prompt', 'User-initiated request. A browser permission prompt may appear when you tap the button.')
    : t('settings.data.persistence_detail_flow_auto', 'Automatic browser decision. The browser may silently grant or deny without showing a permission popup.');

  const persistenceBrowserDetail = storagePersistence?.engine === 'webkit'
    ? t('settings.data.persistence_detail_browser_webkit', 'WebKit browsers on iPhone/iPad and Safari-class environments usually decide this silently. Installing the app can help storage quotas, but backups are still essential.')
    : storagePersistence?.engine === 'chromium'
      ? t('settings.data.persistence_detail_browser_chromium', 'Chromium browsers such as Chrome and Edge usually decide this from browser heuristics, so tapping again may recheck without showing a prompt.')
      : storagePersistence?.engine === 'gecko'
        ? t('settings.data.persistence_detail_browser_gecko', 'Firefox-class browsers may show a permission prompt when requested from this screen.')
        : t('settings.data.persistence_detail_browser_generic', 'Browser behavior varies by engine and device.');

  const persistenceReasonDetail = (storagePersistence?.status === 'denied' || storagePersistence?.status === 'not_requested')
    ? t('settings.data.persistence_detail_reason', 'Exact denial reasons are not exposed by the web API, so AuraTrack can only show the browser result, not why it decided that way.')
    : null;

  const persistenceActionLabel = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_request', 'Request access')
    : t('settings.data.persistence_retry', 'Try again');

  const persistenceTechnicalDetails = storagePersistence?.supported
    ? [
        {
          label: t('settings.data.persistence_detail_browser_label', 'Browser'),
          value: `${storagePersistence.browserLabel || t('settings.data.persistence_detail_unknown', 'Unknown')} · ${storagePersistence.platformLabel || t('settings.data.persistence_detail_unknown', 'Unknown')}`,
        },
        {
          label: t('settings.data.persistence_detail_flow_label', 'Request mode'),
          value: persistenceFlowDetail,
        },
        {
          label: t('settings.data.persistence_detail_api_label', 'Web API'),
          value: 'navigator.storage.persist() / persisted()',
        },
      ]
    : [];

  const lastBackupLabel = settings.lastSuccessfulBackupAt
    ? new Date(settings.lastSuccessfulBackupAt).toLocaleString()
    : t('settings.data.backup_never', 'Never');

  const noteLabel = settings.userMode === 'CARETAKER' ? t('settings.identity.patient_name') : t('settings.identity.your_name');
  const tab = activeTab || 'identity';
  const show = (id) => !activeTab || tab === id;

  return (
    <div className="space-y-4 w-full pb-10">

      {/* ── IDENTITY / PROFILE ── */}
      {show('identity') && <Section title={t('settings.identity.section')}>
        <div>
          <FieldLabel>{t('settings.identity.mode')}</FieldLabel>
          <Segments
            options={[
              { value: 'CARETAKER', label: t('settings.identity.mode_caretaker') },
              { value: 'PATIENT',   label: t('settings.identity.mode_self') }
            ]}
            value={settings.userMode}
            onChange={v => onUpdate('userMode', v)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-2">
            {settings.userMode === 'CARETAKER'
              ? t('settings.identity.mode_desc_caretaker')
              : t('settings.identity.mode_desc_self')}
          </p>
        </div>
        <TextField label={noteLabel} value={settings.personName} onChange={v => onUpdate('personName', v)} placeholder={t('settings.identity.name_placeholder')} />
        {settings.userMode === 'CARETAKER' && (
          <TextField label={t('settings.identity.caretaker_name')} value={settings.caretakerName} onChange={v => onUpdate('caretakerName', v)} placeholder={t('settings.identity.caretaker_placeholder')} />
        )}
        <TextField label={t('settings.identity.dob')} value={settings.dateOfBirth} onChange={v => onUpdate('dateOfBirth', v)} type="date" />
        <TextField label={t('settings.identity.emergency_contact')} value={settings.emergencyContact} onChange={v => onUpdate('emergencyContact', v)} placeholder={t('settings.identity.emergency_placeholder')} />
      </Section>}

      {/* ── APPEARANCE + DISPLAY ── */}
      {show('appearance') && <Section title={t('settings.appearance.section')}>
        <div>
          <FieldLabel>{t('settings.appearance.theme')}</FieldLabel>
          <Segments
            options={[
              { value: 'dark',   label: t('settings.appearance.theme_dark') },
              { value: 'light',  label: t('settings.appearance.theme_light') },
              { value: 'system', label: t('settings.appearance.theme_system') }
            ]}
            value={settings.theme}
            onChange={v => onUpdate('theme', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.accent')}</FieldLabel>
          <div className="flex gap-4 flex-wrap pt-1">
            {[
              { key: 'red',    hex: '#dc2626', label: t('settings.appearance.accent_red')    },
              { key: 'blue',   hex: '#3b82f6', label: t('settings.appearance.accent_blue')   },
              { key: 'green',  hex: '#16a34a', label: t('settings.appearance.accent_green')  },
              { key: 'purple', hex: '#9333ea', label: t('settings.appearance.accent_purple') },
              { key: 'amber',  hex: '#d97706', label: t('settings.appearance.accent_amber')  },
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
          <FieldLabel>{t('settings.appearance.text_size')}</FieldLabel>
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
        <div>
          <FieldLabel>{t('settings.appearance.language')}</FieldLabel>
          <select
            value={settings.language || 'en'}
            onChange={e => {
              i18n.changeLanguage(e.target.value);
              onUpdate('language', e.target.value);
            }}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </Section>}

      {show('appearance') && <Section title={t('settings.display.section')}>
        <div>
          <FieldLabel>{t('settings.display.page_size')}</FieldLabel>
          <Segments
            options={[5, 10, 25, 50].map(n => ({ value: n, label: String(n) }))}
            value={settings.historyPageSize}
            onChange={v => onUpdate('historyPageSize', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.date_format')}</FieldLabel>
          <select
            value={settings.dateFormat}
            onChange={e => onUpdate('dateFormat', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="locale">{t('settings.display.date_system')}</option>
            <option value="ISO">ISO  — 2025-05-14</option>
            <option value="US">US   — 05/14/2025</option>
            <option value="EU">EU   — 14/05/2025</option>
          </select>
        </div>
        <div>
          <FieldLabel>{t('settings.display.duration_display')}</FieldLabel>
          <Segments
            options={[{ value: 'seconds', label: '123s' }, { value: 'human', label: '2m 3s' }]}
            value={settings.durationFormat}
            onChange={v => onUpdate('durationFormat', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.time_format')}</FieldLabel>
          <Segments
            options={[{ value: '12h', label: '12h' }, { value: '24h', label: '24h' }]}
            value={settings.timeFormat}
            onChange={v => onUpdate('timeFormat', v)}
          />
        </div>
      </Section>}

      {/* ── RECORDING ── */}
      {show('recording') && <Section title={t('settings.recording.section')}>
        <Row label={t('settings.recording.haptic')} help={t('settings.recording.haptic_help')}>
          <Toggle value={settings.hapticFeedback} onChange={v => onUpdate('hapticFeedback', v)} label={t('settings.recording.haptic')} />
        </Row>
        <Row label={t('settings.recording.eeg_diary')} help={t('settings.recording.eeg_diary_help')}>
          <Toggle value={settings.eegDiaryEnabled} onChange={v => onUpdate('eegDiaryEnabled', v)} label={t('settings.recording.eeg_diary')} />
        </Row>
        <div>
          <FieldLabel>{t('settings.recording.quick_labels')}</FieldLabel>
          <p className="text-[11px] text-[var(--text-dim)] mb-3">{t('settings.recording.quick_labels_help')}</p>
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
                placeholder={t('settings.recording.button_n', { n: i + 1 })}
                className="rounded-xl px-3 py-2.5 text-xs font-bold text-center outline-none transition-all"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            ))}
          </div>
        </div>
      </Section>}

      {/* ── DATA & BACKUP ── */}
      {show('data') && <Section title={t('settings.data.section')}>
        {storageInfo && (
          <Row label={t('settings.data.storage_used')} help={t('settings.data.storage_help')}>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {t('settings.data.storage_value', { kb: storageInfo.usedKB })}
              <span className="text-[var(--text-dim)] font-normal">{t('settings.data.storage_quota', { mb: storageInfo.quotaMB })}</span>
            </p>
          </Row>
        )}

        <Row
          label={t('settings.data.persistence_status', 'Storage protection')}
          help={
            <div className="space-y-2">
              <p>{persistenceStatusHelp}</p>
              <p>{persistenceBrowserDetail}</p>
              {persistenceReasonDetail && <p>{persistenceReasonDetail}</p>}
            </div>
          }
        >
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <p className="text-sm font-bold" style={{ color: storagePersistence?.persisted ? '#4ade80' : 'var(--text-primary)' }}>
              {persistenceStatusLabel}
            </p>
            {storagePersistence?.supported && !storagePersistence?.persisted && (
              <button
                onClick={() => storagePersistence.requestPersistence?.({ userInitiated: true })}
                className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
              >
                {persistenceActionLabel}
              </button>
            )}
          </div>
        </Row>
        {persistenceTechnicalDetails.length > 0 && (
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {t('settings.data.persistence_details_title', 'Technical details')}
            </p>
            {persistenceTechnicalDetails.map((detail) => (
              <div key={detail.label} className="flex flex-col gap-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                  {detail.label}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <Row label={t('settings.data.last_backup', 'Last successful backup')} help={t('settings.data.last_backup_help', 'Updated when an encrypted backup file is saved successfully.')}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{lastBackupLabel}</p>
        </Row>

        <div>
          <Row label={t('settings.data.backup_reminders', 'Backup reminders')} help={t('settings.data.backup_reminders_help', 'Reminders appear when no successful backup has been created within the chosen interval.')}>
            <Toggle value={settings.backupReminderEnabled !== false} onChange={value => onUpdate('backupReminderEnabled', value)} label={t('settings.data.backup_reminders', 'Backup reminders')} />
          </Row>
          {settings.backupReminderEnabled !== false && (
            <div className="mt-3">
              <FieldLabel>{t('settings.data.backup_interval', 'Reminder interval')}</FieldLabel>
              <Segments
                options={[
                  { value: 7, label: t('settings.data.backup_interval_7', '7 days') },
                  { value: 14, label: t('settings.data.backup_interval_14', '14 days') },
                  { value: 30, label: t('settings.data.backup_interval_30', '30 days') },
                ]}
                value={settings.backupReminderIntervalDays || 7}
                onChange={value => onUpdate('backupReminderIntervalDays', value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionBtn label={t('settings.data.export_backup')} sub={t('settings.data.export_sub')} icon={<UploadIcon className="w-5 h-5" />} onClick={handleExportBackup} />
          <ActionBtn label={t('settings.data.import_data')}   sub={t('settings.data.import_sub')}    icon={<DownloadIcon className="w-5 h-5" />} onClick={handleImportClick} />
        </div>
        {onSync && (
          <ActionBtn label="Sync to Another Device" sub="QR · WiFi · File" icon={<SyncIcon className="w-5 h-5" />} onClick={onSync} />
        )}

        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('settings.data.security_title')}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.data.security_current')}
          </p>
          <div className="space-y-2 pt-1">
            {['exports', 'sync', 'recommendation'].map((item) => (
              <div key={item} className="flex gap-2 items-start">
                <span className="text-xs leading-6" style={{ color: 'var(--accent)' }}>•</span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`settings.data.security_${item}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".atbak,.json,application/json" className="hidden" onChange={handleImport} />

        {statusMsg && (
          <p className="text-center text-xs py-2 font-bold" style={{ color: statusMsg.includes('fail') || statusMsg.includes('No') || statusMsg.includes('mislyk') || statusMsg.includes('Ingen') ? '#ef4444' : '#4ade80' }}>
            {statusMsg}
          </p>
        )}

        {/* Danger Zone */}
        <div className="border-t mt-2 pt-5 space-y-3" style={{ borderColor: 'rgba(185,28,28,0.3)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">{t('settings.data.danger_zone')}</p>

          {showClearConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
              <p className="text-red-400 text-sm font-bold">{t('settings.data.clear_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleClearAllData} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">
                  {t('settings.data.clear_yes')}
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-xl font-bold text-xs" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.clear_btn')} icon={<TrashIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowClearConfirm(true)} />
          )}
        </div>
      </Section>}

      {/* ── MEDICATIONS ── */}
      {show('medications') && <MedicationSection flash={flash} notificationPermission={notificationPermission} onRequestNotificationPermission={onRequestNotificationPermission} settings={settings} onUpdate={onUpdate} />}

      {/* ── REPORTS & NEUROLOGIST ── */}
      {show('clinician') && <Section title={t('settings.reports.section')}>
        <p className="text-[11px] text-[var(--text-dim)] -mt-2">{t('settings.reports.section_desc')}</p>
        <TextField label={t('settings.reports.neuro_name')} value={settings.neurologistName} onChange={v => onUpdate('neurologistName', v)} placeholder={t('settings.reports.neuro_name_placeholder')} />
        <TextField label={t('settings.reports.institution')} value={settings.neurologistInstitution} onChange={v => onUpdate('neurologistInstitution', v)} placeholder={t('settings.reports.institution_placeholder')} />
        <TextField label={t('settings.reports.contact')} value={settings.neurologistContact} onChange={v => onUpdate('neurologistContact', v)} placeholder={t('settings.reports.contact_placeholder')} />
        <Row label={t('settings.reports.include_dob')} help={t('settings.reports.include_dob_help')}>
          <Toggle value={settings.includePatientDOB !== false} onChange={v => onUpdate('includePatientDOB', v)} label={t('settings.reports.include_dob')} />
        </Row>
        <div>
          <FieldLabel>{t('settings.reports.additional_notes')}</FieldLabel>
          <textarea
            value={settings.reportNotes || ''}
            onChange={e => onUpdate('reportNotes', e.target.value)}
            placeholder={t('settings.reports.notes_placeholder')}
            rows={4}
            className="w-full rounded-[1.5rem] px-5 py-4 text-sm outline-none resize-none transition-all"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </Section>}

      {/* ── ABOUT (shown in Data tab) ── */}
      {show('data') && <Section title={t('settings.about_section.section')}>
        <Row label={t('settings.about_section.version')}><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrack v{pkg.version}</p></Row>
        <Row label={t('settings.about_section.schema')}><p className="text-sm font-bold text-[var(--text-primary)]">{db.name} v{db.verno}</p></Row>
        {pwa?.canInstallManually && (
          <div>
            <ActionBtn
              label={t('settings.about_section.reinstall')}
              sub={t('settings.about_section.reinstall_sub')}
              icon={<InstallIcon className="w-5 h-5" />}
              onClick={pwa.resetDismissal}
            />
          </div>
        )}
        <div className="pt-1">
          {showResetConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)' }}>
              <p className="text-red-400 text-sm font-bold">{t('settings.data.reset_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleResetSettings} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">
                  {t('settings.data.reset_yes')}
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-xl font-bold text-xs" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.reset_btn')} icon={<ResetIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowResetConfirm(true)} />
          )}
        </div>
      </Section>}

      {backupModal.mode === 'export' && (
        <BackupTransferModal
          key="settings-backup-export"
          isOpen
          mode="export"
          settings={settings}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onExportSuccess={handleEncryptedExportSuccess}
        />
      )}

      {backupModal.mode === 'import' && (
        <BackupTransferModal
          key={`settings-backup-import-${backupModal.fileName}`}
          isOpen
          mode="import"
          fileName={backupModal.fileName}
          fileText={backupModal.fileText}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onImportSuccess={handleEncryptedImportSuccess}
        />
      )}

    </div>
  );
}
