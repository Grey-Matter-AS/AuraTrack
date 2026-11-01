import { AUTO_STOP_AT_S, emergencyPlan, recordingState } from '@auratrack/model';
import { AppHeader, Button, ButtonRow, Card, Dialog, Screen, Section, Stack } from '@auratrack/ui';
import { useEffect, useRef, useState } from 'react';
import { FREQUENT, PATIENTS, QUICK_NOTES, RESCUE, mmss, newItemId } from './data';
import { goHome, useNav } from './nav';
import { usePrototype } from './state';

// The recording screen. It follows the settled rules: the emergency plan (alert at 5 min, warning one minute before,
// measured on seizure time), the 12-minute auto-stop, and no extra buttons beyond the phase buttons.
// The "prototype controls" at the bottom exist only so you can reach 4, 5 and 12 minutes without waiting.

export function Recording({ locked = false }: { locked?: boolean }) {
  const nav = useNav();
  const { draft, setDraft, label, selfMode, symptomStrip, patient } = usePrototype();
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
          { id: newItemId(), code, phase, area: null, gap: d.items.length === 0 ? 'unknown' : 'few' },
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
        <AppHeader title="Recording" patient={PATIENTS[patient] ?? PATIENTS[0]} />
        {locked ? (
          <Card tone="accent">
            <p className="proto-note">
              Recording while the app is locked: everything is written to a protected buffer and joins your records when
              you unlock.
            </p>
          </Card>
        ) : null}
        <p className="proto-timer" role="timer" aria-label="Time since start">
          {mmss(total / 1000)}
        </p>
        <ul className="proto-phase-times">
          {selfMode ? null : <li>Aura {mmss(aura)}</li>}
          <li>Seizure {mmss(seizure)}</li>
          {draft.seizureEnd !== null ? <li>Recovery {mmss(recovery)}</li> : null}
        </ul>

        {state === 'warning' ? (
          <Card tone="danger">
            <p className="proto-banner">One minute to the emergency alert time</p>
          </Card>
        ) : null}
        {draft.emergencyStop ? (
          <Card tone="danger">
            <p className="proto-banner">Stopped at 12 minutes. A possible status epilepticus note is saved.</p>
          </Card>
        ) : null}

        {running ? (
          selfMode ? (
            <Button variant="danger" size="lg" fullWidth onClick={() => endSeizure()}>
              Stop
            </Button>
          ) : (
            <ButtonRow stack>
              {draft.auraEnd === null ? (
                <Button variant="warning" size="lg" onClick={() => setDraft((d) => ({ ...d, auraEnd: stampNow() }))}>
                  End aura
                </Button>
              ) : null}
              <Button variant="danger" size="lg" onClick={() => endSeizure()}>
                End seizure
              </Button>
            </ButtonRow>
          )
        ) : (
          <ButtonRow stack>
            {draft.recoveryEnd === null && !selfMode ? (
              <Button variant="success" size="lg" onClick={() => setDraft((d) => ({ ...d, recoveryEnd: stampNow() }))}>
                Back to normal
              </Button>
            ) : null}
            <Button variant="primary" size="lg" onClick={finish}>
              Add details
            </Button>
          </ButtonRow>
        )}

        {symptomStrip && !selfMode ? (
          <Section title="Symptoms (one tap, timed automatically)">
            <div className="ui-cluster">
              {FREQUENT.during.slice(0, 4).map((code) => (
                <Button key={code} onClick={() => addSymptom(code)}>
                  {label(code)}
                </Button>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Quick notes">
          <div className="ui-cluster">
            {QUICK_NOTES.map((note) => (
              <Button key={note} onClick={() => addNote(note)}>
                {note}
              </Button>
            ))}
          </div>
          {draft.quickNotes.length > 0 ? (
            <ul className="proto-note" aria-label="Notes so far">
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
          tone="danger"
          title={selfMode ? 'This seizure has lasted 5 minutes' : '5 minutes: follow the emergency plan'}
          dismissible={false}
          message={
            selfMode
              ? 'If someone is with you, show them this screen.'
              : 'Seizure time, not counting aura or recovery. Call for help if the plan says so.'
          }
          actions={
            <Button variant="primary" fullWidth onClick={() => setAlertSeen(true)}>
              Dismiss
            </Button>
          }
        >
          <Stack>
            <p>
              <strong>Rescue medication:</strong> {RESCUE.medication}
            </p>
            <p>
              <strong>Emergency contact:</strong> {RESCUE.contact}
            </p>
            <p>
              <strong>Neurologist:</strong> {RESCUE.neurologist}
            </p>
          </Stack>
        </Dialog>
      ) : null}
      {draft.emergencyStop && !stopSeen ? (
        <Dialog
          tone="danger"
          title="Recording stopped at 12 minutes"
          dismissible={false}
          message="This is a long seizure. A note for possible status epilepticus is saved with it. Your quick notes are kept."
          actions={
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setStopSeen(true);
                finish();
              }}
            >
              Add details
            </Button>
          }
        />
      ) : null}
    </Screen>
  );
}
