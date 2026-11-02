import { localDateKey } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, FieldRow, NumberField, Stack, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import './screens.css';

// Log Past Seizure (F-102): when it began, how long it lasted in all, and optionally the aura and the recovery. The seizure
// itself is what is left of the total, so the phases always add up. Every time is saved as "entered later".

const pad = (n: number) => String(n).padStart(2, '0');
/** 'YYYY-MM-DDTHH:mm' of a local time, the format the date-and-time field uses. */
const localInput = (at: number): string => {
  const d = new Date(at);
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function LogPast({ onClose, initial }: { onClose: () => void; initial: number }) {
  const { t, actions, busy } = useApp();
  const toast = useToast();
  const [when, setWhen] = useState(() => localInput(initial));
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [aura, setAura] = useState(0);
  const [recovery, setRecovery] = useState(0);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    const start = new Date(when).getTime(); // a date-and-time field is local time
    const result = await actions.logPast({
      start: Number.isNaN(start) ? Number.POSITIVE_INFINITY : start,
      totalSec: minutes * 60 + seconds,
      auraSec: aura,
      recoverySec: recovery * 60,
    });
    if (result === 'saved') {
      toast(t('past.saved'), 'success');
      return onClose();
    }
    setError(result === 'zero' ? t('past.zero') : result === 'future' ? t('past.future') : t('past.sumError'));
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
        <DateTimeField type="datetime-local" label={t('past.when')} value={when} onChange={setWhen} />
        <p className="app-banner">{t('past.total')}</p>
        <FieldRow min="7rem">
          <NumberField label={t('past.minutes')} value={minutes} onChange={setMinutes} maxLength={3} />
          <NumberField label={t('past.seconds')} value={seconds} onChange={setSeconds} max={59} maxLength={2} />
        </FieldRow>
        <p className="app-banner">{t('past.phases')}</p>
        <FieldRow min="7rem">
          <NumberField label={t('times.aura')} value={aura} onChange={setAura} maxLength={4} />
          <NumberField label={t('times.recovery')} value={recovery} onChange={setRecovery} maxLength={3} />
        </FieldRow>
        {error ? (
          <p className="ui-error" role="alert">
            {error}
          </p>
        ) : null}
      </Stack>
    </BottomSheet>
  );
}
