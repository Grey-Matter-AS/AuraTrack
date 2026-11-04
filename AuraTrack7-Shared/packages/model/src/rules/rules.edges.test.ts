import { describe, expect, it, vi } from 'vitest';
import { newId } from '../ids';
import type { MedicationChange } from '../schemas';
import { ids, medicationFixture } from '../schemas/fixtures';
import { endOfLocalDay, parseLocalDate } from './dates';
import { getScheduledDosesForDay, planMissedDoses } from './doses';
import { defaultScheduledTimes, diffRegimen, regimenAt, regimenSnapshot, slotDose } from './regimen';

// Edges of the medication rules that a small change could break without anything noticing.
const DAY = 86_400_000;
const day0 = new Date(2026, 2, 1).getTime();
const at = (day: number, h: number, m = 0, s = 0, ms = 0) => new Date(2026, 2, 1 + day, h, m, s, ms).getTime();
const med = medicationFixture({ startedAt: day0 });
const reg = (over: object = {}) => regimenSnapshot({ ...med, ...over });
const change = (over: Partial<MedicationChange>): MedicationChange => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1,
  medicationId: med.id,
  medicationName: med.name,
  type: 'changed',
  effectiveAt: day0,
  recordedAt: day0,
  from: null,
  to: null,
  changedFields: [],
  note: '',
  isBaseline: false,
  ...over,
});
const started = change({ type: 'started', to: reg() });

describe('usual times', () => {
  it('are exact for every frequency', () => {
    expect(defaultScheduledTimes('OD')).toEqual(['08:00']);
    expect(defaultScheduledTimes('TDS')).toEqual(['08:00', '14:00', '20:00']);
    expect(defaultScheduledTimes('QDS')).toEqual(['08:00', '12:00', '16:00', '20:00']);
  });
});

describe('regimen snapshots and differences', () => {
  it('a snapshot is a copy: changing the medication later does not change it', () => {
    const live = medicationFixture({ slotDoses: { '08:00': 250 } });
    const snap = regimenSnapshot(live);
    live.slotDoses['08:00'] = 999;
    expect(snap.slotDoses).toEqual({ '08:00': 250 });
  });

  it('the same times in another order are the same schedule; a different set is not', () => {
    const from = reg();
    expect(diffRegimen(from, { ...from, scheduledTimes: ['20:00', '08:00'] })).toEqual([]);
    expect(diffRegimen(from, { ...from, scheduledDays: [6, 0, 1, 2, 3, 4, 5] })).toEqual([]);
    expect(diffRegimen(from, { ...from, scheduledTimes: ['08:00', '21:00'] })).toEqual(['scheduledTimes']);
    expect(diffRegimen(from, { ...from, scheduledTimes: ['08:00'] })).toEqual(['scheduledTimes']);
  });

  it('only the ingredient is compared without regard to case', () => {
    const from = reg();
    expect(diffRegimen(from, { ...from, activeIngredient: 'LEVETIRACETAM' })).toEqual([]);
    expect(diffRegimen(from, { ...from, name: 'LEVETIRACETAM' })).toEqual(['name']);
    expect(diffRegimen(from, { ...from, form: 'TABLET' })).toEqual(['form']);
  });

  it('an as-needed medication compares its single dose even if it still lists times', () => {
    const from = reg({ frequency: 'PRN', scheduledTimes: ['08:00'], dose: 5 });
    const to = reg({ frequency: 'PRN', scheduledTimes: ['08:00'], dose: 10 });
    expect(diffRegimen(from, to)).toEqual(['dose']);
  });

  it('a slot dose is read for a real slot only', () => {
    const r = reg({ slotDoses: { '08:00': 250 } });
    expect(slotDose(r, '08:00')).toBe(250);
    expect(slotDose(r, '20:00')).toBe(500);
    expect(slotDose(r, null)).toBe(500);
  });
});

describe('regimen at a moment: the edges', () => {
  const current = { ...med, dose: 750 };
  it('the start moment itself is already on the medication', () => {
    expect(regimenAt(med, [], day0)?.dose).toBe(500);
    expect(regimenAt(med, [], day0 - 1)).toBeNull();
  });

  it('before the first change, a medication that started later is not yet taken; one that started earlier was on the old dose', () => {
    const raised = change({ effectiveAt: day0 + 10 * DAY, from: reg(), to: reg({ dose: 750 }) });
    expect(regimenAt({ ...current, startedAt: day0 + 5 * DAY }, [raised], day0 + 5 * DAY - 1)).toBeNull();
    expect(regimenAt({ ...current, startedAt: day0 + 5 * DAY }, [raised], day0 + 5 * DAY)?.dose).toBe(500);
    expect(regimenAt({ ...current, startedAt: null }, [raised], day0)?.dose).toBe(500);
    // a "started" record means nothing was taken before it
    expect(regimenAt(current, [started], day0 - 1)).toBeNull();
    expect(
      regimenAt(
        { ...current, startedAt: null },
        [change({ type: 'changed', effectiveAt: day0, from: reg(), to: reg() })],
        day0 - 1,
      ),
    ).toEqual(reg());
  });

  it('a stop ends it, and a later restart brings it back', () => {
    const stopped = change({ type: 'stopped', effectiveAt: day0 + 3 * DAY, from: reg(), to: null });
    const again = change({ type: 'started', effectiveAt: day0 + 6 * DAY, to: reg() });
    expect(regimenAt(med, [started, stopped, again], day0 + 4 * DAY)).toBeNull();
    expect(regimenAt(med, [started, stopped, again], day0 + 7 * DAY)?.dose).toBe(500);
    expect(regimenAt(med, [started, stopped, again], day0 + 2 * DAY)?.dose).toBe(500);
  });
});

