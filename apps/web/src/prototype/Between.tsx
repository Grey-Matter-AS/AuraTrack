import { SYMPTOMS, SYMPTOM_GROUPS } from '@auratrack/model';
import { BottomSheet, Button, DateTimeField, Select, Stack, TextArea, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { BodyMap, areaText } from './BodyMap';
import { localInputValue, type Area } from './data';
import { usePrototype } from './state';

/** "Between seizures": a quick entry for symptoms that happen outside a seizure. */
export function BetweenSheet({ onClose }: { onClose: () => void }) {
  const { label } = usePrototype();
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
        title="Between seizures"
        onClose={onClose}
        footer={
          <Button
            variant="primary"
            fullWidth
            disabled={symptom === ''}
            onClick={() => {
              toast('Saved (prototype: nothing is stored)', 'success');
              onClose();
            }}
          >
            Save
          </Button>
        }
      >
        <Stack>
          <Select
            label="Group"
            value={group}
            onChange={(v) => {
              setGroup(v);
              setSymptom('');
            }}
            placeholder="Choose a group"
            options={SYMPTOM_GROUPS.map((g) => ({ value: g.code, label: `${label(g.category)}: ${label(g.code)}` }))}
          />
          <Select
            label="Symptom"
            value={symptom}
            onChange={setSymptom}
            placeholder="Choose a symptom"
            options={SYMPTOMS.filter((s) => s.group === group).map((s) => ({ value: s.code, label: label(s.code) }))}
          />
          <DateTimeField label="When" type="datetime-local" value={when} onChange={setWhen} />
          <Button onClick={() => setWhere(true)}>
            {area ? `Where: ${areaText(area, label)}` : 'Where on the body'}
          </Button>
          <TextArea label="Note" value={note} onChange={setNote} rows={3} />
        </Stack>
      </BottomSheet>
      {where ? (
        <BottomSheet
          title="Where on the body"
          onClose={() => setWhere(false)}
          footer={
            <Button variant="primary" fullWidth onClick={() => setWhere(false)}>
              Done
            </Button>
          }
        >
          <BodyMap value={area} onChange={setArea} />
        </BottomSheet>
      ) : null}
    </>
  );
}
