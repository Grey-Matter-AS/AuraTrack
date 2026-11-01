import { SYMPTOMS, SYMPTOM_GROUPS } from '@auratrack/model';
import { Button, ChipGroup, Section, Select, Stack, TextField } from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { SAVED_SETS, frequentFor, newItemId, startingArea, type Item, type PhaseName } from './data';
import { usePrototype } from './state';

// Adding symptoms to one phase: saved sets and this patient's usual ones first, then a search, then a browse by group.
// Tapping a chip adds the symptom to the end of the phase; tapping it again removes it.

export function SymptomPicker({
  phase,
  items,
  onItems,
}: {
  phase: PhaseName;
  items: readonly Item[];
  onItems: (update: (previous: Item[]) => Item[]) => void;
}) {
  const { label, draft } = usePrototype();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const here = items.filter((i) => i.phase === phase).map((i) => i.code);

  const toggle = (next: readonly string[]) => {
    const added = next.find((c) => !here.includes(c));
    const removed = here.find((c) => !next.includes(c));
    onItems((previous) =>
      added
        ? [...previous, { id: newItemId(), code: added, phase, area: startingArea(added), gap: 'few' }]
        : removed
          ? previous.filter((i) => !(i.phase === phase && i.code === removed))
          : previous,
    );
  };
  const applySet = (setId: string) => {
    const set = SAVED_SETS.find((s) => s.id === setId);
    if (!set) return;
    onItems((previous) => [
      ...previous,
      ...set.items
        .filter((x) => x.phase === phase && !previous.some((i) => i.phase === phase && i.code === x.code))
        .map((x) => ({ id: newItemId(), code: x.code, phase, area: startingArea(x.code), gap: 'few' as const })),
    ]);
  };

  const sets = SAVED_SETS.filter((s) => s.typeCode === draft.typeCode || draft.typeCode === null).filter((s) =>
    s.items.some((x) => x.phase === phase),
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SYMPTOMS.filter((s) => label(s.code).toLowerCase().includes(q)).slice(0, 12);
  }, [query, label]);
  const inGroup = SYMPTOMS.filter((s) => s.group === group);
  const chips = (codes: readonly string[]) => codes.map((c) => ({ value: c, label: label(c) }));

  return (
    <Stack>
      {sets.length > 0 ? (
        <Section title="Saved sets">
          <div className="ui-cluster">
            {sets.map((s) => (
              <Button key={s.id} onClick={() => applySet(s.id)}>
                + {s.name}
              </Button>
            ))}
          </div>
        </Section>
      ) : null}
      <Section title={draft.typeCode ? `Often for ${label(draft.typeCode)}` : 'Often for this patient'}>
        <ChipGroup
          multiple
          label="Often"
          value={here}
          onChange={toggle}
          options={chips(frequentFor(draft.typeCode, phase))}
        />
      </Section>
      <Section title="Find a symptom">
        <TextField label="Search" value={query} onChange={setQuery} placeholder="Type to search" />
        {matches.length > 0 ? (
          <ChipGroup
            multiple
            label="Search results"
            value={here}
            onChange={toggle}
            options={chips(matches.map((m) => m.code))}
          />
        ) : null}
        <Select
          label="Or browse by group"
          value={group}
          onChange={setGroup}
          placeholder="Choose a group"
          options={SYMPTOM_GROUPS.map((g) => ({ value: g.code, label: `${label(g.category)}: ${label(g.code)}` }))}
        />
        {inGroup.length > 0 ? (
          <ChipGroup
            multiple
            label="Symptoms in this group"
            value={here}
            onChange={toggle}
            options={chips(inGroup.map((s) => s.code))}
          />
        ) : null}
      </Section>
    </Stack>
  );
}
