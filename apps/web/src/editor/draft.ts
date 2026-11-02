import type { MessageKey, MessageParams } from '@auratrack/i18n';
import {
  SYMPTOMS,
  SYMPTOM_GROUPS,
  bodyAreaFromLegacy,
  newId,
  type BodyArea,
  type PhaseName,
  type PhaseSource,
  type Seizure,
  type SymptomEntry,
} from '@auratrack/model';

// The seizure editor's working copy (F-300). A `Draft` is what the screen edits; `draftFromSeizure` makes it from the saved
// seizure and `patchFromDraft` makes the change to save. Only what the user changed is in the patch, so editing the notes
// never rewrites the symptoms, and a time that was timed live stays "timed" unless it is edited.

export type Area = BodyArea;
export const PHASES: readonly PhaseName[] = ['before', 'during', 'after'];
export type { PhaseName };

/** The time since the previous symptom, as a person would say it. */
export type Gap = 'same' | 'few' | 's10' | 's30' | 'm1' | 'unknown';
export const GAPS: readonly Gap[] = ['same', 'few', 's10', 's30', 'm1', 'unknown'];
const GAP_MS: Record<Exclude<Gap, 'unknown'>, number> = { same: 0, few: 3000, s10: 10_000, s30: 30_000, m1: 60_000 };

export interface Item {
  id: string;
  code: string;
  phase: PhaseName;
  area: Area | null;
  gap: Gap;
  /** The time between, exactly as saved (for instance tapped live). Kept until the user changes the gap or the order. */
  saved: SymptomEntry['sincePrevious'] | null;
}

export interface Draft {
  seizureId: string;
  isPast: boolean;
  status: Seizure['status'];
  /** Epoch ms. */
  start: number;
  auraEnd: number | null;
  seizureEnd: number | null;
  recoveryEnd: number | null;
  /** Where each time came from, and so what "edited" means. */
  sources: { start: PhaseSource; auraEnd: PhaseSource; seizureEnd: PhaseSource; recoveryEnd: PhaseSource };
  items: Item[];
  typeCode: string | null;
  onset: 'focal' | 'generalized' | 'unknown' | null;
  awareness: 'aware' | 'impaired' | 'unknown' | null;
  motor: 'motor' | 'non_motor' | 'unknown' | null;
  spread: 'yes' | 'no' | 'unknown' | null;
  triggers: string[];
  findings: string[];
  /** The user's own findings, in their own words. */
  customFindings: string[];
  notes: string;
  quickNotes: string[];
  prodromeAmount: number;
  prodromeUnit: 'seconds' | 'minutes' | 'hours';
  recoveryMinutes: number;
  notBackYet: boolean;
  /** The timer stopped itself at 12 minutes; the seizure end is not known unless the user adds it. */
  stoppedByTimer: boolean;
}

export const CUSTOM_FINDING = 'after.custom';

/** Sorted by `order`, then by phase: the order of the seizure. */
export const inSeizureOrder = (items: readonly Item[]): Item[] =>
  PHASES.flatMap((phase) => items.filter((item) => item.phase === phase));

const gapOf = (offset: SymptomEntry['sincePrevious'], first: boolean): Gap => {
  if (first || offset.kind === 'unknown' || offset.ms === null) return 'unknown';
  const ms = offset.ms;
  return ms <= 500 ? 'same' : ms <= 6500 ? 'few' : ms <= 20_000 ? 's10' : ms <= 45_000 ? 's30' : 'm1';
};

/** The prodrome as an amount and the biggest whole unit. */
function prodromeParts(seconds: number | null | undefined): Pick<Draft, 'prodromeAmount' | 'prodromeUnit'> {
  const s = seconds ?? 0;
  if (s > 0 && s % 3600 === 0) return { prodromeAmount: s / 3600, prodromeUnit: 'hours' };
  if (s > 0 && s % 60 === 0) return { prodromeAmount: s / 60, prodromeUnit: 'minutes' };
  return { prodromeAmount: s, prodromeUnit: 'seconds' };
}