describe('dates', () => {
  it('the end of a day is the last millisecond of that day', () => {
    expect(endOfLocalDay(at(0, 5))).toBe(at(0, 23, 59, 59, 999));
    expect(new Date(endOfLocalDay(at(0, 5))).getMinutes()).toBe(59);
  });

  it('a date key must be exactly YYYY-MM-DD', () => {
    expect(Number.isNaN(parseLocalDate('2026-03-01x').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('x2026-03-01').getTime())).toBe(true);
    expect(parseLocalDate('2026-03-01').getTime()).toBe(day0);
  });
});

describe('scheduled doses: the day edges', () => {
  it('a slot that exists only for part of the day is still scheduled', () => {
    const noon = reg({ frequency: 'TDS', scheduledTimes: ['08:00', '12:00', '20:00'] });
    const added = change({ effectiveAt: at(3, 9), from: reg(), to: noon });
    const removed = change({ effectiveAt: at(3, 15), from: noon, to: reg() });
    const doses = getScheduledDosesForDay([med], at(3, 12), [started, added, removed]);
    expect(doses.map((d) => d.scheduledTime)).toEqual(['08:00', '12:00', '20:00']);
  });

  it('a medication stopped during the day has no dose after it', () => {
    const stopped = change({ type: 'stopped', effectiveAt: at(3, 10), from: reg(), to: null });
    const doses = getScheduledDosesForDay([{ ...med, active: false }], at(3, 12), [started, stopped]);
    expect(doses.map((d) => d.scheduledTime)).toEqual(['08:00']);
  });

  it('as-needed and rescue medication are never scheduled, even if times are left on them', () => {
    const prn = medicationFixture({ frequency: 'PRN', scheduledTimes: ['08:00'], startedAt: day0 });
    expect(getScheduledDosesForDay([prn], at(1, 12), [])).toEqual([]);
    const rescue = medicationFixture({ isRescue: true, startedAt: day0 });
    expect(getScheduledDosesForDay([rescue], at(1, 12), [])).toEqual([]);
    const both = getScheduledDosesForDay([med, rescue], at(1, 12), []);
    expect(both).toHaveLength(2);
  });

  it('a change that takes effect at midnight belongs to the new day', () => {
    const evening = reg({ scheduledTimes: ['08:00', '20:00', '21:00'] });
    const atMidnight = change({ effectiveAt: at(4, 0), from: reg(), to: evening });
    expect(getScheduledDosesForDay([med], at(3, 12), [started, atMidnight]).map((d) => d.scheduledTime)).toEqual([
      '08:00',
      '20:00',
    ]);
  });
});

describe('missed and assumed doses: the edges', () => {
  const base = {
    medications: [med],
    changes: [started],
    logs: [] as { medicationId: string; scheduledTime: string | null; takenAt: number }[],
  };

  it('a dose is missed, or assumed, exactly 90 minutes after its time and not a moment before', () => {
    expect(planMissedDoses({ ...base, now: at(2, 9, 30), assume: false })).toHaveLength(1);
    expect(planMissedDoses({ ...base, now: at(2, 9, 30) - 1, assume: false })).toHaveLength(0);
    expect(planMissedDoses({ ...base, now: at(2, 9, 30), assume: true, assumeSince: '2026-03-03' })).toHaveLength(1);
    expect(planMissedDoses({ ...base, now: at(2, 9, 30) - 1, assume: true, assumeSince: '2026-03-03' })).toHaveLength(
      0,
    );
  });

  it('a medication listed twice gives each missed dose once', () => {
    expect(planMissedDoses({ ...base, medications: [med, med], now: at(2, 12), assume: false })).toHaveLength(1);
  });

  it('a dose logged on another day, or for another time, does not count as logged', () => {
    const logs = [
      { medicationId: med.id, scheduledTime: '08:00', takenAt: at(1, 8) },
      { medicationId: med.id, scheduledTime: '20:00', takenAt: at(2, 8) },
      { medicationId: newId(), scheduledTime: '08:00', takenAt: at(2, 8) },
    ];
    expect(planMissedDoses({ ...base, logs, now: at(2, 12), assume: false })).toHaveLength(1);
  });

  it('"assume taken" with a start date accepts a date key, an instant, or an ISO text; anything else means today', () => {
    const now = at(4, 23);
    const count = (assumeSince: string | number | null | undefined) =>
      planMissedDoses({ ...base, now, assume: true, ...(assumeSince !== undefined ? { assumeSince } : {}) }).length;
    expect(count('2026-03-03')).toBe(6);
    expect(count(at(2, 17))).toBe(6);
    expect(count(new Date(2026, 2, 3, 12).toISOString())).toBe(6);
    expect(count(null)).toBe(2);
    expect(count(undefined)).toBe(2);
    expect(count('')).toBe(2);
    expect(count('not a date')).toBe(2);
    expect(count('2026-03-03 and more')).toBe(2);
  });

  it('with "assume taken" off, a start date is ignored', () => {
    expect(planMissedDoses({ ...base, now: at(4, 23), assume: false, assumeSince: '2026-03-01' })).toHaveLength(2);
  });

  it('the back-fill starts at the day the setting was turned on', () => {
    vi.stubEnv('TZ', 'Europe/Oslo');
    const drafts = planMissedDoses({ ...base, now: at(4, 23), assume: true, assumeSince: '2026-03-04' });
    expect(drafts.map((d) => d.takenAt)).toEqual([at(3, 8), at(3, 20), at(4, 8), at(4, 20)]);
    vi.unstubAllEnvs();
  });
});
