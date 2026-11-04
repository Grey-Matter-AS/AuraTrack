import {
  doseGrid,
  endOfLocalDay,
  startOfLocalDay,
  addLocalDays,
  type DoseStatus,
  type GridCell,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  DateTimeField,
  Screen,
  Select,
  Stack,
  TextField,
} from '@auratrack/ui';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { dayInput, doseText, instantFrom } from './medText';
import './screens.css';

type Span = '7' | '14' | '30';
const STATUSES: DoseStatus[] = ['taken', 'late', 'assumed', 'missed'];

/** The dose history, day by day (F-405): each scheduled dose with its status, and a tap to change it. Changed doses are marked. */
export function DoseGrid() {
  const app = useApp();
  const { t, fmt, api, revision, medications, medChanges, doseLogs } = app;
  const nav = useNav();
  const [span, setSpan] = useState<Span>('7');
  const [editing, setEditing] = useState<GridCell | null>(null);
  const [edited, setEdited] = useState<string[]>([]);
  const [now] = useState(() => app.controller.now());
  useEffect(() => {
    void Promise.resolve(api.editedIds({ type: 'doseLog' }))
      .then(setEdited)
      .catch(() => undefined);
  }, [api, revision]);
  const days = useMemo(
    () =>
      doseGrid({
        medications,
        changes: medChanges,
        logs: doseLogs,
        from: startOfLocalDay(addLocalDays(now, -(Number(span) - 1))),
        to: endOfLocalDay(now),
        now,
      }),
    [medications, medChanges, doseLogs, span, now],
  );
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('dose.history')} onBack={() => nav.pop()} />
        <ChipGroup
          label={t('dose.span')}
          value={span}
          onChange={setSpan}
          options={(['7', '14', '30'] as const).map((v) => ({ value: v, label: t('settings.days', { n: v }) }))}
        />
        {days.every((d) => d.cells.length === 0) ? <p className="app-note">{t('dose.nothing')}</p> : null}
        {days
          .filter((d) => d.cells.length > 0)
          .map((d) => (
            <Card compact key={d.day}>
              <Stack gap="0.5rem">
                <p className="app-banner">{fmt.day(d.dayStart)}</p>
                {d.cells.map((c) => (
                  <Button key={`${c.medicationId}${c.scheduledTime}`} fullWidth onClick={() => setEditing(c)}>
                    {`${c.scheduledTime} · ${c.name}${c.dose !== null ? ` · ${doseText(c.dose, c.unit)}` : ''} · ${
                      c.state === 'upcoming'
                        ? t('dose.upcoming')
                        : c.state === 'due'
                          ? t('dose.notMarked')
                          : t(`dose.${c.state}` as never)
                    }${c.log && edited.includes(c.log.id) ? ` · ${t('dose.edited')}` : ''}`}
                  </Button>
                ))}
              </Stack>
            </Card>
          ))}
      </Stack>
      {editing ? (
        <EditDose cell={editing} day={dayInput(editing.scheduledTs)} onClose={() => setEditing(null)} />
      ) : null}
    </Screen>
  );
}

function EditDose({ cell, day, onClose }: { cell: GridCell; day: string; onClose: () => void }) {
  const app = useApp();
  const { t, patient, actions } = app;
  const [status, setStatus] = useState<DoseStatus>(cell.log?.status ?? 'taken');
  const initial = cell.log?.takenAt ?? cell.scheduledTs;
  const [time, setTime] = useState(() => {
    const d = new Date(initial);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [takenDay, setTakenDay] = useState(dayInput(initial));
  const [note, setNote] = useState(cell.log?.note ?? '');
  void day;
  return (
    <BottomSheet
      title={`${cell.scheduledTime} · ${cell.name}`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={!patient || takenDay === '' || time === ''}
          onClick={() => {
            if (!patient) return;
            const takenAt = instantFrom(takenDay, time);
            void (
              cell.log
                ? actions.editDose(cell.log.id, { status, takenAt, note })
                : actions.logDoses([
                    {
                      patientId: patient.id,
                      medicationId: cell.medicationId,
                      scheduledTime: cell.scheduledTime,
                      takenAt,
                      status,
                      note,
                      doseSnapshot: cell.dose,
                      unitSnapshot: cell.unit,
                    },
                  ])
            ).then(onClose);
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <Select
          label={t('dose.status')}
          value={status}
          onChange={(v) => setStatus(v as DoseStatus)}
          options={STATUSES.map((s) => ({ value: s, label: t(`dose.${s}` as never) }))}
        />
        <DateTimeField label={t('dose.takenDay')} type="date" value={takenDay} onChange={setTakenDay} />
        <DateTimeField label={t('dose.takenTime')} type="time" value={time} onChange={setTime} />
        <TextField label={t('dose.note')} value={note} onChange={setNote} />
        <p className="app-note">{t('dose.editNote')}</p>
      </Stack>
    </BottomSheet>
  );
}
