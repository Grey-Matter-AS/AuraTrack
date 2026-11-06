import { describe, expect, it } from 'vitest';
import { ILAE_2025_GENERALIZED, Ilae2025Schema, type Ilae2025 } from '../schemas';
import {
  EMPTY_ILAE_2025,
  consciousness,
  ilae2025ForSaving,
  ilae2025Questions,
  ilae2025Type,
  isAuraLike,
  observable,
  switchProfileAnswers,
} from './ilae2025';

const a = (over: Partial<Ilae2025>): Ilae2025 => ({ ...EMPTY_ILAE_2025, ...over });

describe('consciousness, from recall and responsiveness', () => {
  it.each([
    ['yes', 'yes', 'preserved'],
    ['no', 'yes', 'impaired'],
    ['yes', 'no', 'impaired'],
    ['no', null, 'impaired'],
    [null, 'no', 'impaired'],
    ['unknown', 'no', 'impaired'],
    ['yes', null, null],
    ['yes', 'unknown', null],
    [null, null, null],
  ] as const)('recall %s, responsive %s: %s', (recall, responsive, expected) => {
    expect(consciousness(a({ recall, responsive }))).toBe(expected);
  });
});

describe('the ILAE 2025 seizure type', () => {
  it.each([
    [a({}), null],
    [a({ class: 'focal' }), 'focal'],
    [a({ class: 'focal', recall: 'yes', responsive: 'yes' }), 'focal_preserved_consciousness'],
    [a({ class: 'focal', responsive: 'no' }), 'focal_impaired_consciousness'],
    [
      a({ class: 'focal', recall: 'yes', responsive: 'yes', bilateralTonicClonic: 'yes' }),
      'focal_to_bilateral_tonic_clonic',
    ],
    [a({ class: 'focal', bilateralTonicClonic: 'unknown' }), 'focal'],
    [a({ class: 'unknown' }), 'unknown'],
    [a({ class: 'unknown', recall: 'yes', responsive: 'yes' }), 'unknown_preserved_consciousness'],
    [a({ class: 'unknown', recall: 'no' }), 'unknown_impaired_consciousness'],
    [a({ class: 'unknown', bilateralTonicClonic: 'yes' }), 'unknown_bilateral_tonic_clonic'],
    [a({ class: 'generalized' }), 'generalized'],
    [a({ class: 'generalized', generalized: 'typical_absence' }), 'g.typical_absence'],
    [a({ class: 'generalized', generalized: 'tonic_clonic' }), 'g.tonic_clonic'],
    [a({ class: 'generalized', recall: 'no', generalized: 'atonic' }), 'g.atonic'],
  ] as const)('%j is %s', (answers, expected) => {
    expect(ilae2025Type(answers)).toBe(expected);
  });

  it('names every generalized kind', () => {
    for (const kind of ILAE_2025_GENERALIZED)
      expect(ilae2025Type(a({ class: 'generalized', generalized: kind }))).toBe(`g.${kind}`);
  });
});

describe('observable manifestations', () => {
  it('are there by definition with impaired consciousness or a bilateral tonic-clonic seizure', () => {
    expect(observable(a({ class: 'focal', recall: 'no', observable: 'no' }))).toBe('yes');
    expect(observable(a({ class: 'unknown', bilateralTonicClonic: 'yes' }))).toBe('yes');
  });
  it('are the answer given otherwise, and do not apply to generalized or unanswered seizures', () => {
    expect(observable(a({ class: 'focal', recall: 'yes', responsive: 'yes', observable: 'no' }))).toBe('no');
    expect(observable(a({ class: 'focal', observable: 'unknown' }))).toBe('unknown');
    expect(observable(a({ class: 'generalized', observable: 'yes' }))).toBeNull();
    expect(observable(a({ observable: 'yes' }))).toBeNull();
  });
});

