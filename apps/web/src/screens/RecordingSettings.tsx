import { Button, Checkbox, Section, Select, Stack, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nb: 'Norsk bokmål',
  nn: 'Norsk nynorsk',
  da: 'Dansk',
  sv: 'Svenska',
  fi: 'Suomi',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

/** The settings for recording (F-604), shown on Home until the settings screen arrives in a later milestone. */
export function RecordingSettings() {
  const { t, settings, actions, recording, language } = useApp();
  const set = actions.setSetting;
  const [notes, setNotes] = useState(settings.quickNoteLabels.join(', '));
  const parsed = notes
    .split(',')
    .map((x) => x.trim().slice(0, 24).trim())
    .filter((x) => x !== '')
    .slice(0, 8);
  return (
    <Section title={t('settings.title')}>
      <Stack>
        <Checkbox
          checked={settings.recordedBy === 'self'}
          onChange={(on) => void set('recordedBy', on ? 'self' : 'carer')}
          label={t('settings.self')}
          help={t('settings.selfHelp')}
        />
        <Checkbox
          checked={settings.symptomStrip}
          onChange={(on) => void set('symptomStrip', on)}
          label={t('settings.strip')}
          help={t('settings.stripHelp')}
        />
        <Checkbox checked={settings.wakeLock} onChange={(on) => void set('wakeLock', on)} label={t('settings.wake')} />
        <Checkbox
          checked={settings.recordingHaptics}
          onChange={(on) => void set('recordingHaptics', on)}
          label={t('settings.haptics')}
          {...(recording.vibration === 'unsupported' ? { help: t('settings.hapticsNone') } : {})}
        />
        <Checkbox
          checked={settings.alertSound}
          onChange={(on) => void set('alertSound', on)}
          label={t('settings.sound')}
          help={t('settings.soundHelp')}
        />
        <Checkbox
          checked={settings.lockedStart}
          onChange={(on) => void set('lockedStart', on)}
          label={t('settings.lockedStart')}
        />
        <Checkbox
          checked={settings.lockedShowName}
          onChange={(on) => void set('lockedShowName', on)}
          label={t('settings.lockedName')}
        />
        <TextField
          label={t('settings.quickNotes')}
          help={t('settings.quickNotesHelp')}
          value={notes}
          onChange={setNotes}
        />
        <Button
          disabled={JSON.stringify(parsed) === JSON.stringify(settings.quickNoteLabels)}
          onClick={() => void set('quickNoteLabels', parsed)}
        >
          {t('common.save')}
        </Button>
        <Select
          label={t('settings.language')}
          value={language}
          onChange={(value) => {
            const next = Object.keys(LANGUAGE_NAMES).find((l) => l === value);
            if (next) void set('language', next as typeof settings.language);
          }}
          options={Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label }))}
        />
      </Stack>
    </Section>
  );
}
