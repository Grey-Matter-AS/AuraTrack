import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { medicationFixture } from '../schemas/fixtures';
import type { DoseLog, Medication, MedicationChange } from '../schemas';
import { planMissedDoses, slotDayKey } from './doses';
import {
  adherence,
  doseGrid,
  dosePanel,
  dueReminders,
  extraDose,
  planMedicationChange,
  renameType,
  takenDose,
  type ChangePlan,
} from './medication';
import { regimenAt, regimenSnapshot } from './regimen';

const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m, 0).getTime(); // October 2026
const NOW = at(10, 12);
const patientId = 'p1';
const med = (over: Partial<Medication> = {}): Medication => ({
  ...medicationFixture({ id: 'm1', patientId, startedAt: at(1, 8), ...over }),
});
const flags = { isRescue: false, showInEmergency: false, reminderEnabled: false };
const planOf = (r: ReturnType<typeof planMedicationChange>): ChangePlan => {
  if ('problem' in r) throw new Error(r.problem);
  return r;
};
const asChange = (plan: ChangePlan, id = 'c1'): MedicationChange => ({
  id,
  householdId: 'h',
  deviceId: 'd',
  createdAt: plan.change.recordedAt,
  ...plan.change,
  medicationId: plan.change.medicationId || 'm1',
});

describe('starting a medicine', () => {
  it('creates it active, from the effective day, with a "started" record that has no "from"', () => {
    const next = { ...regimenSnapshot(med()), ...flags };
    const plan = planOf(
      planMedicationChange({
        patientId,
        before: null,
        next,
        type: 'started',
        effectiveAt: at(1, 8),
        recordedAt: NOW,
        note: 'new',
      }),
    );
    expect(plan.medication).toMatchObject({
      create: { name: 'Levetiracetam', active: true, startedAt: at(1, 8), stoppedAt: null },
    });
    expect(plan.change).toMatchObject({
      type: 'started',
      from: null,
      isBaseline: false,
      note: 'new',
      medicationName: 'Levetiracetam',
    });
    expect(plan.change.to).toMatchObject({ dose: 500, frequency: 'BD' });
  });

  it('takes a stopped medicine up again as the same record, with its history kept', () => {
    const stopped = med({ active: false, stoppedAt: at(5) });
    const next = { ...regimenSnapshot(stopped), ...flags };
    const plan = planOf(
      planMedicationChange({
        patientId,
        before: stopped,
        next,
        type: 'started',
        effectiveAt: at(8),
        recordedAt: NOW,
        note: '',
      }),
    );
    expect(plan.medication).toMatchObject({ id: 'm1', patch: { active: true, startedAt: at(8), stoppedAt: null } });
  });

  it('refuses a name that is empty, scheduled times that are missing, a medicine that is already taken, and a day to come', () => {
    const base = { patientId, before: null, type: 'started' as const, effectiveAt: at(1), recordedAt: NOW, note: '' };
    const good = { ...regimenSnapshot(med()), ...flags };
    expect(planMedicationChange({ ...base, next: { ...good, name: '   ' } })).toEqual({ problem: 'name_empty' });
    expect(planMedicationChange({ ...base, next: { ...good, scheduledTimes: [] } })).toEqual({ problem: 'no_times' });
    expect(planMedicationChange({ ...base, before: med(), next: good })).toEqual({ problem: 'not_stopped' });
    expect(planMedicationChange({ ...base, effectiveAt: NOW + 86_400_000, next: good })).toEqual({ problem: 'future' });
  });

  it('lets an as-needed medicine have no times', () => {
    const next = { ...regimenSnapshot(med({ frequency: 'PRN', scheduledTimes: [] })), ...flags, isRescue: true };
    const plan = planOf(
      planMedicationChange({
        patientId,
        before: null,
        next,
        type: 'started',
        effectiveAt: at(1),
        recordedAt: NOW,
        note: '',
      }),
    );
    expect(plan.medication).toMatchObject({ create: { frequency: 'PRN', isRescue: true } });
  });
});

