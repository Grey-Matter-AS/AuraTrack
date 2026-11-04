import { Button, Checkbox, NumberField, Section, Stack, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import './screens.css';

/** Locking (F-1002): lock by itself after a time away, and unlock with Face ID or a fingerprint where the browser can. */
export function LockSettings() {
  const { t, settings, actions, passkey, passkeySupported } = useApp();
  const [pin, setPin] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <Section title={t('common.lock')}>
      <Stack>
        <Checkbox
          checked={settings.appLockEnabled}
          onChange={(on) => void actions.setSetting('appLockEnabled', on)}
          label={t('settings.appLock')}
          help={t('settings.appLockHelp')}
        />
        {settings.appLockEnabled ? (
          <NumberField
            label={t('settings.autoLock')}
            value={settings.autoLockSeconds}
            max={3600}
            maxLength={4}
            onChange={(seconds) => void actions.setSetting('autoLockSeconds', seconds)}
          />
        ) : null}
        <p className="app-banner">{t('settings.passkey')}</p>
        {!passkeySupported ? (
          <p className="app-note">{t('settings.passkeyNone')}</p>
        ) : passkey ? (
          <>
            <p className="app-note">{t('settings.passkeyDone')}</p>
            <Button variant="danger" onClick={() => void actions.removePasskey()}>
              {t('home.delete')}
            </Button>
          </>
        ) : (
          <>
            <TextField
              label={t('settings.passkeyPin')}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={setPin}
              error={problem}
            />
            <Button
              disabled={pin.length < 4}
              onClick={() => {
                void actions.setupPasskey(pin).then((result) => {
                  setProblem(
                    result === 'ok' ? undefined : result === 'wrong_pin' ? t('lock.wrong') : t('lock.passkeyFailed'),
                  );
                  if (result === 'ok') setPin('');
                });
              }}
            >
              {t('settings.passkeyAdd')}
            </Button>
          </>
        )}
      </Stack>
    </Section>
  );
}
