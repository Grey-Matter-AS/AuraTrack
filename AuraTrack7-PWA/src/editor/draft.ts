import { formatHms } from '@auratrack/ui';
import type { MessageKey, MessageParams } from '@auratrack/i18n';
import {
  EMPTY_ILAE_2025,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  bodyAreaFromLegacy,
  ilae2025ForSaving,
  isAuraLike,
  newId,
  switchProfileAnswers,
  type BodyArea,
  type Ilae2025,
  type PhaseName,
  type PhaseSource,
  type ProfileSnapshot,
  type Seizure,
  type SeizureProfile,
  type SymptomEntry,
} from '@auratrack/model';

// The seizure editor's working copy (F-300). A `Draft` is what the screen edits; `draftFromSeizure` makes it from the saved
// seizure and `patchFromDraft` makes the change to save. Only what the user changed is in the patch, so editing the notes
// never rewrites the symptoms, and a time that was timed live stays "timed" unless it is edited.

export type Area = BodyArea;
/** The four phases in the order they happen; warning signs (prodrome) come before the seizure and are not part of it. */
export const PHASES: readonly PhaseName[] = ['prodrome', 'aura', 'seizure', 'recovery'];
export type { PhaseName };

/**
 * The time since the previous symptom, as a person would say it, or `custom`: a time typed as h:mm:ss (kept in
 * `customMs`). A new symptom starts at `unknown`: no gap is ever assumed on the person's behalf.
 */
export type Gap = 'unknown' | 'same' | 'few' | 's10' | 's30' | 'm1' | 'custom';
export const GAPS: readonly Gap[] = ['unknown', 'same', 'few', 's10', 's30', 'm1', 'custom'];
const GAP_MS: Record<Exclude<Gap, 'unknown' | 'custom'>, number> = {
  same: 0,
  few: 3000,
  s10: 10_000,
  s30: 30_000,
  m1: 60_000,
};

export interface Item {
  id: string;
  code: string;
  phase: PhaseName;
  area: Area | null;
  gap: Gap;
  /** The typed time since the previous symptom when `gap` is `custom`, in ms. */
  customMs: number | null;
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
  /** The ILAE 2025 answers (D-17), and the profile they came from as it is named now. */
  ilae2025: Ilae2025;
  profile: ProfileSnapshot | null;
  /** The timeline items the chosen profile added, so choosing another one can take them away again. Not saved. */
  profileItems: string[];
  /** Recorded before 7.2: the plain-language type and the ILAE 2017 answers. Shown as they are; never changed. */
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
  /** How long before the start the first warning signs came (prodrome), in seconds; null when none were entered. */
  prodromeSec: number | null;
  recoveryMinutes: number;
  notBackYet: boolean;
  /** The timer stopped itself at 12 minutes; the seizure end is not known unless the user adds it. */
  stoppedByTimer: boolean;
}

export const CUSTOM_FINDING = 'after.custom';

/** Sorted by `order`, then by phase: the order of the seizure. */
export const inSeizureOrder = (items: readonly Item[]): Item[] =>
  PHASES.flatMap((phase) => items.filter((item) => item.phase === phase));

const PRESET_BY_MS = new Map(Object.entries(GAP_MS).map(([gap, ms]) => [ms, gap as Gap]));
/** How a saved gap shows on its delay card: a preset when it is one, else its own time (a live tap is exact to the second). */
const gapOf = (offset: SymptomEntry['sincePrevious'], first: boolean): Pick<Item, 'gap' | 'customMs'> => {
  if (first || offset.kind === 'unknown' || offset.ms === null) return { gap: 'unknown', customMs: null };
  if (offset.kind === 'exact' && offset.ms <= 500) return { gap: 'same', customMs: null };
  const preset = offset.kind === 'approximate' ? PRESET_BY_MS.get(offset.ms) : undefined;
  return preset ? { gap: preset, customMs: null } : { gap: 'custom', customMs: offset.ms };
};

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
      phase: e.phase ?? 'seizure',
      area: e.area,
      ...gapOf(e.sincePrevious, i === 0 || e.isFirst || e.phase === 'prodrome'),
      saved: e.sincePrevious,
    })),
    ilae2025: s.ilae2025 ?? EMPTY_ILAE_2025,
    profile: s.profile ?? null,
    profileItems: [],
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
    prodromeSec: s.prodromeSecondsBefore ?? null,
    recoveryMinutes: s.recoveryMinutes ?? 0,
    notBackYet: s.recoveryOngoing,
    stoppedByTimer: s.isEmergencyStop && s.phases.seizureEnd === null,
  };
}

