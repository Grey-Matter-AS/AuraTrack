import { dosePanel, takenDose, type DosePanelRow } from '@auratrack/model';
import { Button, Card, Checkbox, Section, Stack, useToast } from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { doseText } from './medText';
import './screens.css';

/** Today's scheduled doses by time (F-104): tap the ones taken, then Save. A dose never marked becomes missed or assumed by itself. */
export function DosePanel() {
  const app = useApp();
  const { t, fmt, patient, medications, medChanges, doseLogs, actions } = app;
  const toast = useToast();
  const [now, setNow] = useState(() => app.controller.now());
  const [picked, setPicked] = useState<string[]>([]);
  const rows = useMemo(
    () => dosePanel({ medications: medications.filter((m) => m.active), changes: medChanges, logs: doseLogs, now }),
    [medications, medChanges, doseLogs, now],
  );
  if (rows.length === 0 || !patient) return null;
  const done = (r: DosePanelRow) => r.state === 'taken' || r.state === 'late';
  const toggle = (key: string, on: boolean) => setPicked((p) => (on ? [...p, key] : p.filter((k) => k !== key)));
  const stateText = (r: DosePanelRow): string =>
    r.state === 'upcoming' ? '' : r.state === 'due' ? t('dose.due') : t(`dose.${r.state}` as never);
  return (
    <Section title={t('dose.today')}>
      <Card>
        <Stack>
          {rows.map((r) => (
            <Checkbox
              key={r.key}
              checked={done(r) || picked.includes(r.key)}
              onChange={(on) => {
                if (!done(r)) toggle(r.key, on);
              }}
              label={`${r.scheduledTime} · ${r.name}${r.dose !== null ? ` · ${doseText(r.dose, r.unit)}` : ''}`}
              help={r.log && done(r) ? `${stateText(r)} · ${fmt.time(r.log.takenAt)}` : stateText(r) || undefined}
            />
          ))}
          <Button
            variant="primary"
            disabled={picked.length === 0}
            onClick={() => {
              const at = app.controller.now();
              const chosen = rows.filter((r) => picked.includes(r.key));
              void actions.logDoses(chosen.map((r) => takenDose(r, patient.id, at))).then(() => {
                setPicked([]);
                setNow(at);
                toast(t('dose.saved'), 'success');
              });
            }}
          >
            {t('common.save')}
          </Button>
        </Stack>
      </Card>
    </Section>
  );
}
