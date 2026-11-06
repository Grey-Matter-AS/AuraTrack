import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { WellbeingEntry } from '../schemas';
import {
  DEFAULT_FACTORS,
  cleanFactors,
  effectiveFactors,
  entriesOn,
  factorStats,
  moodCounts,
  reminderDue,
  type FactorDef,
} from './wellbeing';

const at = (d: number, h = 12) => new Date(2026, 9, d, h, 0, 0).getTime();
const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
const entry = (
  d: number,
  factors: Record<string, number | boolean> = {},
  over: Partial<WellbeingEntry> = {},
): WellbeingEntry => ({
  id: `e${d}${over.recordedAt ?? ''}`,
  householdId: 'h',
  deviceId: 'dv',
  createdAt: 0,
  dataVersion: 2,
  patientId: 'p',
  recordedAt: at(d),
  dayKey: day(d),
  moodCode: 'mood.calm',
  intensity: 1,
  factors,
  notes: '',
  ...over,
});
const seizureOn = (d: number) => ({
  phases: { start: { at: at(d), source: 'timed' as const }, auraEnd: null, seizureEnd: null, recoveryEnd: null },
});

describe('the factors', () => {
  it('are the usual ten until the person makes a list of their own', () => {
    expect(DEFAULT_FACTORS).toHaveLength(10);
    expect(effectiveFactors([])).toBe(DEFAULT_FACTORS);
    const own: FactorDef[] = [{ code: 'custom.x', type: 'boolean', unit: '', label: 'Headache' }];
    expect(effectiveFactors(own)).toBe(own);
  });

  const defs: FactorDef[] = [
    { code: 'f.yes', type: 'boolean', unit: '' },
    { code: 'f.scale', type: 'scale', unit: '' },
    { code: 'f.num', type: 'number', unit: 'h' },
  ];
  it('keeps only answers that mean something: a yes, a step of 1 to 3, an amount', () => {
    expect(cleanFactors(defs, { 'f.yes': true, 'f.scale': 2, 'f.num': 7.5 })).toEqual({
      'f.yes': true,
      'f.scale': 2,
      'f.num': 7.5,
    });
    expect(cleanFactors(defs, { 'f.yes': false, 'f.scale': 0, 'f.num': 0 })).toEqual({ 'f.num': 0 });
  });
  it('drops wrong kinds of value, negatives, steps out of range and factors that are not asked', () => {
    expect(cleanFactors(defs, { 'f.yes': 1, 'f.scale': 9, 'f.num': -1, other: true })).toEqual({});
    expect(cleanFactors(defs, { 'f.scale': 'high', 'f.num': Number.NaN })).toEqual({});
    expect(cleanFactors(defs, { 'f.scale': 2.6 })).toEqual({ 'f.scale': 3 });
  });
  it('never invents an answer', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.anything()), (raw) => {
        const out = cleanFactors(defs, raw);
        for (const key of Object.keys(out)) expect(defs.some((d) => d.code === key)).toBe(true);
      }),
    );
  });
});

describe('today and the reminder', () => {
  it('finds the entries of a day, newest first', () => {
    const list = [
      entry(5, {}, { recordedAt: at(5, 8), id: 'a' }),
      entry(5, {}, { recordedAt: at(5, 20), id: 'b' }),
      entry(6),
    ];
    expect(entriesOn(list, day(5)).map((e) => e.id)).toEqual(['b', 'a']);
    expect(entriesOn(list, day(7))).toEqual([]);
  });

  it('is due once the time has come and there is no entry today, and not before, nor after an entry', () => {
    expect(reminderDue({ now: at(5, 19), time: '20:00', entries: [] })).toBe(false);
    expect(reminderDue({ now: at(5, 20), time: '20:00', entries: [] })).toBe(true);
    expect(reminderDue({ now: at(5, 21), time: '20:00', entries: [entry(5)] })).toBe(false);
    expect(reminderDue({ now: at(5, 21), time: '20:00', entries: [entry(4)] })).toBe(true);
  });
});

describe('moods and what lines up with seizures', () => {
  it('counts the moods, the commonest first, ties by name', () => {
    const list = [
      entry(1, {}, { moodCode: 'mood.sad_low' }),
      entry(2),
      entry(3),
      entry(4, {}, { moodCode: 'mood.anxious_worried' }),
    ];
    expect(moodCounts(list)).toEqual([
      { code: 'mood.calm', count: 2 },
      { code: 'mood.anxious_worried', count: 1 },
      { code: 'mood.sad_low', count: 1 },
    ]);
    expect(moodCounts([])).toEqual([]);
  });

  const defs: FactorDef[] = [
    { code: 'f.yes', type: 'boolean', unit: '' },
    { code: 'f.scale', type: 'scale', unit: '' },
    { code: 'f.num', type: 'number', unit: 'h' },
  ];
  it('compares days with a seizure and days without, per factor', () => {
    const entries = [
      entry(1, { 'f.yes': true, 'f.scale': 3, 'f.num': 4 }), // seizure day
      entry(2, { 'f.yes': true, 'f.scale': 1, 'f.num': 6 }), // seizure day
      entry(3, {}), // other
      entry(4, { 'f.scale': 2, 'f.num': 8 }), // other
    ];
    const stats = factorStats({ defs, entries, seizures: [seizureOn(1), seizureOn(2), seizureOn(2)] });
    expect(stats[0]).toMatchObject({
      code: 'f.yes',
      seizureDays: { days: 2, present: 2 },
      otherDays: { days: 2, present: 0 },
    });
    expect(stats[1]).toMatchObject({ seizureDays: { present: 1 }, otherDays: { present: 1 } });
    expect(stats[2]?.seizureDays.average).toBe(5);
    expect(stats[2]?.otherDays.average).toBe(8);
    expect(stats[0]?.seizureDays.average).toBeNull();
  });

  it('counts one entry per day, the latest', () => {
    const entries = [
      entry(1, { 'f.yes': true }, { recordedAt: at(1, 8), id: 'm' }),
      entry(1, {}, { recordedAt: at(1, 20), id: 'n' }),
    ];
    const [stat] = factorStats({ defs: [defs[0]!], entries, seizures: [] });
    expect(stat?.otherDays).toMatchObject({ days: 1, present: 0 });
  });

  it('a seizure on a day with no entry changes nothing, and no data gives zeros', () => {
    expect(factorStats({ defs, entries: [], seizures: [seizureOn(1)] })[0]).toMatchObject({
      seizureDays: { days: 0, present: 0, average: null },
      otherDays: { days: 0, present: 0 },
    });
  });
});