export const prodromeSeconds = (d: Pick<Draft, 'prodromeSec'>): number => Math.max(0, Math.round(d.prodromeSec ?? 0));

/** "about 02:00:00", or null when there was no warning. `t` writes it in the chosen language. */
export const prodromeText = (
  d: Pick<Draft, 'prodromeSec'>,
  t: (key: MessageKey, params?: MessageParams) => string,
): string | null => (prodromeSeconds(d) > 0 ? t('tl.about', { value: formatHms(prodromeSeconds(d)) }) : null);

/**
 * Recovery in seconds: from the end of the seizure until back to usual self. Taken from the phase marks; a seizure that
 * only has the older minutes field (or no known end) uses that. Null when nothing was entered.
 */
export function recoverySecondsOf(d: Pick<Draft, 'seizureEnd' | 'recoveryEnd' | 'recoveryMinutes'>): number | null {
  if (d.seizureEnd !== null && d.recoveryEnd !== null) {
    const sec = Math.round((d.recoveryEnd - d.seizureEnd) / 1000);
    if (sec > 0) return sec; // a recovery mark on the seizure's end (End seizure missed) says nothing about its length
  }
  return d.recoveryMinutes > 0 ? d.recoveryMinutes * 60 : null;
}

/** The draft with a new recovery length: the phase mark moves (when the seizure's end is known) and the minutes follow. */
export function withRecovery<D extends Pick<Draft, 'seizureEnd' | 'recoveryEnd' | 'recoveryMinutes'>>(
  d: D,
  sec: number | null,
): D {
  const v = sec === null ? 0 : Math.max(0, Math.round(sec));
  return {
    ...d,
    recoveryEnd: d.seizureEnd !== null ? (v > 0 ? d.seizureEnd + v * 1000 : null) : d.recoveryEnd,
    recoveryMinutes: Math.round(v / 60),
  };
}

/**
 * The first sign of the seizure: the first symptom that is not a warning sign. Warning signs come hours or minutes before
 * the start, so they are never the first sign and are not timed from it.
 */
export const firstSignOf = (items: readonly Item[]): Item | undefined =>
  inSeizureOrder(items).find((i) => i.phase !== 'prodrome');

