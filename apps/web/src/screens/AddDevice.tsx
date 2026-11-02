import {
  inviteListenerId,
  inviteQrText,
  INVITE_MINUTES,
  loadHousehold,
  newInvite,
  runInviter,
  type Invite,
} from '@auratrack/sync';
import { AppHeader, Button, Card, Dialog, Screen, Stack } from '@auratrack/ui';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { useHousehold } from '../household/HouseholdContext';
import { QrFromText } from '../household/QrFromText';
import { householdEnv } from '../household/transport';
import { FollowChoice } from './Household';
import './screens.css';

type Step = 'choose' | 'code' | 'compare' | 'done';
type Failure = 'declined' | 'expired' | 'refused' | 'failed';
const FAILURE_TEXT = {
  declined: 'hh.addDeclined',
  expired: 'hh.addExpired',
  refused: 'hh.addRefused',
  failed: 'hh.addFailed',
} as const;

/**
 * Adding a device: choose who it keeps, show the one-time code, then both phones show six digits and a person on each
 * says they match. Only then does the household's state travel to the new device.
 */
export function AddDevice() {
  const { t, api, patients } = useApp();
  const hh = useHousehold();
  const nav = useNav();
  const [step, setStep] = useState<Step>('choose');
  const [choice, setChoice] = useState({ all: true, ids: patients.map((p) => p.id) });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [digits, setDigits] = useState('');
  const [joining, setJoining] = useState('');
  const [added, setAdded] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const answer = useRef<((same: boolean) => void) | null>(null);
  const listener = useRef<{ close(): void } | null>(null);
  const run = useRef(0);

  const stop = () => {
    run.current++;
    answer.current?.(false);
    answer.current = null;
    listener.current?.close();
    listener.current = null;
  };
  useEffect(() => stop, []);

  const begin = async () => {
    const mine = ++run.current;
    setFailure(null);
    const state = await loadHousehold(api);
    const who = (await api.status()).info;
    if (!state || !who) return setFailure('failed');
    const fresh = newInvite(Date.now());
    setInvite(fresh);
    setStep('code');
    try {
      listener.current = await householdEnv.transport().listen(await inviteListenerId(fresh.secret), (channel) => {
        void runInviter(channel, {
          secret: fresh.secret,
          expiresAt: fresh.expiresAt,
          state,
          inviterId: who.deviceId,
          follows: choice.all ? 'all' : choice.ids,
          now: Date.now,
          save: (next) => api.saveHouseholdState({ state: next }),
          confirm: (six, name) =>
            new Promise<boolean>((resolve) => {
              if (run.current !== mine) return resolve(false);
              setDigits(six);
              setJoining(name);
              setStep('compare');
              answer.current = (same) => {
                resolve(same);
                answer.current = null;
              };
            }),
        }).then((result) => {
          if (run.current !== mine) return;
          listener.current?.close();
          listener.current = null;
          if (result.outcome === 'joined') {
            setStep('done');
            hh.searchNow();
          } else {
            setFailure(
              result.outcome === 'declined'
                ? 'declined'
                : result.outcome === 'expired'
                  ? 'expired'
                  : result.outcome === 'refused'
                    ? 'refused'
                    : 'failed',
            );
            setStep('choose');
          }
        });
      });
    } catch {
      setFailure('failed');
      setStep('choose');
    }
  };

  // The name of the device added, from the household once it has been saved
  useEffect(() => {
    if (step !== 'done') return;
    let alive = true;
    void loadHousehold(api).then((s) => {
      const newest = Object.values(s?.membership.devices ?? {}).sort((a, b) => b.addedAt - a.addedAt)[0];
      if (alive && newest) setAdded(newest.name);
    });
    return () => {
      alive = false;
    };
  }, [step, api]);

  return (
    <Screen>
      <Stack>
        <AppHeader
          title={t('hh.addTitle')}
          onBack={() => {
            stop();
            nav.pop();
          }}
        />
        {failure ? (
          <Card tone="danger" compact>
            <p role="alert" className="app-banner">
              {t(FAILURE_TEXT[failure])}
            </p>
          </Card>
        ) : null}
        {step === 'choose' ? (
          <>
            <p className="app-note">{t('hh.addWho')}</p>
            <FollowChoice {...choice} onChange={setChoice} />
            <Button
              variant="primary"
              fullWidth
              disabled={!choice.all && choice.ids.length === 0}
              onClick={() => void begin()}
            >
              {t('hh.addDevice')}
            </Button>
          </>
        ) : null}
        {step === 'code' && invite ? (
          <>
            <p className="app-note">{t('hh.addScan')}</p>
            <QrFromText text={inviteQrText(invite)} label={t('hh.addQr')} />
            <Card>
              <p className="app-code" aria-label={t('hh.addCode')}>
                {invite.code}
              </p>
            </Card>
            <p className="app-help">{t('hh.addExpires', { minutes: INVITE_MINUTES })}</p>
            <p className="app-note">{t('hh.addWaiting')}</p>
          </>
        ) : null}
        {step === 'done' ? (
          <>
            <Card tone="accent">
              <p className="app-banner">{t('hh.addDone', { name: added })}</p>
            </Card>
            <Button fullWidth onClick={() => nav.pop()}>
              {t('common.done')}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setStep('choose');
                setInvite(null);
              }}
            >
              {t('hh.addAgain')}
            </Button>
          </>
        ) : null}
        {step === 'compare' ? (
          <Dialog
            title={t('hh.addCompare')}
            message={`${t('hh.addCompareDevice', { name: joining })}\n${digits.replace(/(\d{3})(\d{3})/, '$1 $2')}`}
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
    </Screen>
  );
}
