import { buildDangerMap, seizureSeconds, type Seizure } from '@auratrack/model';
import { AppHeader, Button, Card, RoundButton, Screen, Section, Stack } from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useEditorHost } from '../editor/EditorContext';
import { useNav } from '../editor/nav';
import { BetweenSheet } from './Between';
import { clock, whenText } from './format';
import { LogPast } from './LogPast';
import { Recovery } from './Recovery';
import { UpdateCard } from './UpdateCard';
import { LockSettings } from './LockSettings';
import { RecordingSettings } from './RecordingSettings';
import './screens.css';

// Home (F-101 to F-103): Start timer, Log past seizure, the last five seizures, and the cards that need an answer. Medication
// and wellbeing cards arrive in M4; the between-seizures log in slice 8.

export function Home() {
  const app = useApp();
  const { t, language, patient, patients, seizures, settings, actions, between } = app;
  const nav = useNav();
  const host = useEditorHost();
  const [logging, setLogging] = useState(false);
  const [betweenOpen, setBetweenOpen] = useState(false);
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
          {...(patient ? { patient: { name: patient.name } } : {})}
          {...(patients.length > 1 ? { onPatientClick: () => void actions.switchPatient() } : {})}
          actions={
            <Button size="md" onClick={() => void actions.lock()}>
              {t('common.lock')}
            </Button>
          }
        />

        <UpdateCard />
        <Recovery />

        {cancelled.map((s) => (
          <Card key={s.id} tone="danger">
            <Stack>
              <p className="app-banner">{t('home.cancelledTitle')}</p>
              <p className="app-note">
                {whenText(language, s.phases.start.at)} · {t('home.cancelledText')}
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
            <p className="app-banner">{whenText(language, s.phases.start.at)}</p>
            <p className="app-note">{t('home.lockedText')}</p>
          </Card>
        ))}

        <Section title={t('home.recent')}>
          {recent.length === 0 ? (
            <p className="app-note">{t('home.noSeizures')}</p>
          ) : (
            <Stack>
              {recent.map((s) => (
                <SeizureCard key={s.id} seizure={s} flags={danger[s.id]} onEdit={() => edit(s)} />
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
                    <p className="app-note">{whenText(language, b.occurredAt)}</p>
                  </div>
                  <Button size="md" variant="danger" onClick={() => void actions.deleteBetween(b.id)}>
                    {t('between.delete')}
                  </Button>
                </div>
              </Card>
            ))}
          </Stack>
        </Section>

        <Card compact>
          <p className="app-note">{t('home.laterNote')}</p>
        </Card>

        <Button fullWidth onClick={() => nav.push('sets')}>
          {t('settings.sets')}
        </Button>

        <RecordingSettings />
        <LockSettings />
      </Stack>
      {betweenOpen ? <BetweenSheet opened={openedAt} onClose={() => setBetweenOpen(false)} /> : null}
      {logging ? <LogPast initial={openedAt} onClose={() => setLogging(false)} /> : null}
    </Screen>
  );
}

function SeizureCard({
  seizure,
  flags,
  onEdit,
}: {
  seizure: Seizure;
  flags: ReturnType<typeof buildDangerMap>[string] | undefined;
  onEdit: () => void;
}) {
  const { t, label, language } = useApp();
  const length = seizureSeconds(seizure.phases);
  const badges = [
    seizure.isManualEntry ? t('home.badgeManual') : null,
    seizure.recordedWhileLocked ? t('home.badgeLocked') : null,
    seizure.isEmergencyStop ? t('home.badgeStopped') : null,
    flags?.flags.includes('long_duration') ? t('home.longSeizure') : null,
    flags?.flags.includes('cluster') ? t('home.badgeCluster', { count: flags.clusterCount }) : null,
    seizure.status === 'in_progress' ? t('rec.title') : null,
  ].filter((b): b is string => b !== null);
  return (
    <Card compact>
      <div className="app-row">
        <div>
          <p className="app-banner">{seizure.typeCode ? label(seizure.typeCode) : t('home.untyped')}</p>
          <p className="app-note">
            {whenText(language, seizure.phases.start.at)}
            {length !== null ? ` · ${clock(length)}` : ''}
          </p>
          {badges.length > 0 ? <p className="app-note">{badges.join(' · ')}</p> : null}
          {seizure.status === 'recorded' ? <p className="app-note">{t('home.detailsDue')}</p> : null}
        </div>
        {seizure.status === 'in_progress' ? null : (
          <Button size="md" onClick={onEdit}>
            {t(seizure.status === 'complete' ? 'common.edit' : 'rec.addDetails')}
          </Button>
        )}
      </div>
    </Card>
  );
}
