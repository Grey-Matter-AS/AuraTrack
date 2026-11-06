import { describe, expect, it } from 'vitest';
import { CodeSchema } from '../schemas';
import {
  CATALOGUE_VERSION,
  BODY_REGIONS,
  EEG_ACTIVITIES,
  FINDINGS,
  FINDING_GROUPS,
  MOODS,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  TRIGGERS,
  WELLBEING_FACTORS,
  isCatalogueCode,
  isCustomCode,
  isKnownCode,
} from './index';

describe('catalogue', () => {
  it('is versioned', () => {
    expect(CATALOGUE_VERSION).toBe(2);
  });

  it('holds its lists: 11 triggers, 12 moods, 10 factors, 61 symptoms', () => {
    expect(TRIGGERS).toHaveLength(11);
    expect(MOODS).toHaveLength(12);
    expect(WELLBEING_FACTORS).toHaveLength(10);
    expect(SYMPTOMS).toHaveLength(61);
    expect(EEG_ACTIVITIES.length).toBeGreaterThan(100);
  });

  it('every code is valid and unique', () => {
    const all: string[] = [
      ...SYMPTOM_GROUPS,
      ...SYMPTOMS,
      ...TRIGGERS,
      ...FINDING_GROUPS,
      ...FINDINGS,
      ...MOODS,
      ...WELLBEING_FACTORS,
      ...EEG_ACTIVITIES,
    ].map((x) => x.code);
    for (const region of BODY_REGIONS) {
      all.push(region.code);
      for (const sub of region.subRegions) all.push(sub.code, ...sub.parts.map((p) => p.code));
    }
    expect(new Set(all).size).toBe(all.length);
    for (const code of all) expect(CodeSchema.safeParse(code).success, code).toBe(true);
  });

  it('every symptom belongs to a group and every finding to a group', () => {
    const groups = new Set(SYMPTOM_GROUPS.map((g) => g.code));
    for (const s of SYMPTOMS) expect(groups.has(s.group), s.code).toBe(true);
    const findingGroups = new Set(FINDING_GROUPS.map((g) => g.code));
    for (const f of FINDINGS) expect(findingGroups.has(f.group), f.code).toBe(true);
  });
});

describe('code kinds', () => {
  it("separates catalogue codes from a household's own", () => {
    expect(isCatalogueCode('trigger.stress')).toBe(true);
    expect(isCatalogueCode('custom.abc')).toBe(false);
    expect(isCustomCode('custom.abc')).toBe(true);
    expect(isKnownCode('custom.abc')).toBe(true);
    expect(isKnownCode('trigger.nonsense')).toBe(false);
    expect(isCatalogueCode('body.arms.left_arm.upper_arm')).toBe(true);
  });
});

describe('no 6.1 data (D-18)', () => {
  it('has no plain-language seizure types, no ILAE 2017 codes and no 6.1 labels', () => {
    expect(isCatalogueCode('seizure_type.absence')).toBe(false);
    expect(isCatalogueCode('ilae.onset.focal')).toBe(false);
    for (const s of SYMPTOMS)
      expect(
        Object.keys(s).some((k) => k.startsWith('legacy')),
        s.code,
      ).toBe(false);
  });
});
