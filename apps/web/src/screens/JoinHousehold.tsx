import { inviteListenerId, parseInvite, runJoiner } from '@auratrack/sync';
import { AppHeader, Button, Card, Dialog, Screen, Stack, TextField } from '@auratrack/ui';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { QrScanner } from '../household/QrScanner';
import { householdEnv } from '../household/transport';
import './screens.css';

type Step = 'form' | 'connecting' | 'compare' | 'waiting' | 'done';
type Problem = 'code' | 'notFound' | 'declined' | 'expired' | 'refused' | 'records' | 'failed';
const PROBLEM_TEXT = {
  code: 'hh.joinBadCode',
  notFound: 'hh.joinNotFound',
  declined: 'hh.addDeclined',
  expired: 'hh.addExpired',
  refused: 'hh.addRefused',
  records: 'hh.joinHasRecords',
  failed: 'hh.addFailed',
} as const;

/**
 * The join form: the code from the other device (typed or scanned), a name for this one, the six digits to compare, and
 * the household arriving. Used on the set-up screen (before anything is here) and from More on a phone that is still empty.
 */
export function JoinForm({ onJoined, onCancel }: { onJoined: () => void; onCancel: () => void }) {
  const { t, api } = useApp();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [digits, setDigits] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const answer = useRef<((same: boolean) => void) | null>(null);
  const secret = parseInvite(code);

  useEffect(() => () => answer.current?.(false), []);

  const go = async () => {
    const bytes = parseInvite(code);
    if (!bytes) return setProblem('code');
    setProblem(null);
    setStep('connecting');
    const fail = (p: Problem) => {
      setProblem(p);
      setStep('form');
    };
    try {
      if (!(await api.storeIsEmpty())) return fail('records');
      const info = (await api.status()).info;
      if (!info) return fail('failed');
      let channel;
      try {
        channel = await householdEnv.transport().connect(await inviteListenerId(bytes), 15_000);
      } catch {
        return fail('notFound');
      }
      const result = await runJoiner(channel, {
        secret: bytes,
        deviceId: info.deviceId,
        deviceName: name.trim() || t('hh.thisDevice'),
        now: Date.now,
        confirm: (six) =>
          new Promise<boolean>((resolve) => {
            setDigits(six);
            setStep('compare');
            answer.current = (same) => {
              setStep(same ? 'waiting' : 'form');
              resolve(same);
            };
          }),
      });
      if (result.outcome !== 'joined' || !result.state) {
        return fail(
          result.outcome === 'declined'
            ? 'declined'
            : result.outcome === 'expired'
              ? 'expired'
              : result.outcome === 'refused'
                ? 'refused'
                : 'failed',
        );
      }
      await api.adoptHousehold({ householdId: result.state.membership.householdId });
      await api.saveHouseholdState({ state: result.state });
      setStep('done');
      onJoined();
    } catch {
      fail('failed');
    }
  };

  return (
    <Stack>
      <p className="app-note">{t('hh.joinHelp')}</p>
      <TextField
        label={t('hh.joinCode')}
        value={code}
        onChange={setCode}
        autoComplete="off"
        autoCapitalize="characters"
        error={code !== '' && !secret ? t('hh.joinBadCode') : undefined}
      />
      <Button onClick={() => setScanning(!scanning)}>{t('hh.joinScan')}</Button>
      {scanning ? (
        <QrScanner
          onText={(text) => {
            if (parseInvite(text)) {
              setCode(text.replace(/^auratrack:join:/, ''));
              setScanning(false);
            }
          }}
        />
      ) : null}
      <TextField label={t('hh.deviceName')} value={name} onChange={setName} autoComplete="off" />
      {problem ? (
        <Card tone="danger" compact>
          <p role="alert" className="app-banner">
            {t(PROBLEM_TEXT[problem])}
          </p>
        </Card>
      ) : null}
      {step === 'connecting' ? <p className="app-note">{t('hh.joinConnecting')}</p> : null}
      {step === 'waiting' ? <p className="app-note">{t('hh.joinWaitingOther')}</p> : null}
      <Button variant="primary" fullWidth disabled={!secret || step !== 'form'} onClick={() => void go()}>
        {t('hh.joinGo')}
      </Button>
      <Button fullWidth onClick={onCancel}>
        {t('hh.joinStay')}
      </Button>
      {step === 'compare' ? (
        <Dialog
          title={t('hh.joinCompare')}
          message={digits.replace(/(\d{3})(\d{3})/, '$1 $2')}
          onClose={() => answer.current?.(false)}
          actions={
            <>
              <Button onClick={() => answer.current?.(false)}>{t('hh.addDiffer')}</Button>
              <Button variant="primary" onClick={() => answer.current?.(true)}>
                {t('hh.addSame')}
              </Button>
            </>
          }
        />
      ) : null}
    </Stack>
  );
}

/** The join form as a screen of its own, from More, on a phone that has no records yet. */
export function JoinScreen() {
  const { t, actions } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('hh.joinTitle')} onBack={() => nav.pop()} />
        <JoinForm onJoined={() => void actions.refresh().then(() => nav.pop())} onCancel={() => nav.pop()} />
      </Stack>
    </Screen>
  );
}

/** The join step of first-run set-up: choose a PIN, then the form; when it is done the app opens. */
export function JoinSetup({ onCancel }: { onCancel: () => void }) {
  const { t, actions, language } = useApp();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('hh.joinTitle')} />
        <JoinForm onJoined={() => void actions.finishJoin(language)} onCancel={onCancel} />
      </Stack>
    </Screen>
  );
}
