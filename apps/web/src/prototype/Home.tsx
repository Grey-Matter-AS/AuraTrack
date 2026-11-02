import { LANGUAGES } from '@auratrack/i18n';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Section,
  Screen,
  Select,
  Stack,
  ToastProvider,
  RoundButton,
} from '@auratrack/ui';
import { useState } from 'react';
import { BetweenSheet } from './Between';
import { PATIENTS, RECENT, emptyDraft, mmss } from './data';
import { useNav } from './nav';
import { usePrototype } from './state';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nb: 'Norsk bokmål',
  nn: 'Norsk nynorsk',
  da: 'Dansk',
  sv: 'Svenska',
  fi: 'Suomi',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export function Home() {
  const nav = useNav();
  const p = usePrototype();
  const { t } = p;
  const [now] = useState(() => Date.now());
  const when = (daysAgo: number, hour: number, minute: number) => {
    const day = new Date(now - daysAgo * 86_400_000);
    day.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat(p.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(day);
  };
  const [between, setBetween] = useState(false);
  const [help, setHelp] = useState(false);

  const start = () => {
    p.setDraft(emptyDraft(Date.now()));
    nav.push('record');
  };
  const past = (seconds = 90, type: string | null = null) => {
    const base = Date.now() - 3_600_000;
    p.setDraft({
      ...emptyDraft(base),
      isPast: true,
      source: 'entered-later',
      seizureEnd: base + seconds * 1000,
      recoveryEnd: base + seconds * 1000 + 5 * 60_000,
      typeCode: type,
    });
    nav.push('editor');
  };

  return (
    <Screen>
      <Stack>
        <AppHeader
          title="AuraTrack"
          patient={PATIENTS[p.patient] ?? PATIENTS[0]}
          onPatientClick={() => p.setPatient((p.patient + 1) % PATIENTS.length)}
          actions={
            <Button size="md" onClick={() => nav.push('lock')}>
              {t('common.lock')}
            </Button>
          }
        />
        <Card tone="accent">
          <p className="proto-banner">Prototype</p>
          <p className="proto-note">
            Made-up data. Nothing is saved or sent anywhere. Try the whole flow, then tell me what to change before the
            real build starts.
          </p>
          <Button variant="ghost" onClick={() => setHelp(true)}>
            What to try
          </Button>
        </Card>

        <div className="proto-round-row">
          <RoundButton tone="danger" onClick={start}>
            {t('home.start')}
          </RoundButton>
          <RoundButton tone="warning" onClick={() => past()}>
            {t('home.logPast')}
          </RoundButton>
        </div>

        <Section title={t('home.recent')}>
          <Stack>
            {RECENT.map((r) => (
              <Card compact key={r.id}>
                <div className="proto-row">
                  <div>
                    <p className="proto-banner">{p.label(r.typeCode)}</p>
                    <p className="proto-note">
                      {when(r.daysAgo, r.hour, r.minute)} · {mmss(r.seconds)}
                      {r.flag === 'long' ? ` · ${t('home.longSeizure')}` : ''}
                    </p>
                  </div>
                  <Button size="md" onClick={() => past(r.seconds, r.typeCode)}>
                    {t('common.edit')}
                  </Button>
                </div>
              </Card>
            ))}
          </Stack>
        </Section>

        <Section title={t('home.between')}>
          <Button fullWidth onClick={() => setBetween(true)}>
            {t('home.betweenLog')}
          </Button>
        </Section>

        <Card compact>
          <p className="proto-note">Medication today and wellbeing cards arrive in a later milestone.</p>
        </Card>

        <Section title="Prototype settings">
          <Stack>
            <Checkbox
              checked={p.selfMode}
              onChange={p.setSelfMode}
              label="Recording for myself"
              help="A simpler recording screen with no phase buttons"
            />
            <Checkbox
              checked={p.symptomStrip}
              onChange={p.setSymptomStrip}
              label="Symptom strip while recording"
              help="Off by default in the real app"
            />
            <Select
              label="Language"
              value={p.language}
              onChange={(v) => p.setLanguage(LANGUAGES.find((l) => l === v) ?? 'en')}
              options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] ?? l }))}
            />
          </Stack>
        </Section>
      </Stack>
      {between ? <BetweenSheet onClose={() => setBetween(false)} /> : null}
      {help ? (
        <BottomSheet
          title="What to try"
          onClose={() => setHelp(false)}
          footer={
            <Button variant="primary" fullWidth onClick={() => setHelp(false)}>
              Got it
            </Button>
          }
        >
          <Stack>
            <p>
              1. Start timer, then End aura and End seizure. Use the prototype buttons to skip ahead to 4 and 5 minutes
              (the warning and the alert) and 12 minutes (auto-stop).
            </p>
            <p>
              2. In the editor: switch tabs, add symptoms, set where they were felt on the body map, change the order
              and the time between, then Review.
            </p>
            <p>3. Lock: Start works from the lock screen. The PIN here is 2468.</p>
            <p>4. Change the language in the settings below to see the screens in that language.</p>
          </Stack>
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

export { ToastProvider };
