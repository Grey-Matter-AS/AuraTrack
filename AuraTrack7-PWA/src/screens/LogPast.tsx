import { localDateKey } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, DurationField, Stack, formatHms, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import './screens.css';

// Log Past Seizure (F-102): when it began, then the four phases in the order they happen: warning signs beforehand
// (prodrome), aura, seizure, recovery. The seizure length is the aura and the seizure together, as neurologists time it;
// warning signs and recovery are never part of it. Every time is saved as "entered later".

const pad = (n: number) => String(n).padStart(2, '0');
/** 'YYYY-MM-DDTHH:mm:ss' of a local time, the format the date-and-time field uses (seizure times keep their seconds). */
const localInput = (at: number): string => {
  const d = new Date(at);
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function LogPast({ onClose, initial }: { onClose: () => void; initial: number }) {
  const { t, actions, busy } = useApp();
  const toast = useToast();
  const [when, setWhen] = useState(() => localInput(initial));
  const [prodrome, setProdrome] = useState<number | null>(null);
  const [aura, setAura] = useState<number | null>(null);
  const [seizure, setSeizure] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  const length = (aura ?? 0) + (seizure ?? 0);

  const save = async () => {
    if (seizure === null) return setError(t('past.seizureNeeded'));
    const start = new Date(when).getTime(); // a date-and-time field is local time
    const result = await actions.logPast({
      start: Number.isNaN(start) ? Number.POSITIVE_INFINITY : start,
      prodromeSec: prodrome,
      auraSec: aura,
      seizureSec: seizure,
      recoverySec: recovery,
    });
    if (result === 'saved') {
      toast(t('past.saved'), 'success');
      return onClose();
    }
    setError(result === 'zero' ? t('past.zero') : t('past.future'));
  };

  return (
    <BottomSheet
      title={t('past.title')}
      onClose={onClose}
      footer={
        <Button variant="primary" fullWidth disabled={busy} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <DateTimeField
          type="datetime-local"
          label={t('past.when')}
          help={t('past.whenHelp')}
          value={when}
          onChange={setWhen}
        />
        <DurationField label={t('dur.prodrome')} help={t('dur.prodromeHelp')} value={prodrome} onChange={setProdrome} />
        <DurationField label={t('dur.aura')} help={t('dur.auraHelp')} value={aura} onChange={setAura} />
        <DurationField
          label={t('dur.seizure')}
          help={t('dur.seizureHelp')}
          required
          value={seizure}
          onChange={(v) => {
            setSeizure(v);
            setError(undefined);
          }}
        />
        <DurationField label={t('dur.recovery')} value={recovery} onChange={setRecovery} />
        <p className="app-banner" aria-live="polite">
          {seizure === null && aura === null ? t('dur.lengthNone') : t('dur.length', { length: formatHms(length) })}
        </p>
        {error ? (
          <p className="ui-error" role="alert">
            {error}
          </p>
        ) : null}
      </Stack>
    </BottomSheet>
  );
}
