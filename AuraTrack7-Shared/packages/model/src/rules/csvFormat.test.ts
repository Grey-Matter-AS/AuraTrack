import { describe, expect, it } from 'vitest';
import {
  areaToken,
  findingToken,
  parseAreaToken,
  parseFindingToken,
  parseSymptomToken,
  symptomToken,
} from './csvFormat';

// The one-cell tokens the CSV export writes and its import reads: each written token reads back as the same value.

const arm = { region: 'body.arms', subRegion: 'body.arms.left_arm', part: 'body.arms.left_arm.wrist' };

describe('CSV tokens', () => {
  it('body areas at each depth, including a part without a sub-region', () => {
    for (const area of [
      { region: 'body.arms', subRegion: null, part: null },
      { region: 'body.arms', subRegion: 'body.arms.left_arm', part: null },
      arm,
      { region: 'body.arms', subRegion: null, part: 'body.arms.left_arm.wrist' },
    ])
      expect(parseAreaToken(areaToken(area))).toEqual(area);
    expect(areaToken(null)).toBe('');
    expect(parseAreaToken('  ')).toBeNull();
    expect(parseAreaToken('/body.arms.left_arm')).toBeNull();
  });

  it('symptoms with an area and a phase, and a phase it does not know left out', () => {
    expect(parseSymptomToken(symptomToken('symptom.x', arm, 'seizure'))).toEqual({
      code: 'symptom.x',
      area: arm,
      phase: 'seizure',
    });
    expect(parseSymptomToken('symptom.x#prodrome')?.phase).toBe('prodrome');
    // Files written before 7.2 used three phases: they are read as aura, seizure and recovery
    expect(parseSymptomToken('symptom.x#before')?.phase).toBe('aura');
    expect(parseSymptomToken('symptom.x#during')?.phase).toBe('seizure');
    expect(parseSymptomToken('symptom.x#after')?.phase).toBe('recovery');
    expect(symptomToken('symptom.x', null)).toBe('symptom.x');
    expect(parseSymptomToken('symptom.x#later')).toEqual({ code: 'symptom.x', area: null, phase: null });
  });

  it('findings with the places they were seen', () => {
    const areas = [arm, { region: 'body.legs', subRegion: null, part: null }];
    expect(parseFindingToken(findingToken('after.weakness', areas))).toEqual({ code: 'after.weakness', areas });
    expect(findingToken('after.confused', [])).toBe('after.confused');
    expect(parseFindingToken('after.weakness@+')).toEqual({ code: 'after.weakness', areas: [] });
  });
});
