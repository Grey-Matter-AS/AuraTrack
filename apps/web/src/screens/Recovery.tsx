import { lastActivityAt, localDateKey, type RecordingSession } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, Dialog, Stack } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';

// A recording the app lost (F-212): it was closed or crashed while recording. "Still happening" carries on with the same
// clock; "It ended" asks when, offering the last tap, and saves that time as entered later (decision 2). One that ran past
// 12 minutes is not asked: the timer stopped itself, the end is not known, and it can be added in the seizure details.

const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (at: number): string => {
  const d = new Date(at);
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function Recovery() {
  const { recovery, t, fmt, busy } = useApp();
  const [stoppedSeen, setStoppedSeen] = useState(false);
  const open = recovery.running[0];
  if (open) return <Question key={open.seizureId} session={open} />;
  if (recovery.autoStopped.length > 0 && !stoppedSeen)
    return (
      <Dialog
        tone="emergency"
        title={t('recover.stoppedTitle')}
        dismissible={false}
        message={t('recover.stoppedMessage')}
        actions={
          <Button variant="primary" fullWidth disabled={busy} onClick={() => setStoppedSeen(true)}>
            {t('common.dismiss')}
          </Button>
        }
      >
        <p>{t('home.badgeStopped')}</p>
        <p className="app-note">{recovery.autoStopped.map((s) => fmt.time(s.start)).join(', ')}</p>
      </Dialog>
    );
  return null;
}

function Question({ session }: { session: RecordingSession }) {
  const { t, fmt, actions, busy } = useApp();
  const [asking, setAsking] = useState(false);
  const [when, setWhen] = useState(() => localInput(lastActivityAt(session)));
  const at = new Date(when).getTime();
  // The field shows whole minutes, so a time in the minute of Start is fine (the engine never puts a mark before Start)
  const bad = Number.isNaN(at) || at < session.start - (session.start % 60_000);
  if (!asking)
    return (
      <Dialog
        title={t('recover.title')}
        dismissible={false}
        message={t('recover.message', { time: fmt.time(session.start) })}
        actions={
          <>
            <Button
              variant="danger"
              fullWidth
              disabled={busy}
              onClick={() => void actions.answerRecovery({ seizureId: session.seizureId, ended: false })}
            >
              {t('recover.still')}
            </Button>
            <Button fullWidth onClick={() => setAsking(true)}>
              {t('recover.ended')}
            </Button>
          </>
        }
      />
    );
  return (
    <BottomSheet
      title={t('recover.when')}
      dismissible={false}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={busy || bad}
          onClick={() => void actions.answerRecovery({ seizureId: session.seizureId, ended: true, at })}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <DateTimeField
          type="datetime-local"
          label={t('recover.when')}
          value={when}
          onChange={setWhen}
          min={localInput(session.start)}
        />
      </Stack>
    </BottomSheet>
  );
}