describe('which questions apply', () => {
  it('asks nothing more until the start is answered', () => {
    expect(ilae2025Questions(a({}))).toEqual({
      recall: false,
      responsive: false,
      bilateralTonicClonic: false,
      observable: false,
      generalized: false,
    });
  });
  it('asks about recall, responsiveness, spread and signs for focal and unknown starts', () => {
    for (const c of ['focal', 'unknown'] as const)
      expect(ilae2025Questions(a({ class: c }))).toEqual({
        recall: true,
        responsive: true,
        bilateralTonicClonic: true,
        observable: true,
        generalized: false,
      });
  });
  it('does not ask about signs when they are there by definition', () => {
    expect(ilae2025Questions(a({ class: 'focal', responsive: 'no' })).observable).toBe(false);
    expect(ilae2025Questions(a({ class: 'focal', bilateralTonicClonic: 'yes' })).observable).toBe(false);
  });
  it('asks only for the kind of a generalized seizure', () => {
    expect(ilae2025Questions(a({ class: 'generalized' }))).toEqual({
      recall: false,
      responsive: false,
      bilateralTonicClonic: false,
      observable: false,
      generalized: true,
    });
  });
});

describe('the answers as saved', () => {
  it('drops answers to questions that do not apply', () => {
    expect(
      ilae2025ForSaving(a({ class: 'generalized', recall: 'no', observable: 'yes', generalized: 'myoclonic' })),
    ).toEqual(a({ class: 'generalized', generalized: 'myoclonic' }));
    expect(ilae2025ForSaving(a({ class: 'focal', responsive: 'no', observable: 'no', generalized: 'tonic' }))).toEqual(
      a({ class: 'focal', responsive: 'no' }),
    );
    expect(ilae2025ForSaving(a({ recall: 'yes' }))).toBeNull();
  });
  it('keeps every answer that applies, "not sure" included, and passes the schema', () => {
    const full = a({
      class: 'unknown',
      recall: 'unknown',
      responsive: 'yes',
      bilateralTonicClonic: 'no',
      observable: 'yes',
    });
    expect(ilae2025ForSaving(full)).toEqual(full);
    expect(Ilae2025Schema.parse(ilae2025ForSaving(full))).toEqual(full);
  });
  it('is null when nothing is answered', () => {
    expect(ilae2025ForSaving(EMPTY_ILAE_2025)).toBeNull();
  });
});

describe('aura-like seizures (no During tab)', () => {
  it('are focal, with preserved consciousness and no signs others could see', () => {
    expect(isAuraLike(a({ class: 'focal', recall: 'yes', responsive: 'yes', observable: 'no' }))).toBe(true);
  });
  it.each([
    [a({ class: 'focal', recall: 'yes', responsive: 'yes', observable: 'yes' })],
    [a({ class: 'focal', recall: 'yes', responsive: 'yes', observable: 'unknown' })],
    [a({ class: 'focal', recall: 'yes', responsive: 'yes', observable: 'no', bilateralTonicClonic: 'yes' })],
    [a({ class: 'focal', recall: 'yes', observable: 'no' })],
    [a({ class: 'unknown', recall: 'yes', responsive: 'yes', observable: 'no' })],
    [a({ class: 'generalized', generalized: 'typical_absence' })],
  ])('not %j', (answers) => {
    expect(isAuraLike(answers)).toBe(false);
  });
  it('is false for no answers', () => {
    expect(isAuraLike(null)).toBe(false);
    expect(isAuraLike(undefined)).toBe(false);
  });
});

describe('switching the chosen profile', () => {
  const usual = a({ class: 'focal', recall: 'yes', responsive: 'no' });
  const night = a({ class: 'generalized', generalized: 'tonic_clonic' });

  it('fills in what the picked profile answers and keeps the rest', () => {
    expect(switchProfileAnswers(a({ observable: 'yes' }), null, usual)).toEqual({ ...usual, observable: 'yes' });
  });
  it('replaces the old profile answers with the new ones and clears what the new one leaves open', () => {
    expect(switchProfileAnswers(usual, usual, night)).toEqual(night);
  });
  it('keeps what someone changed after the profile filled it in', () => {
    const changed = { ...usual, responsive: 'unknown' as const, bilateralTonicClonic: 'no' as const };
    expect(switchProfileAnswers(changed, usual, night)).toEqual({
      ...night,
      responsive: 'unknown',
      bilateralTonicClonic: 'no',
    });
  });
  it('clears what the profile filled in when no profile is chosen any more', () => {
    expect(switchProfileAnswers(usual, usual, null)).toEqual(EMPTY_ILAE_2025);
  });
  it('does not change the answers it was given', () => {
    const current = a({});
    switchProfileAnswers(current, null, usual);
    expect(current).toEqual(EMPTY_ILAE_2025);
  });
});
