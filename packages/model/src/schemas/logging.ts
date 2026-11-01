import { z } from 'zod';
import { BodyAreaSchema, PhaseNameSchema } from './seizure';
import { CodeSchema, InstantSchema, ShortTextSchema, TextSchema, TimeZoneSchema, baseRecord } from './common';

/**
 * A symptom noticed between seizures (README 5, F-313): myoclonic jerks, an absence noticed later, headaches, a change in
 * memory or mood. One symptom, when, where, and a note. Shown on the same timeline as seizures in History and reports.
 */
export const InterictalEventSchema = z.object({
  ...baseRecord,
  /** When it happened (or was noticed), as a UTC instant. */
  occurredAt: InstantSchema,
  timeZone: TimeZoneSchema,
  /** A catalogue symptom code, or the household's own (`custom.<id>`). */
  symptomCode: CodeSchema,
  area: BodyAreaSchema.nullable(),
  notes: TextSchema,
  recordedBy: z.enum(['self', 'carer']),
});
export type InterictalEvent = z.infer<typeof InterictalEventSchema>;

/** One symptom in a saved set, with the phase it belongs to. */
export const SymptomSetItemSchema = z.object({ code: CodeSchema, phase: PhaseNameSchema });
export type SymptomSetItem = z.infer<typeof SymptomSetItemSchema>;

/**
 * A saved set of symptoms for a seizure type (F-304): one tap adds all of it. `name` is the user's own words and may be
 * empty, in which case the app suggests a name from the symptoms.
 */
export const SymptomSetSchema = z.object({
  ...baseRecord,
  /** The seizure type it is for; null means every type. */
  seizureTypeCode: CodeSchema.nullable(),
  name: ShortTextSchema,
  items: z.array(SymptomSetItemSchema).min(1).max(40),
});
export type SymptomSet = z.infer<typeof SymptomSetSchema>;
