import {
  changesForMedication,
  planMedicationChange,
  regimenSnapshot,
  type ChangeType,
  type Medication,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  DateTimeField,
  Dialog,
  Screen,
  Section,
  Stack,
  TextArea,
} from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { dayInput, instantFrom, regimenSummary } from './medText';
import './screens.css';

/** One medicine (F-502, F-504, F-505): what it is now, its change history, and Change, Stop, Take up again and Delete. */
export function MedDetail({ id }: { id: string }) {
  const app = useApp();
  const { t, fmt, patient, medications, medChanges, actions } = app;
  const nav = useNav();
  const med = medications.find((m) => m.id === id);
  const [sheet, setSheet] = useState<'stop' | 'restart' | null>(null);
  const [deleting, setDeleting] = useState(false);
  if (!med)
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('nav.meds')} onBack={() => nav.pop()} />
          <p className="app-note">{t('med.gone')}</p>
        </Stack>
      </Screen>
    );
  const history = changesForMedication(med, medChanges).reverse();
  const flags = [
    med.isRescue ? t('med.rescue') : null,
    med.showInEmergency ? t('med.emergency') : null,
    med.reminderEnabled ? t('med.reminder') : null,
  ].filter((x): x is string => x !== null);
  return (
    <Screen>
      <Stack>
        <AppHeader title={med.name} onBack={() => nav.pop()} />
        <Card>
          <Stack gap="0.5rem">
            <p className="app-banner">{regimenSummary(med)}</p>
            {med.activeIngredient ? <p className="app-note">{med.activeIngredient}</p> : null}
            <p className="app-note">
              {med.active
                ? t('med.active')
                : t('med.stoppedOn', { day: med.stoppedAt === null ? '–' : fmt.day(med.stoppedAt) })}
              {med.startedAt !== null ? ` · ${t('med.startedOn', { day: fmt.day(med.startedAt) })}` : ''}
            </p>
            {flags.length > 0 ? <p className="app-note">{flags.join(' · ')}</p> : null}
          </Stack>
        </Card>
        <div className="ui-cluster">
          {med.active ? (
            <>
              <Button variant="primary" onClick={() => nav.push('medEdit', { id: med.id })}>
                {t('med.change')}
              </Button>
              <Button variant="danger" onClick={() => setSheet('stop')}>
                {t('med.stop')}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setSheet('restart')}>
              {t('med.restart')}
            </Button>
          )}
          <Button onClick={() => setDeleting(true)}>{t('med.deleteMistake')}</Button>
        </div>
        <Section title={t('med.history')}>
          {history.length === 0 ? (
            <p className="app-note">{t('med.noHistory')}</p>
          ) : (
            <Stack>
              {history.map((c) => (
                <Card compact key={c.id}>
                  <Stack gap="0.25rem">
                    <p className="app-banner">
                      {fmt.when(c.effectiveAt)} · {t(`med.change.${c.type}` as never)}
                      {c.isBaseline ? ` · ${t('med.baseline')}` : ''}
                    </p>
                    {c.from ? <p className="app-note">{regimenSummary(c.from)}</p> : null}
                    {c.to ? <p className="app-note">→ {regimenSummary(c.to)}</p> : null}
                    {c.from && c.to && c.from.name !== c.to.name ? (
                      <p className="app-note">
                        {c.from.name} → {c.to.name}
                      </p>
                    ) : null}
                    {c.note ? <p className="app-note">{c.note}</p> : null}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
      </Stack>
      {sheet && patient ? (
        <DateSheet
          title={sheet === 'stop' ? t('med.stopTitle', { name: med.name }) : t('med.restartTitle', { name: med.name })}
          confirm={sheet === 'stop' ? t('med.stop') : t('med.restart')}
          danger={sheet === 'stop'}
          onClose={() => setSheet(null)}
          onConfirm={(at, note) => {
            const type: ChangeType = sheet === 'stop' ? 'stopped' : 'started';
            const plan = planMedicationChange({
              patientId: patient.id,
              before: med as Medication,
              next: {
                ...regimenSnapshot(med),
                isRescue: med.isRescue,
                showInEmergency: med.showInEmergency,
                reminderEnabled: med.reminderEnabled,
              },
              type,
              effectiveAt: at,
              recordedAt: app.controller.now(),
              note,
            });
            if ('problem' in plan) return;
            void actions.changeMedication(plan).then(() => setSheet(null));
          }}
        />
      ) : null}
      {deleting ? (
        <Dialog
          title={t('med.deleteTitle', { name: med.name })}
          message={t('med.deleteText')}
          tone="danger"
          onClose={() => setDeleting(false)}
          actions={
            <>
              <Button onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void actions.deleteMedication(med.id).then(() => {
                    setDeleting(false);
                    nav.pop();
                  });
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

function DateSheet({
  title,
  confirm,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  confirm: string;
  danger: boolean;
  onClose: () => void;
  onConfirm: (at: number, note: string) => void;
}) {
  const app = useApp();
  const { t } = app;
  const now = app.controller.now();
  const [day, setDay] = useState(dayInput(now));
  const [time, setTime] = useState(() => {
    const d = new Date(now);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [note, setNote] = useState('');
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <Button
          variant={danger ? 'danger' : 'primary'}
          fullWidth
          disabled={day === '' || time === ''}
          onClick={() => onConfirm(instantFrom(day, time), note.trim())}
        >
          {confirm}
        </Button>
      }
    >
      <Stack>
        <DateTimeField label={t('med.effectiveDay')} type="date" value={day} onChange={setDay} max={dayInput(now)} />
        <DateTimeField label={t('med.effectiveTime')} type="time" withSeconds={false} value={time} onChange={setTime} />
        <TextArea label={t('med.note')} value={note} onChange={setNote} rows={3} />
      </Stack>
    </BottomSheet>
  );
}
