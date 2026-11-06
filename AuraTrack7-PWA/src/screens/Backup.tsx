import {
  AppHeader,
  Button,
  Card,
  ChipGroup,
  FilePicker,
  Screen,
  Section,
  Stack,
  TextField,
  useToast,
} from '@auratrack/ui';
import type { RestoreReport } from '@auratrack/store';
import { dateStamp } from '@auratrack/model';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { reportsEnv } from '../reports/env';
import { ImportCsv } from './ImportCsv';
import { QrSvg } from './QrSvg';
import './screens.css';

const MIN_LENGTH = 8;
type Checked = {
  counts: { records: Record<string, number> };
  countsMatch: boolean;
  invalid: number;
  badChanges: number;
  exportedAt: number;
  patients: string[];
};

const errorName = (e: unknown): string => (e instanceof Error ? e.name : '');

/** Backup, restore, moving to a new device, bringing in a spreadsheet, and the recovery kit (F-801, F-802, F-806). */
export function Backup() {
  const { t } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.backup')} onBack={() => nav.pop()} />
        <MakeBackup />
        <Section title={t('bk.moveTitle')}>
          <Card>
            <Stack gap="0.5rem">
              <p className="app-help">{t('bk.move1')}</p>
              <p className="app-help">{t('bk.move2')}</p>
              <p className="app-help">{t('bk.move3')}</p>
            </Stack>
          </Card>
        </Section>
        <Restore />
        <ImportCsv />
        <RecoveryKit />
      </Stack>
    </Screen>
  );
}

function PassphraseFields({
  phrase,
  setPhrase,
  again,
  setAgain,
}: {
  phrase: string;
  setPhrase: (v: string) => void;
  again: string;
  setAgain: (v: string) => void;
}) {
  const { t } = useApp();
  const short = phrase.length > 0 && phrase.length < MIN_LENGTH;
  const mismatch = again.length > 0 && again !== phrase;
  return (
    <>
      <TextField
        label={t('backup.passphrase', { min: MIN_LENGTH })}
        type="password"
        autoComplete="new-password"
        value={phrase}
        onChange={setPhrase}
        {...(short ? { error: t('backup.short', { min: MIN_LENGTH }) } : {})}
      />
      <TextField
        label={t('backup.passphraseAgain')}
        type="password"
        autoComplete="new-password"
        value={again}
        onChange={setAgain}
        {...(mismatch ? { error: t('backup.mismatch') } : {})}
      />
    </>
  );
}

