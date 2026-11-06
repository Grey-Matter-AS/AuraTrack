import { z } from 'zod';
import { BodyAreaSchema, Ilae2025Schema, PhaseNameSchema } from './seizure';
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

/** How many seizure profiles one person can have; the editor shows the first few in its row, the rest under "More". */
export const MAX_SEIZURE_PROFILES = 12;
export const PROFILES_IN_ROW = 3;

/**
 * A seizure profile (D-17): one of the person's own kinds of seizure, for example "Usual seizure". Its name is the user's
 * own words; its ILAE 2025 answers and usual signs (in order) are copied onto a seizure when it is picked. Changing or
 * removing a profile never changes the seizures that used it: each one keeps its own copy.
 */
export const SeizureProfileSchema = z.object({
  ...baseRecord,
  name: z.string().min(1).max(60),
  ilae: Ilae2025Schema,
  signs: z.array(SymptomSetItemSchema).max(40),
  /** Its place in the list; the lowest comes first. */
  position: z.number().int().nonnegative(),
});
export type SeizureProfile = z.infer<typeof SeizureProfileSchema>;
