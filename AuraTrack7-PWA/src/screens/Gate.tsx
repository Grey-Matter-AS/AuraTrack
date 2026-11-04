import { LANGUAGES } from '@auratrack/i18n';
import { AppHeader, BottomSheet, Button, Card, Logo, Screen, Select, Stack, TextArea, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { JoinSetup } from './JoinHousehold';
import { Recording } from './Recording';
import { LANGUAGE_NAMES } from './RecordingSettings';
import './screens.css';

// Before the app opens: first-run set-up, and the PIN screen. The PIN screen has a Start button, so a recording never waits
// for the PIN (README 4.5); what is recorded there joins the records at the next unlock. The full lock screen (auto-lock,
// passkey) comes in slice 9; this is the part the recording needs now.

/** The language choice on the screens before the app opens: English until one is chosen. */
export function LanguageChoice() {
  const { t, language, actions } = useApp();
  return (
    <Select
      label={t('settings.language')}
      value={language}
      onChange={(value) => {
        const next = LANGUAGES.find((l) => l === value);
        if (next) actions.chooseLanguage(next);
      }}
      options={Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label }))}
    />
  );
}

export function Gate() {
  const app = useApp();
  const [joinPin, setJoinPin] = useState('');
  if (app.phase === 'setup') return <Setup onJoin={setJoinPin} />;
  if (app.phase === 'joining') return <JoinSetup onCancel={() => void app.actions.eraseAll(joinPin)} />;
  const session = app.recording.session;
  // A recording made from the PIN screen carries on there, with the same screen and the same buttons
  if (session) return <Recording />;
  return <Locked />;
}

function Setup({ onJoin }: { onJoin: (pin: string) => void }) {
  const { t, actions, busy, language } = useApp();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const digits = /^\d{4,}$/.test(pin);
  const problem = !shown ? undefined : !digits ? t('setup.tooShort') : pin !== again ? t('setup.mismatch') : undefined;
  return (
    <Screen>
      <Stack>
        <Logo src="/icons/icon-192.png" size={72} />
        <AppHeader title={t('setup.title')} />
        <LanguageChoice />
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
            if (digits && pin === again) void actions.setup({ name, pin, language });
          }}
        >
          {t('setup.create')}
        </Button>
        <Button
          fullWidth
          disabled={busy}
          onClick={() => {
            setShown(true);
            if (digits && pin === again) {
              onJoin(pin);
              void actions.beginJoin(pin);
            }
          }}
        >
          {t('hh.joinInstead')}
        </Button>
      </Stack>
    </Screen>
  );
}

function Locked() {
  const { t, actions, busy, wrongPin, locked, passkey, passkeySupported, passkeyFailed } = useApp();
  const [pin, setPin] = useState('');
  const [forgot, setForgot] = useState(false);
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
        <Button variant="ghost" fullWidth onClick={() => setForgot(true)}>
          {t('lock.forgot')}
        </Button>
        <Card tone="accent">
          <p className="app-note">{available ? t('lock.startNote') : t('lock.startUnavailable')}</p>
          {/* Start, with no PIN. It is a recording; it joins the records when the app is unlocked. */}
          <Button variant="danger" size="lg" fullWidth disabled={!available} onClick={actions.startRecording}>
            {t('lock.start')}
          </Button>
        </Card>
      </Stack>
      {forgot ? <ForgotPin onClose={() => setForgot(false)} /> : null}
    </Screen>
  );
}

/** The PIN is forgotten: the printed recovery kit opens the app, and a new PIN is set. */
function ForgotPin({ onClose }: { onClose: () => void }) {
  const { t, actions, busy } = useApp();
  const [kit, setKit] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [wrong, setWrong] = useState(false);
  const digits = /^\d{4,}$/.test(pin);
  const mismatch = again.length > 0 && again !== pin;
  return (
    <BottomSheet
      title={t('lock.kitTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={busy || kit.trim() === '' || !digits || pin !== again}
          onClick={() => {
            setWrong(false);
            void actions.unlockWithKit(kit, pin).then((r) => setWrong(r === 'wrong_kit'));
          }}
        >
          {t('lock.kitGo')}
        </Button>
      }
    >
      <Stack>
        <p className="app-note">{t('lock.kitHelp')}</p>
        <TextArea label={t('lock.kitCode')} value={kit} onChange={setKit} rows={4} />
        {wrong ? (
          <p role="alert" className="ui-error">
            {t('lock.kitWrong')}
          </p>
        ) : null}
        <TextField
          label={t('lock.kitNewPin')}
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
          {...(mismatch ? { error: t('setup.mismatch') } : {})}
        />
      </Stack>
    </BottomSheet>
  );
}