function MakeBackup() {
  const app = useApp();
  const { t, api, actions, patients } = app;
  const toast = useToast();
  const [who, setWho] = useState('all');
  const [phrase, setPhrase] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <Section title={t('backup.make')}>
      <Card>
        <Stack>
          <p className="app-help">{t('backup.makeHelp')}</p>
          {patients.length > 1 ? (
            <ChipGroup
              label={t('bk.who')}
              value={who}
              onChange={setWho}
              options={[
                { value: 'all', label: t('bk.everyone') },
                ...patients.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          ) : null}
          <PassphraseFields phrase={phrase} setPhrase={setPhrase} again={again} setAgain={setAgain} />
          {problem ? (
            <p role="alert" className="app-banner">
              {problem}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={busy || phrase.length < MIN_LENGTH || phrase !== again}
            onClick={() => {
              setBusy(true);
              setProblem(undefined);
              // One async function, so busy clears in the same step as the last change and nothing runs on behind it.
              void (async () => {
                try {
                  const file = await api.backup({ passphrase: phrase, ...(who === 'all' ? {} : { patientId: who }) });
                  const result = await reportsEnv.save(file.text, file.fileName, 'application/octet-stream');
                  if (result === 'cancelled') return;
                  await actions.setSetting('lastBackupAt', app.controller.now());
                  toast(t('backup.done'), 'success');
                  setPhrase('');
                  setAgain('');
                } catch {
                  setProblem(t('backup.failed'));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {t('backup.button')}
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}

function Restore() {
  const app = useApp();
  const { t, api, actions, fmt } = app;
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [phrase, setPhrase] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [result, setResult] = useState<RestoreReport | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) =>
    setProblem(
      errorName(e) === 'DecryptError'
        ? t('restore.wrongPassphrase')
        : errorName(e) === 'BackupFormatError'
          ? t('restore.notBackup')
          : errorName(e) === 'BackupVerificationError'
            ? t('restore.damaged')
            : t('restore.failed'),
    );
  const typeLine = (records: Record<string, number>) =>
    [
      ['patient', 'restore.people'],
      ['seizure', 'restore.seizures'],
      ['medication', 'restore.medicines'],
      ['doseLog', 'restore.doses'],
      ['wellbeingEntry', 'restore.checkIns'],
      ['eegSession', 'restore.eegSessions'],
    ]
      .map(([type, key]) => `${t(key as never)}: ${records[type as string] ?? 0}`)
      .join(' · ');
  return (
    <Section title={t('restore.title')}>
      <Card>
        <Stack>
          <p className="app-help">{t('restore.help')}</p>
          <FilePicker
            label={file ? t('restore.otherFile') : t('restore.choose')}
            accept=".atbak,.json,application/json"
            onPick={(f) => {
              void f.text().then((text) => {
                setFile({ name: f.name, text });
                setChecked(null);
                setResult(null);
                setProblem(undefined);
              });
            }}
          />
          {file ? <p className="app-note">{file.name}</p> : null}
          {file ? (
            <TextField
              label={t('restore.passphrase')}
              type="password"
              autoComplete="off"
              value={phrase}
              onChange={setPhrase}
            />
          ) : null}
          {problem ? (
            <p role="alert" className="app-banner">
              {problem}
            </p>
          ) : null}
          {file && !checked && !result ? (
            <Button
              disabled={busy || phrase === ''}
              onClick={() => {
                setBusy(true);
                setProblem(undefined);
                void (async () => {
                  try {
                    setChecked((await api.checkBackup({ text: file.text, passphrase: phrase })) as Checked);
                  } catch (e) {
                    fail(e);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {t('restore.check')}
            </Button>
          ) : null}
          {checked && !result ? (
            <>
              <Card compact>
                <Stack gap="0.25rem">
                  <p className="app-banner">{t('restore.made', { date: fmt.date(checked.exportedAt) })}</p>
                  {checked.patients.length > 0 ? <p className="app-note">{checked.patients.join(', ')}</p> : null}
                  <p className="app-note">{typeLine(checked.counts.records)}</p>
                  {!checked.countsMatch || checked.badChanges > 0 ? (
                    <p role="alert" className="app-banner">
                      {t('restore.damaged')}
                    </p>
                  ) : null}
                  {checked.invalid > 0 ? (
                    <p className="app-note">{t('restore.invalid', { count: checked.invalid })}</p>
                  ) : null}
                </Stack>
              </Card>
              <p className="app-note">{t('restore.merge')}</p>
              <Button
                variant="primary"
                disabled={busy || !checked.countsMatch || checked.badChanges > 0}
                onClick={() => {
                  if (!file) return;
                  setBusy(true);
                  setProblem(undefined);
                  // The lists are refreshed before the result shows (refresh never throws).
                  void (async () => {
                    try {
                      const r = await api.restore({ text: file.text, passphrase: phrase });
                      await actions.refresh();
                      setResult(r);
                    } catch (e) {
                      fail(e);
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {t('restore.button')}
              </Button>
            </>
          ) : null}
          {result ? (
            <Card compact {...(result.ok ? {} : { tone: 'danger' as const })}>
              <Stack gap="0.25rem">
                <p className="app-banner" role="status">
                  {result.ok ? t('restore.ok') : t('restore.notOk')}
                </p>
                <p className="app-note">{typeLine(result.restored.records)}</p>
                {result.applied.rejected.length > 0 ? (
                  <p className="app-note">{t('restore.rejected', { count: result.applied.rejected.length })}</p>
                ) : null}
                {result.invalid.length > 0 ? (
                  <p className="app-note">{t('restore.invalid', { count: result.invalid.length })}</p>
                ) : null}
                {result.mismatched.length > 0 ? (
                  <p className="app-note">{t('restore.mismatched', { count: result.mismatched.length })}</p>
                ) : null}
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>
    </Section>
  );
}

function RecoveryKit() {
  const app = useApp();
  const { t, api, patient, fmt, language } = app;
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [kit, setKit] = useState<{ kit: string; qr: { size: number; dark: boolean[] } } | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <Section title={t('kit.section')}>
      <Card>
        <Stack>
          <p className="app-help">{t('kit.sectionHelp')}</p>
          {!kit ? (
            <>
              <TextField
                label={t('kit.pin')}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={setPin}
                {...(problem ? { error: problem } : {})}
              />
              <Button
                disabled={busy || pin.length < 4}
                onClick={() => {
                  setBusy(true);
                  setProblem(undefined);
                  void (async () => {
                    try {
                      setKit(await api.recoveryKit({ credential: { pin } }));
                      setPin('');
                    } catch (e) {
                      setProblem(errorName(e) === 'WrongSecretError' ? t('lock.wrong') : t('kit.failed'));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {t('kit.make')}
              </Button>
            </>
          ) : (
            <>
              <QrSvg size={kit.qr.size} dark={kit.qr.dark} label={t('kit.qrLabel')} />
              <p className="app-note app-code">{kit.kit}</p>
              <Button
                variant="primary"
                onClick={() => {
                  const now = app.controller.now();
                  void reportsEnv
                    .makePdf({
                      kind: 'recoveryKit',
                      language,
                      model: { person: patient?.name ?? '', date: fmt.date(now), kit: kit.kit, qr: kit.qr },
                    })
                    .then((bytes) =>
                      reportsEnv.save(bytes, `auratrack-recovery-kit-${dateStamp(now)}.pdf`, 'application/pdf'),
                    )
                    .then((r) => r === 'saved' && toast(t('reports.saved'), 'success'))
                    .catch(() => setProblem(t('reports.failed')));
                }}
              >
                {t('kit.savePdf')}
              </Button>
              <p className="app-note">{t('kit.keepSafe')}</p>
            </>
          )}
        </Stack>
      </Card>
    </Section>
  );
}
