import { AppHeader, Button, Card, Screen, Stack, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { Recording } from './Recording';
import './screens.css';

// Before the app opens: first-run set-up, and the PIN screen. The PIN screen has a Start button, so a recording never waits
// for the PIN (README 4.5); what is recorded there joins the records at the next unlock. The full lock screen (auto-lock,
// passkey) comes in slice 9; this is the part the recording needs now.

export function Gate() {
  const app = useApp();
  if (app.phase === 'setup') return <Setup />;
  const session = app.recording.session;
  // A recording made from the PIN screen carries on there, with the same screen and the same buttons
  if (session) return <Recording />;
  return <Locked />;
}

function Setup() {
  const { t, actions, busy } = useApp();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const digits = /^\d{4,}$/.test(pin);
  const problem = !shown ? undefined : !digits ? t('setup.tooShort') : pin !== again ? t('setup.mismatch') : undefined;
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('setup.title')} />
        <p className="app-note">{t('setup.intro')}</p>
        <TextField label={t('setup.name')} value={name} onChange={setName} autoComplete="off" />
        <TextField
          label={t('setup.pin')}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          onChange={setPin}
        />
        <TextField
          label={t('setup.pinAgain')}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={again}
          onChange={setAgain}
          error={problem}
        />
        <Button
          variant="primary"
          fullWidth
          disabled={busy || name.trim() === ''}
          onClick={() => {
            setShown(true);
            if (digits && pin === again) void actions.setup({ name, pin });
          }}
        >
          {t('setup.create')}
        </Button>
      </Stack>
    </Screen>
  );
}

function Locked() {
  const { t, actions, busy, wrongPin, locked, passkey, passkeySupported, passkeyFailed } = useApp();
  const [pin, setPin] = useState('');
  const available = locked?.available === true;
  const name = locked?.screen.patientName ?? null;
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('lock.title')} {...(name ? { patient: { name } } : {})} />
        <TextField
          label={t('unlock.pin')}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={setPin}
          error={wrongPin ? t('lock.wrong') : undefined}
        />
        <Button variant="primary" fullWidth disabled={busy || pin.length < 4} onClick={() => void actions.unlock(pin)}>
          {busy ? t('unlock.working') : t('unlock.button')}
        </Button>
        {passkey && passkeySupported ? (
          <>
            <Button fullWidth disabled={busy} onClick={() => void actions.unlockWithPasskey()}>
              {t('lock.usePasskey')}
            </Button>
            {passkeyFailed ? (
              <p className="ui-error" role="alert">
                {t('lock.passkeyFailed')}
              </p>
            ) : null}
          </>
        ) : null}
        <Card tone="accent">
          <p className="app-note">{available ? t('lock.startNote') : t('lock.startUnavailable')}</p>
          {/* Start, with no PIN. It is a recording; it joins the records when the app is unlocked. */}
          <Button variant="danger" size="lg" fullWidth disabled={!available} onClick={actions.startRecording}>
            {t('lock.start')}
          </Button>
        </Card>
      </Stack>
    </Screen>
  );
}
