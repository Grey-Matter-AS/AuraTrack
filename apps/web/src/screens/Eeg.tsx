import {
  EEG_ACTIVITIES,
  EEG_PRESETS,
  MOODS,
  activeSession,
  elapsedSeconds,
  plannedEnd,
  runningActivity,
  type EegActivity,
  type EegSession,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  Dialog,
  Screen,
  Section,
  Select,
  Stack,
  TextArea,
  TextField,
  DecimalField,
  useToast,
} from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import './screens.css';

/** The EEG diary (F-407, F-581 to F-585): the running session, and the sessions before it. */
export function Eeg() {
  const app = useApp();
  const { t, fmt, patient, eegSessions, settings } = app;
  const nav = useNav();
  const [starting, setStarting] = useState(false);
  const [activity, setActivity] = useState(false);
  const running = patient ? activeSession(eegSessions, patient.id) : null;
  const done = eegSessions.filter((s) => s.status === 'completed').sort((a, b) => b.startTime - a.startTime);
  if (!settings.eegEnabled)
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('more.eeg')} onBack={() => nav.pop()} />
          <p className="app-note">{t('eeg.off')}</p>
        </Stack>
      </Screen>
    );
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.eeg')} onBack={() => nav.pop()} />
        {running ? (
          <RunningCard
            session={running}
            onActivity={() => setActivity(true)}
            onOpen={() => nav.push('eegSession', { id: running.id })}
          />
        ) : (
          <Button variant="primary" fullWidth onClick={() => setStarting(true)}>
            {t('eeg.start')}
          </Button>
        )}
        <Section title={t('eeg.sessions')}>
          {done.length === 0 ? (
            <p className="app-note">{t('eeg.none')}</p>
          ) : (
            <Stack>
              {done.map((s) => (
                <Card compact key={s.id}>
                  <div className="app-row">
                    <div>
                      <p className="app-banner">{s.title || t('eeg.untitled')}</p>
                      <p className="app-note">
                        {fmt.when(s.startTime)}
                        {s.actualEndTime ? ` – ${fmt.when(s.actualEndTime)}` : ''}
                      </p>
                    </div>
                    <Button size="md" onClick={() => nav.push('eegSession', { id: s.id })}>
                      {t('hist.open')}
                    </Button>
                  </div>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
      </Stack>
      {starting ? <StartSession onClose={() => setStarting(false)} /> : null}
      {activity && running ? <ActivitySheet session={running} onClose={() => setActivity(false)} /> : null}
    </Screen>
  );
}

/** Seconds as "2:05:09" (the clock of a session that runs for hours). */
export const hms = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** The running session: elapsed time, the running activity, and the buttons to start or stop an activity or end the session. */
export function RunningCard({
  session,
  onActivity,
  onOpen,
}: {
  session: EegSession;
  onActivity: () => void;
  onOpen?: () => void;
}) {
  const app = useApp();
  const { t, fmt, eegActivities, actions } = app;
  const [now, setNow] = useState(() => app.controller.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(app.controller.now()), 1000);
    return () => window.clearInterval(timer);
  }, [app.controller]);
  const current = runningActivity(eegActivities, session.id);
  const toast = useToast();
  return (
    <Card tone="accent">
      <Stack gap="0.5rem">
        <p className="app-banner">{session.title || t('eeg.untitled')}</p>
        <p className="app-note" role="timer">
          {t('eeg.elapsed', { time: hms(elapsedSeconds(session.startTime, now)) })}
        </p>
        {session.plannedEndTime ? (
          <p className="app-note">{t('eeg.plannedEnd', { time: fmt.when(session.plannedEndTime) })}</p>
        ) : null}
        {current ? (
          <p className="app-note">
            {t('eeg.running', {
              name: current.customText || app.label(current.activityCode ?? ''),
              time: hms(elapsedSeconds(current.startTime, now)),
            })}
          </p>
        ) : null}
        <div className="ui-cluster">
          {current ? (
            <Button
              size="md"
              onClick={() => {
                const at = app.controller.now();
                void actions
                  .updateRecord('eegActivity', current.id, {
                    endTime: at,
                    durationSec: elapsedSeconds(current.startTime, at),
                  })
                  .then(() => toast(t('eeg.activityStopped'), 'success'));
              }}
            >
              {t('eeg.stopActivity')}
            </Button>
          ) : (
            <Button size="md" onClick={onActivity}>
              {t('eeg.startActivity')}
            </Button>
          )}
          <Button
            size="md"
            variant="danger"
            onClick={() => {
              const at = app.controller.now();
              void (async () => {
                // Read the diary again: an activity started a moment ago must be stopped with the session
                const fresh = (await app.api.list({ type: 'eegActivity' })) as unknown as EegActivity[];
                const open = runningActivity(fresh, session.id);
                if (open)
                  await actions.updateRecord('eegActivity', open.id, {
                    endTime: at,
                    durationSec: elapsedSeconds(open.startTime, at),
                  });
                await actions.updateRecord('eegSession', session.id, { status: 'completed', actualEndTime: at });
                toast(t('eeg.ended'), 'success');
              })();
            }}
          >
            {t('eeg.end')}
          </Button>
          {onOpen ? (
            <Button size="md" onClick={onOpen}>
              {t('eeg.diary')}
            </Button>
          ) : null}
        </div>
      </Stack>
    </Card>
  );
}

/** Starts a session (F-581): a title, how long it is planned for, and notes. */
export function StartSession({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { t, patient, actions } = app;
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<string>('24h');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const custom = hours.trim() === '' ? null : Number(hours.replace(',', '.'));
  const bad = preset === 'custom' && (custom === null || !Number.isFinite(custom) || custom <= 0);
  return (
    <BottomSheet
      title={t('eeg.start')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={bad || !patient}
          onClick={() => {
            if (!patient) return;
            const startTime = app.controller.now();
            void actions
              .createRecord('eegSession', {
                patientId: patient.id,
                startTime,
                plannedEndTime: plannedEnd(startTime, preset, custom),
                actualEndTime: null,
                durationPreset: preset,
                customHours: preset === 'custom' ? custom : null,
                title: title.trim().slice(0, 120),
                notes: notes.trim(),
                status: 'active',
              })
              .then(onClose);
          }}
        >
          {t('eeg.start')}
        </Button>
      }
    >
      <Stack>
        <TextField label={t('eeg.title')} value={title} onChange={setTitle} />
        <ChipGroup
          label={t('eeg.length')}
          value={preset}
          onChange={setPreset}
          options={EEG_PRESETS.map((p) => ({ value: p, label: p === 'custom' ? t('eeg.custom') : p }))}
        />
        {preset === 'custom' ? <DecimalField label={t('eeg.hours')} value={hours} onChange={setHours} /> : null}
        <TextArea label={t('eeg.notes')} value={notes} onChange={setNotes} rows={3} />
      </Stack>
    </BottomSheet>
  );
}

const OWN = '__own__';

/** An activity in a session (F-582): from the list or in your own words, with a mood and a note; started now. */
export function ActivitySheet({
  session,
  existing,
  onClose,
}: {
  session: EegSession;
  /** Editing an activity that is already in the diary. */
  existing?: EegActivity;
  onClose: () => void;
}) {
  const app = useApp();
  const { t, label, patient, actions } = app;
  const [code, setCode] = useState(existing ? (existing.customText ? OWN : (existing.activityCode ?? '')) : '');
  const [own, setOwn] = useState(existing?.customText ?? '');
  const [mood, setMood] = useState(existing?.moodCode ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const ready = code === OWN ? own.trim() !== '' : code !== '';
  const values = () => ({
    activityCode: code === OWN ? null : code,
    customText: code === OWN ? own.trim().slice(0, 120) : '',
    moodCode: mood === '' ? null : mood,
    notes: notes.trim(),
  });
  return (
    <BottomSheet
      title={existing ? t('eeg.editActivity') : t('eeg.startActivity')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={!ready || !patient}
          onClick={() => {
            if (!patient) return;
            const work = existing
              ? actions.updateRecord('eegActivity', existing.id, values())
              : actions
                  .createRecord('eegActivity', {
                    patientId: patient.id,
                    sessionId: session.id,
                    kind: 'activity',
                    startTime: app.controller.now(),
                    endTime: null,
                    durationSec: null,
                    linkedSeizureId: null,
                    ...values(),
                  })
                  .then(() => undefined);
            void work.then(onClose);
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <Select
          label={t('eeg.activity')}
          value={code}
          onChange={setCode}
          placeholder={t('med.chooseIngredient')}
          options={[
            ...EEG_ACTIVITIES.map((a) => ({ value: a.code, label: label(a.code) })),
            { value: OWN, label: t('eeg.ownActivity') },
          ]}
        />
        {code === OWN ? <TextField label={t('eeg.ownActivityName')} value={own} onChange={setOwn} /> : null}
        <Select
          label={t('eeg.mood')}
          value={mood}
          onChange={setMood}
          placeholder={t('common.none')}
          options={MOODS.map((m) => ({ value: m.code, label: label(m.code) }))}
        />
        <TextArea label={t('eeg.notes')} value={notes} onChange={setNotes} rows={3} />
      </Stack>
    </BottomSheet>
  );
}

/** Sure? for deleting a session or an activity. */
export function ConfirmDelete({
  title,
  text,
  onClose,
  onConfirm,
}: {
  title: string;
  text: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useApp();
  return (
    <Dialog
      title={title}
      message={text}
      tone="danger"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('home.delete')}
          </Button>
        </>
      }
    />
  );
}
