import { type EegActivity } from '@auratrack/model';
import { AppHeader, Button, Card, Screen, Section, Stack, TextArea, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { ActivitySheet, ConfirmDelete, RunningCard, hms } from './Eeg';
import './screens.css';

/** One session (F-407, F-582, F-583): its details, and its activities and seizure references in time order. */
export function EegSession({ id }: { id: string }) {
  const app = useApp();
  const { t, fmt, label, eegSessions, eegActivities, actions } = app;
  const nav = useNav();
  const session = eegSessions.find((s) => s.id === id);
  // What is typed shows until it is saved; then the saved text shows again
  const [titleDraft, setTitle] = useState<string | null>(null);
  const [notesDraft, setNotes] = useState<string | null>(null);
  const title = titleDraft ?? session?.title ?? '';
  const notes = notesDraft ?? session?.notes ?? '';
  const [sheet, setSheet] = useState<{ existing?: EegActivity } | null>(null);
  const [deleting, setDeleting] = useState<'session' | EegActivity | null>(null);
  if (!session)
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('more.eeg')} onBack={() => nav.pop()} />
          <p className="app-note">{t('eeg.gone')}</p>
        </Stack>
      </Screen>
    );
  const items = eegActivities.filter((a) => a.sessionId === session.id).sort((a, b) => a.startTime - b.startTime);
  return (
    <Screen>
      <Stack>
        <AppHeader title={session.title || t('eeg.untitled')} onBack={() => nav.pop()} />
        {session.status === 'active' ? <RunningCard session={session} onActivity={() => setSheet({})} /> : null}
        <Card>
          <Stack gap="0.5rem">
            <p className="app-note">
              {fmt.when(session.startTime)}
              {session.actualEndTime ? ` – ${fmt.when(session.actualEndTime)}` : ` · ${t('eeg.running.session')}`}
            </p>
            {session.plannedEndTime ? (
              <p className="app-note">{t('eeg.plannedEnd', { time: fmt.when(session.plannedEndTime) })}</p>
            ) : null}
            <TextField label={t('eeg.title')} value={title} onChange={setTitle} />
            <TextArea label={t('eeg.notes')} value={notes} onChange={setNotes} rows={3} />
            <Button
              size="md"
              disabled={title === session.title && notes === session.notes}
              onClick={() =>
                void actions
                  .updateRecord('eegSession', session.id, { title: title.trim().slice(0, 120), notes: notes.trim() })
                  .then(() => {
                    setTitle(null);
                    setNotes(null);
                  })
              }
            >
              {t('common.save')}
            </Button>
          </Stack>
        </Card>
        <Section title={t('eeg.timeline')}>
          {items.length === 0 ? (
            <p className="app-note">{t('eeg.noActivities')}</p>
          ) : (
            <Stack>
              {items.map((a) => (
                <Card compact key={a.id}>
                  <Stack gap="0.25rem">
                    <p className="app-banner">
                      {a.kind === 'seizure_reference'
                        ? `${t('eeg.seizure')}${a.activityCode ? ` · ${label(a.activityCode)}` : ''}`
                        : a.customText || label(a.activityCode ?? '')}
                    </p>
                    <p className="app-note">
                      {a.kind === 'seizure_reference' ? fmt.timeSec(a.startTime) : fmt.time(a.startTime)}
                      {a.endTime
                        ? ` – ${a.kind === 'seizure_reference' ? fmt.timeSec(a.endTime) : fmt.time(a.endTime)}`
                        : a.kind === 'activity'
                          ? ` · ${t('eeg.running.session')}`
                          : ''}
                      {a.durationSec !== null
                        ? ` · ${a.kind === 'activity' ? hms(a.durationSec) : fmt.duration(a.durationSec)}`
                        : ''}
                    </p>
                    {a.moodCode ? <p className="app-note">{label(a.moodCode)}</p> : null}
                    {a.notes ? <p className="app-note">{a.notes}</p> : null}
                    <div className="ui-cluster">
                      {a.kind === 'activity' ? (
                        <Button size="md" onClick={() => setSheet({ existing: a })}>
                          {t('common.edit')}
                        </Button>
                      ) : a.linkedSeizureId ? (
                        <Button size="md" onClick={() => nav.push('detail', { id: a.linkedSeizureId })}>
                          {t('hist.open')}
                        </Button>
                      ) : null}
                      {a.kind === 'activity' ? (
                        <Button size="md" variant="danger" onClick={() => setDeleting(a)}>
                          {t('home.delete')}
                        </Button>
                      ) : null}
                    </div>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
        <div className="ui-cluster">
          <Button variant="danger" onClick={() => setDeleting('session')}>
            {t('eeg.deleteSession')}
          </Button>
        </div>
      </Stack>
      {sheet ? (
        <ActivitySheet
          session={session}
          {...(sheet.existing ? { existing: sheet.existing } : {})}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {deleting === 'session' ? (
        <ConfirmDelete
          title={t('eeg.deleteSessionTitle')}
          text={t('eeg.deleteSessionText')}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            void (async () => {
              // The session goes first: while it exists, a seizure freed from it would be tied to it again
              await actions.removeRecord('eegSession', session.id);
              for (const a of items) await actions.removeRecord('eegActivity', a.id);
              // The seizures stay in History, no longer tied to a session that is gone
              for (const z of app.seizures.filter((x) => x.eegSessionId === session.id))
                await actions.updateRecord('seizure', z.id, { eegSessionId: null });
              setDeleting(null);
              nav.pop();
            })();
          }}
        />
      ) : null}
      {deleting && deleting !== 'session' ? (
        <ConfirmDelete
          title={t('eeg.deleteActivityTitle')}
          text={t('eeg.deleteActivityText')}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            void actions.removeRecord('eegActivity', deleting.id).then(() => setDeleting(null));
          }}
        />
      ) : null}
    </Screen>
  );
}
