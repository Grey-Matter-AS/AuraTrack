import { activeSession, buildDangerMap, type Seizure } from '@auratrack/model';
import { AppHeader, Button, Card, RoundButton, Screen, Section, Stack } from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useEditorHost } from '../editor/EditorContext';
import { useNav } from '../editor/nav';
import { BetweenSheet } from './Between';
import { LogPast } from './LogPast';
import { Recovery } from './Recovery';
import { UpdateCard } from './UpdateCard';
import { DosePanel } from './DosePanel';
import { BackupCard, InstallCard, WellbeingCard, WhatsNewCard } from './HomeCards';
import { CheckIn } from './Wellbeing';
import { ActivitySheet, RunningCard, StartSession } from './Eeg';
import { MainNav } from './MainNav';
import { SeizureCard } from './SeizureCard';
import './screens.css';

// Home (F-101 to F-103): Start timer, Log past seizure, the last five seizures, and the cards that need an answer. Medication
// and wellbeing cards arrive in M4; the between-seizures log in slice 8.

export function Home() {
  const app = useApp();
  const { t, fmt, patient, patients, seizures, settings, actions, between } = app;
  const nav = useNav();
  const host = useEditorHost();
  const [logging, setLogging] = useState(false);
  const [betweenOpen, setBetweenOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(false);
  const [eegSheet, setEegSheet] = useState<'start' | 'activity' | null>(null);
  const eegRunning = patient ? activeSession(app.eegSessions, patient.id) : null;
  const [openedAt] = useState(() => Date.now() - 3_600_000);
  const danger = buildDangerMap(seizures, settings.plan);

  // After a recording, "Add details" asks for the editor once Home is on screen
  const pending = host.pending;
  const target = pending ? seizures.find((x) => x.id === pending) : undefined;
  useEffect(() => {
    if (!target) return;
    host.open(target);
    host.openLater(null);
    nav.push('editor');
  }, [target, host, nav]);
  const edit = (seizure: Seizure) => {
    host.open(seizure);
    nav.push('editor');
  };

  const cancelled = seizures.filter((s) => s.cancelled === true);
  const kept = seizures.filter((s) => s.cancelled !== true);
  const lockedOnes = kept.filter((s) => s.recordedWhileLocked === true && s.typeCode === null);
  const recent = kept.slice(0, 5);

  return (
    <Screen>
      <Stack>
        <AppHeader
          title="AuraTrack"
          {...(patient ? { patient: { name: patient.name, color: patient.color } } : {})}
          {...(patients.length > 1 ? { onPatientClick: () => void actions.switchPatient() } : {})}
          actions={
            <Button size="md" onClick={() => void actions.lock()}>
              {t('common.lock')}
            </Button>
          }
        />

        <MainNav current="home" />
        <UpdateCard />
        <Recovery />
        <WhatsNewCard />
        <BackupCard />
        <InstallCard />
        {app.video.notice ? (
          <Card tone={app.video.notice === 'failed' ? 'danger' : 'accent'} compact>
            <div className="app-row">
              <p className="app-banner">{t(`video.${app.video.notice}` as never)}</p>
              <Button size="md" onClick={actions.dismissVideoNotice}>
                {t('common.dismiss')}
              </Button>
            </div>
          </Card>
        ) : null}

        {cancelled.map((s) => (
          <Card key={s.id} tone="danger">
            <Stack>
              <p className="app-banner">{t('home.cancelledTitle')}</p>
              <p className="app-note">
                {fmt.when(s.phases.start.at)} · {t('home.cancelledText')}
              </p>
              <div className="ui-cluster">
                <Button variant="danger" onClick={() => void actions.deleteSeizure(s.id)}>
                  {t('home.delete')}
                </Button>
                <Button onClick={() => void actions.keepSeizure(s.id)}>{t('home.keep')}</Button>
              </div>
            </Stack>
          </Card>
        ))}

        <div className="app-round-row">
          <RoundButton tone="danger" onClick={actions.startRecording}>
            {t('home.start')}
          </RoundButton>
          <RoundButton tone="warning" onClick={() => setLogging(true)}>
            {t('home.logPast')}
          </RoundButton>
        </div>

        {lockedOnes.map((s) => (
          <Card key={s.id} tone="accent" compact>
            <p className="app-banner">{fmt.when(s.phases.start.at)}</p>
            <p className="app-note">{t('home.lockedText')}</p>
          </Card>
        ))}

        {app.reminders
          .filter((r) => r.patientId === patient?.id)
          .map((r) => (
            <Card key={r.key} tone="accent" compact>
              <div className="app-row">
                <div>
                  <p className="app-banner">{t('dose.reminder', { name: r.name })}</p>
                  <p className="app-note">{r.scheduledTime}</p>
                </div>
                <Button size="md" onClick={() => actions.dismissReminder(r.key)}>
                  {t('common.dismiss')}
                </Button>
              </div>
            </Card>
          ))}
        {app.reminders
          .filter((r) => r.patientId !== patient?.id)
          .map((r) => (
            <Card key={r.key} tone="accent" compact>
              <div className="app-row">
                <div>
                  <p className="app-banner">
                    {t('dose.reminderFor', {
                      name: r.name,
                      person: patients.find((p) => p.id === r.patientId)?.name ?? '',
                    })}
                  </p>
                  <p className="app-note">{r.scheduledTime}</p>
                </div>
                <Button size="md" onClick={() => actions.dismissReminder(r.key)}>
                  {t('common.dismiss')}
                </Button>
              </div>
            </Card>
          ))}
        <DosePanel />

        <WellbeingCard onCheckIn={() => setCheckIn(true)} />

        {settings.eegEnabled ? (
          eegRunning ? (
            <RunningCard
              session={eegRunning}
              onActivity={() => setEegSheet('activity')}
              onOpen={() => nav.push('eeg')}
            />
          ) : (
            <Card compact>
              <div className="ui-cluster">
                <Button size="md" onClick={() => setEegSheet('start')}>
                  {t('eeg.start')}
                </Button>
                <Button size="md" onClick={() => nav.push('eeg')}>
                  {t('eeg.diary')}
                </Button>
              </div>
            </Card>
          )
        ) : null}

        <Section title={t('home.recent')}>
          {recent.length === 0 ? (
            <p className="app-note">{t('home.noSeizures')}</p>
          ) : (
            <Stack>
              {recent.map((s) => (
                <SeizureCard
                  key={s.id}
                  seizure={s}
                  flags={danger[s.id]}
                  action={{
                    label: t(s.status === 'complete' ? 'common.edit' : 'rec.addDetails'),
                    onClick: () => edit(s),
                  }}
                />
              ))}
            </Stack>
          )}
        </Section>

        <Section title={t('home.between')}>
          <Stack>
            <Button fullWidth onClick={() => setBetweenOpen(true)}>
              {t('home.betweenLog')}
            </Button>
            {between.slice(0, 5).map((b) => (
              <Card compact key={b.id}>
                <div className="app-row">
                  <div>
                    <p className="app-banner">{app.label(b.symptomCode)}</p>
                    <p className="app-note">{fmt.when(b.occurredAt)}</p>
                  </div>
                  <Button size="md" variant="danger" onClick={() => void actions.deleteBetween(b.id)}>
                    {t('between.delete')}
                  </Button>
                </div>
              </Card>
            ))}
          </Stack>
        </Section>
      </Stack>
      {checkIn ? <CheckIn entry={null} onClose={() => setCheckIn(false)} /> : null}
      {eegSheet === 'start' ? <StartSession onClose={() => setEegSheet(null)} /> : null}
      {eegSheet === 'activity' && eegRunning ? (
        <ActivitySheet session={eegRunning} onClose={() => setEegSheet(null)} />
      ) : null}
      {betweenOpen ? <BetweenSheet opened={openedAt} onClose={() => setBetweenOpen(false)} /> : null}
      {logging ? <LogPast initial={openedAt} onClose={() => setLogging(false)} /> : null}
    </Screen>
  );
}
