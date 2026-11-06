// DEVELOPER PAGE (M1). Not a real screen: it exists to check the data core with real data on the real device.
// Open it at /#/dev. It lists what is in the store, adds made-up records to check with, and makes and restores backups. Everything runs on this device; nothing is sent anywhere.
import { localDateKey, newId, seizureLengthSeconds, type Seizure } from '@auratrack/model';
import type { RestoreReport, StoreApi, StoreStatus } from '@auratrack/store';
import { connect, type PortLike } from '@auratrack/store/rpc';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RecordingCheck from './RecordingCheck';

const pad = (n: number) => String(n).padStart(2, '0');
const when = (ms: number) => {
  const d = new Date(ms);
  return `${localDateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const read = (file: File) => file.text();

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const box = 'rounded-lg border border-white/15 p-3 mb-4';
const button = 'rounded-md border border-white/30 px-3 py-1.5 text-sm mr-2 disabled:opacity-40';
const input = 'rounded-md border border-white/30 bg-transparent px-2 py-1.5 text-sm mr-2';

export default function DevPage() {
  const client = useMemo(() => {
    const worker = new Worker(new URL('../store.worker.ts', import.meta.url), { type: 'module' });
    return connect<StoreApi>(worker as unknown as PortLike, { waitForReady: true });
  }, []);
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [seizures, setSeizures] = useState<Seizure[]>([]);
  const [pin, setPin] = useState('');
  const [backupPass, setBackupPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState<RestoreReport | null>(null);
  const [kit, setKit] = useState<{ kit: string; qrSvg: string } | null>(null);
  const [pinMs, setPinMs] = useState<number | null>(null);
  const [sampleName, setSampleName] = useState('Test person');

  const refresh = useCallback(async () => {
    const next = await client.status();
    setStatus(next);
    if (next.unlocked) {
      setCounts((await client.counts()) as Record<string, number>);
      const list = (await client.list({ type: 'seizure' })) as unknown as Seizure[];
      setSeizures([...list].sort((a, b) => b.phases.start.at - a.phases.start.at));
    } else {
      setCounts({});
      setSeizures([]);
    }
  }, [client]);

  useEffect(() => {
    // Asked after this effect has run, so the first answer arrives as an event, not as a state change inside the effect
    void Promise.resolve()
      .then(refresh)
      .catch((e: unknown) => setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    // The client is not closed here: React's development mode runs this effect twice, and a closed client never hears back
  }, [refresh]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  };

  const unlocked = status?.unlocked === true;

  return (
    <main className="mx-auto max-w-4xl p-4 text-sm" data-testid="dev-page">
      <h1 className="mb-1 text-xs font-black uppercase tracking-[0.4em]">AuraTrack — developer page</h1>
      <p className="mb-4" style={{ color: 'var(--text-dim)' }}>
        Data core check (M1). Everything stays on this device.
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-400 p-2" data-testid="error">
          {error}
        </p>
      )}

      <section className={box}>
        <h2 className="mb-2 font-bold">Lock</h2>
        <p className="mb-2" data-testid="status">
          {status === null ? 'Loading…' : !status.exists ? 'No store yet' : unlocked ? 'Unlocked' : 'Locked'}
        </p>
        {pinMs !== null && (
          <p className="mb-2" data-testid="pin-time">
            PIN key took {pinMs} ms (creating a store derives the key twice; the first unlock of an older store three
            times)
          </p>
        )}
        {!unlocked && (
          <>
            <input
              className={input}
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              aria-label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button
              className={button}
              disabled={busy || pin.length < 4}
              onClick={() =>
                run(async () => {
                  const started = performance.now();
                  await (status?.exists
                    ? client.unlock({ credential: { pin } })
                    : client.create({ credential: { pin } }));
                  setPinMs(Math.round(performance.now() - started));
                })
              }
            >
              {status?.exists ? 'Unlock' : 'Create store'}
            </button>
          </>
        )}
        {unlocked && (
          <button
            className={button}
            onClick={() =>
              run(async () => {
                await client.lock();
                setKit(null);
              })
            }
          >
            Lock
          </button>
        )}
      </section>

      <RecordingCheck client={client} exists={status?.exists === true} unlocked={unlocked} onChange={refresh} />

      {unlocked && (
        <>
          <section className={box}>
            <h2 className="mb-2 font-bold">In the store</h2>
            <p data-testid="counts">
              {Object.keys(counts).length === 0
                ? 'Nothing yet'
                : Object.entries(counts)
                    .map(([type, n]) => `${type}: ${n}`)
                    .join(' · ')}
            </p>
          </section>

          <section className={box}>
            <h2 className="mb-2 font-bold">Made-up records</h2>
            <p className="mb-2" style={{ color: 'var(--text-dim)' }}>
              A patient with this name, a medicine and 12 seizures, written through the store like any other record.
            </p>
            <input
              className={input}
              aria-label="Made-up patient name"
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
            />
            <button className={button} disabled={busy} onClick={() => run(() => addSamples(client, sampleName))}>
              Add made-up records
            </button>
          </section>

          <section className={box}>
            <h2 className="mb-2 font-bold">Backup and restore (v7)</h2>
            <input
              className={input}
              type="password"
              placeholder="Backup passphrase (8+ characters)"
              aria-label="Backup passphrase"
              value={backupPass}
              onChange={(e) => setBackupPass(e.target.value)}
            />
            <button
              className={button}
              disabled={busy || backupPass.length < 8}
              onClick={() =>
                run(async () => {
                  const file = await client.backup({ passphrase: backupPass });
                  download(file.fileName, file.text);
                })
              }
            >
              Make backup
            </button>
            <input
              className={input}
              type="file"
              aria-label="v7 backup file"
              disabled={busy || backupPass.length < 8}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () =>
                    setRestored(await client.restore({ text: await read(file), passphrase: backupPass })),
                  );
                e.target.value = '';
              }}
            />
            {restored && (
              <p className="mt-2" data-testid="restore-result">
                Restore {restored.ok ? 'verified' : 'NOT verified'}: {restored.applied.applied} changes applied,{' '}
                {restored.applied.duplicates} already here, {restored.mismatched.length} different,{' '}
                {restored.invalid.length} invalid, {restored.applied.rejected.length} rejected.
              </p>
            )}
          </section>

          <section className={box}>
            <h2 className="mb-2 font-bold">Recovery kit</h2>
            <button
              className={button}
              disabled={busy || pin.length < 4}
              onClick={() => run(async () => setKit(await client.recoveryKit({ credential: { pin } })))}
            >
              Make recovery kit (uses the PIN above)
            </button>
            {kit && (
              <div className="mt-2">
                <p className="break-all font-mono text-xs" data-testid="kit">
                  {kit.kit}
                </p>
                <div
                  className="mt-2 inline-block bg-white p-2"
                  aria-label="Recovery kit QR code"
                  dangerouslySetInnerHTML={{ __html: kit.qrSvg }}
                />
              </div>
            )}
          </section>

          <section className={box}>
            <h2 className="mb-2 font-bold">Seizures ({seizures.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left" data-testid="seizures">
                <thead>
                  <tr>
                    <th className="pr-3">When</th>
                    <th className="pr-3">Profile</th>
                    <th className="pr-3">Seizure length</th>
                    <th className="pr-3">Symptoms</th>
                    <th className="pr-3">Status</th>
                    <th className="pr-3">Locked?</th>
                  </tr>
                </thead>
                <tbody>
                  {seizures.slice(0, 100).map((s) => (
                    <tr key={s.id}>
                      <td className="pr-3">{when(s.phases.start.at)}</td>
                      <td className="pr-3">{s.profile?.name ?? '—'}</td>
                      <td className="pr-3">{seizureLengthSeconds(s.phases) ?? '—'} s</td>
                      <td className="pr-3">{s.symptoms.length}</td>
                      <td className="pr-3">{s.status}</td>
                      <td className="pr-3">
                        {s.recordedWhileLocked ? 'recorded while locked' : ''}
                        {s.cancelled ? ' · cancelled' : ''}
                        {s.isEmergencyStop ? ' · auto-stopped' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/** A patient, one medicine and 12 seizures a day apart, all made up. */
async function addSamples(
  client: { createRecord(arg: Parameters<StoreApi['createRecord']>[0]): Promise<unknown> },
  name: string,
): Promise<void> {
  const patientId = newId();
  await client.createRecord({
    type: 'patient',
    values: {
      id: patientId,
      patientId,
      name,
      dateOfBirth: null,
      emergencyContact: '',
      emergencyPhone: '',
      color: '#336699',
    },
  });
  await client.createRecord({
    type: 'medication',
    values: {
      patientId,
      name: 'Levetiracetam',
      activeIngredient: 'Levetiracetam',
      form: 'form.tablet',
      dose: 500,
      unit: 'mg',
      slotDoses: {},
      slotUnits: {},
      frequency: 'BD',
      scheduledTimes: ['08:00', '20:00'],
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      isRescue: false,
      showInEmergency: false,
      reminderEnabled: false,
      active: true,
      startedAt: Date.now() - 30 * 86_400_000,
      stoppedAt: null,
    },
  });
  for (let i = 0; i < 12; i++) {
    const start = Date.now() - (i + 1) * 86_400_000;
    await client.createRecord({
      type: 'seizure',
      values: {
        patientId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        phases: {
          start: { at: start, source: 'entered-later' },
          auraEnd: null,
          seizureEnd: { at: start + (40 + i * 10) * 1000, source: 'entered-later' },
          recoveryEnd: null,
        },
        status: 'recorded',
        ilae2025: null,
        profile: null,
        symptoms: [],
        afterFindings: [],
        recoveryOngoing: false,
        triggerCodes: [],
        notes: '',
        video: null,
        isManualEntry: true,
        isEmergencyStop: false,
        recordedBy: 'carer',
        eegSessionId: null,
        prodromeSecondsBefore: null,
        quickNotes: [],
        recordedWhileLocked: false,
        cancelled: false,
      },
    });
  }
}
