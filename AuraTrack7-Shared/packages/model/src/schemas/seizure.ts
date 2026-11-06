import { z } from 'zod';
import { IdSchema } from '../ids';
import { CodeSchema, InstantSchema, ShortTextSchema, TextSchema, TimeZoneSchema, baseRecord } from './common';

/** A body area as codes: the map region, its side or sub-area, and a close-up part. */
export const BodyAreaSchema = z.object({
  region: CodeSchema,
  subRegion: CodeSchema.nullable(),
  part: CodeSchema.nullable(),
});
export type BodyArea = z.infer<typeof BodyAreaSchema>;

export const PhaseSourceSchema = z.enum(['timed', 'edited', 'entered-later']);
export type PhaseSource = z.infer<typeof PhaseSourceSchema>;
export const PhaseMarkSchema = z.object({ at: InstantSchema, source: PhaseSourceSchema });
export type PhaseMark = z.infer<typeof PhaseMarkSchema>;

/**
 * One timing model (README 4.3). `start` begins the aura if there is one. `auraEnd` is when the aura ended and the
 * seizure began. `seizureEnd` is when the seizure stopped (Stop on the recording screen sets it). `recoveryEnd` is when
 * the person was back to normal. Without an `auraEnd` the seizure starts at `start`.
 */
export const PhasesSchema = z.object({
  start: PhaseMarkSchema,
  auraEnd: PhaseMarkSchema.nullable(),
  seizureEnd: PhaseMarkSchema.nullable(),
  recoveryEnd: PhaseMarkSchema.nullable(),
});
export type Phases = z.infer<typeof PhasesSchema>;

export const IlaeSchema = z.object({
  onset: z.enum(['focal', 'generalized', 'unknown']).nullable(),
  awareness: z.enum(['aware', 'impaired', 'unknown']).nullable(),
  motor: z.enum(['motor', 'non_motor']).nullable(),
  feature: CodeSchema.nullable(),
  spreadToBothSides: z.boolean().nullable(),
});
export type Ilae = z.infer<typeof IlaeSchema>;

/**
 * The generalized seizure types of the ILAE 2025 classification (Beniczky et al., Epilepsia 2025, Table 1), plus the two
 * parent terms "absence" and "tonic_clonic" for when the subtype is not known (D-17).
 */
export const ILAE_2025_GENERALIZED = [
  'absence',
  'typical_absence',
  'atypical_absence',
  'myoclonic_absence',
  'eyelid_myoclonia',
  'tonic_clonic',
  'myoclonic_tonic_clonic',
  'absence_to_tonic_clonic',
  'myoclonic',
  'clonic',
  'negative_myoclonus',
  'epileptic_spasms',
  'tonic',
  'atonic',
  'myoclonic_atonic',
] as const;
export type Ilae2025Generalized = (typeof ILAE_2025_GENERALIZED)[number];

/** A yes or no answer, "not sure" (`unknown`), or not answered (null). */
const AnswerSchema = z.enum(['yes', 'no', 'unknown']).nullable();

/**
 * The ILAE 2025 answers (basic version, D-17). Class: where it started (`unknown` = unknown whether focal or generalized).
 * For focal and unknown: recall (awareness) and responsiveness, which together define consciousness; whether it became a
 * bilateral tonic-clonic seizure; whether others could see signs (observable manifestations). For generalized: the kind.
 */
export const Ilae2025Schema = z.object({
  class: z.enum(['focal', 'generalized', 'unknown']).nullable(),
  recall: AnswerSchema,
  responsive: AnswerSchema,
  bilateralTonicClonic: AnswerSchema,
  observable: AnswerSchema,
  generalized: z.enum(ILAE_2025_GENERALIZED).nullable(),
});
export type Ilae2025 = z.infer<typeof Ilae2025Schema>;

/** A seizure profile as it was when the seizure was saved: its id and its name then (D-17). */
export const ProfileSnapshotSchema = z.object({ id: IdSchema, name: ShortTextSchema });
export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;

/**
 * Which phase a symptom belongs to, the same four phases as the times (ILAE semiology glossary): `prodrome` (warning signs
 * before the seizure; not part of it), `aura` (felt first; part of the seizure), `seizure`, `recovery` (post-ictal, until
 * back to usual self). The three phases written before 7.2 are read as aura, seizure and recovery.
 */
