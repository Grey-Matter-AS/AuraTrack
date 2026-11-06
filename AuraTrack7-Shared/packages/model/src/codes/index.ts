import {
  BODY_REGIONS,
  EEG_ACTIVITIES,
  FINDINGS,
  FINDING_GROUPS,
  MEDICATION_FORMS,
  MOODS,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  TRIGGERS,
  WELLBEING_FACTORS,
} from './catalogue';

// The versioned catalogue (README 4.2). Stored data holds these codes, never English text. This file adds lookups.
export * from './catalogue';

export const CUSTOM_PREFIX = 'custom.';
export const isCustomCode = (code: string): boolean => code.startsWith(CUSTOM_PREFIX);

const catalogueCodes = new Set<string>();
const add = (code: string) => catalogueCodes.add(code);
SYMPTOM_GROUPS.forEach((x) => {
  add(x.code);
  add(x.category);
});
FINDING_GROUPS.forEach((x) => add(x.code));
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
