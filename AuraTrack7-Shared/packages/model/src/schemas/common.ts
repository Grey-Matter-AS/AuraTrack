import { z } from 'zod';
import { IdSchema } from '../ids';

/** A UTC instant, in ms since the epoch. Calendar days and clock times are always derived from it, never stored beside it. */
export const InstantSchema = z.number().int().nonnegative();
/** A catalogue code or a household's own custom code, e.g. `trigger.stress` or `custom.<uuid>`. */
export const CodeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_.:-]*$/);
export type Code = z.infer<typeof CodeSchema>;
/** 'HH:MM', 24 hours. */
export const ClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** 'YYYY-MM-DD', a calendar day on the patient's own clock. */
export const CalendarDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeZoneSchema = z.string().min(1).max(64);
export const TextSchema = z.string().max(5000);
export const ShortTextSchema = z.string().max(120);

/** Every record says whose it is and who wrote it (README 4.1). */
/**
 * The version of the data model that wrote a record (D-18). 2 is the model of 7.2, the first one the native apps share. A
 * record without it was saved before 7.2: it is removed at the next load (with a notice), never shown. A record with a
 * version is never removed for not fitting: from 7.2 on, a new version must convert what it changes, and a record from a
 * newer version is kept and counted until this device is updated.
 */
export const DATA_VERSION = 2;

export const baseRecord = {
  id: IdSchema,
  householdId: IdSchema,
  patientId: IdSchema,
  deviceId: IdSchema,
  createdAt: InstantSchema,
  dataVersion: z.number().int().positive(),
};

/** The fields the store fills in itself when a record is made. */
export type AutoFields = 'id' | 'householdId' | 'deviceId' | 'createdAt' | 'dataVersion';