function entriesOf(items: readonly Item[]): SymptomEntry[] {
  const ordered = inSeizureOrder(items);
  const first = ordered.findIndex((i) => i.phase !== 'prodrome');
  const unknown: SymptomEntry['sincePrevious'] = { kind: 'unknown', ms: null };
  let moment = -1;
  return ordered.map((item, index) => {
    const prodrome = item.phase === 'prodrome';
    // The times between symptoms are counted from the first sign of the seizure; warning signs have none
    const offset: SymptomEntry['sincePrevious'] = prodrome
      ? unknown
      : (item.saved ??
        (index === first || item.gap === 'unknown' || (item.gap === 'custom' && item.customMs === null)
          ? unknown
          : item.gap === 'custom'
            ? { kind: 'approximate', ms: item.customMs } // typed from memory: an estimate, never exact
            : { kind: item.gap === 'same' ? 'exact' : 'approximate', ms: GAP_MS[item.gap] }));
    if (prodrome || index === first || item.gap !== 'same') moment += 1;
    return {
      id: item.id,
      code: item.code,
      area: item.area,
      moment,
      order: index,
      sincePrevious: offset,
      isFirst: index === first,
      phase: item.phase,
    };
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What to save: only the fields the user changed since the draft was opened. */
export function patchFromDraft(before: Draft, now: Draft, original: Seizure): Partial<Seizure> {
  const patch: Partial<Seizure> = {};
  // The type and ILAE 2017 answers of an older seizure are never written: the editor only shows them
  const answers = ilae2025ForSaving(now.ilae2025);
  if (!same(answers, ilae2025ForSaving(before.ilae2025))) patch.ilae2025 = answers;
  if (!same(now.profile, before.profile)) patch.profile = now.profile;
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

export type TabId = 'classification' | 'timeline' | 'notes';
/**
 * Classification, then the whole seizure as one timeline, then the notes. The timeline has a labelled section per phase
 * (warning signs, aura, seizure, recovery) holding that phase's length and details and its symptom cards.
 */
export const TABS: readonly TabId[] = ['classification', 'timeline', 'notes'];

/**
 * The phases the timeline shows. A seizure like an aura (focal, preserved consciousness, nothing others could see) is all
 * aura, so it has no Seizure section, unless symptoms were already placed there.
 */
export const timelinePhases = (d: Pick<Draft, 'typeCode' | 'ilae2025' | 'items'>): PhaseName[] =>
  (d.typeCode === 'seizure_type.aura_only' || isAuraLike(d.ilae2025)) && !d.items.some((i) => i.phase === 'seizure')
    ? ['prodrome', 'aura', 'recovery']
    : [...PHASES];

/** The draft with a symptom moved to another phase: it goes to the end of that phase, and its time since the one before is
 * no longer known (it now follows a different symptom). */
export const movedToPhase = (items: readonly Item[], id: string, phase: PhaseName): Item[] => {
  const item = items.find((i) => i.id === id);
  if (!item || item.phase === phase) return [...items];
  return [...items.filter((i) => i.id !== id), { ...item, phase, gap: 'unknown', customMs: null, saved: null }];
};

/**
 * The draft after the chosen profile changes (`to` null: "Something different"). The answers switch by the model rule
 * (switchProfileAnswers). The timeline items the old profile added go again if nobody changed them, and the new profile's
 * usual signs are added after what is there, each phase in its own order, without doubling a sign already there.
 */
export function chooseProfile(d: Draft, to: SeizureProfile | null, profiles: readonly SeizureProfile[]): Draft {
  const from = d.profile ? (profiles.find((p) => p.id === d.profile?.id) ?? null) : null;
  const untouched = (i: Item) => d.profileItems.includes(i.id) && i.saved === null && i.area === startingArea(i.code);
  const kept = d.items.filter((i) => !untouched(i));
  const added = (to?.signs ?? [])
    .filter((x, n, all) => all.findIndex((y) => y.code === x.code && y.phase === x.phase) === n)
    .filter((x) => !kept.some((i) => i.code === x.code && i.phase === x.phase))
    .map((x) => newItem(x.code, x.phase));
  return {
    ...d,
    ilae2025: switchProfileAnswers(d.ilae2025, from?.ilae ?? null, to?.ilae ?? null),
    profile: to ? { id: to.id, name: to.name } : null,
    items: [...kept, ...added],
    profileItems: added.map((i) => i.id),
  };
}

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
  gap: 'unknown',
  customMs: null,
  saved: null,
});

/** The value a date-and-time field wants: local time to the second, never UTC. */
export function localInputValue(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** m:ss, or h:mm:ss from an hour (a long recovery or warning). */
export const mmss = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

export const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * The symptoms this patient has most often had in a phase, for the "often" row (F-304). With a profile chosen it counts
 * that profile's seizures first; with fewer than three it falls back to all of them. Most common first.
 */
export function frequentSymptoms(
  seizures: readonly Seizure[],
  profileId: string | null,
  phase: PhaseName,
  count = 6,
): string[] {
  const tally = (list: readonly Seizure[]) => {
    const counts = new Map<string, number>();
    for (const seizure of list)
      for (const symptom of seizure.symptoms)
        if ((symptom.phase ?? 'seizure') === phase) counts.set(symptom.code, (counts.get(symptom.code) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
  };
  const ofType = profileId ? tally(seizures.filter((x) => x.profile?.id === profileId)) : [];
  return (ofType.length >= 3 ? ofType : [...ofType, ...tally(seizures).filter((c) => !ofType.includes(c))]).slice(
    0,
    count,
  );
}
