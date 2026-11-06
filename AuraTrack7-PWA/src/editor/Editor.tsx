import {
  EMPTY_ILAE_2025,
  FINDINGS,
  FINDING_GROUPS,
  MAX_SEIZURE_PROFILES,
  PROFILES_IN_ROW,
  TRIGGERS,
  ilae2025ForSaving,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Checkbox,
  ChipGroup,
  DateTimeField,
  Disclosure,
  formatHms,
  Dialog,
  DurationField,
  Screen,
  Section,
  Select,
  Stack,
  Tabs,
  TextArea,
  TextField,
  useToast,
  type TabItem,
} from '@auratrack/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../app/AppContext';
import { ilae2025Name } from '../app/seizureName';
import { BodyMap } from './BodyMap';
import {
  areaRule,
  chooseProfile,
  newItem,
  clock,
  localInputValue,
  recoverySecondsOf,
  withRecovery,
  TABS,
  movedToPhase,
  type Draft,
  type Gap,
  type Item,
  type PhaseName,
  type TabId,
} from './draft';
import { useEditor, useEditorHost } from './EditorContext';
import { Ilae2025Questions } from './Ilae2025Questions';
import { goHome, useNav } from './nav';
import { AddSymptomSheet, SaveSetButton, SetPicker } from './SymptomPicker';
import { OverviewStrip, Timeline, type TimelineActions } from './Timeline';
import '../screens/screens.css';
import './editor.css';

// The seizure editor, in tabs (F-300). Classification comes first: the profile and ILAE 2025 answers there decide what the
// timeline suggests. The Timeline tab holds the whole seizure as symptom cards and delay cards; Warning signs, Recovery and
// Notes hold what the timeline does not. Every tab is always there with its state; the overview above shows the whole seizure; Save
// works from any tab, and Review shows everything in order before saving.

const NOT_SURE = [{ value: 'unknown', label: 'Not sure' }] as const;

