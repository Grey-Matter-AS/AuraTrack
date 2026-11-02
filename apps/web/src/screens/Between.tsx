import { SYMPTOMS, SYMPTOM_GROUPS, type BodyArea } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, Select, Stack, TextArea, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { BodyMapSheet } from '../editor/BodyMapSheet';
import { areaText } from '../editor/BodyMap';
import { localInputValue } from '../editor/draft';

/** "Between seizures" (F-313): a quick entry for a symptom that happens outside a seizure. */
export function BetweenSheet({ onClose, opened }: { onClose: () => void; opened: number }) {
  const { t, label, actions, customCodes } = useApp();
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [symptom, setSymptom] = useState('');
  const [when, setWhen] = useState(() => localInputValue(opened));
  const [area, setArea] = useState<BodyArea | null>(null);
  const [where, setWhere] = useState(false);
  const [note, setNote] = useState('');
  const own = customCodes.filter((c) => c.kind === 'symptom');
  const GROUP_OWN = 'own';
  const choices =
    group === GROUP_OWN
      ? own.map((c) => ({ value: c.code, label: c.label }))
      : SYMPTOMS.filter((s) => s.group === group).map((s) => ({ value: s.code, label: label(s.code) }));
  const groups = [
    ...SYMPTOM_GROUPS.map((g) => ({ value: g.code, label: `${label(g.category)}: ${label(g.code)}` })),
    ...(own.length > 0 ? [{ value: GROUP_OWN, label: t('own.title') }] : []),
  ];
  return (
    <>
      <BottomSheet
        title={t('home.between')}
        onClose={onClose}
        footer={
          <Button
            variant="primary"
            fullWidth
            disabled={symptom === ''}
            onClick={() => {
              const occurredAt = new Date(when).getTime();
              void actions
                .logBetween({
                  symptomCode: symptom,
                  occurredAt: Number.isNaN(occurredAt) ? opened : occurredAt,
                  area,
                  notes: note,
                })
                .then(() => {
                  toast(t('between.saved'), 'success');
                  onClose();
                });
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        <Stack>
          <Select
            label={t('between.group')}
            value={group}
            onChange={(v) => {
              setGroup(v);
              setSymptom('');
            }}
            placeholder={t('picker.chooseGroup')}
            options={groups}
          />
          <Select
            label={t('between.symptom')}
            value={symptom}
            onChange={setSymptom}
            placeholder={t('between.chooseSymptom')}
            options={choices}
          />
          <DateTimeField label={t('between.when')} type="datetime-local" value={when} onChange={setWhen} />
          <Button onClick={() => setWhere(true)}>
            {area ? t('between.whereChosen', { area: areaText(area, label) }) : t('between.where')}
          </Button>
          <TextArea label={t('between.note')} value={note} onChange={setNote} rows={3} />
        </Stack>
      </BottomSheet>
      {where ? (
        <BodyMapSheet title={t('between.where')} value={area} onChange={setArea} onClose={() => setWhere(false)} />
      ) : null}
    </>
  );
}