describe('changing a medicine', () => {
  it('keeps the regimen before and after and names what changed', () => {
    const before = med();
    const next = { ...regimenSnapshot(before), dose: 750, ...flags };
    const plan = planOf(
      planMedicationChange({
        patientId,
        before,
        next,
        type: 'changed',
        effectiveAt: at(9),
        recordedAt: NOW,
        note: 'up',
      }),
    );
    expect(plan.change.from).toMatchObject({ dose: 500 });
    expect(plan.change.to).toMatchObject({ dose: 750 });
    expect(plan.change.changedFields).toEqual(['slotDose:08:00', 'slotDose:20:00']);
    expect(plan.medication).toMatchObject({ id: 'm1', patch: { dose: 750, active: true } });
  });

  it('says there is nothing to confirm when nothing changed', () => {
    const before = med();
    expect(
      planMedicationChange({
        patientId,
        before,
        next: { ...regimenSnapshot(before), ...flags },
        type: 'changed',
        effectiveAt: at(9),
        recordedAt: NOW,
        note: '',
      }),
    ).toEqual({ problem: 'no_change' });
  });

  it('counts a changed flag (such as the reminder) as a change', () => {
    const before = med();
    const plan = planMedicationChange({
      patientId,
      before,
      next: { ...regimenSnapshot(before), ...flags, reminderEnabled: true },
      type: 'changed',
      effectiveAt: at(9),
      recordedAt: NOW,
      note: '',
    });
    expect('problem' in plan).toBe(false);
  });

  it('reads the right regimen at any moment from the history: before, between and after the change', () => {
    const before = med();
    const next = { ...regimenSnapshot(before), dose: 750, ...flags };
    const plan = planOf(
      planMedicationChange({ patientId, before, next, type: 'changed', effectiveAt: at(9), recordedAt: NOW, note: '' }),
    );
    const started = planOf(
      planMedicationChange({
        patientId,
        before: null,
        next: { ...regimenSnapshot(before), ...flags },
        type: 'started',
        effectiveAt: at(1, 8),
        recordedAt: at(1, 8),
        note: '',
      }),
    );
    const live = { ...before, dose: 750 };
    const history = [asChange(started, 'c0'), asChange(plan, 'c1')];
    expect(regimenAt(live, history, at(3))?.dose).toBe(500);
    expect(regimenAt(live, history, at(9, 13))?.dose).toBe(750);
    expect(regimenAt(live, history, at(0))).toBeNull();
  });

  it('a correction is recorded as a correction, and a typo rename is one while a brand change is a change', () => {
    expect(renameType('typo')).toBe('correction');
    expect(renameType('brand')).toBe('changed');
    const before = med({ name: 'Lamotrigne' });
    const next = { ...regimenSnapshot(before), name: 'Lamotrigine', ...flags };
    const plan = planOf(
      planMedicationChange({
        patientId,
        before,
        next,
        type: 'correction',
        effectiveAt: at(9),
        recordedAt: NOW,
        note: 'typo',
      }),
    );
    expect(plan.change).toMatchObject({ type: 'correction', changedFields: ['name'], medicationName: 'Lamotrigine' });
  });
});

describe('stopping a medicine', () => {
  it('keeps it, marks it stopped on the day, and records the regimen it had', () => {
    const before = med();
    const plan = planOf(
      planMedicationChange({
        patientId,
        before,
        next: { ...regimenSnapshot(before), ...flags },
        type: 'stopped',
        effectiveAt: at(9),
        recordedAt: NOW,
        note: 'side effects',
      }),
    );
    expect(plan.medication).toEqual({ id: 'm1', patch: { active: false, stoppedAt: at(9) } });
    expect(plan.change).toMatchObject({ type: 'stopped', to: null, note: 'side effects' });
    expect(plan.change.from).toMatchObject({ name: 'Levetiracetam' });
  });

  it('cannot stop what is already stopped', () => {
    const stopped = med({ active: false });
    expect(
      planMedicationChange({
        patientId,
        before: stopped,
        next: { ...regimenSnapshot(stopped), ...flags },
        type: 'stopped',
        effectiveAt: at(9),
        recordedAt: NOW,
        note: '',
      }),
    ).toEqual({ problem: 'already_stopped' });
  });
});

