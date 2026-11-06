import { z } from 'zod';
import { IdSchema } from '../ids';
import { ClockTimeSchema, CodeSchema, InstantSchema, ShortTextSchema, TextSchema, baseRecord } from './common';

export const FrequencySchema = z.enum(['OD', 'BD', 'TDS', 'QDS', 'PRN']);
export type Frequency = z.infer<typeof FrequencySchema>;
export const WeekdaySchema = z.number().int().min(0).max(6);

/** The clinically relevant part of a medication: what a change record stores before and after. */
export const RegimenSchema = z.object({
  name: ShortTextSchema,
  activeIngredient: ShortTextSchema,
  /** The form as a catalogue code (`form.tablet`), or null when not given; the label comes from the catalogue. */
  form: CodeSchema.nullable(),
  dose: z.number().nonnegative().nullable(),
  unit: z.string().max(20),
  slotDoses: z.record(ClockTimeSchema, z.number().nonnegative()),
  /** The unit of each time's dose ("mg" in the morning, "tablet" at night). A time without one uses `unit`. */
  slotUnits: z.record(ClockTimeSchema, z.string().max(20)),
  frequency: FrequencySchema,
  scheduledTimes: z.array(ClockTimeSchema).max(24),
  scheduledDays: z.array(WeekdaySchema).max(7),
});
export type Regimen = z.infer<typeof RegimenSchema>;

export const MedicationSchema = z.object({
  ...baseRecord,
  ...RegimenSchema.shape,
  isRescue: z.boolean(),
  showInEmergency: z.boolean(),
  reminderEnabled: z.boolean(),
  active: z.boolean(),
  startedAt: InstantSchema.nullable(),
  stoppedAt: InstantSchema.nullable(),
});
export type Medication = z.infer<typeof MedicationSchema>;

/** Only ever added to, never edited (README 4.4). */
export const MedicationChangeSchema = z.object({
  ...baseRecord,
  medicationId: IdSchema,
  medicationName: ShortTextSchema,
  type: z.enum(['started', 'changed', 'stopped', 'correction']),
  effectiveAt: InstantSchema,
  recordedAt: InstantSchema,
  from: RegimenSchema.nullable(),
  to: RegimenSchema.nullable(),
  changedFields: z.array(z.string().max(40)).max(40),
  note: TextSchema,
  isBaseline: z.boolean(),
});
export type MedicationChange = z.infer<typeof MedicationChangeSchema>;

export const DOSE_STATUSES = ['taken', 'assumed', 'late', 'missed'] as const;
export const DoseStatusSchema = z.enum(DOSE_STATUSES);
export type DoseStatus = z.infer<typeof DoseStatusSchema>;

export const DoseLogSchema = z.object({
  ...baseRecord,
  medicationId: IdSchema,
  scheduledTime: ClockTimeSchema.nullable(),
  takenAt: InstantSchema,
  status: DoseStatusSchema,
  note: TextSchema,
  doseSnapshot: z.number().nonnegative().nullable(),
  unitSnapshot: z.string().max(20),
});
export type DoseLog = z.infer<typeof DoseLogSchema>;
