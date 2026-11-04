// DEVELOPER PAGE, recording check (M3, slice 5). Not a real screen: it lets the recording engine and Start from the PIN
// screen be tried on a real phone before the real screens exist. Lock the store, tap Start, tap the buttons, unlock with the
// PIN, and the recording is in the list below. Everything stays on this device.
import { clusterWarningAtStart, emergencyPlan, newId, type RecordingEvent } from '@auratrack/model';
import type { LockedStatus, StoreApi } from '@auratrack/store';
import type { Client } from '@auratrack/store/rpc';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  RecordingController,
  browserRecordingEnv,
  defaultRecordingSettings,
  type RecordingTransport,
} from '../recording/controller';

type Api = Client<StoreApi>;

const box = 'rounded-lg border border-white/15 p-3 mb-4';
const button = 'rounded-md border border-white/30 px-3 py-1.5 text-sm mr-2 mb-2 disabled:opacity-40';

/** Unlocked: the store saves each tap. Locked: the tap is posted to the drop box with the public key. */
const transportFor = (client: Api, unlocked: boolean): RecordingTransport => ({
  send: (seizureId, event: RecordingEvent) =>
    unlocked ? client.recordingEvent({ seizureId, event }) : client.lockedPost({ event }),
});

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function RecordingCheck({
  client,
  exists,
  unlocked,
  onChange,
}: {
  client: Api;
  exists: boolean;
  unlocked: boolean;
  onChange: () => unknown;
}) {
  const [controller] = useState(
    () => new RecordingController(transportFor(client, unlocked), browserRecordingEnv(), defaultRecordingSettings()),
  );
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [locked, setLocked] = useState<LockedStatus | null>(null);
  const [now, setNow] = useState(0);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [report, setReport] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refreshLocked = async () => setLocked(exists ? await client.lockedStatus() : null);

  useEffect(() => {
    controller.setTransport(transportFor(client, unlocked));
    void (async () => {
      try {
        const status = exists ? await client.lockedStatus() : null;
        setLocked(status);
        setNow(Date.now());
        controller.setSettings({
          ...defaultRecordingSettings(),
          plan: emergencyPlan(status?.screen.plan ?? {}),
        });
        if (controller.getSnapshot().session?.status === 'running') return;
        if (unlocked) {
          const found = await client.recordingRecover();
          setReport(JSON.stringify(await client.dropBoxReport()));
          const first = found.running[0];
          if (first) controller.adopt(first);
          if (found.autoStopped.length > 0)
            setNotice(
              `${found.autoStopped.length} recording(s) had run past 12 minutes and were stopped. The seizure end is unknown.`,
            );
        } else if (status?.session?.status === 'running') controller.adopt(status.session);
      } catch (e) {
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      }
    })();
  }, [client, controller, exists, unlocked]);

  // The count of entries waiting in the drop box follows each save
  const saved = snap.save === 'saved' ? (snap.session?.seen.length ?? 0) : -1;
  useEffect(() => {
    if (saved < 0 || !exists) return;
    void client.lockedStatus().then(setLocked);
    if (unlocked) onChange(); // the list of seizures follows the saves
  }, [client, exists, saved, unlocked, onChange]);

  const available = unlocked || locked?.available === true;
  const patientId = locked?.screen.patientId ?? null;
  const cluster = clusterWarningAtStart(locked?.recentStarts ?? [], now, emergencyPlan(locked?.screen.plan ?? {}));
  const session = snap.session;
  const running = session?.status === 'running';

  const addPatient = async () => {
    const id = newId();
    await client.createRecord({
      type: 'patient',
      values: {
        id,
        patientId: id,
        name: 'Test patient',
        dateOfBirth: null,
        emergencyContact: 'Test contact 555 0100',
        color: '#336699',
      },
    });
    onChange();
    await refreshLocked();
  };

  const start = () => {
    if (!patientId) return;
    const t0 = performance.now();
    controller.start({ patientId, recordedBy: 'carer', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    requestAnimationFrame(() => setStartMs(Math.round(performance.now() - t0)));
  };

  if (!exists) return null;
  return (
    <section className={box} data-testid="recording-check">
      <h2 className="mb-2 font-bold">Recording check (slice 5)</h2>
      {error && (
        <p role="alert" data-testid="recording-error">
          {error}
        </p>
      )}
      {unlocked && !patientId && (
        <button className={button} onClick={() => void addPatient()}>
          Add a test patient
        </button>
      )}
      {unlocked && patientId && (
        <button className={button} onClick={() => void client.refreshLockedScreen({}).then(refreshLocked)}>
          Refresh what the PIN screen shows
        </button>
      )}
      <p className="mb-2" data-testid="pin-screen">
        PIN screen: {locked?.available ? 'Start is available' : 'Start is not available'}
        {locked?.screen.card
          ? ` · card: ${locked.screen.card.contact ?? 'no contact'}${locked.screen.card.rescue.map((m) => `, ${m.name}`).join('')}`
          : ' · no card'}
        {locked?.screen.patientName ? ` · patient: ${locked.screen.patientName}` : ''} · {locked?.waiting ?? 0} entries
        waiting
      </p>
      {cluster.warn && (
        <p role="alert" data-testid="cluster-warning">
          Another seizure just before this one: {cluster.count} within {locked?.screen.plan.clusterWindowMinutes} min.
        </p>
      )}
      {!running && (
        <button className={button} disabled={!available || !patientId} onClick={start}>
          {unlocked ? 'Start recording' : 'Start (without the PIN)'}
        </button>
      )}
      {running && session && (
        <>
          <p className="my-2 text-4xl font-black" data-testid="recording-clock">
            {clock(snap.view?.elapsedSec ?? 0)}
          </p>
          <p data-testid="recording-stage">
            {snap.view?.stage} · {snap.view?.alert} · {unlocked ? 'unlocked' : 'locked'}
          </p>
          <div className="my-2">
            <button
              className={button}
              disabled={session.auraEnd !== null || session.seizureEnd !== null}
              onClick={() => controller.tap('end_aura')}
            >
              End aura
            </button>
            <button
              className={button}
              disabled={session.seizureEnd !== null}
              onClick={() => controller.tap('end_seizure')}
            >
              End seizure
            </button>
            <button className={button} onClick={() => controller.tap('back_to_normal')}>
              Back to normal
            </button>
            <button className={button} onClick={() => controller.quickNote('Calm')}>
              Note: Calm
            </button>
          </div>
        </>
      )}
      {session && !running && (
        <p data-testid="recording-done">
          Recording {session.status}
          {session.autoStopped ? ': the timer stopped itself at 12 minutes; the seizure end is unknown' : ''}.{' '}
          <button
            className={button}
            onClick={() => {
              void controller.settled().then(refreshLocked);
              window.location.reload();
            }}
          >
            New recording
          </button>
        </p>
      )}
      <p data-testid="recording-state">
        Saving: {snap.save} · wake lock: {snap.wakeLock} · vibration: {snap.vibration}
        {startMs !== null ? ` · Start reacted in ${startMs} ms` : ''}
      </p>
      {startMs !== null && <p data-testid="start-ms">{startMs}</p>}
      {notice && <p data-testid="recovery-notice">{notice}</p>}
      {report && <p data-testid="dropbox-report">Drop box at unlock: {report}</p>}
    </section>
  );
}
