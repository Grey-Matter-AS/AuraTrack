import { AUTO_STOP_AT_S, emergencyPlan, recordingState } from '@auratrack/model';
import { AppHeader, Button, ButtonRow, Card, Dialog, Screen, Section, Stack } from '@auratrack/ui';
import { useEffect, useRef, useState } from 'react';
import { FREQUENT, PATIENTS, QUICK_NOTE_KEYS, RESCUE, mmss, newItemId, startingArea } from './data';
import { goHome, useNav } from './nav';
import { usePrototype } from './state';

// The recording screen. It follows the settled rules: the emergency plan (alert at 5 min, warning one minute before,
// measured on seizure time), the 12-minute auto-stop, and no extra buttons beyond the phase buttons.
// The "prototype controls" at the bottom exist only so you can reach 4, 5 and 12 minutes without waiting.

export function Recording({ locked = false }: { locked?: boolean }) {
  const nav = useNav();
  const { draft, setDraft, label, t, selfMode, symptomStrip, patient } = usePrototype();
  const [wall, setWall] = useState(() => Date.now());
  const [skip, setSkip] = useState(0); // seconds added by the prototype controls
  const [alertSeen, setAlertSeen] = useState(false);
  const [stopSeen, setStopSeen] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setWall(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const now = wall + skip * 1000; // the clock is read every quarter second
  const plan = emergencyPlan();
  const total = (draft.recoveryEnd ?? draft.seizureEnd ?? now) - draft.start;
  // Until the aura is ended, the time counts as seizure time: the safe way round for the alert
  const seizureSec = ((draft.seizureEnd ?? now) - (draft.auraEnd ?? draft.start)) / 1000;
  const state = draft.seizureEnd === null ? recordingState(seizureSec, plan) : 'recording';
  const running = draft.seizureEnd === null;

  const stampNow = () => Date.now() + skip * 1000;
  const endSeizure = (at = stampNow(), emergency = false) =>
    setDraft((d) => ({ ...d, auraEnd: d.auraEnd ?? d.start, seizureEnd: at, emergencyStop: emergency }));

  // 12 minutes: the recording ends by itself, once
  useEffect(() => {
    if (state === 'auto_stop' && !stopped.current) {
      stopped.current = true;
      endSeizure(draft.start + AUTO_STOP_AT_S * 1000, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the state changes to auto_stop
  }, [state]);

  const addNote = (text: string) =>
    setDraft((d) => ({
      ...d,
      quickNotes: [...d.quickNotes, `[T+${Math.round((stampNow() - d.start) / 1000)}s] ${text}`],
    }));
  const addSymptom = (code: string) =>
    setDraft((d) => {
      const phase = d.seizureEnd ? 'after' : 'during';
      const at = Math.round((stampNow() - d.start) / 1000);
      return {
        ...d,
        items: [
          ...d.items,
          { id: newItemId(), code, phase, area: startingArea(code), gap: d.items.length === 0 ? 'unknown' : 'few' },
        ],
        quickNotes: [...d.quickNotes, `[T+${at}s] ${label(code)}`],
      };
    });
  const finish = () => {
    setDraft((d) => ({ ...d, recoveryEnd: d.recoveryEnd ?? stampNow() }));
    nav.replace('editor');
  };

  const aura = draft.auraEnd !== null ? (draft.auraEnd - draft.start) / 1000 : 0;
  const seizure = Math.max(0, seizureSec);
  const recovery = draft.seizureEnd !== null ? ((draft.recoveryEnd ?? now) - draft.seizureEnd) / 1000 : 0;

  return (
    <Screen>
      <Stack>
        <AppHeader title={t('rec.title')} patient={PATIENTS[patient] ?? PATIENTS[0]} />
        {locked ? (
          <Card tone="accent">
            <p className="proto-note">{t('rec.lockedNote')}</p>
          </Card>
        ) : null}
        <p className="proto-timer" role="timer" aria-label={t('rec.timeSince')}>
          {mmss(total / 1000)}
        </p>
        <ul className="proto-phase-times">
          {selfMode ? null : (
            <li>
              {t('rec.aura')} {mmss(aura)}
            </li>
          )}
          <li>
            {t('rec.seizure')} {mmss(seizure)}
          </li>
          {draft.seizureEnd !== null ? (
            <li>
              {t('rec.recovery')} {mmss(recovery)}
            </li>
          ) : null}
        </ul>

        {state === 'warning' ? (
          <Card tone="danger">
            <p className="proto-banner">{t('rec.warning')}</p>
          </Card>
        ) : null}
        {draft.emergencyStop ? (
          <Card tone="danger">
            <p className="proto-banner">{t('rec.stoppedNote')}</p>
          </Card>
        ) : null}

        {running ? (
          selfMode ? (
            <Button variant="danger" size="lg" fullWidth onClick={() => endSeizure()}>
              {t('rec.stop')}
            </Button>
          ) : (
            <ButtonRow stack>
              {draft.auraEnd === null ? (
                <Button variant="warning" size="lg" onClick={() => setDraft((d) => ({ ...d, auraEnd: stampNow() }))}>
                  {t('rec.endAura')}
                </Button>
              ) : null}
              <Button variant="danger" size="lg" onClick={() => endSeizure()}>
                {t('rec.endSeizure')}
              </Button>
            </ButtonRow>
          )
        ) : (
          <ButtonRow stack>
            {draft.recoveryEnd === null && !selfMode ? (
              <Button variant="success" size="lg" onClick={() => setDraft((d) => ({ ...d, recoveryEnd: stampNow() }))}>
                {t('rec.backToNormal')}
              </Button>
            ) : null}
            <Button variant="primary" size="lg" onClick={finish}>
              {t('rec.addDetails')}
            </Button>
          </ButtonRow>
        )}

        {symptomStrip && !selfMode ? (
          <Section title={t('rec.symptomStrip')}>
            <div className="ui-cluster">
              {FREQUENT.during.slice(0, 4).map((code) => (
                <Button key={code} onClick={() => addSymptom(code)}>
                  {label(code)}
                </Button>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title={t('rec.quickNotes')}>
          <div className="ui-cluster">
            {QUICK_NOTE_KEYS.map((key) => (
              <Button key={key} onClick={() => addNote(t(key))}>
                {t(key)}
              </Button>
            ))}
          </div>
          {draft.quickNotes.length > 0 ? (
            <ul className="proto-note" aria-label={t('rec.notesSoFar')}>
              {draft.quickNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Prototype controls (not part of the app)">
          <Stack>
            <p className="proto-note">
              Skips ahead so you can see the warning, the alert and the auto-stop without waiting.
            </p>
            <div className="ui-cluster">
              <Button onClick={() => setSkip((s) => s + 30)}>+30 s</Button>
              <Button onClick={() => setSkip(Math.max(0, 230 - (now - draft.start) / 1000 + skip))}>To 3:50</Button>
              <Button onClick={() => setSkip(Math.max(0, 290 - (now - draft.start) / 1000 + skip))}>To 4:50</Button>
              <Button onClick={() => setSkip(Math.max(0, 710 - (now - draft.start) / 1000 + skip))}>To 11:50</Button>
            </div>
            <Button variant="ghost" onClick={() => goHome(nav)}>
              Cancel recording
            </Button>
          </Stack>
        </Section>
      </Stack>

      {state === 'alert' && !alertSeen ? (
        <Dialog
          tone="emergency"
          title={t(selfMode ? 'alert.selfTitle' : 'alert.carerTitle', { minutes: plan.alertMinutes })}
          dismissible={false}
          message={t(selfMode ? 'alert.selfMessage' : 'alert.carerMessage')}
          actions={
            <Button variant="primary" fullWidth onClick={() => setAlertSeen(true)}>
              {t('common.dismiss')}
            </Button>
          }
        >
          <Stack>
            <p>
              <strong>{t('alert.rescue')}:</strong> {RESCUE.medication}
            </p>
            <p>
              <strong>{t('alert.contact')}:</strong> {RESCUE.contact}
            </p>
            <p>
              <strong>{t('alert.neurologist')}:</strong> {RESCUE.neurologist}
            </p>
          </Stack>
        </Dialog>
      ) : null}
      {draft.emergencyStop && !stopSeen ? (
        <Dialog
          tone="emergency"
          title={t('stop.title')}
          dismissible={false}
          message={t('stop.message')}
          actions={
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setStopSeen(true);
                finish();
              }}
            >
              {t('rec.addDetails')}
            </Button>
          }
        />
      ) : null}
    </Screen>
  );
}