export function Editor() {
  const nav = useNav();
  const toast = useToast();
  const app = useApp();
  const { draft, setDraft, label, t, dirty, patch, original } = useEditor();
  // Whichever way the editor is left, what it held is let go, so a later lock cannot save it
  const { discard } = useEditorHost();
  useEffect(() => discard, [discard]);
  const [tab, setTab] = useState<TabId>('classification');
  const [areaFor, setAreaFor] = useState<string | null>(null);
  const [adding, setAdding] = useState<PhaseName | null>(null);
  const [leaving, setLeaving] = useState(false);

  const setItems = (update: (previous: Item[]) => Item[]) => setDraft((d) => ({ ...d, items: update(d.items) }));
  const added = (n: number) => (n === 0 ? t('tab.notFilled') : t('tab.added', { n }));

  const ids = TABS;
  const active: TabId = tab;
  const state: Record<TabId, string> = {
    classification:
      draft.profile?.name ??
      ilae2025Name(draft.ilae2025, t) ??
      (draft.typeCode ? label(draft.typeCode) : t('tab.typeNotSet')),
    timeline: added(draft.items.length),
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
        // The times between were measured for the old order, so they are no longer exact
        const forget = (i: Item): Item => ({ ...i, saved: null });
        return previous.map((i) => (i.id === item.id ? forget(other) : i.id === other.id ? forget(item) : i));
      }),
    setGap: (id, gap: Gap) =>
      setItems((previous) => previous.map((i) => (i.id === id ? { ...i, gap, saved: null } : i))),
    setCustomGap: (id, ms) =>
      setItems((previous) =>
        previous.map((i) => (i.id === id ? { ...i, gap: 'custom', customMs: ms, saved: null } : i)),
      ),
    setPhase: (id, phase) => setItems((previous) => movedToPhase(previous, id, phase)),
    remove: (id) => setItems((previous) => previous.filter((i) => i.id !== id)),
    pickArea: (id) => setAreaFor(id),
    add: (phase) => setAdding(phase),
  };

  const save = async () => {
    await app.actions.saveSeizure(original.id, patch('complete'));
    toast(t('common.saved'), 'success');
    goHome(nav);
  };
  const back = () => (dirty ? setLeaving(true) : nav.pop());
  const editing = draft.items.find((i) => i.id === areaFor);

  return (
    <Screen>
      <Stack>
        <AppHeader
          title={t(draft.isPast ? 'editor.titlePast' : 'editor.title')}
          onBack={back}
          actions={
            <>
              <Button size="md" onClick={() => nav.push('review')}>
                {t('common.review')}
              </Button>
              <Button size="md" variant="primary" disabled={app.busy} onClick={() => void save()}>
                {t('common.save')}
              </Button>
            </>
          }
        />
        <OverviewStrip draft={draft} />
        <Tabs tabs={tabs} activeTab={active} onTabChange={(id) => setTab(id as TabId)} label={t('editor.sections')}>
          {active === 'classification' ? <ClassificationTab /> : null}
          {active === 'timeline' ? (
            <Stack>
              <SetPicker onItems={setItems} />
              <Timeline
                draft={draft}
                actions={actions}
                details={(phase) => <PhaseDetails phase={phase} />}
                startDetails={<StartDetails />}
              />
              <SaveSetButton />
            </Stack>
          ) : null}
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
      {adding ? (
        <AddSymptomSheet
          phase={adding}
          onClose={() => setAdding(null)}
          onPick={(code) => {
            const item = newItem(code, adding);
            setItems((previous) => [...previous, item]);
            setAdding(null);
            // A symptom with a place on the body asks for it straight away
            if (areaRule(code).kind === 'ask') setAreaFor(item.id);
          }}
        />
      ) : null}
      {leaving ? (
        <Dialog
          title={t('editor.leaveTitle')}
          message={t('editor.leaveMessage')}
          onClose={() => setLeaving(false)}
          actions={
            <>
              <Button variant="danger" fullWidth onClick={() => nav.pop()}>
                {t('editor.leave')}
              </Button>
              <Button fullWidth onClick={() => setLeaving(false)}>
                {t('editor.stay')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

function ClassificationTab() {
  const { draft, setDraft, t, label, profiles } = useEditor();
  const app = useApp();
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [name, setName] = useState('');
  const [withSigns, setWithSigns] = useState(true);
  const answers = ilae2025ForSaving(draft.ilae2025);
  const chosen = draft.profile?.id ?? (answers ? DIFFERENT : null);
  // The first few profiles show; the chosen one always does, even when it is further down or has been removed since
  const row = all ? profiles : profiles.slice(0, PROFILES_IN_ROW);
  const options = [
    ...row.map((p) => ({ value: p.id, label: p.name })),
    ...(draft.profile && !row.some((p) => p.id === draft.profile?.id)
      ? [{ value: draft.profile.id, label: draft.profile.name }]
      : []),
    { value: DIFFERENT, label: t('prof.different') },
  ];
  const choose = (id: string) => {
    if (id === chosen) return;
    const to = profiles.find((p) => p.id === id) ?? null;
    setDraft((d) => chooseProfile(d, to, profiles));
  };
  const earlier = earlierAnswers(draft, label);
  const keep = async () => {
    if (!app.patient) return;
    const created = await app.actions.createRecord('seizureProfile', {
      patientId: app.patient.id,
      name: name.trim().slice(0, 60),
      ilae: answers ?? EMPTY_ILAE_2025,
      signs: withSigns ? draft.items.map((i) => ({ code: i.code, phase: i.phase })).slice(0, 40) : [],
      position: Math.max(-1, ...profiles.map((p) => p.position)) + 1,
    });
    setDraft((d) => ({ ...d, profile: { id: String(created.id), name: name.trim().slice(0, 60) } }));
    toast(t('prof.kept'), 'success');
    setKeeping(false);
    setName('');
  };
  return (
    <Stack>
      {draft.typeCode || earlier ? (
        <Section title={t('classify.earlier', { type: draft.typeCode ? label(draft.typeCode) : t('home.untyped') })}>
          {earlier ? <p className="app-note">{t('classify.earlier2017', { answers: earlier })}</p> : null}
        </Section>
      ) : null}
      <Section title={t('prof.row')}>
        <Stack>
          {/* With no profile saved yet there is nothing to start from: only the hint shows */}
          {options.length > 1 ? (
            <ChipGroup showLabel={false} label={t('prof.row')} value={chosen} onChange={choose} options={options} />
          ) : null}
          {profiles.length > PROFILES_IN_ROW ? (
            <Button size="md" onClick={() => setAll((x) => !x)}>
              {all ? t('prof.fewer') : t('prof.more', { n: profiles.length - PROFILES_IN_ROW })}
            </Button>
          ) : null}
          <p className="app-note">
            {draft.profile
              ? `${t('prof.from', { name: draft.profile.name })} ${t('prof.rowHelp')}`
              : profiles.length === 0
                ? t('prof.noneYet')
                : t('prof.rowHelp')}
          </p>
        </Stack>
      </Section>
      <Section title={t('classify.section')}>
        <Stack>
          <p className="app-note">{t('cls.intro')}</p>
          <Ilae2025Questions value={draft.ilae2025} onChange={(ilae2025) => setDraft((d) => ({ ...d, ilae2025 }))} />
          {!draft.profile && answers && profiles.length < MAX_SEIZURE_PROFILES ? (
            <Button onClick={() => setKeeping(true)}>{t('prof.keep')}</Button>
          ) : null}
          {!draft.profile && answers && profiles.length >= MAX_SEIZURE_PROFILES ? (
            <p className="app-note">{t('prof.full', { max: MAX_SEIZURE_PROFILES })}</p>
          ) : null}
        </Stack>
      </Section>
      {keeping ? (
        <BottomSheet
          title={t('prof.keepTitle')}
          onClose={() => setKeeping(false)}
          footer={
            <Button variant="primary" fullWidth disabled={name.trim() === '' || app.busy} onClick={() => void keep()}>
              {t('common.save')}
            </Button>
          }
        >
          <TextField label={t('prof.name')} help={t('prof.nameHelp')} value={name} onChange={setName} maxLength={60} />
          {draft.items.length > 0 ? (
            <Checkbox
              label={t('prof.withSigns', { n: Math.min(draft.items.length, 40) })}
              checked={withSigns}
              onChange={setWithSigns}
            />
          ) : null}
        </BottomSheet>
      ) : null}
    </Stack>
  );
}

const DIFFERENT = 'different';

/** The ILAE 2017 answers of a seizure recorded before 7.2, in words, or null when it has none. */
function earlierAnswers(d: Draft, label: (code: string) => string): string | null {
  const parts = [
    d.onset ? label(`ilae.onset.${d.onset}`) : null,
    d.awareness ? label(`ilae.awareness.${d.awareness}`) : null,
    d.motor && d.motor !== 'unknown' ? label(`ilae.motor.${d.motor}`) : null,
    d.spread === 'yes' ? label('ilae.spread_to_both_sides') : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** The lengths of the phases, kept as marks: aura, then seizure, then recovery; changing one moves the marks after it. */
function usePhaseTimes() {
  const { draft, setDraft } = useEditor();
  const sec = (a: number | null, b: number | null) => (a === null || b === null ? 0 : Math.round((b - a) / 1000));
  const auraSec = draft.auraEnd === null ? null : sec(draft.start, draft.auraEnd);
  const seizureSec = draft.seizureEnd === null ? null : sec(draft.auraEnd ?? draft.start, draft.seizureEnd);
  const recoverySec = recoverySecondsOf(draft);
  const lengthSec = draft.seizureEnd === null ? null : sec(draft.start, draft.seizureEnd);
  const setTimes = (aura: number | null, seizure: number | null, recovery: number | null) =>
    setDraft((d) => {
      const auraEnd = d.start + (aura ?? 0) * 1000;
      const seizureEnd = auraEnd + (seizure ?? 0) * 1000;
      return withRecovery({ ...d, auraEnd, seizureEnd }, recovery);
    });
  // After the 12-minute stop the end of the seizure is not known until someone enters it
  const endUnknown = draft.stoppedByTimer && draft.seizureEnd === null;
  return { auraSec, seizureSec, recoverySec, lengthSec, setTimes, endUnknown };
}

/** At the Start mark: when it began. Every later time moves with it, so the seizure keeps its length. */
function StartDetails() {
  const { draft, setDraft, t } = useEditor();
  const [openedAt] = useState(() => Date.now());
  return (
    <Stack gap="0.5rem">
      <DateTimeField
        type="datetime-local"
        label={t('past.when')}
        value={localInputValue(draft.start)}
        max={localInputValue(openedAt)}
        onChange={(value) => {
          const at = new Date(value).getTime();
          if (Number.isNaN(at)) return;
          setDraft((d) => {
            const shift = at - d.start;
            const moved = (x: number | null) => (x === null ? null : x + shift);
            return {
              ...d,
              start: at,
              auraEnd: moved(d.auraEnd),
              seizureEnd: moved(d.seizureEnd),
              recoveryEnd: moved(d.recoveryEnd),
            };
          });
        }}
      />
      <p className="app-note">
        {t('times.started', {
          time: clock(draft.start),
          source: t(draft.sources.start === 'entered-later' ? 'times.enteredLater' : 'times.timed'),
        })}
      </p>
    </Stack>
  );
}

/** A long list of chips folded into one row that opens: "Possible triggers · 2 chosen   Show ⌄". */
function Fold({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const { t } = useEditor();
  return (
    <Disclosure title={title} summary={count > 0 ? t('fold.chosen', { n: count }) : t('fold.none')}>
      {children}
    </Disclosure>
  );
}

/**
 * What each phase section holds besides its symptom cards: warning signs (how long before, triggers), aura (its length),
 * seizure (its length, or when it ended after a 12-minute stop), recovery (its length, findings).
 */
function PhaseDetails({ phase }: { phase: PhaseName }) {
  const { draft, setDraft, label, t } = useEditor();
  const times = usePhaseTimes();
  const [ended, setEnded] = useState(() => localInputValue(draft.start));
  const [group, setGroup] = useState<string>(FINDING_GROUPS[0]?.code ?? '');
  const [custom, setCustom] = useState('');
  if (phase === 'prodrome')
    return (
      <Stack>
        <DurationField
          label={t('dur.prodrome')}
          help={t('dur.prodromeHelp')}
          value={draft.prodromeSec}
          onChange={(prodromeSec) => setDraft((d) => ({ ...d, prodromeSec }))}
        />
        <Fold title={t('before.triggers')} count={draft.triggers.length}>
          <ChipGroup
            multiple
            showLabel={false}
            label={t('before.triggers')}
            value={draft.triggers}
            onChange={(triggers) => setDraft((d) => ({ ...d, triggers }))}
            options={TRIGGERS.map((x) => ({ value: x.code, label: label(x.code) }))}
          />
        </Fold>
      </Stack>
    );
  if (phase === 'aura')
    return times.endUnknown ? null : (
      <DurationField
        label={t('tl.howLong')}
        value={times.auraSec}
        onChange={(v) => times.setTimes(v, times.seizureSec, times.recoverySec)}
      />
    );
  if (phase === 'seizure')
    return times.endUnknown ? (
      <Stack>
        <p className="app-banner">{t('times.endUnknown')}</p>
        <DateTimeField
          type="datetime-local"
          label={t('times.whenEnded')}
          value={ended}
          min={localInputValue(draft.start)}
          onChange={(value) => {
            setEnded(value);
            const at = new Date(value).getTime();
            if (!Number.isNaN(at) && at >= draft.start)
              setDraft((d) => ({ ...d, auraEnd: d.auraEnd ?? d.start, seizureEnd: at }));
          }}
        />
        <p className="app-note">{t('times.dontKnow')}</p>
      </Stack>
    ) : (
      <Stack>
        <DurationField
          label={t('tl.howLong')}
          help={t('dur.seizureHelp')}
          value={times.seizureSec}
          onChange={(v) => times.setTimes(times.auraSec, v, times.recoverySec)}
        />
        <p className="app-banner" aria-live="polite">
          {times.lengthSec === null ? t('dur.lengthNone') : t('dur.length', { length: formatHms(times.lengthSec) })}
        </p>
      </Stack>
    );
  const inGroup = FINDINGS.filter((f) => f.group === group && f.code !== 'after.custom');
  return (
    <Stack>
      <Checkbox
        checked={draft.notBackYet}
        onChange={(notBackYet) => setDraft((d) => ({ ...d, notBackYet }))}
        label={t('after.notBack')}
      />
      {draft.notBackYet ? null : (
        <DurationField
          label={t('dur.recovery')}
          value={times.recoverySec}
          onChange={(v) =>
            draft.seizureEnd === null
              ? setDraft((d) => withRecovery(d, v))
              : times.setTimes(times.auraSec, times.seizureSec, v)
          }
        />
      )}
      <Fold title={t('after.section')} count={draft.findings.length + draft.customFindings.length}>
        <Stack>
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
          {draft.findings.length + draft.customFindings.length > 0 ? (
            <p className="app-note">
              {t('after.chosen', { list: [...draft.findings.map(label), ...draft.customFindings].join(', ') })}
            </p>
          ) : null}
          <TextField label={t('after.customLabel')} value={custom} onChange={setCustom} maxLength={120} />
          <Button
            disabled={custom.trim() === ''}
            onClick={() => {
              setDraft((d) => ({ ...d, customFindings: [...d.customFindings, custom.trim()] }));
              setCustom('');
            }}
          >
            {t('after.customAdd')}
          </Button>
        </Stack>
      </Fold>
    </Stack>
  );
}

function NotesTab() {
  const nav = useNav();
  const app = useApp();
  const { draft, setDraft, t, language, original } = useEditor();
  const [history, setHistory] = useState<{ at: number; kind: string; fields: string[] }[] | null>(null);
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => {
    let live = true;
    void app.actions
      .history(original.id)
      .then((h) => live && setHistory(h))
      .catch(() => undefined); // the app locked meanwhile
    return () => {
      live = false;
    };
  }, [app.actions, original.id]);

  const field = (name: string) => {
    const key = `field.${name}`;
    return (
      [
        'phases',
        'symptoms',
        'typeCode',
        'ilae',
        'triggerCodes',
        'afterFindings',
        'notes',
        'prodromeSecondsBefore',
        'recoveryMinutes',
        'status',
        'quickNotes',
        'ilae2025',
        'profile',
      ] as const
    ).includes(name as never)
      ? t(key as 'field.phases')
      : t('field.other');
  };
  const time = (at: number) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(at));

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
          <p className="app-note">{t('notes.fromRecording', { list: draft.quickNotes.join(' ') })}</p>
        ) : null}
      </Section>
      <Section title={t('editor.history')}>
        {history === null || history.length === 0 ? (
          <p className="app-note">{t('editor.historyNone')}</p>
        ) : (
          <ul className="app-list">
            {history.map((h, i) => (
              <li key={i}>
                {t('editor.historyLine', {
                  time: time(h.at),
                  fields:
                    h.kind === 'create' ? t('editor.historyCreated') : [...new Set(h.fields.map(field))].join(', '),
                })}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Button variant="danger" onClick={() => setDiscarding(true)}>
        {t('editor.discard')}
      </Button>
      {discarding ? (
        <Dialog
          tone="danger"
          title={t('editor.discardTitle')}
          message={t('editor.discardMessage')}
          onClose={() => setDiscarding(false)}
          actions={
            <>
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  void app.actions.saveSeizure(original.id, { cancelled: true }).then(() => goHome(nav));
                }}
              >
                {t('editor.discard')}
              </Button>
              <Button fullWidth onClick={() => setDiscarding(false)}>
                {t('editor.stay')}
              </Button>
            </>
          }
        />
      ) : null}
    </Stack>
  );
}

export { NOT_SURE };
