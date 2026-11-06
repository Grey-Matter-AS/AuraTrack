import { z } from 'zod';
import { HlcStringSchema } from '../hlc';
import { IdSchema } from '../ids';
import { CalendarDaySchema, CodeSchema, InstantSchema, ShortTextSchema, TextSchema, baseRecord } from './common';

export const HouseholdSchema = z.object({ id: IdSchema, name: ShortTextSchema, createdAt: InstantSchema });
export type Household = z.infer<typeof HouseholdSchema>;

export const DeviceSchema = z.object({
  id: IdSchema,
  householdId: IdSchema,
  name: ShortTextSchema,
  createdAt: InstantSchema,
});
export type Device = z.infer<typeof DeviceSchema>;

export const PatientSchema = z.object({
  ...baseRecord,
  name: ShortTextSchema,
  dateOfBirth: CalendarDaySchema.nullable(),
  emergencyContact: ShortTextSchema,
  /** The emergency contact's phone number; empty when not given. */
  emergencyPhone: ShortTextSchema,
  color: z.string().max(20),
});
export type Patient = z.infer<typeof PatientSchema>;

/** The emergency contact as one line, for the alert and the report: "Sam, 555 0100", or whichever of the two there is. */
export const emergencyContactLine = (patient: Pick<Patient, 'emergencyContact' | 'emergencyPhone'>): string =>
  [patient.emergencyContact, patient.emergencyPhone].filter(Boolean).join(', ');

export const WellbeingEntrySchema = z.object({
  ...baseRecord,
  recordedAt: InstantSchema,
  dayKey: CalendarDaySchema,
  moodCode: CodeSchema,
  intensity: z.number().int().min(1).max(3),
  /** factor code to value: a scale step, an amount, or yes/no. */
  factors: z.record(CodeSchema, z.union([z.number(), z.boolean()])),
  notes: TextSchema,
});
export type WellbeingEntry = z.infer<typeof WellbeingEntrySchema>;

export const EegSessionSchema = z.object({
  ...baseRecord,
  startTime: InstantSchema,
  plannedEndTime: InstantSchema.nullable(),
  actualEndTime: InstantSchema.nullable(),
  durationPreset: z.string().max(20),
  customHours: z.number().nonnegative().nullable(),
  title: ShortTextSchema,
  notes: TextSchema,
  status: z.enum(['active', 'completed']),
});
export type EegSession = z.infer<typeof EegSessionSchema>;

export const EegActivitySchema = z.object({
  ...baseRecord,
  sessionId: IdSchema,
  kind: z.enum(['activity', 'seizure_reference']),
  /** An activity code, or the seizure type code for a seizure reference. */
  activityCode: CodeSchema.nullable(),
  customText: ShortTextSchema,
  moodCode: CodeSchema.nullable(),
  notes: TextSchema,
  startTime: InstantSchema,
  endTime: InstantSchema.nullable(),
  durationSec: z.number().int().nonnegative().nullable(),
  linkedSeizureId: IdSchema.nullable(),
});
export type EegActivity = z.infer<typeof EegActivitySchema>;

/** Settings: which ones belong to this device, to one patient, or to the whole household. */
export const SettingSchema = z.object({
  ...baseRecord,
  scope: z.enum(['device', 'patient', 'household']),
  key: z.string().min(1).max(80),
  value: z.json(),
});
export type Setting = z.infer<typeof SettingSchema>;

/** A household's own codes (own symptoms, triggers, moods, activities). */
export const CustomCodeSchema = z.object({
  ...baseRecord,
  kind: z.enum(['symptom', 'trigger', 'finding', 'mood', 'activity', 'factor']),
  code: CodeSchema,
  label: ShortTextSchema,
  /** Where it sits among the catalogue's groups, if anywhere. */
  parentCode: CodeSchema.nullable(),
});
export type CustomCode = z.infer<typeof CustomCodeSchema>;

/** One line of the append-only change log: the audit trail, and what sync exchanges. */
export const ChangeLogEntrySchema = z.object({
  id: IdSchema,
  householdId: IdSchema,
  patientId: IdSchema.nullable(),
  deviceId: IdSchema,
  stamp: HlcStringSchema,
  at: InstantSchema,
  recordType: z.string().min(1).max(40),
  recordId: IdSchema,
  kind: z.enum(['create', 'update', 'delete', 'import']),
  /** Field names touched, with their new values (null for a deletion). */
  fields: z.record(z.string(), z.json()).nullable(),
});
export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>;

export const TombstoneSchema = z.object({
  recordType: z.string().min(1).max(40),
  recordId: IdSchema,
  deletedAt: HlcStringSchema,
  deviceId: IdSchema,
});
export type Tombstone = z.infer<typeof TombstoneSchema>;
