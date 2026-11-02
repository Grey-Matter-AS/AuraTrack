import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import type { MedicationChange } from '../schemas';
import { ids, medicationFixture } from '../schemas/fixtures';
import {
  getDoseStatus,
  getScheduledDosesForDay,
  isMedScheduledForDay,
  planMissedDoses,
  scheduledTimestampForDay,
} from './doses';
import { regimenSnapshot } from './regimen';

const DAY = 86_400_000;
const day0 = new Date(2026, 2, 1).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 2, 1 + day, h, m).getTime();
const med = medicationFixture({ startedAt: day0 });

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
const started = change({ type: 'started', to: regimenSnapshot(med) });
const raised = change({
  effectiveAt: day0 + 10 * DAY,
  from: regimenSnapshot(med),
  to: regimenSnapshot({ ...med, dose: 750 }),
});
const current = { ...med, dose: 750 };

describe('scheduled doses', () => {
  it('schedules each dose with the regimen in force at that dose time', () => {
    const doses = getScheduledDosesForDay([current], day0 + 10 * DAY, [started, raised]);
    expect(doses.map((d) => [d.scheduledTime, d.dose])).toEqual([
      ['08:00', 750],
      ['20:00', 750],
    ]);
    const before = getScheduledDosesForDay([current], day0 + 5 * DAY, [started, raised]);
    expect(before.map((d) => d.dose)).toEqual([500, 500]);
  });

  it('a change effective from the evening dose leaves the morning dose on the old regimen', () => {
    const evening = change({
      effectiveAt: at(10, 20),
      from: regimenSnapshot(med),
      to: regimenSnapshot({ ...med, dose: 750 }),
    });
    const doses = getScheduledDosesForDay([current], at(10, 12), [started, evening]);
    expect(doses.map((d) => [d.scheduledTime, d.dose])).toEqual([
      ['08:00', 500],
      ['20:00', 750],
    ]);
  });

  it('skips rescue and as-needed medication, and days it is not scheduled for', () => {
    const rescue = medicationFixture({ isRescue: true, frequency: 'PRN', scheduledTimes: [] });
    expect(getScheduledDosesForDay([rescue], day0, [])).toEqual([]);
    const monday = medicationFixture({ scheduledDays: [1], startedAt: day0 });
    expect(getScheduledDosesForDay([monday], at(0, 12), [])).toEqual([]); // 1 March 2026 is a Sunday
    expect(getScheduledDosesForDay([monday], at(1, 12), []).length).toBe(2);
  });

  it('includes a slot introduced by a change during the day', () => {
    const added = change({
      effectiveAt: at(3, 9),
      from: regimenSnapshot(med),
      to: regimenSnapshot({ ...med, frequency: 'TDS', scheduledTimes: ['08:00', '14:00', '20:00'] }),
    });
    const tds = { ...med, frequency: 'TDS' as const, scheduledTimes: ['08:00', '14:00', '20:00'] };
    expect(getScheduledDosesForDay([tds], at(3, 12), [started, added]).map((d) => d.scheduledTime)).toEqual([
      '08:00',
      '14:00',
      '20:00',
    ]);
  });

  it('times are in the local day', () => {
    expect(scheduledTimestampForDay('08:30', at(2, 15))).toBe(at(2, 8, 30));
  });

  it('daily means no days, or all seven', () => {
    expect(isMedScheduledForDay({}, day0)).toBe(true);
    expect(isMedScheduledForDay({ scheduledDays: [] }, day0)).toBe(true);
    expect(isMedScheduledForDay({ scheduledDays: [0, 1, 2, 3, 4, 5, 6] }, day0)).toBe(true);
    expect(isMedScheduledForDay({ scheduledDays: [1] }, day0)).toBe(false);
  });
});

describe('dose status', () => {
  it('taken within 90 minutes, late after, missed when never logged', () => {
    expect(getDoseStatus('08:00', at(0, 9, 30))).toBe('taken');
    expect(getDoseStatus('08:00', at(0, 9, 31))).toBe('late');
    expect(getDoseStatus('08:00', at(0, 7, 0))).toBe('taken');
    expect(getDoseStatus('08:00', null)).toBe('missed');
    expect(getDoseStatus('08:00', at(1, 9, 31), at(1, 0))).toBe('late');
  });
});

describe('missed and assumed doses', () => {
  const base = {
    medications: [med],
    changes: [started],
    logs: [] as { medicationId: string; scheduledTime: string | null; takenAt: number }[],
  };

  it("by default records only today's past doses, as missed", () => {
    const drafts = planMissedDoses({ ...base, now: at(2, 12), assume: false });
    expect(drafts).toEqual([
      {
        medicationId: med.id,
        scheduledTime: '08:00',
        takenAt: at(2, 8),
        status: 'missed',
        doseSnapshot: 500,
        unitSnapshot: 'mg',
      },
    ]);
  });

  it('does not call a dose missed until the 90 minutes in which it still counts as taken are over', () => {
    expect(planMissedDoses({ ...base, now: at(2, 9, 29), assume: false })).toEqual([]);
    expect(planMissedDoses({ ...base, now: at(2, 9, 31), assume: false })).toHaveLength(1);
  });

  it('adds nothing for a dose already logged, and never twice', () => {
    const logs = [{ medicationId: med.id, scheduledTime: '08:00', takenAt: at(2, 8, 20) }];
    expect(planMissedDoses({ ...base, logs, now: at(2, 12), assume: false })).toEqual([]);
    expect(
      planMissedDoses({
        ...base,
        logs: [{ medicationId: med.id, scheduledTime: null, takenAt: at(2, 8) }],
        now: at(2, 12),
        assume: false,
      }),
    ).toHaveLength(1);
  });

  it('with "assume taken", waits out the 90 minutes and back-fills from the day it was turned on', () => {
    const justAfter = planMissedDoses({ ...base, now: at(2, 9, 29), assume: true, assumeSince: '2026-03-03' });
    expect(justAfter).toEqual([]);
    const drafts = planMissedDoses({ ...base, now: at(4, 12), assume: true, assumeSince: '2026-03-03' });
    expect(drafts.map((d) => [d.takenAt, d.status])).toEqual([
      [at(2, 8), 'assumed'],
      [at(2, 20), 'assumed'],
      [at(3, 8), 'assumed'],
      [at(3, 20), 'assumed'],
      [at(4, 8), 'assumed'],
    ]);
  });

  it('back-fills at most 31 days, and treats a missing or bad start as today', () => {
    const long = planMissedDoses({
      ...base,
      medications: [{ ...med, startedAt: null }],
      changes: [],
      now: at(60, 23),
      assume: true,
      assumeSince: '2026-01-01',
    });
    expect(long.length).toBe(32 * 2);
    expect(planMissedDoses({ ...base, now: at(2, 23), assume: true }).length).toBe(2);
    expect(planMissedDoses({ ...base, now: at(2, 23), assume: true, assumeSince: 'garbage' }).length).toBe(2);
    expect(planMissedDoses({ ...base, now: at(2, 23), assume: true, assumeSince: '' }).length).toBe(2);
    expect(planMissedDoses({ ...base, now: at(2, 23), assume: true, assumeSince: at(1, 5) }).length).toBe(4);
  });

  it('a start date in the future does not reach past today', () => {
    expect(planMissedDoses({ ...base, now: at(2, 23), assume: true, assumeSince: '2030-01-01' }).length).toBe(2);
  });
});
