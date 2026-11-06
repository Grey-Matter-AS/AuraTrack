import { SYMPTOMS, SYMPTOM_GROUPS } from '@auratrack/model';
import { BottomSheet, Button, ChipGroup, Section, Select, Stack, TextField, useToast } from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { frequentSymptoms, inSeizureOrder, newItem, type Item, type PhaseName } from './draft';
import { useEditor } from './EditorContext';

// Symptoms are added one card at a time to the timeline. "Add symptom" in a phase opens this sheet: this patient's usual
// symptoms for that phase first, then a search, a browse by group, the household's own symptoms, and a box to add a new
// one in the person's own words. Choosing one adds its card at the end of the phase and closes the sheet.

export function AddSymptomSheet({
  phase,
  onPick,
  onClose,
}: {
  phase: PhaseName;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const { label, draft, t, seizures, customCodes } = useEditor();
  const app = useApp();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [own, setOwn] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const mine = customCodes.filter((c) => c.kind === 'symptom').map((c) => ({ code: c.code }));
    return [...SYMPTOMS, ...mine].filter((s) => label(s.code).toLowerCase().includes(q)).slice(0, 12);
  }, [query, label, customCodes]);
  const inGroup = SYMPTOMS.filter((s) => s.group === group);
  const chips = (codes: readonly string[]) => codes.map((c) => ({ value: c, label: label(c) }));
  const usual = frequentSymptoms(seizures, draft.profile?.id ?? null, phase);
  const mine = customCodes.filter((c) => c.kind === 'symptom').map((c) => c.code);

  return (
    <BottomSheet title={t('tl.addTitle', { phase: t(`tab.${phase}`) })} onClose={onClose}>
      <Stack>
        {usual.length > 0 ? (
          <Section title={draft.profile ? t('picker.oftenFor', { type: draft.profile.name }) : t('picker.often')}>
            <ChipGroup
              showLabel={false}
              label={t('picker.oftenLabel')}
              value=""
              onChange={onPick}
              options={chips(usual)}
            />
          </Section>
        ) : null}
        <Section title={t('picker.find')}>
          <Stack>
            <TextField
              label={t('picker.search')}
              value={query}
              onChange={setQuery}
              placeholder={t('picker.searchPlaceholder')}
            />
            {matches.length > 0 ? (
              <ChipGroup
                label={t('picker.results')}
                value=""
                onChange={onPick}
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
                label={t('picker.inGroup')}
                value=""
                onChange={onPick}
                options={chips(inGroup.map((s) => s.code))}
              />
            ) : null}
            {mine.length > 0 ? (
              <ChipGroup showLabel label={t('own.title')} value="" onChange={onPick} options={chips(mine)} />
            ) : null}
          </Stack>
        </Section>
        <Section title={t('picker.addOwn')}>
          <Stack>
            <TextField label={t('picker.ownLabel')} value={own} onChange={setOwn} maxLength={120} />
            <Button
              disabled={own.trim() === '' || app.busy}
              onClick={() => {
                void app.actions.addCustomSymptom(own).then((code) => {
                  setOwn('');
                  onPick(code);
                });
              }}
            >
              {t('picker.ownAdd')}
            </Button>
          </Stack>
        </Section>
      </Stack>
    </BottomSheet>
  );
}

/** Above the timeline: fill it from a saved symptom set (each symptom goes to the end of its phase, once). */
export function SetPicker({ onItems }: { onItems: (update: (previous: Item[]) => Item[]) => void }) {
  const { label, t, sets } = useEditor();
  if (sets.length === 0) return null;
  const applySet = (setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    onItems((previous) => [
      ...previous,
      ...set.items
        .filter((x, n, all) => all.findIndex((y) => y.code === x.code && y.phase === x.phase) === n)
        .filter((x) => !previous.some((i) => i.phase === x.phase && i.code === x.code))
        .map((x) => newItem(x.code, x.phase)),
    ]);
  };
  return (
    <Select
      label={t('set.add')}
      value=""
      placeholder={t('set.choose')}
      onChange={applySet}
      options={sets.map((s) => ({
        value: s.id,
        label:
          s.name ||
          s.items
            .map((x) => label(x.code))
            .slice(0, 2)
            .join(', '),
      }))}
    />
  );
}

/** Under the timeline, once it has symptoms: keep them as a set for next time (the phases and the order are kept). */
export function SaveSetButton() {
  const { label, draft, t } = useEditor();
  const app = useApp();
  const toast = useToast();
  const [naming, setNaming] = useState(false);
  const [setName, setSetName] = useState('');
  if (draft.items.length === 0) return null;
  const suggestion = inSeizureOrder(draft.items)
    .slice(0, 3)
    .map((i) => label(i.code))
    .join(', ')
    .slice(0, 60);
  return (
    <>
      <Button
        fullWidth
        onClick={() => {
          setSetName(suggestion);
          setNaming(true);
        }}
      >
        {t('set.save')}
      </Button>
      {naming ? (
        <BottomSheet
          title={t('set.save')}
          onClose={() => setNaming(false)}
          footer={
            <Button
              variant="primary"
              fullWidth
              disabled={app.busy}
              onClick={() => {
                void app.actions
                  .saveSet({
                    name: setName,
                    items: inSeizureOrder(draft.items).map((i) => ({ code: i.code, phase: i.phase })),
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
    </>
  );
}
