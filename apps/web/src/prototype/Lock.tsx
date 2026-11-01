import { AppHeader, Button, Card, RoundButton, Screen, Select, Stack, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { RESCUE, emptyDraft } from './data';
import { useNav } from './nav';
import { usePrototype } from './state';

// The lock screen: PIN (or the passkey, here only pretended), and Start, which never waits for the PIN.
// What the alert shows while locked is a setting; the default is the rescue medication and the contacts.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function Lock() {
  const nav = useNav();
  const toast = useToast();
  const { lockedAlert, setLockedAlert, setDraft } = usePrototype();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = (digit: string) => {
    const next = (pin + digit).slice(0, 4);
    setWrong(false);
    setPin(next);
    if (next.length === 4) {
      if (next === '2468') {
        toast('Unlocked', 'success');
        nav.pop();
      } else {
        setWrong(true);
        setPin('');
      }
    }
  };

  return (
    <Screen>
      <Stack>
        <AppHeader title="AuraTrack is locked" onBack={() => nav.pop()} />
        <RoundButton
          tone="danger"
          onClick={() => {
            setDraft(emptyDraft(Date.now()));
            nav.push('record', { locked: true });
          }}
        >
          Start timer
        </RoundButton>
        <p className="proto-note">Starting a recording never needs the PIN.</p>

        <p className="proto-pin-dots" aria-label={`${pin.length} of 4 digits entered`}>
          {'●'.repeat(pin.length)}
          {'○'.repeat(4 - pin.length)}
        </p>
        {wrong ? (
          <p className="proto-banner" role="alert">
            That PIN is not right. Try again.
          </p>
        ) : null}
        <div className="proto-pin">
          {KEYS.map((k) => (
            <Button key={k} size="lg" onClick={() => press(k)}>
              {k}
            </Button>
          ))}
          <Button size="lg" variant="ghost" onClick={() => setPin((p) => p.slice(0, -1))}>
            ⌫
          </Button>
          <Button size="lg" onClick={() => press('0')}>
            0
          </Button>
          <Button size="lg" variant="ghost" onClick={() => toast('Face ID or fingerprint (simulated)', 'success')}>
            ID
          </Button>
        </div>
        <p className="proto-note">The PIN in this prototype is 2468.</p>

        <Card compact>
          <Stack>
            <Select
              label="While locked, the alert shows"
              value={lockedAlert}
              onChange={(v) => setLockedAlert(v === 'nothing' || v === 'rescue' ? v : 'rescue_and_contacts')}
              options={[
                { value: 'nothing', label: 'Nothing personal' },
                { value: 'rescue', label: 'Rescue medication' },
                { value: 'rescue_and_contacts', label: 'Rescue medication and contacts' },
              ]}
            />
            <p className="proto-banner">Preview of the alert while locked</p>
            <p>5 minutes: follow the emergency plan.</p>
            {lockedAlert !== 'nothing' ? <p>Rescue medication: {RESCUE.medication}</p> : null}
            {lockedAlert === 'rescue_and_contacts' ? <p>Emergency contact: {RESCUE.contact}</p> : null}
          </Stack>
        </Card>
      </Stack>
    </Screen>
  );
}