export function draftFromSeizure(s: Seizure): Draft {
  const entries = [...s.symptoms].sort((a, b) => a.order - b.order);
  const ilae = s.ilae;
  const known = s.afterFindings.filter((f) => f.code !== CUSTOM_FINDING);
  return {
    seizureId: s.id,
    isPast: s.isManualEntry,
    status: s.status,
    start: s.phases.start.at,
    auraEnd: s.phases.auraEnd?.at ?? null,
    seizureEnd: s.phases.seizureEnd?.at ?? null,
    recoveryEnd: s.phases.recoveryEnd?.at ?? null,
    sources: {
      start: s.phases.start.source,
      auraEnd: s.phases.auraEnd?.source ?? 'timed',
      seizureEnd: s.phases.seizureEnd?.source ?? 'timed',
      recoveryEnd: s.phases.recoveryEnd?.source ?? 'timed',
    },
    items: entries.map((e, i) => ({
      id: e.id,
      code: e.code,
      phase: e.phase ?? 'during',
      area: e.area,
      gap: gapOf(e.sincePrevious, i === 0),
      saved: e.sincePrevious,
    })),
    typeCode: s.typeCode,
    onset: ilae?.onset ?? null,
    awareness: ilae?.awareness ?? null,
    motor: ilae?.motor ?? null,
    spread: ilae?.spreadToBothSides == null ? null : ilae.spreadToBothSides ? 'yes' : 'no',
    triggers: [...s.triggerCodes],
    findings: known.map((f) => f.code),
    customFindings: s.afterFindings.filter((f) => f.code === CUSTOM_FINDING).map((f) => f.customLabel ?? ''),
    notes: s.notes,
    quickNotes: (s.quickNotes ?? []).map((n) => `[T+${Math.round((n.at - s.phases.start.at) / 1000)}s] ${n.label}`),
    ...prodromeParts(s.prodromeSecondsBefore),
    recoveryMinutes: s.recoveryMinutes ?? 0,
    notBackYet: s.recoveryOngoing,
    stoppedByTimer: s.isEmergencyStop && s.phases.seizureEnd === null,
  };
}

export const prodromeSeconds = (d: Pick<Draft, 'prodromeAmount' | 'prodromeUnit'>): number =>
  d.prodromeAmount * { seconds: 1, minutes: 60, hours: 3600 }[d.prodromeUnit];

const UNIT_KEY = { seconds: 'unit.sShort', minutes: 'unit.minShort', hours: 'unit.hShort' } as const;
/** "about 30 s", "about 2 h", or null when there was no warning. `t` writes it in the chosen language. */
export const prodromeText = (
  d: Pick<Draft, 'prodromeAmount' | 'prodromeUnit'>,
  t: (key: MessageKey, params?: MessageParams) => string,
): string | null =>
  d.prodromeAmount > 0 ? t('tl.about', { value: `${d.prodromeAmount} ${t(UNIT_KEY[d.prodromeUnit])}` }) : null;

