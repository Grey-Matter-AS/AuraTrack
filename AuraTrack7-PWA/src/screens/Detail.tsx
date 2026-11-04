import { buildDangerMap, type EegActivity } from '@auratrack/model';
import { AppHeader, Button, Card, Dialog, Screen, Section, Stack } from '@auratrack/ui';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useRecords } from '../app/records';
import { areaText } from '../editor/BodyMap';
import { draftFromSeizure } from '../editor/draft';
import { useEditorHost } from '../editor/EditorContext';
import { useNav } from '../editor/nav';
import { OverviewStrip, Timeline } from '../editor/Timeline';
import { downloadBlob } from '../recording/video';
import '../editor/editor.css';
import './screens.css';

/** One seizure in full (F-403): timing, the timeline, after-seizure findings, triggers, notes, flags and the edit history. */
export function Detail({ id }: { id: string }) {
  const app = useApp();
  const { t, label, fmt, seizures, settings, actions } = app;
  const nav = useNav();
  const host = useEditorHost();
  const seizure = seizures.find((s) => s.id === id);
  const eegNotes = useRecords<EegActivity>('eegActivity', { all: true }) ?? [];
  const [trail, setTrail] = useState<{ at: number; kind: string; fields: string[] }[]>([]);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    void actions
      .history(id)
      .then(setTrail)
      .catch(() => undefined);
  }, [actions, id, seizure]);
  const danger = useMemo(() => buildDangerMap(seizures, settings.plan), [seizures, settings.plan]);
  if (!seizure)
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('det.title')} onBack={() => nav.pop()} />
          <p className="app-note">{t('det.gone')}</p>
        </Stack>
      </Screen>
    );
  const flags = danger[seizure.id];
  const draft = draftFromSeizure(seizure);
  const linked = eegNotes.filter((n) => n.linkedSeizureId === seizure.id);
  const sources = [
    seizure.phases.start,
    seizure.phases.auraEnd,
    seizure.phases.seizureEnd,
    seizure.phases.recoveryEnd,
  ].filter((m) => m !== null);
  const entered = sources.some((m) => m.source === 'entered-later');
  const edited = sources.some((m) => m.source === 'edited');
  return (
    <Screen>
      <Stack>
        <AppHeader title={seizure.typeCode ? label(seizure.typeCode) : t('home.untyped')} onBack={() => nav.pop()} />
        <Card>
          <Stack gap="0.5rem">
            <p className="app-banner">{fmt.when(seizure.phases.start.at)}</p>
            <OverviewStrip draft={draft} />
            {entered ? <p className="app-note">{t('det.enteredLater')}</p> : null}
            {edited ? <p className="app-note">{t('det.edited')}</p> : null}
            {seizure.isEmergencyStop ? <p className="app-note">{t('home.badgeStopped')}</p> : null}
            {seizure.recordedWhileLocked ? <p className="app-note">{t('home.badgeLocked')}</p> : null}
            {seizure.cancelled === true ? <p className="app-note">{t('home.badgeCancelled')}</p> : null}
            {flags?.flags.includes('long_duration') ? (
              <p className="app-banner">{t('det.long', { minutes: settings.plan.alertMinutes })}</p>
            ) : null}
            {flags?.flags.includes('cluster') ? (
              <p className="app-banner">
                {t('det.cluster', { count: flags.clusterCount, minutes: settings.plan.clusterWindowMinutes })}
              </p>
            ) : null}
            {seizure.eegSessionId ? <p className="app-note">{t('det.eeg')}</p> : null}
          </Stack>
        </Card>
        {seizure.symptoms.length > 0 || draft.start ? (
          <Section title={t('tl.aria')}>
            <Timeline draft={draft} />
          </Section>
        ) : null}
        {seizure.afterFindings.length > 0 || seizure.recoveryMinutes !== null || seizure.recoveryOngoing ? (
          <Section title={t('det.afterFindings')}>
            <Stack gap="0.5rem">
              {seizure.afterFindings.map((f, i) => (
                <p className="app-note" key={i}>
                  {f.customLabel ?? label(f.code)}
                  {f.areas.length > 0 ? ` · ${f.areas.map((a) => areaText(a, label)).join('; ')}` : ''}
                </p>
              ))}
              {seizure.recoveryMinutes !== null ? (
                <p className="app-note">{t('det.recovery', { minutes: seizure.recoveryMinutes })}</p>
              ) : null}
              {seizure.recoveryOngoing ? <p className="app-note">{t('det.recoveryOngoing')}</p> : null}
            </Stack>
          </Section>
        ) : null}
        {seizure.triggerCodes.length > 0 ? (
          <Section title={t('det.triggers')}>
            <p className="app-note">{seizure.triggerCodes.map(label).join(', ')}</p>
          </Section>
        ) : null}
        {seizure.notes ? (
          <Section title={t('det.notes')}>
            <p className="app-help">{seizure.notes}</p>
          </Section>
        ) : null}
        {(seizure.quickNotes ?? []).length > 0 ? (
          <Section title={t('det.quickNotes')}>
            <Stack gap="0.25rem">
              {(seizure.quickNotes ?? []).map((n) => (
                <p className="app-note" key={n.id}>
                  {fmt.time(n.at)} · {n.label}
                </p>
              ))}
            </Stack>
          </Section>
        ) : null}
        {seizure.video ? <VideoSection seizureId={seizure.id} fileName={seizure.video.fileName} /> : null}
        <Section title={t('det.history')}>
          <Stack gap="0.25rem">
            {trail.map((e, i) => (
              <p className="app-note" key={i}>
                {fmt.when(e.at)} ·{' '}
                {t(e.kind === 'create' ? 'det.created' : e.kind === 'import' ? 'det.imported' : 'det.changed')}
                {e.kind === 'update' && e.fields.length > 0 ? ` (${e.fields.length})` : ''}
              </p>
            ))}
          </Stack>
        </Section>
        <div className="ui-cluster">
          {seizure.status === 'in_progress' ? null : (
            <Button
              variant="primary"
              onClick={() => {
                host.open(seizure);
                nav.push('editor');
              }}
            >
              {t('common.edit')}
            </Button>
          )}
          <Button variant="danger" onClick={() => setDeleting(true)}>
            {t('home.delete')}
          </Button>
        </div>
      </Stack>
      {deleting ? (
        <Dialog
          title={t('det.deleteTitle')}
          message={linked.length > 0 ? `${t('det.deleteText')} ${t('det.deleteEeg')}` : t('det.deleteText')}
          tone="danger"
          onClose={() => setDeleting(false)}
          actions={
            <>
              <Button onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void (async () => {
                    // The seizure goes first: while it exists, the diary would add its reference again
                    await actions.deleteSeizure(seizure.id);
                    for (const note of linked) await actions.removeRecord('eegActivity', note.id);
                    setDeleting(false);
                    nav.pop();
                  })();
                }}
              >
                {t('home.delete')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

/** The video of a seizure, played from the sealed copy on this phone, with a copy to save and a way to delete it. */
function VideoSection({ seizureId, fileName }: { seizureId: string; fileName: string }) {
  const { t, api, actions } = useApp();
  const [clip, setClip] = useState<{ url: string; blob: Blob; size: number } | 'missing' | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void Promise.resolve(api.videoGet({ seizureId }))
      .then((found) => {
        if (!live) return;
        if (!found) return setClip('missing');
        const blob = new Blob([found.bytes as BlobPart], { type: found.mime });
        url = URL.createObjectURL(blob);
        setClip({ url, blob, size: found.bytes.byteLength });
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, seizureId]);
  return (
    <Section title={t('det.video')}>
      <Stack gap="0.5rem">
        <p className="app-note">{fileName}</p>
        {clip === 'missing' ? <p className="app-note">{t('det.videoElsewhere')}</p> : null}
        {clip && clip !== 'missing' ? (
          <>
            <video className="app-video" controls src={clip.url} aria-label={t('det.video')} />
            <p className="app-note">{t('det.videoSize', { mb: (clip.size / 1_048_576).toFixed(1) })}</p>
            <div className="ui-cluster">
              <Button size="md" onClick={() => downloadBlob(clip.blob, fileName)}>
                {t('det.videoSave')}
              </Button>
              <Button size="md" variant="danger" onClick={() => setAsking(true)}>
                {t('det.videoDelete')}
              </Button>
            </div>
          </>
        ) : null}
        <p className="app-note">{t('det.videoPrivate')}</p>
      </Stack>
      {asking ? (
        <Dialog
          title={t('det.videoDeleteTitle')}
          message={t('det.videoDeleteText')}
          tone="danger"
          onClose={() => setAsking(false)}
          actions={
            <>
              <Button onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void api.videoDelete({ seizureId }).then(() => actions.refresh().then(() => setAsking(false)));
                }}
              >
                {t('home.delete')}
              </Button>
            </>
          }
        />
      ) : null}
    </Section>
  );
}
