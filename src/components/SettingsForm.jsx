import React, { useState, useEffect, useRef } from 'react';
import { db } from '../data/db';
import { exportToJSON } from '../utils/exportHelpers';

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

function Toggle({ value, onChange }) {
  return (
    <button
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

// ─── Main component ───────────────────────────────────────────

export function SettingsForm({ settings, onUpdate, onReset, pwa }) {
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
    const events = await db.events.toArray();
    if (!events.length) { flash('No events to export.'); return; }
    exportToJSON(events);
    flash(`Exported ${events.length} event(s).`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const events = Array.isArray(parsed) ? parsed : (parsed.events || []);
      if (!events.length) { flash('No events found in file.'); return; }
      const toImport = events.map(({ id, ...rest }) => rest);
      await db.events.bulkAdd(toImport);
      flash(`Imported ${toImport.length} event(s) successfully.`);
    } catch {
      flash('Import failed — invalid or corrupted file.');
    }
    e.target.value = '';
  };

  const handleClearAllData = async () => {
    await db.events.clear();
    setShowClearConfirm(false);
    flash('All event data deleted.');
  };

  const handleResetSettings = async () => {
    await onReset?.();
    setShowResetConfirm(false);
    flash('Settings reset to defaults.');
  };

  const noteLabel = settings.userMode === 'CARETAKER' ? 'Person / Patient Name' : 'Your Name';

  return (
    <div className="space-y-4 w-full pb-10">

      {/* ── IDENTITY ── */}
      <Section title="Identity">
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
      </Section>

      {/* ── APPEARANCE ── */}
      <Section title="Appearance">
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
      </Section>

      {/* ── DISPLAY ── */}
      <Section title="Display">
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
      </Section>

      {/* ── RECORDING ── */}
      <Section title="Recording">
        <Row label="Haptic Feedback" help="Vibration on button presses (device must support it)">
          <Toggle value={settings.hapticFeedback} onChange={v => onUpdate('hapticFeedback', v)} />
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
      </Section>

      {/* ── DATA & BACKUP ── */}
      <Section title="Data &amp; Backup">
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
      </Section>

      {/* ── REPORTS & NEUROLOGIST ── */}
      <Section title="Reports &amp; Neurologist">
        <p className="text-[11px] text-[var(--text-dim)] -mt-2">Information used to generate clinical neurologist reports.</p>
        <TextField label="Neurologist / Clinician Name" value={settings.neurologistName} onChange={v => onUpdate('neurologistName', v)} placeholder="Dr. Name" />
        <TextField label="Institution / Hospital" value={settings.neurologistInstitution} onChange={v => onUpdate('neurologistInstitution', v)} placeholder="Clinic or hospital name" />
        <TextField label="Clinician Contact" value={settings.neurologistContact} onChange={v => onUpdate('neurologistContact', v)} placeholder="Phone, email, or referral number" />
        <Row label="Include Date of Birth" help="Whether DOB appears in printed reports">
          <Toggle value={settings.includePatientDOB !== false} onChange={v => onUpdate('includePatientDOB', v)} />
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
      </Section>

      {/* ── ABOUT ── */}
      <Section title="About">
        <Row label="App Version"><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrack v0.1.0</p></Row>
        <Row label="Database Schema"><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrackDB v4</p></Row>
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
      </Section>

    </div>
  );
}
