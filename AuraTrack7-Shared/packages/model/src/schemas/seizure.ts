import { z } from 'zod';
import { IdSchema } from '../ids';
import { CodeSchema, InstantSchema, TextSchema, TimeZoneSchema, baseRecord } from './common';

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

/** Which part of the seizure a symptom belongs to: before (prodrome and aura), during, or after (post-ictal). */
export const PhaseNameSchema = z.enum(['before', 'during', 'after']);
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
  typeCode: CodeSchema.nullable(),
  ilae: IlaeSchema.nullable(),
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
