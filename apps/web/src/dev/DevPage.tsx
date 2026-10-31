// DEVELOPER PAGE (M1). Not a real screen: it exists to check the data core with real data on the real device.
// Open it at /#/dev. It lists what is in the store, imports a 6.1 backup, compares the result with 6.1's own numbers,
// and makes and restores backups. Everything runs on this device; nothing is sent anywhere.
import { labelText } from '@auratrack/i18n';
import { localDateKey, seizureSeconds, type Seizure } from '@auratrack/model';
import type { ComparisonReport, ImportReport, RestoreReport, StoreApi, StoreStatus } from '@auratrack/store';
import { connect, type PortLike } from '@auratrack/store/rpc';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [passphrase, setPassphrase] = useState('');
  const [backupPass, setBackupPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<{ report: ImportReport; comparison: ComparisonReport } | null>(null);
  const [restored, setRestored] = useState<RestoreReport | null>(null);
  const [kit, setKit] = useState<{ kit: string; qrSvg: string } | null>(null);

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
                run(
                  async () =>
                    void (await (status?.exists
                      ? client.unlock({ credential: { pin } })
                      : client.create({ credential: { pin } }))),
                )
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
                setImported(null);
                setKit(null);
              })
            }
          >
            Lock
          </button>
        )}
      </section>

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
            <h2 className="mb-2 font-bold">Import a 6.1 backup</h2>
            <p className="mb-2" style={{ color: 'var(--text-dim)' }}>
              Choose a 6.1 backup file (plain, encrypted, or all patients). It is read here and never uploaded.
              Importing the same file twice adds nothing.
            </p>
            <input
              className={input}
              type="password"
              placeholder="Passphrase (encrypted backups)"
              aria-label="6.1 backup passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <input
              className={input}
              type="file"
              aria-label="6.1 backup file"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () =>
                    setImported(
                      await client.importLegacy({ text: await read(file), ...(passphrase ? { passphrase } : {}) }),
                    ),
                  );
                e.target.value = '';
              }}
            />
          </section>

          {imported && <ImportResult result={imported} />}

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
                    <th className="pr-3">Type</th>
                    <th className="pr-3">Seizure time</th>
                    <th className="pr-3">Symptoms</th>
                    <th className="pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {seizures.slice(0, 100).map((s) => (
                    <tr key={s.id}>
                      <td className="pr-3">{when(s.phases.start.at)}</td>
                      <td className="pr-3">{s.typeCode ? labelText('en', s.typeCode) : '—'}</td>
                      <td className="pr-3">{seizureSeconds(s.phases) ?? '—'} s</td>
                      <td className="pr-3">{s.symptoms.length}</td>
                      <td className="pr-3">{s.status}</td>
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

function ImportResult({ result }: { result: { report: ImportReport; comparison: ComparisonReport } }) {
  const { report, comparison } = result;
  return (
    <section className={box} data-testid="import-result">
      <h2 className="mb-2 font-bold">Import result</h2>
      <p data-testid="import-summary">
        {report.file.patients} patient(s) · {report.totals.found} rows found · {report.totals.imported} imported ·{' '}
        {report.totals.rejected} rejected · {report.unaccounted} unaccounted for · {report.applied} new,{' '}
        {report.duplicates} already here
      </p>
      {report.timeZoneAssumed && (
        <p style={{ color: 'var(--text-dim)' }}>
          6.1 did not store a time zone; {report.timeZone} was assumed for every seizure.
        </p>
      )}
      {report.patients.map((p) => (
        <div key={p.patientKey} className="mt-2">
          <h3 className="font-bold">{p.name || '(no name)'}</h3>
          <p>
            {Object.entries(p.tables)
              .map(([t, c]) => `${t} ${c.imported}/${c.found}`)
              .join(' · ')}
          </p>
          {p.rejected.length > 0 && (
            <ul className="list-disc pl-5">
              {p.rejected.map((r, i) => (
                <li key={i}>
                  Rejected {r.table} #{r.index + 1}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {report.review.length > 0 && (
        <>
          <h3 className="mt-3 font-bold">
            To review ({report.review.length}): the original text is kept; shown as your own code, or as the broader
            area where one is named
          </h3>
          <ul className="list-disc pl-5" data-testid="review">
            {report.review.map((r) => (
              <li key={`${r.kind}|${r.text}`}>
                {r.kind}: “{r.text}” × {r.count}
                {r.keptAs ? ` → ${r.keptAs}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="mt-3 font-bold" data-testid="comparison-title">
        Comparison with 6.1:{' '}
        {comparison.allMatch ? 'everything matches' : `${comparison.mismatches.length} difference(s)`}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left" data-testid="comparison">
          <thead>
            <tr>
              <th className="pr-3">Patient</th>
              <th className="pr-3">Section</th>
              <th className="pr-3">Metric</th>
              <th className="pr-3">6.1</th>
              <th className="pr-3">v7</th>
              <th className="pr-3">Match</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row, i) => (
              <tr key={i} style={row.match ? undefined : { color: '#f87171' }}>
                <td className="pr-3">{row.patient}</td>
                <td className="pr-3">{row.section}</td>
                <td className="pr-3">{row.metric}</td>
                <td className="pr-3">{row.v6}</td>
                <td className="pr-3">{row.v7}</td>
                <td className="pr-3">{row.match ? 'yes' : 'NO'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison.seizureTimeDifferences.length > 0 && (
        <p className="mt-2">
          Seizures whose seizure time differs:{' '}
          {comparison.seizureTimeDifferences
            .map((d) => `${d.legacyKey} (6.1 ${d.v6} s, v7 ${d.v7 ?? '?'} s)`)
            .join('; ')}
        </p>
      )}
    </section>
  );
}