describe('the dose panel', () => {
  const m = med();
  const log = (over: Partial<DoseLog>): DoseLog => ({
    id: 'l1',
    householdId: 'h',
    deviceId: 'd',
    createdAt: 0,
    patientId,
    medicationId: 'm1',
    scheduledTime: '08:00',
    takenAt: at(10, 8, 5),
    status: 'taken',
    note: '',
    doseSnapshot: 500,
    unitSnapshot: 'mg',
    ...over,
  });

  it('shows each slot as due when it has passed, and upcoming when it has not', () => {
    const rows = dosePanel({ medications: [m], changes: [], logs: [], now: NOW });
    expect(rows.map((r) => [r.scheduledTime, r.state])).toEqual([
      ['08:00', 'due'],
      ['20:00', 'upcoming'],
    ]);
    expect(rows[0]).toMatchObject({ name: 'Levetiracetam', dose: 500, unit: 'mg', log: null });
  });

  it('shows the logged status, and a late-night dose taken after midnight stays on the evening it was for', () => {
    const evening = at(9, 20);
    const lateLog = log({ id: 'l2', scheduledTime: '20:00', takenAt: at(10, 0, 20), status: 'late' });
    const nine = dosePanel({ medications: [m], changes: [], logs: [lateLog], now: NOW, day: evening });
    expect(nine.find((r) => r.scheduledTime === '20:00')?.state).toBe('late');
    const ten = dosePanel({ medications: [m], changes: [], logs: [lateLog], now: NOW });
    expect(ten.find((r) => r.scheduledTime === '20:00')?.state).toBe('upcoming');
  });

  it('leaves out rescue medicine and medicine not yet started', () => {
    const rescue = med({ id: 'r', isRescue: true, frequency: 'PRN', scheduledTimes: [] });
    const later = med({ id: 'later', startedAt: at(20) });
    expect(dosePanel({ medications: [rescue, later], changes: [], logs: [], now: NOW })).toEqual([]);
  });

  it('a dose marked taken within 90 minutes is taken, after that late, and it keeps the dose it was', () => {
    const [row] = dosePanel({ medications: [m], changes: [], logs: [], now: NOW });
    expect(takenDose(row!, patientId, at(10, 8, 30))).toMatchObject({
      status: 'taken',
      scheduledTime: '08:00',
      doseSnapshot: 500,
      unitSnapshot: 'mg',
    });
    expect(takenDose(row!, patientId, at(10, 11))).toMatchObject({ status: 'late' });
  });

  it('an extra dose has no slot, and uses the given dose or the usual one', () => {
    expect(extraDose(m, patientId, NOW, 250)).toMatchObject({
      scheduledTime: null,
      status: 'taken',
      doseSnapshot: 250,
    });
    expect(extraDose(m, patientId, NOW, null)).toMatchObject({ doseSnapshot: 500 });
  });
});

describe('slot days and the missed-dose plan', () => {
  it('puts a dose taken just after midnight on the evening before, and one taken on time on its own day', () => {
    expect(slotDayKey('23:30', at(11, 0, 10))).toBe('2026-10-10');
    expect(slotDayKey('08:00', at(10, 8, 10))).toBe('2026-10-10');
    expect(slotDayKey('02:00', at(10, 3, 0))).toBe('2026-10-10');
  });

  it('does not call a dose missed when it was taken after midnight', () => {
    const night = med({ scheduledTimes: ['23:30'], frequency: 'OD', startedAt: at(1) });
    const drafts = planMissedDoses({
      medications: [night],
      changes: [],
      logs: [{ medicationId: 'm1', scheduledTime: '23:30', takenAt: at(10, 0, 10) }],
      now: at(10, 12),
      assume: true,
      assumeSince: '2026-10-09',
    });
    // 9 Oct 23:30 was taken at 00:10 on the 10th, so only no other day is missing
    expect(drafts.map((d) => new Date(d.takenAt).getDate())).toEqual([]);
  });
});

