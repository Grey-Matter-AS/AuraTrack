import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seizureFixture } from '../schemas/fixtures';
import type { DoseLog, InterictalEvent, MedicationChange, Phases, Seizure } from '../schemas';
import { emergencyPlan } from './emergency';
import {
  NO_FILTERS,
  filterSeizures,
  filtersActive,
  frequencyBuckets,
  needsDetails,
  seizureKindKey,
  paginate,
  timelineItems,
} from './history';

const plan = emergencyPlan();
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();
const phasesAt = (start: number, seconds: number): Phases => ({
  start: { at: start, source: 'timed' },
  auraEnd: null,
  seizureEnd: { at: start + seconds * 1000, source: 'timed' },
  recoveryEnd: null,
});
const seizure = (start: number, seconds: number, extra: Partial<Seizure> = {}): Seizure => ({
  ...seizureFixture(),
  phases: phasesAt(start, seconds),
  status: 'complete',
  profile: { id: 'usual', name: 'Usual seizure' },
  cancelled: false,
  ...extra,
});

describe('filters', () => {
  const a = seizure(at(2026, 10, 1), 60, { id: 'a' });
  const b = seizure(at(2026, 10, 15), 400, { id: 'b', profile: null });
  const c = seizure(at(2026, 11, 1), 60, { id: 'c', status: 'recorded' });
  const all = [a, b, c];

  it('passes everything with no filters', () => {
    expect(filterSeizures(all, NO_FILTERS)).toEqual(all);
    expect(filtersActive(NO_FILTERS)).toBe(false);
  });

  it('filters by kind, including "not set"', () => {
    expect(filterSeizures(all, { ...NO_FILTERS, type: 'profile:usual' }).map((s) => s.id)).toEqual(['a', 'c']);
    expect(filterSeizures(all, { ...NO_FILTERS, type: 'none' }).map((s) => s.id)).toEqual(['b']);
  });

  it('filters by profile and by ILAE 2025 type, and a profile wins over the type it has (D-17)', () => {
    const ilae2025 = {
      class: 'focal' as const,
      recall: 'no' as const,
      responsive: null,
      bilateralTonicClonic: null,
      observable: null,
      generalized: null,
    };
    const p = seizure(at(2026, 10, 2), 60, { id: 'p', ilae2025, profile: { id: 'x', name: 'Usual' } });
    const q = seizure(at(2026, 10, 3), 60, { id: 'q', profile: null, ilae2025 });
    const r = seizure(at(2026, 10, 4), 60, { id: 'r', profile: null, ilae2025: { ...ilae2025, class: null } });
    expect(seizureKindKey(p)).toBe('profile:x');
    expect(seizureKindKey(q)).toBe('ilae2025:focal_impaired_consciousness');
    expect(seizureKindKey(r)).toBeNull();
    expect(seizureKindKey(seizure(at(2026, 10, 5), 60))).toBe('profile:usual');
    const list = [p, q, r];
    expect(filterSeizures(list, { ...NO_FILTERS, type: 'profile:x' }).map((s) => s.id)).toEqual(['p']);
    expect(
      filterSeizures(list, { ...NO_FILTERS, type: 'ilae2025:focal_impaired_consciousness' }).map((s) => s.id),
    ).toEqual(['q']);
    expect(filterSeizures(list, { ...NO_FILTERS, type: 'none' }).map((s) => s.id)).toEqual(['r']);
    expect(needsDetails({ ...q, status: 'complete' })).toBe(false);
    expect(needsDetails({ ...r, status: 'complete' })).toBe(true);
  });

  it('filters by local day, both ends included', () => {
    expect(filterSeizures(all, { ...NO_FILTERS, from: '2026-10-01', to: '2026-10-15' }).map((s) => s.id)).toEqual([
      'a',
      'b',
    ]);
    expect(filterSeizures(all, { ...NO_FILTERS, from: '2026-10-02' }).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('uses the local day, so a seizure just after midnight is on that day, not the one before', () => {
    const late = seizure(new Date(2026, 9, 1, 0, 5).getTime(), 30, { id: 'late' });
    expect(filterSeizures([late], { ...NO_FILTERS, from: '2026-10-01', to: '2026-10-01' })).toHaveLength(1);
    expect(filterSeizures([late], { ...NO_FILTERS, to: '2026-09-30' })).toHaveLength(0);
  });

  it('"needs details" is a seizure that has no type, or only its timing', () => {
    expect(needsDetails(a)).toBe(false);
    expect(needsDetails(b)).toBe(true);
    expect(needsDetails(c)).toBe(true);
    expect(filterSeizures(all, { ...NO_FILTERS, needsDetails: true }).map((s) => s.id)).toEqual(['b', 'c']);
    expect(filtersActive({ ...NO_FILTERS, needsDetails: true })).toBe(true);
  });

  it('combines the filters, and never returns a seizure that was not in the list', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 400 }), { maxLength: 30 }),
        fc.constantFrom(null, 'none', 'profile:usual'),
        (days, type) => {
          const list = days.map((d, i) =>
            seizure(at(2026, 1, 1) + d * 86_400_000, 30, {
              id: String(i),
              profile: i % 2 ? null : { id: 'usual', name: 'Usual seizure' },
            }),
          );
          const out = filterSeizures(list, { ...NO_FILTERS, type });
          expect(out.every((s) => list.includes(s))).toBe(true);
          expect(out.length).toBeLessThanOrEqual(list.length);
        },
      ),
    );
  });
});

