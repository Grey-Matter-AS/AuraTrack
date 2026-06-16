import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WELLBEING_MOOD_OPTIONS } from '../data/constants';

const INTENSITY_OPTIONS = [
  { value: 1, label: 'Mild', labelKey: 'wellbeing.mild' },
  { value: 2, label: 'Moderate', labelKey: 'wellbeing.moderate' },
  { value: 3, label: 'Strong', labelKey: 'wellbeing.strong' },
];

function valueFromEntryFactor(factor) {
  if (factor && typeof factor === 'object' && 'value' in factor) return factor.value;
  return factor;
}

function translatedLabel(t, item, fallback = '') {
  return item?.labelKey ? t(item.labelKey, item.label || fallback) : (item?.label || fallback);
}

function translatedHelp(t, item) {
  return item?.helpKey ? t(item.helpKey, item.help || '') : (item?.help || '');
}

function translatedScaleLabels(t, definition) {
  if (Array.isArray(definition.scaleLabelKeys) && definition.scaleLabelKeys.length === 4) {
    return definition.scaleLabelKeys.map((key, index) => t(key, definition.scaleLabels?.[index] || ''));
  }
  if (Array.isArray(definition.scaleLabels) && definition.scaleLabels.length === 4) return definition.scaleLabels;
  return [
    t('wellbeing.none', 'None'),
    t('wellbeing.mild', 'Mild'),
    t('wellbeing.moderate', 'Moderate'),
    t('wellbeing.severe', 'Severe'),
  ];
}

function FactorControl({ definition, value, onChange, t }) {
  const label = translatedLabel(t, definition, definition.id);
  const help = translatedHelp(t, definition);
  if (definition.type === 'boolean') {
    return (
      <label
        className="flex items-start gap-3 rounded-2xl p-3"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        title={help}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="mt-1"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
          {help && <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</span>}
        </span>
      </label>
    );
  }

  if (definition.type === 'scale') {
    const numeric = value === undefined || value === null || value === '' ? null : Number(value);
    const scaleLabels = translatedScaleLabels(t, definition);
    return (
      <div
        className="rounded-2xl p-3 space-y-2"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        title={help}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          {help && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</p>}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {scaleLabels.map((label, scaleValue) => (
            <button
              key={scaleValue}
              type="button"
              onClick={() => onChange(scaleValue)}
              className="rounded-xl px-1 py-2 text-[10px] font-black uppercase tracking-widest"
              style={{
                backgroundColor: numeric === scaleValue ? 'var(--accent)' : 'var(--bg-card)',
                color: numeric === scaleValue ? '#fff' : 'var(--text-dim)',
                border: numeric === scaleValue ? '1px solid transparent' : '1px solid var(--border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-3 space-y-2"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
      title={help}
    >
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {help && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.25"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        {definition.unit && <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{definition.unit}</span>}
      </div>
    </div>
  );
}

export function WellbeingEntrySheet({ entry = null, factorDefinitions = [], onSave, onClose }) {
  const { t } = useTranslation();
  const [primaryMood, setPrimaryMood] = useState(entry?.primaryMood || WELLBEING_MOOD_OPTIONS[0].label);
  const [intensity, setIntensity] = useState(entry?.intensity || 1);
  const [recordedAt, setRecordedAt] = useState(() => {
    const source = entry?.recordedAt ? new Date(entry.recordedAt) : new Date();
    const offset = source.getTimezoneOffset() * 60000;
    return new Date(source.getTime() - offset).toISOString().slice(0, 16);
  });
  const [factors, setFactors] = useState(() => {
    const initial = {};
    Object.entries(entry?.factors || {}).forEach(([key, factor]) => {
      initial[key] = valueFromEntryFactor(factor);
    });
    return initial;
  });
  const [notes, setNotes] = useState(entry?.notes || '');
  const [error, setError] = useState('');

  const selectedMood = useMemo(
    () => WELLBEING_MOOD_OPTIONS.find(option => option.label === primaryMood),
    [primaryMood]
  );
  const activeDefinitions = factorDefinitions.filter(definition => definition.active !== false);

  const updateFactor = (id, value) => {
    setFactors(prev => ({ ...prev, [id]: value }));
  };

  const submit = async () => {
    try {
      setError('');
      await onSave({
        recordedAt: new Date(recordedAt).getTime(),
        primaryMood,
        intensity,
        factors,
        notes,
      }, entry?.id || null);
      onClose();
    } catch (err) {
      setError(err?.message || t('wellbeing.save_failed', 'Could not save wellbeing entry.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3">
      <div
        className="w-full max-w-md rounded-[2rem] max-h-[92dvh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        data-testid="wellbeing-entry-sheet"
      >
        <div className="p-5 pb-3 flex items-center justify-between gap-3 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {t('wellbeing.eyebrow', 'Wellbeing')}
            </p>
            <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
              {entry ? t('wellbeing.edit_entry', 'Edit wellbeing entry') : t('wellbeing.new_entry', 'Log wellbeing')}
            </h3>
          </div>
          <button onClick={onClose} className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('eeg.close', 'Close')}
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0" data-testid="wellbeing-entry-scroll">
          <input
            type="datetime-local"
            value={recordedAt}
            onChange={e => setRecordedAt(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />

          <div>
          <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>
            {t('wellbeing.mood', 'Mood')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {WELLBEING_MOOD_OPTIONS.map(option => {
              const label = translatedLabel(t, option);
              const help = translatedHelp(t, option);
              const active = primaryMood === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  title={help}
                  onClick={() => setPrimaryMood(option.label)}
                  className="rounded-xl px-3 py-2 text-xs font-black text-left"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'var(--bg-raised)',
                    color: active ? '#fff' : 'var(--text-primary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {selectedMood && translatedHelp(t, selectedMood) && (
            <p className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--text-dim)' }}>
              {translatedHelp(t, selectedMood)}
            </p>
          )}
          </div>

          <div>
          <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>
            {t('wellbeing.intensity', 'Intensity')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITY_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntensity(option.value)}
                className="rounded-xl py-2 text-[10px] font-black uppercase tracking-widest"
                style={{
                  backgroundColor: intensity === option.value ? 'var(--accent)' : 'var(--bg-raised)',
                  color: intensity === option.value ? '#fff' : 'var(--text-dim)',
                  border: intensity === option.value ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {t(option.labelKey, option.label)}
              </button>
            ))}
          </div>
          </div>

          <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('wellbeing.context', 'Context')}
          </p>
          {activeDefinitions.map(definition => (
            <FactorControl
              key={definition.id}
              definition={definition}
              value={factors[definition.id]}
              onChange={value => updateFactor(definition.id, value)}
              t={t}
            />
          ))}
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('wellbeing.notes_placeholder', 'Notes (optional)')}
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {error && <p className="mx-5 mt-3 text-xs font-bold text-red-400">{error}</p>}

        <div className="p-5 pt-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={submit}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {t('wellbeing.save', 'Save')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {t('eeg.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
