import { SYMPTOMS, SYMPTOM_GROUPS } from '@auratrack/model';
import { BottomSheet, Button, ChipGroup, Section, Select, Stack, TextField, useToast } from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { frequentSymptoms, newItem, type Item, type PhaseName } from './draft';
import { useEditor } from './EditorContext';

// Adding symptoms to one phase: saved sets and this patient's usual ones first, then a search, then a browse by group, then
// the person's own words. Tapping a chip adds the symptom to the end of the phase; tapping it again removes it.

export function SymptomPicker({
  phase,
  items,
  onItems,
}: {
  phase: PhaseName;
  items: readonly Item[];
  onItems: (update: (previous: Item[]) => Item[]) => void;
}) {
  const { label, draft, t, sets, seizures, customCodes } = useEditor();
  const app = useApp();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [own, setOwn] = useState('');
  const [naming, setNaming] = useState(false);
  const [setName, setSetName] = useState('');
  const here = items.filter((i) => i.phase === phase).map((i) => i.code);

  const toggle = (next: readonly string[]) => {
    const added = next.find((c) => !here.includes(c));
    const removed = here.find((c) => !next.includes(c));
    onItems((previous) =>
      added
        ? [...previous, newItem(added, phase)]
        : removed
          ? previous.filter((i) => !(i.phase === phase && i.code === removed))
          : previous,
    );
  };
  const applySet = (setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    onItems((previous) => [
      ...previous,
      ...set.items
        .filter((x) => x.phase === phase && !previous.some((i) => i.phase === phase && i.code === x.code))
        .map((x) => newItem(x.code, phase)),
    ]);
  };

  const usable = sets.filter(
    (s) =>
      (s.seizureTypeCode === null || s.seizureTypeCode === draft.typeCode || draft.typeCode === null) &&
      s.items.some((x) => x.phase === phase),
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const own = customCodes.filter((c) => c.kind === 'symptom').map((c) => ({ code: c.code }));
    return [...SYMPTOMS, ...own].filter((s) => label(s.code).toLowerCase().includes(q)).slice(0, 12);
  }, [query, label, customCodes]);
  const inGroup = SYMPTOMS.filter((s) => s.group === group);
  const chips = (codes: readonly string[]) => codes.map((c) => ({ value: c, label: label(c) }));
  const usual = frequentSymptoms(seizures, draft.typeCode, phase);
  const mine = customCodes.filter((c) => c.kind === 'symptom').map((c) => c.code);
  const suggestion = draft.items
    .slice(0, 3)
    .map((i) => label(i.code))
    .join(', ')
    .slice(0, 60);

  return (
    <Stack>
      {usable.length > 0 ? (
        <Section title={t('picker.sets')}>
          <div className="ui-cluster">
            {usable.map((s) => (
              <Button key={s.id} onClick={() => applySet(s.id)}>
                +{' '}
                {s.name ||
                  s.items
                    .map((x) => label(x.code))
                    .slice(0, 2)
                    .join(', ')}
              </Button>
            ))}
          </div>
        </Section>
      ) : null}
      {usual.length > 0 ? (
        <Section title={draft.typeCode ? t('picker.oftenFor', { type: label(draft.typeCode) }) : t('picker.often')}>
          <ChipGroup multiple label={t('picker.oftenLabel')} value={here} onChange={toggle} options={chips(usual)} />
        </Section>
      ) : null}
      <Section title={t('picker.find')}>
        <TextField
          label={t('picker.search')}
          value={query}
          onChange={setQuery}
          placeholder={t('picker.searchPlaceholder')}
        />
        {matches.length > 0 ? (
          <ChipGroup
            multiple
            label={t('picker.results')}
            value={here}
            onChange={toggle}
            options={chips(matches.map((m) => m.code))}
          />
        ) : null}
        <Select
          label={t('picker.browse')}
          value={group}
          onChange={setGroup}
          placeholder={t('picker.chooseGroup')}
          options={SYMPTOM_GROUPS.map((g) => ({ value: g.code, label: `${label(g.category)}: ${label(g.code)}` }))}
        />
        {inGroup.length > 0 ? (
          <ChipGroup
            multiple
            label={t('picker.inGroup')}
            value={here}
            onChange={toggle}
            options={chips(inGroup.map((s) => s.code))}
          />
        ) : null}
        {mine.length > 0 ? (
          <ChipGroup multiple label={t('own.title')} value={here} onChange={toggle} options={chips(mine)} />
        ) : null}
      </Section>
      <Section title={t('picker.addOwn')}>
        <Stack>
          <TextField label={t('picker.ownLabel')} value={own} onChange={setOwn} maxLength={120} />
          <Button
            disabled={own.trim() === ''}
            onClick={() => {
              void app.actions.addCustomSymptom(own).then((code) => {
                onItems((previous) => [...previous, newItem(code, phase)]);
                setOwn('');
              });
            }}
          >
            {t('picker.ownAdd')}
          </Button>
        </Stack>
      </Section>
      {draft.items.length > 0 ? (
        <Button
          variant="ghost"
          onClick={() => {
            setSetName(suggestion);
            setNaming(true);
          }}
        >
          {t('set.save')}
        </Button>
      ) : null}
      {naming ? (
        <BottomSheet
          title={t('set.save')}
          onClose={() => setNaming(false)}
          footer={
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                void app.actions
                  .saveSet({
                    typeCode: draft.typeCode,
                    name: setName,
                    items: draft.items.map((i) => ({ code: i.code, phase: i.phase })),
                  })
                  .then(() => {
                    toast(t('set.saved'), 'success');
                    setNaming(false);
                  });
              }}
            >
              {t('common.save')}
            </Button>
          }
        >
          <TextField label={t('set.name')} value={setName} onChange={setSetName} maxLength={120} />
        </BottomSheet>
      ) : null}
    </Stack>
  );
}
