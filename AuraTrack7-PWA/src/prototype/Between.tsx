import { SYMPTOMS, SYMPTOM_GROUPS } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, Select, Stack, TextArea, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { BodyMap, areaText } from './BodyMap';
import { localInputValue, type Area } from './data';
import { usePrototype } from './state';

/** "Between seizures": a quick entry for symptoms that happen outside a seizure. */
export function BetweenSheet({ onClose }: { onClose: () => void }) {
  const { label, t } = usePrototype();
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [symptom, setSymptom] = useState('');
  const [when, setWhen] = useState(() => localInputValue(Date.now()));
  const [area, setArea] = useState<Area | null>(null);
  const [where, setWhere] = useState(false);
  const [note, setNote] = useState('');
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
              toast(t('common.saved'), 'success');
              onClose();
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
            options={SYMPTOM_GROUPS.map((g) => ({ value: g.code, label: `${label(g.category)}: ${label(g.code)}` }))}
          />
          <Select
            label={t('between.symptom')}
            value={symptom}
            onChange={setSymptom}
            placeholder={t('between.chooseSymptom')}
            options={SYMPTOMS.filter((s) => s.group === group).map((s) => ({ value: s.code, label: label(s.code) }))}
          />
          <DateTimeField label={t('between.when')} type="datetime-local" value={when} onChange={setWhen} />
          <Button onClick={() => setWhere(true)}>
            {area ? t('between.whereChosen', { area: areaText(area, label) }) : t('between.where')}
          </Button>
          <TextArea label={t('between.note')} value={note} onChange={setNote} rows={3} />
        </Stack>
      </BottomSheet>
      {where ? (
        <BottomSheet
          title={t('between.where')}
          onClose={() => setWhere(false)}
          footer={
            <Button variant="primary" fullWidth onClick={() => setWhere(false)}>
              {t('common.done')}
            </Button>
          }
        >
          <BodyMap value={area} onChange={setArea} />
        </BottomSheet>
      ) : null}
    </>
  );
}