describe('the history grid and adherence', () => {
  it('lists the days newest first, each with that day’s doses, and counts adherence per medicine', () => {
    const m = med({ frequency: 'OD', scheduledTimes: ['08:00'], startedAt: at(1) });
    const logs: DoseLog[] = [
      {
        id: 'a',
        householdId: 'h',
        deviceId: 'd',
        createdAt: 0,
        patientId,
        medicationId: 'm1',
        scheduledTime: '08:00',
        takenAt: at(8, 8, 5),
        status: 'taken',
        note: '',
        doseSnapshot: 500,
        unitSnapshot: 'mg',
      },
      {
        id: 'b',
        householdId: 'h',
        deviceId: 'd',
        createdAt: 0,
        patientId,
        medicationId: 'm1',
        scheduledTime: '08:00',
        takenAt: at(9, 8, 0),
        status: 'missed',
        note: '',
        doseSnapshot: 500,
        unitSnapshot: 'mg',
      },
      {
        id: 'x',
        householdId: 'h',
        deviceId: 'd',
        createdAt: 0,
        patientId,
        medicationId: 'm1',
        scheduledTime: null,
        takenAt: at(9, 15),
        status: 'taken',
        note: '',
        doseSnapshot: 500,
        unitSnapshot: 'mg',
      },
    ];
    const grid = doseGrid({ medications: [m], changes: [], logs, from: at(8), to: at(10), now: NOW });
    expect(grid.map((d) => d.day)).toEqual(['2026-10-10', '2026-10-09', '2026-10-08']);
    expect(grid.map((d) => d.cells[0]?.state)).toEqual(['due', 'missed', 'taken']);
    expect(adherence(logs).get('m1')).toEqual({ taken: 1, late: 0, assumed: 0, missed: 1 });
  });

  it('has one entry for every calendar day in the range, also across the clock change', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (span) => {
        const from = new Date(2026, 9, 10).getTime();
        const to = new Date(2026, 9, 10 + span, 23).getTime();
        expect(doseGrid({ medications: [], changes: [], logs: [], from, to, now: to })).toHaveLength(span + 1);
      }),
    );
  });
});

describe('reminders', () => {
  const on = (over: Partial<Medication> = {}) => med({ reminderEnabled: true, ...over });
  const base = { changes: [], logs: [] as DoseLog[] };

  it('reminds about a slot that has come and is not logged, inside the 90 minutes', () => {
    const at0830 = at(10, 8, 30);
    expect(dueReminders({ ...base, medications: [on()], now: at0830 })).toMatchObject([
      { name: 'Levetiracetam', scheduledTime: '08:00', patientId },
    ]);
    expect(dueReminders({ ...base, medications: [on()], now: at(10, 9, 31) })).toEqual([]);
  });

  it('does not remind before the slot, for a dose already logged, or for a medicine with its reminder off', () => {
    expect(dueReminders({ ...base, medications: [on()], now: at(10, 7, 59) })).toEqual([]);
    const logged: DoseLog = {
      id: 'l',
      householdId: 'h',
      deviceId: 'd',
      createdAt: 0,
      patientId,
      medicationId: 'm1',
      scheduledTime: '08:00',
      takenAt: at(10, 8, 10),
      status: 'taken',
      note: '',
      doseSnapshot: 500,
      unitSnapshot: 'mg',
    };
    expect(dueReminders({ ...base, logs: [logged], medications: [on()], now: at(10, 8, 30) })).toEqual([]);
    expect(dueReminders({ ...base, medications: [med()], now: at(10, 8, 30) })).toEqual([]);
  });

  it('covers every person, not only the one on screen, and skips stopped medicines', () => {
    const other = on({ id: 'm2', patientId: 'p2', name: 'Valproate' });
    const stopped = on({ id: 'm3', active: false });
    const out = dueReminders({ ...base, medications: [on(), other, stopped], now: at(10, 8, 30) });
    expect(out.map((r) => [r.patientId, r.name])).toEqual([
      ['p1', 'Levetiracetam'],
      ['p2', 'Valproate'],
    ]);
  });
});
