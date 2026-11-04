import { describe, expect, it } from 'vitest';
import { CodeSchema } from '../schemas';
import {
  CATALOGUE_VERSION,
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
  activityFromLegacy,
  bodyAreaFromLegacy,
  factorFromLegacyId,
  findingFromKey,
  isCatalogueCode,
  isCustomCode,
  isKnownCode,
  moodFromLegacy,
  seizureTypeFromLegacy,
  symptomFromLegacy,
  triggerFromLegacy,
} from './index';

describe('catalogue', () => {
  it('is versioned', () => {
    expect(CATALOGUE_VERSION).toBe(1);
  });

  it('holds 6.1 lists: 5 seizure types, 11 triggers, 12 moods, 10 factors', () => {
    expect(SEIZURE_TYPES).toHaveLength(5);
    expect(TRIGGERS).toHaveLength(11);
    expect(MOODS).toHaveLength(12);
    expect(WELLBEING_FACTORS).toHaveLength(10);
    expect(SYMPTOMS).toHaveLength(61);
    expect(EEG_ACTIVITIES.length).toBeGreaterThan(100);
  });

  it('every code is valid and unique', () => {
    const all: string[] = [
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

  it('suggests ILAE parts for each 6.1 seizure type, as a starting point', () => {
    expect(SEIZURE_TYPES.find((t) => t.code === 'seizure_type.focal_impaired')?.suggestedIlae).toMatchObject({
      onset: 'focal',
      awareness: 'impaired',
    });
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

describe('6.1 text to codes', () => {
  it('seizure types, triggers, moods, activities and factors', () => {
    expect(seizureTypeFromLegacy('Focal Aware')?.code).toBe('seizure_type.focal_aware');
    expect(seizureTypeFromLegacy('  tonic-clonic ')?.code).toBe('seizure_type.tonic_clonic');
    expect(seizureTypeFromLegacy('Uncategorized')).toBeNull();
    expect(triggerFromLegacy('Heat / Overheating')?.code).toBe('trigger.heat');
    expect(triggerFromLegacy('Poor sleep')).toBeNull();
    expect(moodFromLegacy('Anxious / Worried')?.code).toBe('mood.anxious_worried');
    expect(activityFromLegacy('Walking dog')?.code).toBe('activity.walking_dog');
    expect(factorFromLegacyId('sleepQuality')?.code).toBe('factor.sleep_quality');
    expect(factorFromLegacyId('hydration')).toBeNull();
  });

  it('symptoms: by group and option, or by option alone when it is unique', () => {
    expect(symptomFromLegacy('Eyes', 'Rapid Blinking')?.code).toBe('symptom.eyes.rapid_blinking');
    expect(symptomFromLegacy('Wrong group', 'Rapid Blinking')?.code).toBe('symptom.eyes.rapid_blinking');
    expect(symptomFromLegacy('Eyes', 'Staring')).toBeNull();
    expect(symptomFromLegacy('', '')).toBeNull();
  });

  it('after-seizure findings by key', () => {
    expect(findingFromKey('weakness')?.location).toBe(true);
    expect(findingFromKey('headache')?.location).toBe(false);
    expect(findingFromKey('nope')).toBeNull();
  });

  it('body areas at each depth, and no area for the general ones', () => {
    expect(bodyAreaFromLegacy('Arms', 'Left Arm', 'Upper Arm')).toEqual({
      region: 'body.arms',
      subRegion: 'body.arms.left_arm',
      part: 'body.arms.left_arm.upper_arm',
    });
    expect(bodyAreaFromLegacy('Arms', 'Left Arm', '')).toEqual({
      region: 'body.arms',
      subRegion: 'body.arms.left_arm',
      part: null,
    });
    expect(bodyAreaFromLegacy('Arms', 'Elsewhere', 'x')).toEqual({ region: 'body.arms', subRegion: null, part: null });
    // a part without its sub-region: found when only one sub-region has it, region only when it is on both sides
    expect(bodyAreaFromLegacy('Head & Face', '', 'Left Eye')).toEqual({
      region: 'body.head_and_face',
      subRegion: 'body.head_and_face.eyes',
      part: 'body.head_and_face.eyes.left_eye',
    });
    expect(bodyAreaFromLegacy('Arms', '', 'Wrist')).toEqual({ region: 'body.arms', subRegion: null, part: null });
    expect(bodyAreaFromLegacy('Arms', '', 'Nothing')).toEqual({ region: 'body.arms', subRegion: null, part: null });
    expect(bodyAreaFromLegacy('Internal/General', '', '')).toBeNull();
    expect(bodyAreaFromLegacy('', '', '')).toBeNull();
    expect(bodyAreaFromLegacy('Moon', '', '')).toBeNull();
  });
});
