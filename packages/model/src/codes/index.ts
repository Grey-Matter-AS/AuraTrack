import {
  BODY_REGIONS,
  EEG_ACTIVITIES,
  FINDINGS,
  FINDING_GROUPS,
  ILAE_FEATURES,
  ILAE_PARTS,
  MEDICATION_FORMS,
  MOODS,
  SEIZURE_TYPES,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  TRIGGERS,
  WELLBEING_FACTORS,
} from './catalogue.generated';

// The versioned catalogue (README 4.2). Stored data holds these codes, never English text. The generated file is
// built from 6.1's own lists; this file adds lookups, including the English text 6.1 stored, for the importer.
export * from './catalogue.generated';

export const CUSTOM_PREFIX = 'custom.';
export const isCustomCode = (code: string): boolean => code.startsWith(CUSTOM_PREFIX);

const catalogueCodes = new Set<string>();
const add = (code: string) => catalogueCodes.add(code);
SEIZURE_TYPES.forEach((x) => add(x.code));
SYMPTOM_GROUPS.forEach((x) => {
  add(x.code);
  add(x.category);
});
FINDING_GROUPS.forEach((x) => add(x.code));
ILAE_FEATURES.forEach((x) => add(x.code));
ILAE_PARTS.forEach(add);
MEDICATION_FORMS.forEach((x) => add(x.code));
SYMPTOMS.forEach((x) => add(x.code));
TRIGGERS.forEach((x) => add(x.code));
FINDINGS.forEach((x) => add(x.code));
MOODS.forEach((x) => add(x.code));
WELLBEING_FACTORS.forEach((x) => add(x.code));
EEG_ACTIVITIES.forEach((x) => add(x.code));
for (const region of BODY_REGIONS) {
  add(region.code);
  for (const sub of region.subRegions) {
    add(sub.code);
    sub.parts.forEach((part) => add(part.code));
  }
}

export const isCatalogueCode = (code: string): boolean => catalogueCodes.has(code);
export const isKnownCode = (code: string): boolean => isCatalogueCode(code) || isCustomCode(code);

const norm = (text: string | null | undefined): string => (text ?? '').trim().toLowerCase();
const index = <T>(items: readonly T[], key: (item: T) => string): Map<string, T> =>
  new Map(items.map((item) => [norm(key(item)), item]));

const typeByLegacy = index(SEIZURE_TYPES, (x) => x.legacy);
const triggerByLegacy = index(TRIGGERS, (x) => x.legacy);
const moodByLegacy = index(MOODS, (x) => x.legacy);
const activityByLegacy = index(EEG_ACTIVITIES, (x) => x.legacy);
const factorByLegacyId = index(WELLBEING_FACTORS, (x) => x.legacyId);
const findingByKey = new Map(FINDINGS.map((x) => [x.code.slice('after.'.length), x]));
const symptomByGroupAndLabel = new Map(SYMPTOMS.map((x) => [`${norm(x.legacyGroup)}|${norm(x.legacy)}`, x]));
const symptomsByLabel = new Map<string, (typeof SYMPTOMS)[number][]>();
for (const symptom of SYMPTOMS)
  symptomsByLabel.set(norm(symptom.legacy), [...(symptomsByLabel.get(norm(symptom.legacy)) ?? []), symptom]);

export const seizureTypeFromLegacy = (text: string) => typeByLegacy.get(norm(text)) ?? null;
export const triggerFromLegacy = (text: string) => triggerByLegacy.get(norm(text)) ?? null;
export const moodFromLegacy = (text: string) => moodByLegacy.get(norm(text)) ?? null;
export const activityFromLegacy = (text: string) => activityByLegacy.get(norm(text)) ?? null;
export const factorFromLegacyId = (id: string) => factorByLegacyId.get(norm(id)) ?? null;
export const findingFromKey = (key: string) => findingByKey.get(key) ?? null;

/** 6.1 stored a symptom as its group ("Eyes") and its option ("Rapid Blinking"). The option alone is used only when one symptom has that label. */
export function symptomFromLegacy(group: string, option: string) {
  const exact = symptomByGroupAndLabel.get(`${norm(group)}|${norm(option)}`);
  if (exact) return exact;
  const byLabel = symptomsByLabel.get(norm(option));
  return byLabel?.length === 1 ? (byLabel[0] ?? null) : null;
}

const NO_AREA = new Set(['', 'n/a', 'internal/general', 'general']);

/** 6.1's region / sub-region / specific part as codes. Anything that is not on the map comes back as null. */
export function bodyAreaFromLegacy(region: string, subRegion: string, part: string) {
  if (NO_AREA.has(norm(region))) return null;
  const r = BODY_REGIONS.find((x) => norm(x.legacy) === norm(region));
  if (!r) return null;
  const s = r.subRegions.find((x) => norm(x.legacy) === norm(subRegion));
  if (!s) return { region: r.code, subRegion: null, part: null };
  const p = s.parts.find((x) => norm(x.legacy) === norm(part));
  return { region: r.code, subRegion: s.code, part: p?.code ?? null };
}
