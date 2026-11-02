import { Button, ButtonRow, Card, Dialog, Screen, Section, Stack, AppHeader } from '@auratrack/ui';
import type { MessageKey } from '@auratrack/i18n';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useEditorHost } from '../editor/EditorContext';
import { usualSymptoms } from '../app/settings';
import { clock } from './format';
import { VideoPreview } from './VideoPreview';
import './screens.css';

// The recording screen (F-201 to F-215). The settled rules: the emergency plan counted from Start, a warning a minute before
// the alert, the 12-minute stop, and no buttons beyond the phase buttons, the quick notes and (if switched on) the symptom
// strip. The same screen is used on the PIN screen and when unlocked; only where the taps are saved differs.

const DEFAULT_NOTES: readonly MessageKey[] = ['quick.fell', 'quick.blue', 'quick.vomited', 'quick.wet'];

export function Recording() {
  const app = useApp();
  const { t, controller, recording, settings, patient, patients, locked, rescue, seizures, cluster, phase } = app;
  const host = useEditorHost();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const session = recording.session;
  const view = recording.view;
  if (!session || !view) return null;

  const isLocked = phase !== 'ready';
  const self = session.recordedBy === 'self';
  const nowMs = session.start + view.elapsedSec * 1000;
  const running = session.status === 'running';
  const seizureEnded = session.seizureEnd !== null;
  const auraSec =
    session.auraEnd !== null ? (session.auraEnd - session.start) / 1000 : seizureEnded ? 0 : view.elapsedSec;
  const seizureSec = session.auraEnd === null ? 0 : ((session.seizureEnd ?? nowMs) - session.auraEnd) / 1000;
  const recoverySec = session.seizureEnd !== null ? ((session.recoveryEnd ?? nowMs) - session.seizureEnd) / 1000 : 0;

  const phaseNow = view.stage === 'aura' ? 'before' : view.stage === 'seizure' ? 'during' : 'after';
  const noteLabels =
    settings.quickNoteLabels.length > 0 ? settings.quickNoteLabels : DEFAULT_NOTES.map((key) => t(key));
  const strip = settings.symptomStrip && !self && running ? usualSymptoms(seizures) : [];

  const card = isLocked ? locked?.screen.card : null;
  const info = isLocked
    ? { rescue: card?.rescue ?? [], contact: card?.contact ?? null, hidden: card === null || card === undefined }
    : { rescue: rescue, contact: patient?.emergencyContact || null, hidden: false };
  const showName = isLocked ? locked?.screen.patientName : patient?.name;

  const alertOpen = view.alert === 'alert' && running && dismissed !== session.seizureId;
  const stopOpen = session.autoStopped && dismissed !== `stop-${session.seizureId}`;

  return (
    <Screen>
      <Stack>
        <AppHeader title={t('rec.title')} {...(showName ? { patient: { name: showName } } : {})} />
        {isLocked ? (
          <Card tone="accent">
            <p className="app-note">{t('rec.lockedNote')}</p>
          </Card>
        ) : patients.length > 1 && patient ? (
          <p className="app-note">{t('rec.recordingFor', { name: patient.name })}</p>
        ) : null}
        <p className="app-timer" role="timer" aria-label={t('rec.timeSince')}>
          {clock(view.elapsedSec)}
        </p>
        <ul className="app-phase-times">
          {self ? null : (
            <li>
              {t('rec.aura')} {clock(auraSec)}
            </li>
          )}
          <li>
            {t('rec.seizure')} {clock(seizureSec)}
          </li>
          {seizureEnded ? (
            <li>
              {t('rec.recovery')} {clock(recoverySec)}
            </li>
          ) : null}
        </ul>

        {cluster ? (
          <Card tone="danger">
            <p className="app-banner">{t('rec.cluster', { count: cluster.count, window: `${cluster.window} min` })}</p>
          </Card>
        ) : null}
        {view.alert === 'warning' && running ? (
          <Card tone="danger">
            <p className="app-banner">{t('rec.warning')}</p>
          </Card>
        ) : null}
        {recording.wakeLock === 'unsupported' || recording.wakeLock === 'denied' ? (
          <Card compact>
            <p className="app-note">
              {t(recording.wakeLock === 'unsupported' ? 'rec.wakeUnsupported' : 'rec.wakeDenied')}
            </p>
          </Card>
        ) : null}
        {recording.save === 'failing' ? (
          <Card tone="danger" compact>
            <p className="app-banner" role="status">
              {t('rec.saveFailing')}
            </p>
          </Card>
        ) : null}
        {session.autoStopped ? (
          <Card tone="danger">
            <p className="app-banner">{t('rec.stoppedNote')}</p>
          </Card>
        ) : null}

        {running && !seizureEnded ? (
          self ? (
            <Button variant="danger" size="lg" fullWidth onClick={() => controller.tap('end_seizure')}>
              {t('rec.stop')}
            </Button>
          ) : (
            <ButtonRow stack>
              {session.auraEnd === null ? (
                <Button variant="warning" size="lg" onClick={() => controller.tap('end_aura')}>
                  {t('rec.endAura')}
                </Button>
              ) : null}
              <Button variant="danger" size="lg" onClick={() => controller.tap('end_seizure')}>
                {t('rec.endSeizure')}
              </Button>
            </ButtonRow>
          )
        ) : (
          <ButtonRow stack>
            {running && session.recoveryEnd === null && !self ? (
              <Button variant="success" size="lg" onClick={() => controller.tap('back_to_normal')}>
                {t('rec.backToNormal')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                const id = session.seizureId;
                void app.actions.closeRecording().then(() => {
                  // Unlocked: straight on to the details. On the PIN screen they wait until the app is unlocked.
                  if (!isLocked) host.openLater(id);
                });
              }}
            >
              {t(isLocked ? 'rec.save' : 'rec.addDetails')}
            </Button>
          </ButtonRow>
        )}

        {strip.length > 0 ? (
          <Section title={t('rec.symptomStrip')}>
            <div className="ui-cluster">
              {strip.map((code) => (
                <Button key={code} onClick={() => controller.symptom(code, phaseNow)}>
                  {app.label(code)}
                </Button>
              ))}
            </div>
          </Section>
        ) : null}

        {running ? (
          <Section title={t('rec.quickNotes')}>
            <div className="ui-cluster">
              {noteLabels.map((text) => (
                <Button key={text} onClick={() => controller.quickNote(text.slice(0, 24))}>
                  {text}
                </Button>
              ))}
            </div>
          </Section>
        ) : null}
        <VideoPreview />
        {session.quickNotes.length > 0 ? (
          <ul className="app-list" aria-label={t('rec.notesSoFar')}>
            {session.quickNotes.map((n) => (
              <li key={n.id}>
                [T+{Math.round((n.at - session.start) / 1000)}s] {n.label}
              </li>
            ))}
          </ul>
        ) : null}
      </Stack>

      {alertOpen ? (
        <Dialog
          tone="emergency"
          title={t(self ? 'alert.selfTitle' : 'alert.carerTitle', { minutes: settings.plan.alertMinutes })}
          dismissible={false}
          message={t(self ? 'alert.selfMessage' : 'alert.carerMessage')}
          actions={
            <Button variant="primary" fullWidth onClick={() => setDismissed(session.seizureId)}>
              {t('common.dismiss')}
            </Button>
          }
        >
          <Stack>
            {info.hidden ? <p>{t('alert.lockedNone')}</p> : null}
            {info.rescue.length > 0 ? (
              <p>
                <strong>{t('alert.rescue')}:</strong>{' '}
                {info.rescue.map((m) => `${m.name}${m.dose ? ` ${m.dose} ${m.unit}` : ''}`).join(', ')}
              </p>
            ) : null}
            {info.contact ? (
              <p>
                <strong>{t('alert.contact')}:</strong> {info.contact}
              </p>
            ) : null}
            {!info.hidden && info.rescue.length === 0 && !info.contact ? <p>{t('alert.noPlan')}</p> : null}
          </Stack>
        </Dialog>
      ) : null}
      {stopOpen ? (
        <Dialog
          tone="emergency"
          title={t('stop.title')}
          dismissible={false}
          message={t('stop.message')}
          actions={
            <Button variant="primary" fullWidth onClick={() => setDismissed(`stop-${session.seizureId}`)}>
              {t('common.dismiss')}
            </Button>
          }
        />
      ) : null}
    </Screen>
  );
}
