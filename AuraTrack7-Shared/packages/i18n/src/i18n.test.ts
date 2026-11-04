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
import drafted from './labels/drafted.json';
import { LANGUAGES, isDrafted, isLanguage, labelFor, labelText, labelledCodes } from './index';

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

describe('drafted translations (not yet checked by a native speaker)', () => {
  const others = LANGUAGES.filter((l) => l !== 'en');

  it.each(others)('%s: has a label for every English label, so nothing falls back to English', (language) => {
    expect(labelledCodes(language).sort()).toEqual(labelledCodes('en').sort());
    expect((review as Record<string, string[]>)[language]).toEqual([]);
  });

  it.each(others)('%s: the drafted list names real labels, each written out and trimmed', (language) => {
    const list = (drafted as Record<string, string[]>)[language]!;
    expect(list.length).toBe(274);
    expect(new Set(list).size).toBe(list.length);
    const have = new Set(labelledCodes(language));
    for (const code of list) {
      expect(have.has(code), code).toBe(true);
      const text = labelText(language, code);
      expect(text.length, code).toBeGreaterThan(0);
      expect(text, code).toBe(text.trim());
      expect(text, code).not.toMatch(/\s{2,}/);
    }
  });

  it.each(others)(
    '%s: almost every drafted label differs from English (a few real words are the same, like Yoga)',
    (language) => {
      const list = (drafted as Record<string, string[]>)[language]!;
      const same = list.filter((code) => labelText(language, code) === labelText('en', code));
      expect(same.length).toBeLessThan(10);
    },
  );

  it('the same body part has the same words wherever it appears, in every language', () => {
    for (const language of others) {
      for (const side of ['left_arm', 'right_arm']) {
        const part = (name: string) => labelText(language, `body.arms.${side}.${name}`);
        expect(part('elbow')).toBe(
          labelText(language, `body.arms.${side === 'left_arm' ? 'right_arm' : 'left_arm'}.elbow`),
        );
        expect(part('wrist')).not.toBe(part('elbow'));
      }
    }
  });

  it('keeps the arrows of "starts on one side → both" readable and the same in every language', () => {
    for (const language of others) {
      expect(labelText(language, 'body.legs.general_legs.starts_left_both')).toContain('→');
      expect(labelText(language, 'body.whole_body.general.starts_one_side_spreads')).toContain('→');
    }
  });

  it('says which labels still wait for a native check', () => {
    expect(isDrafted('nb', 'symptom.eyes.rapid_blinking')).toBe(true);
    expect(isDrafted('nb', 'trigger.stress')).toBe(false); // ported from 6.1
    expect(isDrafted('en', 'symptom.eyes.rapid_blinking')).toBe(false);
  });
});

describe('labelFor', () => {
  it('shows the drafted label, not English', () => {
    expect(labelFor('nb', 'symptom.eyes.rapid_blinking')).toEqual({ text: 'Rask blinking', fallback: false });
    expect(labelFor('de', 'symptom.eyes.rapid_blinking').fallback).toBe(false);
  });

  it('falls back to English, and says so, for a code with no label in that language', () => {
    expect(labelFor('nb', 'trigger.not_translated_yet')).toEqual({
      text: 'trigger.not_translated_yet',
      fallback: true,
    });
  });

  it('shows an unknown code as it is, never hides it', () => {
    expect(labelFor('en', 'trigger.not_in_catalogue')).toEqual({ text: 'trigger.not_in_catalogue', fallback: true });
  });

  it("uses a household's own label first", () => {
    const custom = new Map([['custom.1', 'Humming']]);
    expect(labelFor('de', 'custom.1', custom)).toEqual({ text: 'Humming', fallback: false });
  });
});