describe('pages', () => {
  it('cuts a list into pages, keeps the page in range, and always has one page', () => {
    const list = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(list, 1, 20)).toMatchObject({ page: 1, pages: 3 });
    expect(paginate(list, 3, 20).items).toHaveLength(5);
    expect(paginate(list, 9, 20).page).toBe(3);
    expect(paginate(list, 0, 20).page).toBe(1);
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pages: 1 });
  });

  it('shows every item exactly once across the pages', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 80 }), fc.integer({ min: 1, max: 30 }), (list, size) => {
        const first = paginate(list, 1, size);
        const all = Array.from({ length: first.pages }, (_, i) => paginate(list, i + 1, size).items).flat();
        expect(all).toEqual(list);
      }),
    );
  });
});

describe('frequency buckets', () => {
  const seizures = [
    seizure(at(2026, 10, 5), 60), // Monday
    seizure(at(2026, 10, 5, 20), 400), // same day, long (400 s >= 300 s)
    seizure(at(2026, 10, 7), 60), // Wednesday, same week
    seizure(at(2026, 10, 14), 60), // next week
  ];
  it('counts per day with the empty days included', () => {
    const days = frequencyBuckets(seizures, at(2026, 10, 5, 0), at(2026, 10, 8, 23), 'day', plan);
    expect(days.map((d) => [d.day, d.count, d.long])).toEqual([
      ['2026-10-05', 2, 1],
      ['2026-10-06', 0, 0],
      ['2026-10-07', 1, 0],
      ['2026-10-08', 0, 0],
    ]);
  });

  it('counts per week, weeks starting on Monday', () => {
    const weeks = frequencyBuckets(seizures, at(2026, 10, 7), at(2026, 10, 16), 'week', plan);
    expect(weeks.map((w) => [w.day, w.count])).toEqual([
      ['2026-10-05', 3],
      ['2026-10-12', 1],
    ]);
  });

  it('counts per month', () => {
    const months = frequencyBuckets(
      [...seizures, seizure(at(2026, 11, 2), 30)],
      at(2026, 10, 20),
      at(2026, 11, 20),
      'month',
      plan,
    );
    expect(months.map((m) => [m.day, m.count])).toEqual([
      ['2026-10-01', 4],
      ['2026-11-01', 1],
    ]);
  });

  it('ignores seizures outside the range', () => {
    const out = frequencyBuckets(seizures, at(2026, 10, 14, 0), at(2026, 10, 14, 23), 'day', plan);
    expect(out).toHaveLength(1);
    expect(out[0]?.count).toBe(1);
  });

  it('does not lose or invent days when the clocks change', () => {
    // 2026-10-25 has 25 hours in Europe/Oslo; in any zone the day count must match the calendar
    const out = frequencyBuckets([], at(2026, 10, 24, 0), at(2026, 10, 27, 23), 'day', plan);
    expect(out.map((d) => d.day)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });
});

describe('timeline items', () => {
  const names = new Map([['m1', 'Lamotrigine']]);
  const between = { id: 'i1', occurredAt: at(2026, 10, 6), symptomCode: 'symptom.dizziness' } as InterictalEvent;
  const change = (id: string, effectiveAt: number, isBaseline: boolean) =>
    ({
      id,
      effectiveAt,
      isBaseline,
      medicationId: 'm1',
      medicationName: 'Lamotrigine',
      type: 'changed',
    }) as MedicationChange;
  const dose = (id: string, takenAt: number, status: DoseLog['status']) =>
    ({ id, takenAt, status, medicationId: 'm1' }) as DoseLog;

  it('puts everything in time order and leaves out what is outside the range, baselines and doses that were taken', () => {
    const items = timelineItems({
      seizures: [seizure(at(2026, 10, 5), 90, { id: 's1' }), seizure(at(2026, 9, 1), 90, { id: 'old' })],
      between: [between],
      changes: [change('c1', at(2026, 10, 7), false), change('base', at(2026, 10, 7), true)],
      doses: [dose('d1', at(2026, 10, 8), 'missed'), dose('d2', at(2026, 10, 8), 'taken')],
      medicationNames: names,
      from: at(2026, 10, 1, 0),
      to: at(2026, 10, 31, 23),
      plan,
    });
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ['seizure', 's1'],
      ['between', 'i1'],
      ['medication', 'c1'],
      ['missed', 'd1'],
    ]);
    expect(items[0]).toMatchObject({ seconds: 90, long: false, kindKey: 'profile:usual' });
    expect(items[3]).toMatchObject({ name: 'Lamotrigine', medicationId: 'm1' });
  });

  it('marks a seizure at or over the alert time as long', () => {
    const [item] = timelineItems({
      seizures: [seizure(at(2026, 10, 5), 300, { id: 's' })],
      between: [],
      changes: [],
      doses: [],
      medicationNames: names,
      from: 0,
      to: Number.MAX_SAFE_INTEGER,
      plan,
    });
    expect(item).toMatchObject({ kind: 'seizure', long: true });
  });
});
