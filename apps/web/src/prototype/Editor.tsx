import { FINDINGS, FINDING_GROUPS, SEIZURE_TYPES, TRIGGERS } from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Checkbox,
  ChipGroup,
  NumberField,
  Screen,
  Section,
  Select,
  Stack,
  Tabs,
  TextArea,
  useToast,
  type TabItem,
} from '@auratrack/ui';
import { useState } from 'react';
import { BodyMap } from './BodyMap';
import { PHASES, clock, type Draft, type Gap, type Item, type PhaseName } from './data';
import { SymptomPicker } from './SymptomPicker';
import { OverviewStrip, Timeline, type TimelineActions } from './Timeline';
import { goHome, useNav } from './nav';
import { usePrototype } from './state';

// The seizure editor, in tabs by phase. Every tab is always there with its state; the overview above shows the whole
// seizure; Save works from any tab and Review shows everything in order before saving.

const TAB_NAME: Record<PhaseName | 'details', string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
  details: 'Details',
};

const NOT_SURE = [{ value: 'unknown', label: 'Not sure' }] as const;

export function Editor() {
  const nav = useNav();
  const toast = useToast();
  const { draft, setDraft, label } = usePrototype();
  const [tab, setTab] = useState<string>('before');
  const [areaFor, setAreaFor] = useState<string | null>(null);

  const setItems = (update: (previous: Item[]) => Item[]) => setDraft((d) => ({ ...d, items: update(d.items) }));
  const count = (phase: PhaseName) => draft.items.filter((i) => i.phase === phase).length;
  const added = (n: number) => (n === 0 ? 'not filled in yet' : `${n} added`);
  const tabs: TabItem[] = [
    {
      id: 'before',
      label: TAB_NAME.before,
      state: draft.prodromeHours > 0 ? `${added(count('before'))} · ${draft.prodromeHours} h` : added(count('before')),
    },
    { id: 'during', label: TAB_NAME.during, state: added(count('during')) },
    { id: 'after', label: TAB_NAME.after, state: added(count('after') + draft.findings.length) },
    { id: 'details', label: TAB_NAME.details, state: draft.onset ? 'classified' : 'not classified' },
  ];

  const actions: TimelineActions = {
    move: (id, direction) =>
      setItems((previous) => {
        const item = previous.find((i) => i.id === id);
        if (!item) return previous;
        const same = previous.filter((i) => i.phase === item.phase);
        const at = same.findIndex((i) => i.id === id);
        const other = same[at + direction];
        if (!other) return previous;
        return previous.map((i) => (i.id === item.id ? other : i.id === other.id ? item : i));
      }),
    setGap: (id, gap: Gap) => setItems((previous) => previous.map((i) => (i.id === id ? { ...i, gap } : i))),
    remove: (id) => setItems((previous) => previous.filter((i) => i.id !== id)),
    pickArea: (id) => setAreaFor(id),
  };

  const save = () => {
    toast('Saved (prototype: nothing is stored)', 'success');
    goHome(nav);
  };
  const editing = draft.items.find((i) => i.id === areaFor);

  return (
    <Screen>
      <Stack>
        <AppHeader
          title={draft.isPast ? 'Past seizure' : 'Seizure details'}
          onBack={() => nav.pop()}
          actions={
            <>
              <Button size="md" onClick={() => nav.push('review')}>
                Review
              </Button>
              <Button size="md" variant="primary" onClick={save}>
                Save
              </Button>
            </>
          }
        />
        <OverviewStrip draft={draft} />
        <Section title="What kind of seizure was it?">
          <Stack>
            <ChipGroup
              label="Seizure type"
              value={draft.typeCode}
              onChange={(typeCode) => setDraft((d) => ({ ...d, typeCode }))}
              options={SEIZURE_TYPES.map((t) => ({ value: t.code, label: label(t.code) }))}
            />
            <p className="proto-note">
              {draft.typeCode
                ? 'The symptoms and sets below now follow this type.'
                : 'Not sure? Leave it empty: everything still works, and you can set it later.'}
            </p>
          </Stack>
        </Section>
        <Tabs tabs={tabs} activeTab={tab} onTabChange={setTab} label="Seizure phases">
          {tab === 'before' ? (
            <Stack>
              <NumberField
                label="About how many hours before the seizure did the first warning sign start?"
                help="Leave 0 if there was none"
                value={draft.prodromeHours}
                max={168}
                maxLength={3}
                onChange={(v) => setDraft((d) => ({ ...d, prodromeHours: v }))}
              />
              <SymptomPicker phase="before" items={draft.items} onItems={setItems} />
              <Timeline draft={draft} only="before" actions={actions} />
            </Stack>
          ) : null}
          {tab === 'during' ? (
            <Stack>
              <SymptomPicker phase="during" items={draft.items} onItems={setItems} />
              <Timeline draft={draft} only="during" actions={actions} />
            </Stack>
          ) : null}
          {tab === 'after' ? <AfterTab actions={actions} setItems={setItems} /> : null}
          {tab === 'details' ? <DetailsTab /> : null}
        </Tabs>
      </Stack>
      {editing ? (
        <BottomSheet
          title={`Where: ${label(editing.code)}`}
          onClose={() => setAreaFor(null)}
          footer={
            <Button variant="primary" fullWidth onClick={() => setAreaFor(null)}>
              Done
            </Button>
          }
        >
          <BodyMap
            value={editing.area}
            onChange={(area) => setItems((previous) => previous.map((i) => (i.id === editing.id ? { ...i, area } : i)))}
          />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

function AfterTab({ actions, setItems }: { actions: TimelineActions; setItems: (u: (p: Item[]) => Item[]) => void }) {
  const { draft, setDraft, label } = usePrototype();
  const [group, setGroup] = useState<string>(FINDING_GROUPS[0]?.code ?? '');
  const inGroup = FINDINGS.filter((f) => f.group === group);
  return (
    <Stack>
      <Section title="How the person was afterwards">
        <Select
          label="Group"
          value={group}
          onChange={setGroup}
          options={FINDING_GROUPS.map((g) => ({ value: g.code, label: label(g.code) }))}
        />
        <ChipGroup
          multiple
          label="Findings"
          value={draft.findings}
          onChange={(findings) => setDraft((d) => ({ ...d, findings }))}
          options={inGroup.map((f) => ({ value: f.code, label: label(f.code) }))}
        />
        {draft.findings.length > 0 ? (
          <p className="proto-note">Chosen: {draft.findings.map(label).join(', ')}</p>
        ) : null}
      </Section>
      <Section title="Recovery">
        <Stack>
          <Checkbox
            checked={draft.notBackYet}
            onChange={(notBackYet) => setDraft((d) => ({ ...d, notBackYet }))}
            label="Not back to normal yet"
          />
          {draft.notBackYet ? null : (
            <NumberField
              label="Back to normal after (minutes)"
              value={draft.recoveryMinutes}
              max={1440}
              maxLength={4}
              onChange={(recoveryMinutes) => setDraft((d) => ({ ...d, recoveryMinutes }))}
            />
          )}
        </Stack>
      </Section>
      <SymptomPicker phase="after" items={draft.items} onItems={setItems} />
      <Timeline draft={draft} only="after" actions={actions} />
    </Stack>
  );
}

function DetailsTab() {
  const { draft, setDraft, label } = usePrototype();
  const focal = draft.onset === 'focal';
  const sec = (a: number | null, b: number | null) => (a === null || b === null ? 0 : Math.round((b - a) / 1000));
  const auraSec = sec(draft.start, draft.auraEnd);
  const seizureSec = sec(draft.auraEnd ?? draft.start, draft.seizureEnd);
  const recoveryMin = Math.round(sec(draft.seizureEnd, draft.recoveryEnd) / 60);
  const setTimes = (aura: number, seizure: number, recovery: number) =>
    setDraft((d) => {
      const auraEnd = aura > 0 ? d.start + aura * 1000 : null;
      const seizureEnd = (auraEnd ?? d.start) + seizure * 1000;
      return { ...d, auraEnd, seizureEnd, recoveryEnd: seizureEnd + recovery * 60_000, source: 'entered-later' };
    });
  return (
    <Stack>
      <Section title="Classification (optional)">
        <Stack>
          <p className="proto-note">Answer what you can. "Not sure" is always fine and can be changed later.</p>
          <ChipGroup
            label="Where did it start?"
            value={draft.onset}
            onChange={(onset) => setDraft((d) => ({ ...d, onset }))}
            options={[
              { value: 'focal', label: label('ilae.onset.focal') },
              { value: 'generalized', label: label('ilae.onset.generalized') },
              ...NOT_SURE,
            ]}
          />
          {focal ? (
            <ChipGroup
              label="Awareness"
              value={draft.awareness}
              onChange={(awareness) => setDraft((d) => ({ ...d, awareness }))}
              options={[
                { value: 'aware', label: label('ilae.awareness.aware') },
                { value: 'impaired', label: label('ilae.awareness.impaired') },
                ...NOT_SURE,
              ]}
            />
          ) : null}
          <ChipGroup
            label="Movement"
            value={draft.motor}
            onChange={(motor) => setDraft((d) => ({ ...d, motor }))}
            options={[
              { value: 'motor', label: label('ilae.motor.motor') },
              { value: 'non_motor', label: label('ilae.motor.non_motor') },
              ...NOT_SURE,
            ]}
          />
          {focal ? (
            <ChipGroup
              label={label('ilae.spread_to_both_sides')}
              value={draft.spread}
              onChange={(spread) => setDraft((d) => ({ ...d, spread }))}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, ...NOT_SURE] as const}
            />
          ) : null}
        </Stack>
      </Section>
      <Section title="Possible triggers">
        <ChipGroup
          multiple
          label="Triggers"
          value={draft.triggers}
          onChange={(triggers) => setDraft((d) => ({ ...d, triggers }))}
          options={TRIGGERS.map((t) => ({ value: t.code, label: label(t.code) }))}
        />
      </Section>
      <Section title="Times">
        <Stack>
          <p className="proto-note">
            Started {clock(draft.start)} · {draft.source === 'timed' ? 'timed live' : 'entered later'}. Changing a time
            marks it as edited.
          </p>
          <NumberField
            label="Aura (seconds)"
            value={auraSec}
            max={3600}
            maxLength={4}
            onChange={(v) => setTimes(v, seizureSec, recoveryMin)}
          />
          <NumberField
            label="Seizure (seconds)"
            value={seizureSec}
            max={7200}
            maxLength={4}
            onChange={(v) => setTimes(auraSec, v, recoveryMin)}
          />
          <NumberField
            label="Recovery (minutes)"
            value={recoveryMin}
            max={1440}
            maxLength={4}
            onChange={(v) => setTimes(auraSec, seizureSec, v)}
          />
        </Stack>
      </Section>
      <Section title="Notes">
        <TextArea
          label="Notes for the neurologist"
          value={draft.notes}
          onChange={(notes) => setDraft((d) => ({ ...d, notes }))}
          rows={4}
        />
        {draft.quickNotes.length > 0 ? (
          <p className="proto-note">From recording: {draft.quickNotes.join(' ')}</p>
        ) : null}
      </Section>
    </Stack>
  );
}

export { PHASES };
export type { Draft };
