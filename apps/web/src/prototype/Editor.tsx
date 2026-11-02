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
import { clock, prodromeText, tabsFor, type Gap, type Item, type PhaseName, type TabId } from './data';
import { SymptomPicker } from './SymptomPicker';
import { OverviewStrip, Timeline, type TimelineActions } from './Timeline';
import { goHome, useNav } from './nav';
import { usePrototype } from './state';

// The seizure editor, in tabs. Classification comes first: the type chosen there decides what the other tabs suggest (and
// which of them are shown). Every tab is always there with its state; the overview above shows the whole seizure; Save works
// from any tab and Review shows everything in order before saving.

const NOT_SURE = [{ value: 'unknown', label: 'Not sure' }] as const;

export function Editor() {
  const nav = useNav();
  const toast = useToast();
  const { draft, setDraft, label, t } = usePrototype();
  const [tab, setTab] = useState<TabId>('classification');
  const [areaFor, setAreaFor] = useState<string | null>(null);

  const setItems = (update: (previous: Item[]) => Item[]) => setDraft((d) => ({ ...d, items: update(d.items) }));
  const count = (phase: PhaseName) => draft.items.filter((i) => i.phase === phase).length;
  const added = (n: number) => (n === 0 ? t('tab.notFilled') : t('tab.added', { n }));

  const ids = tabsFor(draft.typeCode);
  const active: TabId = ids.includes(tab) ? tab : 'classification'; // a tab the type does not show falls back to the first
  const state: Record<TabId, string> = {
    classification: draft.typeCode ? label(draft.typeCode) : t('tab.typeNotSet'),
    before: prodromeText(draft, t) ? `${added(count('before'))} · ${prodromeText(draft, t)}` : added(count('before')),
    during: added(count('during')),
    after: added(count('after') + draft.findings.length),
    notes: draft.notes ? t('tab.written') : t('tab.nothingYet'),
  };
  const tabs: TabItem[] = ids.map((id) => ({ id, label: t(`tab.${id}`), state: state[id] }));

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
    toast(t('common.saved'), 'success');
    goHome(nav);
  };
  const editing = draft.items.find((i) => i.id === areaFor);

  return (
    <Screen>
      <Stack>
        <AppHeader
          title={t(draft.isPast ? 'editor.titlePast' : 'editor.title')}
          onBack={() => nav.pop()}
          actions={
            <>
              <Button size="md" onClick={() => nav.push('review')}>
                {t('common.review')}
              </Button>
              <Button size="md" variant="primary" onClick={save}>
                {t('common.save')}
              </Button>
            </>
          }
        />
        <OverviewStrip draft={draft} />
        <Tabs tabs={tabs} activeTab={active} onTabChange={(id) => setTab(id as TabId)} label={t('editor.sections')}>
          {active === 'classification' ? <ClassificationTab /> : null}
          {active === 'before' ? <BeforeTab actions={actions} setItems={setItems} /> : null}
          {active === 'during' ? (
            <Stack>
              <SymptomPicker phase="during" items={draft.items} onItems={setItems} />
              <Timeline draft={draft} only="during" actions={actions} />
            </Stack>
          ) : null}
          {active === 'after' ? <AfterTab actions={actions} setItems={setItems} /> : null}
          {active === 'notes' ? <NotesTab /> : null}
        </Tabs>
      </Stack>
      {editing ? (
        <BottomSheet
          title={t('area.where', { symptom: label(editing.code) })}
          onClose={() => setAreaFor(null)}
          footer={
            <Button variant="primary" fullWidth onClick={() => setAreaFor(null)}>
              {t('common.done')}
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

function ClassificationTab() {
  const { draft, setDraft, label, t } = usePrototype();
  const focal = draft.onset === 'focal';
  return (
    <Stack>
      <Section title={t('cls.question')}>
        <Stack>
          <ChipGroup
            label={t('cls.typeLabel')}
            value={draft.typeCode}
            onChange={(typeCode) => setDraft((d) => ({ ...d, typeCode }))}
            options={SEIZURE_TYPES.map((t) => ({ value: t.code, label: label(t.code) }))}
          />
          <p className="proto-note">{draft.typeCode ? t('cls.follow') : t('cls.notSureHint')}</p>
        </Stack>
      </Section>
      <Section title={t('cls.section')}>
        <Stack>
          <p className="proto-note">{t('cls.intro')}</p>
          <ChipGroup
            label={t('cls.onset')}
            value={draft.onset}
            onChange={(onset) => setDraft((d) => ({ ...d, onset }))}
            options={
              [
                { value: 'focal', label: label('ilae.onset.focal') },
                { value: 'generalized', label: label('ilae.onset.generalized') },
                ...NOT_SURE,
              ] as const
            }
          />
          {focal ? (
            <ChipGroup
              label={t('cls.awareness')}
              value={draft.awareness}
              onChange={(awareness) => setDraft((d) => ({ ...d, awareness }))}
              options={
                [
                  { value: 'aware', label: label('ilae.awareness.aware') },
                  { value: 'impaired', label: label('ilae.awareness.impaired') },
                  ...NOT_SURE,
                ] as const
              }
            />
          ) : null}
          <ChipGroup
            label={t('cls.movement')}
            value={draft.motor}
            onChange={(motor) => setDraft((d) => ({ ...d, motor }))}
            options={
              [
                { value: 'motor', label: label('ilae.motor.motor') },
                { value: 'non_motor', label: label('ilae.motor.non_motor') },
                ...NOT_SURE,
              ] as const
            }
          />
          {focal ? (
            <ChipGroup
              label={label('ilae.spread_to_both_sides')}
              value={draft.spread}
              onChange={(spread) => setDraft((d) => ({ ...d, spread }))}
              options={
                [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }, ...NOT_SURE] as const
              }
            />
          ) : null}
        </Stack>
      </Section>
    </Stack>
  );
}

function BeforeTab({ actions, setItems }: { actions: TimelineActions; setItems: (u: (p: Item[]) => Item[]) => void }) {
  const { draft, setDraft, label, t } = usePrototype();
  return (
    <Stack>
      <Section title={t('before.warningSection')}>
        <Stack>
          <NumberField
            label={t('before.howLong')}
            help={t('before.leaveZero')}
            value={draft.prodromeAmount}
            max={999}
            maxLength={3}
            onChange={(prodromeAmount) => setDraft((d) => ({ ...d, prodromeAmount }))}
          />
          <ChipGroup
            label={t('before.unit')}
            value={draft.prodromeUnit}
            onChange={(prodromeUnit) => setDraft((d) => ({ ...d, prodromeUnit }))}
            options={[
              { value: 'seconds', label: t('unit.seconds') },
              { value: 'minutes', label: t('unit.minutes') },
              { value: 'hours', label: t('unit.hours') },
            ]}
          />
        </Stack>
      </Section>
      <Section title={t('before.triggers')}>
        <ChipGroup
          multiple
          label={t('before.triggersLabel')}
          value={draft.triggers}
          onChange={(triggers) => setDraft((d) => ({ ...d, triggers }))}
          options={TRIGGERS.map((t) => ({ value: t.code, label: label(t.code) }))}
        />
      </Section>
      <SymptomPicker phase="before" items={draft.items} onItems={setItems} />
      <Timeline draft={draft} only="before" actions={actions} />
    </Stack>
  );
}

function AfterTab({ actions, setItems }: { actions: TimelineActions; setItems: (u: (p: Item[]) => Item[]) => void }) {
  const { draft, setDraft, label, t } = usePrototype();
  const [group, setGroup] = useState<string>(FINDING_GROUPS[0]?.code ?? '');
  const inGroup = FINDINGS.filter((f) => f.group === group);
  return (
    <Stack>
      <Section title={t('after.section')}>
        <Select
          label={t('after.group')}
          value={group}
          onChange={setGroup}
          options={FINDING_GROUPS.map((g) => ({ value: g.code, label: label(g.code) }))}
        />
        <ChipGroup
          multiple
          label={t('after.findings')}
          value={draft.findings}
          onChange={(findings) => setDraft((d) => ({ ...d, findings }))}
          options={inGroup.map((f) => ({ value: f.code, label: label(f.code) }))}
        />
        {draft.findings.length > 0 ? (
          <p className="proto-note">{t('after.chosen', { list: draft.findings.map(label).join(', ') })}</p>
        ) : null}
      </Section>
      <Section title={t('after.recovery')}>
        <Stack>
          <Checkbox
            checked={draft.notBackYet}
            onChange={(notBackYet) => setDraft((d) => ({ ...d, notBackYet }))}
            label={t('after.notBack')}
          />
          {draft.notBackYet ? null : (
            <NumberField
              label={t('after.backAfter')}
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

function NotesTab() {
  const { draft, setDraft, t } = usePrototype();
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
      <Section title={t('notes.section')}>
        <TextArea
          label={t('notes.label')}
          value={draft.notes}
          onChange={(notes) => setDraft((d) => ({ ...d, notes }))}
          rows={4}
        />
        {draft.quickNotes.length > 0 ? (
          <p className="proto-note">{t('notes.fromRecording', { list: draft.quickNotes.join(' ') })}</p>
        ) : null}
      </Section>
      <Section title={t('times.section')}>
        <Stack>
          <p className="proto-note">
            {t('times.started', {
              time: clock(draft.start),
              source: t(draft.source === 'timed' ? 'times.timed' : 'times.enteredLater'),
            })}
          </p>
          <NumberField
            label={t('times.aura')}
            value={auraSec}
            max={3600}
            maxLength={4}
            onChange={(v) => setTimes(v, seizureSec, recoveryMin)}
          />
          <NumberField
            label={t('times.seizure')}
            value={seizureSec}
            max={7200}
            maxLength={4}
            onChange={(v) => setTimes(auraSec, v, recoveryMin)}
          />
          <NumberField
            label={t('times.recovery')}
            value={recoveryMin}
            max={1440}
            maxLength={4}
            onChange={(v) => setTimes(auraSec, seizureSec, v)}
          />
        </Stack>
      </Section>
    </Stack>
  );
}
