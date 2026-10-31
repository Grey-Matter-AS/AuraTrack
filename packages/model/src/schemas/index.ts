import type { z } from 'zod';
import { DoseLogSchema, MedicationChangeSchema, MedicationSchema } from './medication';
import {
  ChangeLogEntrySchema,
  CustomCodeSchema,
  EegActivitySchema,
  EegSessionSchema,
  PatientSchema,
  SettingSchema,
  WellbeingEntrySchema,
} from './other';
import { SeizureSchema } from './seizure';

export * from './common';
export * from './medication';
export * from './other';
export * from './seizure';

/** The records that live under a patient and merge field by field. */
export const RECORD_SCHEMAS = {
  patient: PatientSchema,
  seizure: SeizureSchema,
  medication: MedicationSchema,
  medicationChange: MedicationChangeSchema,
  doseLog: DoseLogSchema,
  wellbeingEntry: WellbeingEntrySchema,
  eegSession: EegSessionSchema,
  eegActivity: EegActivitySchema,
  setting: SettingSchema,
  customCode: CustomCodeSchema,
  changeLog: ChangeLogEntrySchema,
} as const;
export type RecordType = keyof typeof RECORD_SCHEMAS;
export const RECORD_TYPES = Object.keys(RECORD_SCHEMAS) as RecordType[];
export type RecordOf<T extends RecordType> = z.infer<(typeof RECORD_SCHEMAS)[T]>;

/** Added to, never edited: merged as a union (README 4.4). */
export const APPEND_ONLY_TYPES: readonly RecordType[] = ['medicationChange', 'changeLog'];

/** Per-field merge rules by record type. Dose status: taken beats assumed beats late beats missed. */
export const MERGE_RULES: Readonly<
  Partial<Record<RecordType, Readonly<Record<string, { readonly rank: readonly string[] }>>>>
> = {
  doseLog: { status: { rank: ['taken', 'late', 'assumed', 'missed'] } },
};