export const PHASE_NAMES = ['prodrome', 'aura', 'seizure', 'recovery'] as const;
const LEGACY_PHASE: Readonly<Record<string, (typeof PHASE_NAMES)[number]>> = {
  before: 'aura',
  during: 'seizure',
  after: 'recovery',
};
export const PhaseNameSchema = z.preprocess(
  (v) => (typeof v === 'string' && v in LEGACY_PHASE ? LEGACY_PHASE[v] : v),
  z.enum(PHASE_NAMES),
);
export type PhaseName = z.infer<typeof PhaseNameSchema>;

/** How well the time between one symptom and the next is known. */
export const OffsetSchema = z.object({
  kind: z.enum(['exact', 'approximate', 'unknown']),
  ms: z.number().int().nonnegative().nullable(),
});

/** A symptom on the seizure timeline: its code, where, its place in the order, and when. */
export const SymptomEntrySchema = z.object({
  id: IdSchema,
  code: CodeSchema,
  area: BodyAreaSchema.nullable(),
  /** Symptoms with the same `moment` share one leader line on the timeline. */
  moment: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  /** Time since the previous moment. */
  sincePrevious: OffsetSchema,
  isFirst: z.boolean(),
  /** Added in 7.0.3. Records written before it have none; the editor places those by the time marks. */
  phase: PhaseNameSchema.optional(),
});
export type SymptomEntry = z.infer<typeof SymptomEntrySchema>;

/** A quick-note button tapped while recording: the button's label (the user's own words) and when it was tapped. */
export const QuickNoteSchema = z.object({ id: IdSchema, at: InstantSchema, label: z.string().min(1).max(24) });
export type QuickNote = z.infer<typeof QuickNoteSchema>;

export const FindingEntrySchema = z.object({
  code: CodeSchema,
  /** For a finding the user wrote in their own words (code `after.custom`). */
  customLabel: z.string().max(120).nullable(),
  areas: z.array(BodyAreaSchema).max(40),
});
export type FindingEntry = z.infer<typeof FindingEntrySchema>;

export const SeizureSchema = z.object({
  ...baseRecord,
  /** The time zone at recording, so travel and daylight-saving changes stay correct. */
  timeZone: TimeZoneSchema,
  phases: PhasesSchema,
  /** 'in_progress' from the moment Start is tapped; 'complete' once the user finished the details. */
  status: z.enum(['in_progress', 'recorded', 'complete']),
  /** The plain-language type and the ILAE 2017 answers. New seizures leave them null; older ones keep them as recorded. */
  typeCode: CodeSchema.nullable(),
  ilae: IlaeSchema.nullable(),
  /** Added in 7.2 (D-17): the ILAE 2025 answers, and the seizure profile they came from, as it was then. */
  ilae2025: Ilae2025Schema.nullable().optional(),
  profile: ProfileSnapshotSchema.nullable().optional(),
  symptoms: z.array(SymptomEntrySchema).max(200),
  afterFindings: z.array(FindingEntrySchema).max(100),
  /**
   * Added in 7.0.3: about how long before the start the first warning sign came, in seconds. Some people have a few seconds'
   * warning, others hours; the screen offers seconds, minutes or hours and stores seconds (up to a week).
   */
  prodromeSecondsBefore: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 3600)
    .nullable()
    .optional(),
  /** Added in 7.0.3: the quick-note buttons tapped during the recording, in the order tapped. */
  quickNotes: z.array(QuickNoteSchema).max(200).optional(),
  /** Added in 7.0.3: the recording was started from the PIN screen and merged after unlock. */
  recordedWhileLocked: z.boolean().optional(),
  /** Added in 7.0.3: the recording was cancelled. It is kept, and the user is asked later whether to delete it. */
  cancelled: z.boolean().optional(),
  recoveryMinutes: z.number().int().nonnegative().nullable(),
  recoveryOngoing: z.boolean(),
  triggerCodes: z.array(CodeSchema).max(50),
  notes: TextSchema,
  video: z.object({ fileName: z.string().max(255) }).nullable(),
  isManualEntry: z.boolean(),
  isEmergencyStop: z.boolean(),
  recordedBy: z.enum(['self', 'carer']),
  eegSessionId: IdSchema.nullable(),
});
export type Seizure = z.infer<typeof SeizureSchema>;
