import { FINDINGS, FINDING_GROUPS, SEIZURE_TYPES, TRIGGERS } from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Checkbox,
  ChipGroup,
  DateTimeField,
  Dialog,
  NumberField,
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
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { BodyMap } from './BodyMap';
import {
  clock,
  localInputValue,
  prodromeText,
  tabsFor,
  type Gap,
  type Item,
  type PhaseName,
  type TabId,
} from './draft';
import { useEditor, useEditorHost } from './EditorContext';
import { goHome, useNav } from './nav';
import { SymptomPicker } from './SymptomPicker';
import { OverviewStrip, Timeline, type TimelineActions } from './Timeline';
import '../screens/screens.css';
import './editor.css';

// The seizure editor, in tabs (F-300). Classification comes first: the type chosen there decides what the other tabs suggest
// (and which of them are shown). Every tab is always there with its state; the overview above shows the whole seizure; Save
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
  const [leaving, setLeaving] = useState(false);

  const setItems = (update: (previous: Item[]) => Item[]) => setDraft((d) => ({ ...d, items: update(d.items) }));
  const count = (phase: PhaseName) => draft.items.filter((i) => i.phase === phase).length;
  const added = (n: number) => (n === 0 ? t('tab.notFilled') : t('tab.added', { n }));

  const ids = tabsFor(draft.typeCode);
  const active: TabId = ids.includes(tab) ? tab : 'classification'; // a tab the type does not show falls back to the first
  const state: Record<TabId, string> = {
    classification: draft.typeCode ? label(draft.typeCode) : t('tab.typeNotSet'),
    before: prodromeText(draft, t) ? `${added(count('before'))} · ${prodromeText(draft, t)}` : added(count('before')),
    during: added(count('during')),
    after: added(count('after') + draft.findings.length + draft.customFindings.length),
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
    remove: (id) => setItems((previous) => previous.filter((i) => i.id !== id)),
    pickArea: (id) => setAreaFor(id),
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
  const { draft, setDraft, label, t } = useEditor();
  const focal = draft.onset === 'focal';
  const notSure = [{ value: 'unknown', label: t('common.notSure') }] as const;
  return (
    <Stack>
      <Section title={t('cls.question')}>
        <Stack>
          <ChipGroup
            label={t('cls.typeLabel')}
            value={draft.typeCode}
            onChange={(typeCode) => setDraft((d) => ({ ...d, typeCode }))}
            options={SEIZURE_TYPES.map((x) => ({ value: x.code, label: label(x.code) }))}
          />
          <p className="app-note">{draft.typeCode ? t('cls.follow') : t('cls.notSureHint')}</p>
        </Stack>
      </Section>
      <Section title={t('cls.section')}>
        <Stack>
          <p className="app-note">{t('cls.intro')}</p>
          <ChipGroup
            label={t('cls.onset')}
            value={draft.onset}
            onChange={(onset) => setDraft((d) => ({ ...d, onset }))}
            options={
              [
                { value: 'focal', label: label('ilae.onset.focal') },
                { value: 'generalized', label: label('ilae.onset.generalized') },
                ...notSure,
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
                  ...notSure,
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
                ...notSure,
              ] as const
            }
          />
          {focal ? (
            <ChipGroup
              label={label('ilae.spread_to_both_sides')}
              value={draft.spread}
              onChange={(spread) => setDraft((d) => ({ ...d, spread }))}
              options={
                [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }, ...notSure] as const
              }
            />
          ) : null}
        </Stack>
      </Section>
    </Stack>
  );
}

function BeforeTab({ actions, setItems }: { actions: TimelineActions; setItems: (u: (p: Item[]) => Item[]) => void }) {
  const { draft, setDraft, label, t } = useEditor();
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
          options={TRIGGERS.map((x) => ({ value: x.code, label: label(x.code) }))}
        />
      </Section>
      <SymptomPicker phase="before" items={draft.items} onItems={setItems} />
      <Timeline draft={draft} only="before" actions={actions} />
    </Stack>
  );
}

function AfterTab({ actions, setItems }: { actions: TimelineActions; setItems: (u: (p: Item[]) => Item[]) => void }) {
  const { draft, setDraft, label, t } = useEditor();
  const [group, setGroup] = useState<string>(FINDING_GROUPS[0]?.code ?? '');
  const [custom, setCustom] = useState('');
  const inGroup = FINDINGS.filter((f) => f.group === group && f.code !== 'after.custom');
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
  const nav = useNav();
  const app = useApp();
  const { draft, setDraft, t, language, original } = useEditor();
  const [history, setHistory] = useState<{ at: number; kind: string; fields: string[] }[] | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [ended, setEnded] = useState(() => localInputValue(draft.start));
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

  const sec = (a: number | null, b: number | null) => (a === null || b === null ? 0 : Math.round((b - a) / 1000));
  const auraSec = sec(draft.start, draft.auraEnd);
  const seizureSec = sec(draft.auraEnd ?? draft.start, draft.seizureEnd);
  const recoveryMin = Math.round(sec(draft.seizureEnd, draft.recoveryEnd) / 60);
  const setTimes = (aura: number, seizure: number, recovery: number) =>
    setDraft((d) => {
      const auraEnd = d.start + aura * 1000;
      const seizureEnd = auraEnd + seizure * 1000;
      return { ...d, auraEnd, seizureEnd, recoveryEnd: recovery > 0 ? seizureEnd + recovery * 60_000 : null };
    });
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
      <Section title={t('times.section')}>
        <Stack>
          <p className="app-note">
            {t('times.started', {
              time: clock(draft.start),
              source: t(draft.sources.start === 'entered-later' ? 'times.enteredLater' : 'times.timed'),
            })}
          </p>
          <DateTimeField
            type="datetime-local"
            label={t('past.when')}
            value={localInputValue(draft.start)}
            max={localInputValue(openedAt)}
            onChange={(value) => {
              const at = new Date(value).getTime();
              if (Number.isNaN(at)) return;
              // The seizure keeps its length: every later time moves with the start
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
          {draft.stoppedByTimer && draft.seizureEnd === null ? (
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
            <>
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
            </>
          )}
        </Stack>
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
