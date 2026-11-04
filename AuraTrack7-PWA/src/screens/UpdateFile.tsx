import {
  buildUpdate,
  collectFrames,
  effectiveFollows,
  HOUSEHOLD_SCOPE,
  loadHousehold,
  openUpdate,
  toFrames,
  UpdateError,
  type FrameCollector,
  type OpenedUpdate,
} from '@auratrack/sync';
import { dateStamp } from '@auratrack/model';
import { AppHeader, Button, Card, FilePicker, Screen, Section, Stack, useToast } from '@auratrack/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { QrFromText } from '../household/QrFromText';
import { QrScanner } from '../household/QrScanner';
import { reportsEnv } from '../reports/env';
import './screens.css';

const MAX_QR_FRAMES = 25;
const MIME = 'application/octet-stream';

/** The last resort: an update as a file or as QR codes, made here and opened on another device, with no network. */
export function UpdateFile() {
  const { t } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('hh.fileTitle')} onBack={() => nav.pop()} />
        <MakeUpdate />
        <OpenUpdate />
      </Stack>
    </Screen>
  );
}

function MakeUpdate() {
  const { t, api, language } = useApp();
  const toast = useToast();
  const [text, setText] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const [showQr, setShowQr] = useState(false);
  void language;

  const make = async () => {
    setProblem(false);
    try {
      const state = await loadHousehold(api);
      const who = (await api.status()).info;
      if (!state || !who) return setProblem(true);
      const scopes = [HOUSEHOLD_SCOPE, ...effectiveFollows(state.membership, who.deviceId)];
      const parts = [];
      for (const scope of scopes) {
        const index = await api.syncIndex({ scope });
        const entries = [];
        for (let i = 0; i < index.length; i += 200)
          entries.push(...(await api.syncEntries({ ids: index.slice(i, i + 200).map((e) => e.id) })));
        parts.push({ scope, entries });
      }
      setText(await buildUpdate(state, who.deviceId, parts, Date.now()));
    } catch {
      setProblem(true);
    }
  };
  const frames = useMemo(() => (text ? toFrames(text) : []), [text]);
  return (
    <Section title={t('hh.fileMake')}>
      <Card>
        <Stack>
          <p className="app-help">{t('hh.fileMakeHelp')}</p>
          {problem ? (
            <p role="alert" className="app-banner">
              {t('hh.fileFailed')}
            </p>
          ) : null}
          <Button onClick={() => void make()}>{t('hh.fileMake')}</Button>
          {text ? (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  void reportsEnv
                    .save(text, `auratrack-update-${dateStamp(new Date())}.auraupdate`, MIME)
                    .then((r) => r === 'saved' && toast(t('reports.saved'), 'success'));
                }}
              >
                {t('hh.fileSave')}
              </Button>
              {frames.length <= MAX_QR_FRAMES ? (
                <Button onClick={() => setShowQr(!showQr)}>{t('hh.fileQr')}</Button>
              ) : (
                <p className="app-help">{t('hh.fileQrTooBig')}</p>
              )}
              {showQr && frames.length <= MAX_QR_FRAMES ? <FrameShow frames={frames} /> : null}
            </>
          ) : null}
        </Stack>
      </Card>
    </Section>
  );
}

/** The frames of an update, one QR code after another, round and round. */
function FrameShow({ frames }: { frames: string[] }) {
  const { t } = useApp();
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((x) => (x + 1) % frames.length), 1200);
    return () => window.clearInterval(id);
  }, [frames.length]);
  const frame = frames[n % frames.length] ?? '';
  return (
    <Stack>
      <QrFromText
        text={frame}
        label={t('hh.fileQrFrame', { n: (n % frames.length) + 1, total: frames.length })}
        level="L"
      />
      <p className="app-note">{t('hh.fileQrFrame', { n: (n % frames.length) + 1, total: frames.length })}</p>
      <p className="app-help">{t('hh.fileQrHelp')}</p>
    </Stack>
  );
}

function OpenUpdate() {
  const { t, api, actions } = useApp();
  const [opened, setOpened] = useState<OpenedUpdate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ have: number; of: number } | null>(null);
  const collector = useRef<FrameCollector>(collectFrames());

  const check = async (text: string) => {
    setMessage(null);
    setOpened(null);
    try {
      const state = await loadHousehold(api);
      if (!state) return setMessage(t('hh.fileFailed'));
      setOpened(await openUpdate(text, state));
    } catch (e) {
      const reason = e instanceof UpdateError ? e.reason : 'damaged';
      setMessage(
        reason === 'other_household'
          ? t('hh.fileOther')
          : reason === 'not_an_update'
            ? t('hh.fileNot')
            : t('hh.fileDamaged'),
      );
    }
  };

  const apply = async () => {
    if (!opened) return;
    try {
      let applied = 0;
      let duplicates = 0;
      for (const scope of opened.scopes)
        for (let i = 0; i < scope.entries.length; i += 200) {
          const r = await api.applySynced({ entries: scope.entries.slice(i, i + 200) });
          applied += r.applied;
          duplicates += r.duplicates;
        }
      setMessage(t('hh.fileApplied', { applied, duplicates }));
      setOpened(null);
      await actions.refresh();
    } catch {
      setMessage(t('hh.fileFailed'));
    }
  };

  const count = opened ? opened.scopes.reduce((n, s) => n + s.entries.length, 0) : 0;
  return (
    <Section title={t('hh.fileOpen')}>
      <Card>
        <Stack>
          <p className="app-help">{t('hh.fileOpenHelp')}</p>
          <FilePicker
            label={t('hh.fileChoose')}
            accept=".auraupdate,text/plain,application/octet-stream"
            onPick={(f) => void f.text().then(check)}
          />
          <Button onClick={() => setScanning(!scanning)}>{t('hh.fileScan')}</Button>
          {scanning ? (
            <>
              <QrScanner
                onText={(frame) => {
                  const got = collector.current.add(frame);
                  if (got) setProgress({ have: got.have, of: got.of });
                  if (got?.complete) {
                    const full = collector.current.text();
                    collector.current = collectFrames();
                    setScanning(false);
                    setProgress(null);
                    if (full) void check(full);
                  }
                }}
              />
              {progress ? (
                <p className="app-note">{t('hh.fileScanProgress', { have: progress.have, of: progress.of })}</p>
              ) : null}
            </>
          ) : null}
          {message ? (
            <p role="status" className="app-banner">
              {message}
            </p>
          ) : null}
          {opened ? (
            <>
              <p className="app-note">
                {t('hh.fileFound', {
                  count,
                  people: opened.scopes.filter((s) => s.scope !== HOUSEHOLD_SCOPE).length,
                  skipped: opened.skipped.length,
                })}
              </p>
              <Button variant="primary" onClick={() => void apply()}>
                {t('hh.fileApply')}
              </Button>
            </>
          ) : null}
        </Stack>
      </Card>
    </Section>
  );
}
