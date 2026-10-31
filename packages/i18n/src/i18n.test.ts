import {
  BODY_REGIONS,
  EEG_ACTIVITIES,
  FINDINGS,
  FINDING_GROUPS,
  ILAE_FEATURES,
  MOODS,
  SEIZURE_TYPES,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  TRIGGERS,
  WELLBEING_FACTORS,
  MEDICATION_FORMS,
  isCatalogueCode,
} from '@auratrack/model';
import { describe, expect, it } from 'vitest';
import review from './labels/review.json';
import { LANGUAGES, isLanguage, labelFor, labelText, labelledCodes } from './index';

const catalogue: string[] = [
  ...SEIZURE_TYPES,
  ...ILAE_FEATURES,
  ...SYMPTOM_GROUPS,
  ...SYMPTOMS,
  ...TRIGGERS,
  ...FINDING_GROUPS,
  ...FINDINGS,
  ...MOODS,
  ...WELLBEING_FACTORS,
  ...EEG_ACTIVITIES,
  ...MEDICATION_FORMS,
].map((x) => x.code);
for (const region of BODY_REGIONS) {
  catalogue.push(region.code);
  for (const sub of region.subRegions) catalogue.push(sub.code, ...sub.parts.map((p) => p.code));
}

describe('languages', () => {
  it('are the nine of 6.1', () => {
    expect([...LANGUAGES]).toEqual(['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es']);
    expect(isLanguage('nb')).toBe(true);
    expect(isLanguage('xx')).toBe(false);
  });
});

describe('English labels', () => {
  it('exist for every catalogue code', () => {
    const have = new Set(labelledCodes('en'));
    expect(catalogue.filter((code) => !have.has(code))).toEqual([]);
  });

  it('are only for codes that exist', () => {
    const stray = labelledCodes('en').filter(
      (code) =>
        !isCatalogueCode(code) && !code.startsWith('ilae.') && !code.startsWith('form.') && !code.startsWith('after'),
    );
    expect(stray).toEqual([]);
  });
});

describe('other languages', () => {
  it.each(LANGUAGES.filter((l) => l !== 'en'))(
    '%s: ports only real codes, and the review list is exactly what is missing',
    (language) => {
      const have = new Set(labelledCodes(language));
      const english = new Set(labelledCodes('en'));
      for (const code of have) expect(english.has(code), code).toBe(true);
      const missing = [...english].filter((code) => !have.has(code)).sort();
      expect((review as Record<string, string[]>)[language]).toEqual(missing);
    },
  );

  it('carry the ported 6.1 translations', () => {
    expect(labelText('nb', 'trigger.stress')).toBe('Stress');
    expect(labelText('nb', 'trigger.sleep_deprivation')).toBe('Søvnmangel');
    expect(labelFor('fr', 'seizure_type.absence').fallback).toBe(false);
  });
});

describe('labelFor', () => {
  it('falls back to English and says so', () => {
    expect(labelFor('nb', 'symptom.eyes.rapid_blinking')).toEqual({ text: 'Rapid Blinking', fallback: true });
  });

  it('shows an unknown code as it is, never hides it', () => {
    expect(labelFor('en', 'trigger.not_in_catalogue')).toEqual({ text: 'trigger.not_in_catalogue', fallback: true });
  });

  it("uses a household's own label first", () => {
    const custom = new Map([['custom.1', 'Humming']]);
    expect(labelFor('de', 'custom.1', custom)).toEqual({ text: 'Humming', fallback: false });
  });
});
