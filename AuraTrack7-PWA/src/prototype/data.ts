import type { MessageKey, MessageParams } from '@auratrack/i18n';
import { SEIZURE_TYPES, SYMPTOMS, SYMPTOM_GROUPS, bodyAreaFromLegacy } from '@auratrack/model';

// Made-up data for the clickable prototype (M3, slice 4). Nothing here is real, and nothing is saved.
// The codes are the real catalogue's, so the labels (in any of the nine languages) are the real ones.

export type PhaseName = 'before' | 'during' | 'after';
export const PHASES: readonly PhaseName[] = ['before', 'during', 'after'];

export interface Area {
  region: string;
  subRegion: string | null;
  part: string | null;
}

/** The time since the previous symptom, as a person would say it. */
export type Gap = 'same' | 'few' | 's10' | 's30' | 'm1' | 'unknown';
export const GAPS: readonly Gap[] = ['same', 'few', 's10', 's30', 'm1', 'unknown'];

export interface Item {
  id: string;
  code: string;
  phase: PhaseName;
  area: Area | null;
  gap: Gap;
}

export interface Draft {
  isPast: boolean;
  /** Epoch ms. */
  start: number;
  auraEnd: number | null;
  seizureEnd: number | null;
  recoveryEnd: number | null;
  /** Whether each time was timed live or typed in. */
  source: 'timed' | 'entered-later';
  items: Item[];
  typeCode: string | null;
  onset: 'focal' | 'generalized' | 'unknown' | null;
  awareness: 'aware' | 'impaired' | 'unknown' | null;
  motor: 'motor' | 'non_motor' | 'unknown' | null;
  spread: 'yes' | 'no' | 'unknown' | null;
  triggers: string[];
  findings: string[];
  notes: string;
  quickNotes: string[];
  /** How long before the seizure the first warning sign came: an amount and its unit. */
  prodromeAmount: number;
  prodromeUnit: 'seconds' | 'minutes' | 'hours';
  recoveryMinutes: number;
  notBackYet: boolean;
  emergencyStop: boolean;
}

let counter = 0;
export const newItemId = (): string => `i${++counter}`;

export const emptyDraft = (start = Date.now()): Draft => ({
  isPast: false,
  start,
  auraEnd: null,
  seizureEnd: null,
  recoveryEnd: null,
  source: 'timed',
  items: [],
  typeCode: null,
  onset: null,
  awareness: null,
  motor: null,
  spread: null,
  triggers: [],
  findings: [],
  notes: '',
  quickNotes: [],
  prodromeAmount: 0,
  prodromeUnit: 'minutes',
  recoveryMinutes: 0,
  notBackYet: false,
  emergencyStop: false,
});

export const PATIENTS = [{ name: 'Alex (demo)' }, { name: 'Sam (demo)' }] as const;

/** Usual symptoms per phase for this made-up patient. */
export const FREQUENT: Record<PhaseName, string[]> = {
  before: [
    'symptom.emotions_memory.deja_vu_been_here_before',
    'symptom.hearing_and_smell.strange_smell',
    'symptom.stomach_and_chest.rising_butterfly_feeling',
  ],
  during: [
    'symptom.awareness.total_blackout',
    'symptom.stiffening_locking.body_gone_rigid',
    'symptom.big_shaking_jerking.rhythmic_shaking',
    'symptom.eyes.staring_blankly',
    'symptom.face_and_mouth.tongue_biting',
  ],
  after: ['symptom.awareness.confused_dream_like', 'symptom.talking.slurred_speech'],
};

/**
 * Once the seizure type is known, the "often" rows follow it: a tonic-clonic seizure and an absence have different usual
 * symptoms. In the real app this comes from what this patient has recorded for the type; here it is made up.
 */
export const FREQUENT_BY_TYPE: Record<string, Record<PhaseName, string[]>> = {
  'seizure_type.tonic_clonic': {
    before: FREQUENT.before,
    during: [
      'symptom.awareness.total_blackout',
      'symptom.stiffening_locking.body_gone_rigid',
      'symptom.big_shaking_jerking.rhythmic_shaking',
      'symptom.face_and_mouth.tongue_biting',
      'symptom.face_and_mouth.drooling',
    ],
    after: [
      'symptom.awareness.confused_dream_like',
      'symptom.talking.slurred_speech',
      'symptom.talking.unable_to_speak',
    ],
  },
  'seizure_type.focal_aware': {
    before: [
      'symptom.emotions_memory.deja_vu_been_here_before',
      'symptom.hearing_and_smell.strange_smell',
      'symptom.hearing_and_smell.strange_taste',
    ],
    during: [
      'symptom.emotions_memory.sudden_fear_panic',
      'symptom.skin_sensation.tingling_pins_and_needles',
      'symptom.vision_eyes.flashing_lights_colors',
      'symptom.awareness.fully_awake_aware',
    ],
    after: [],
  },
  'seizure_type.focal_impaired': {
    before: FREQUENT.before,
    during: [
      'symptom.eyes.staring_blankly',
      'symptom.automatic_habits.lip_smacking_chewing',
      'symptom.automatic_habits.fidgeting_with_clothes',
      'symptom.awareness.confused_dream_like',
    ],
    after: ['symptom.awareness.confused_dream_like', 'symptom.talking.slurred_speech'],
  },
  'seizure_type.absence': {
    before: [],
    during: ['symptom.eyes.staring_blankly', 'symptom.eyes.rapid_blinking', 'symptom.awareness.total_blackout'],
    after: [],
  },
  'seizure_type.aura_only': {
    before: [],
    during: [
      'symptom.emotions_memory.deja_vu_been_here_before',
      'symptom.hearing_and_smell.strange_smell',
      'symptom.emotions_memory.intense_peace_joy',
    ],
    after: [],
  },
};
export const frequentFor = (typeCode: string | null, phase: PhaseName): string[] =>
  (typeCode ? FREQUENT_BY_TYPE[typeCode]?.[phase] : undefined) ?? FREQUENT[phase];

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
/** The area a new symptom starts with: the fixed one, or none. */
export const startingArea = (code: string): Area | null => {
  const rule = areaRule(code);
  return rule.kind === 'fixed' ? rule.area : null;
};

