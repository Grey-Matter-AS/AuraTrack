import { extraDose } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, DecimalField, Select, Stack, TextField, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { localInputValue } from '../editor/draft';
import { doseText } from './medText';

/** An extra dose (F-105): rescue medicine, or a dose outside the schedule. */
export function ExtraDose({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { t, patient, medications, actions } = app;
  const toast = useToast();
  const active = medications.filter((m) => m.active);
  const rescue = active.find((m) => m.isRescue) ?? active[0];
  const [medId, setMedId] = useState(rescue?.id ?? '');
  const med = active.find((m) => m.id === medId);
  const [dose, setDose] = useState(med?.dose !== null && med?.dose !== undefined ? String(med.dose) : '');
  const [when, setWhen] = useState(() => localInputValue(app.controller.now()));
  const [note, setNote] = useState('');
  const takenAt = new Date(when).getTime();
  const amount = dose.trim() === '' ? null : Number(dose.replace(',', '.'));
  const bad = !med || Number.isNaN(takenAt) || (amount !== null && (!Number.isFinite(amount) || amount < 0));
  return (
    <BottomSheet
      title={t('dose.extraTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={bad || !patient}
          onClick={() => {
            if (!med || !patient) return;
            void actions.logDoses([extraDose(med, patient.id, takenAt, amount, note.trim())]).then(() => {
              toast(t('dose.saved'), 'success');
              onClose();
            });
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        {active.length === 0 ? <p className="app-note">{t('dose.noMeds')}</p> : null}
        <Select
          label={t('dose.which')}
          value={medId}
          onChange={(id) => {
            setMedId(id);
            const next = active.find((m) => m.id === id);
            setDose(next?.dose !== null && next?.dose !== undefined ? String(next.dose) : '');
          }}
          options={active.map((m) => ({
            value: m.id,
            label: `${m.name}${m.dose !== null ? ` · ${doseText(m.dose, m.unit)}` : ''}`,
          }))}
        />
        <DecimalField label={`${t('dose.amount')}${med ? ` (${med.unit})` : ''}`} value={dose} onChange={setDose} />
        <DateTimeField label={t('dose.when')} type="datetime-local" value={when} onChange={setWhen} />
        <TextField label={t('dose.note')} value={note} onChange={setNote} />
      </Stack>
    </BottomSheet>
  );
}