function entriesOf(items: readonly Item[]): SymptomEntry[] {
  const ordered = inSeizureOrder(items);
  let moment = -1;
  return ordered.map((item, index) => {
    const offset: SymptomEntry['sincePrevious'] =
      item.saved ??
      (index === 0 || item.gap === 'unknown'
        ? { kind: 'unknown', ms: null }
        : { kind: item.gap === 'same' ? 'exact' : 'approximate', ms: GAP_MS[item.gap] });
    if (index === 0 || item.gap !== 'same') moment += 1;
    return {
      id: item.id,
      code: item.code,
      area: item.area,
      moment,
      order: index,
      sincePrevious: offset,
      isFirst: index === 0,
      phase: item.phase,
    };
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What to save: only the fields the user changed since the draft was opened. */
export function patchFromDraft(before: Draft, now: Draft, original: Seizure): Partial<Seizure> {
  const patch: Partial<Seizure> = {};
  if (now.typeCode !== before.typeCode) patch.typeCode = now.typeCode;
  if (
    now.onset !== before.onset ||
    now.awareness !== before.awareness ||
    now.motor !== before.motor ||
    now.spread !== before.spread
  ) {
    const anything = now.onset ?? now.awareness ?? now.motor ?? now.spread;
    patch.ilae =
      anything === null
        ? null
        : {
            onset: now.onset,
            awareness: now.awareness,
            motor: now.motor === 'unknown' ? null : now.motor,
            feature: original.ilae?.feature ?? null,
            spreadToBothSides: now.spread === 'yes' ? true : now.spread === 'no' ? false : null,
          };
  }
  if (!same(now.items, before.items)) patch.symptoms = entriesOf(now.items);
  if (!same(now.triggers, before.triggers)) patch.triggerCodes = now.triggers;
  if (!same(now.findings, before.findings) || !same(now.customFindings, before.customFindings)) {
    const kept = original.afterFindings.filter((f) => f.code !== CUSTOM_FINDING && now.findings.includes(f.code));
    const added = now.findings
      .filter((code) => !kept.some((f) => f.code === code))
      .map((code) => ({ code, customLabel: null, areas: [] }));
    const custom = now.customFindings
      .filter((text) => text.trim() !== '')
      .map((customLabel) => ({ code: CUSTOM_FINDING, customLabel: customLabel.slice(0, 120), areas: [] }));
    patch.afterFindings = [...kept, ...added, ...custom];
  }
  if (now.notes !== before.notes) patch.notes = now.notes;
  if (prodromeSeconds(now) !== prodromeSeconds(before)) patch.prodromeSecondsBefore = prodromeSeconds(now) || null;
  if (now.recoveryMinutes !== before.recoveryMinutes) patch.recoveryMinutes = now.recoveryMinutes || null;
  if (now.notBackYet !== before.notBackYet) patch.recoveryOngoing = now.notBackYet;

  const timesChanged =
    now.start !== before.start ||
    now.auraEnd !== before.auraEnd ||
    now.seizureEnd !== before.seizureEnd ||
    now.recoveryEnd !== before.recoveryEnd;
  if (timesChanged) {
    const mark = (key: 'start' | 'auraEnd' | 'seizureEnd' | 'recoveryEnd') => {
      const at = now[key];
      if (at === null) return null;
      const source: PhaseSource =
        at === before[key] ? now.sources[key] : before[key] === null ? 'entered-later' : 'edited';
      return { at, source };
    };
    const start = mark('start');
    if (start)
      patch.phases = {
        start,
        auraEnd: mark('auraEnd'),
        seizureEnd: mark('seizureEnd'),
        recoveryEnd: mark('recoveryEnd'),
      };
  }
  if (now.status !== before.status) patch.status = now.status;
  return patch;
}

// ---- tabs

export type TabId = 'classification' | 'before' | 'during' | 'after' | 'notes';
/** The tabs follow the seizure type: an aura-only seizure has no "during" part. */
export const tabsFor = (typeCode: string | null): TabId[] =>
  typeCode === 'seizure_type.aura_only'
    ? ['classification', 'before', 'after', 'notes']
    : ['classification', 'before', 'during', 'after', 'notes'];

// ---- body areas

/**
 * Does a symptom have a place on the body? The catalogue (from 6.1) knows: feelings and states (déjà vu, a strange smell,
 * blacking out, speech) have none; some symptoms are always in one place (tongue biting is the mouth), so nothing is asked.
 */
export type AreaRule = { kind: 'none' } | { kind: 'ask' } | { kind: 'fixed'; area: Area };
export function areaRule(code: string): AreaRule {
  const symptom = SYMPTOMS.find((s) => s.code === code);
  if (!symptom) return { kind: 'ask' };
  if (SYMPTOM_GROUPS.find((g) => g.code === symptom.group)?.skipRegion) return { kind: 'none' };
  if (symptom.forceRegion) {
    const area = bodyAreaFromLegacy(symptom.forceRegion, symptom.forceSubRegion ?? '', '');
    if (area) return { kind: 'fixed', area };
  }
  return { kind: 'ask' };
}
export const startingArea = (code: string): Area | null => {
  const rule = areaRule(code);
  return rule.kind === 'fixed' ? rule.area : null;
};

export const newItem = (code: string, phase: PhaseName): Item => ({
  id: newId(),
  code,
  phase,
  area: startingArea(code),
  gap: 'few',
  saved: null,
});

/** The value a date-and-time field wants: local time, never UTC. */
export function localInputValue(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

export const mmss = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * The symptoms this patient has most often had in a phase, for the "often" row (F-304). With a seizure type chosen it counts
 * that type's seizures first; with fewer than three it falls back to all of them. Most common first.
 */
export function frequentSymptoms(
  seizures: readonly Seizure[],
  typeCode: string | null,
  phase: PhaseName,
  count = 6,
): string[] {
  const tally = (list: readonly Seizure[]) => {
    const counts = new Map<string, number>();
    for (const seizure of list)
      for (const symptom of seizure.symptoms)
        if ((symptom.phase ?? 'during') === phase) counts.set(symptom.code, (counts.get(symptom.code) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
  };
  const ofType = typeCode ? tally(seizures.filter((x) => x.typeCode === typeCode)) : [];
  return (ofType.length >= 3 ? ofType : [...ofType, ...tally(seizures).filter((c) => !ofType.includes(c))]).slice(
    0,
    count,
  );
}