export interface SavedSet {
  id: string;
  name: string;
  typeCode: string;
  items: { code: string; phase: PhaseName }[];
}
export const SAVED_SETS: SavedSet[] = [
  {
    id: 's1',
    name: 'Usual start',
    typeCode: 'seizure_type.tonic_clonic',
    items: [
      { code: 'symptom.emotions_memory.deja_vu_been_here_before', phase: 'before' },
      { code: 'symptom.awareness.total_blackout', phase: 'during' },
      { code: 'symptom.stiffening_locking.body_gone_rigid', phase: 'during' },
      { code: 'symptom.big_shaking_jerking.rhythmic_shaking', phase: 'during' },
    ],
  },
  {
    id: 's2',
    name: 'Staring and chewing',
    typeCode: 'seizure_type.focal_impaired',
    items: [
      { code: 'symptom.eyes.staring_blankly', phase: 'during' },
      { code: 'symptom.automatic_habits.lip_smacking_chewing', phase: 'during' },
    ],
  },
];

export const QUICK_NOTE_KEYS = ['quick.fell', 'quick.blue', 'quick.vomited', 'quick.wet'] as const;
export const RESCUE = {
  medication: 'Midazolam 10 mg, buccal',
  contact: 'Jordan (parent) · 555 0100',
  neurologist: 'Dr. Example · 555 0199',
} as const;

/** Made-up recent seizures: how many days ago and at what time, so the date is written in the chosen language. */
export const RECENT = [
  { id: 'r1', daysAgo: 1, hour: 21, minute: 14, typeCode: 'seizure_type.focal_impaired', seconds: 94, flag: null },
  { id: 'r2', daysAgo: 3, hour: 7, minute: 52, typeCode: 'seizure_type.tonic_clonic', seconds: 312, flag: 'long' },
  { id: 'r3', daysAgo: 5, hour: 16, minute: 30, typeCode: 'seizure_type.absence', seconds: 18, flag: null },
] as const;

export const mmss = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A readable date and time in the visitor's own zone (never toISOString for a calendar day). */
export const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const typeCodes = SEIZURE_TYPES.map((t) => t.code);
export const symptomCodes = SYMPTOMS.map((s) => s.code);

/** Items in the order of the seizure: before, then during, then after, each in the order added. */
export const inSeizureOrder = (items: readonly Item[]): Item[] =>
  PHASES.flatMap((phase) => items.filter((item) => item.phase === phase));

/** The value a date-and-time field wants: local time, never UTC. */
export function localInputValue(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

const UNIT_KEY = { seconds: 'unit.sShort', minutes: 'unit.minShort', hours: 'unit.hShort' } as const;
/** "about 30 s", "about 2 h", or null when there was no warning. `t` writes it in the chosen language. */
export const prodromeText = (
  d: Pick<Draft, 'prodromeAmount' | 'prodromeUnit'>,
  t: (key: MessageKey, params?: MessageParams) => string,
): string | null =>
  d.prodromeAmount > 0 ? t('tl.about', { value: `${d.prodromeAmount} ${t(UNIT_KEY[d.prodromeUnit])}` }) : null;
/** What the model stores: whole seconds. */
export const prodromeSeconds = (d: Pick<Draft, 'prodromeAmount' | 'prodromeUnit'>): number =>
  d.prodromeAmount * { seconds: 1, minutes: 60, hours: 3600 }[d.prodromeUnit];

export type TabId = 'classification' | 'before' | 'during' | 'after' | 'notes';
/**
 * The tabs follow the seizure type. An aura-only seizure has no "during" part, so that tab is not shown; every other type
 * shows all of them. (More of this, like hiding what never applies to a type, is for you to say after trying it.)
 */
export const tabsFor = (typeCode: string | null): TabId[] =>
  typeCode === 'seizure_type.aura_only'
    ? ['classification', 'before', 'after', 'notes']
    : ['classification', 'before', 'during', 'after', 'notes'];
