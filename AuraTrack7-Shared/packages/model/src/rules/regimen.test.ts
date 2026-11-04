import { describe, expect, it } from 'vitest';
import { doseLogFixture, ids, medicationFixture } from '../schemas/fixtures';
import type { MedicationChange } from '../schemas';
import { newId } from '../ids';
import {
  changesForMedication,
  defaultScheduledTimes,
  diffRegimen,
  regimenAt,
  regimenSnapshot,
  slotDose,
} from './regimen';

const DAY = 86_400_000;
const day0 = new Date(2026, 2, 1).getTime();
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
  recordedAt: day0 + 10 * DAY,
  from: regimenSnapshot(med),
  to: regimenSnapshot({ ...med, dose: 750 }),
});
const current = { ...med, dose: 750 };

describe('regimen history', () => {
  it('gives the regimen in force at each moment', () => {
    expect(regimenAt(current, [started, raised], day0 - 1)).toBeNull();
    expect(regimenAt(current, [started, raised], day0 + DAY)?.dose).toBe(500);
    expect(regimenAt(current, [started, raised], day0 + 11 * DAY)?.dose).toBe(750);
  });

  it('shows nothing after the medication was stopped', () => {
    const stopped = change({
      type: 'stopped',
      effectiveAt: day0 + 20 * DAY,
      recordedAt: day0 + 20 * DAY,
      from: raised.to,
      to: null,
    });
    expect(regimenAt({ ...current, active: false }, [started, raised, stopped], day0 + 21 * DAY)).toBeNull();
  });

  it('a medication that has been stopped shows nothing now', () => {
    expect(regimenAt({ ...current, active: false }, [started, raised], day0 + 30 * DAY)).toBeNull();
  });

  it('without change records, falls back to the medication itself', () => {
    expect(regimenAt(med, [], day0 + DAY)?.dose).toBe(500);
    expect(regimenAt(med, [], day0 - DAY)).toBeNull();
    expect(regimenAt({ ...med, active: false }, [], day0 + DAY)).toBeNull();
    expect(regimenAt({ ...med, startedAt: null }, [], 0)?.dose).toBe(500);
  });

  it('before a first change with no "started" on file, the medication was already on the "from" regimen', () => {
    expect(regimenAt(current, [raised], day0 + DAY)?.dose).toBe(500);
    expect(regimenAt({ ...current, startedAt: day0 + 5 * DAY }, [raised], day0 + DAY)).toBeNull();
  });

  it('keeps the regimen of an older change when a later one is not the newest', () => {
    const lowered = change({
      effectiveAt: day0 + 20 * DAY,
      recordedAt: day0 + 20 * DAY,
      from: raised.to,
      to: regimenSnapshot({ ...med, dose: 250 }),
    });
    expect(regimenAt({ ...med, dose: 250 }, [started, raised, lowered], day0 + 15 * DAY)?.dose).toBe(750);
  });

  it('a change with no "to" falls back to the live record', () => {
    const odd = change({ effectiveAt: day0 + 5 * DAY, to: null });
    const later = change({ effectiveAt: day0 + 9 * DAY });
    expect(regimenAt(med, [started, odd, later], day0 + 6 * DAY)?.dose).toBe(500);
  });

  it('orders changes by effect, then by when they were recorded, and only for that medication', () => {
    const a = change({ effectiveAt: 5, recordedAt: 9 });
    const b = change({ effectiveAt: 5, recordedAt: 2 });
    const other = change({ effectiveAt: 1, medicationId: newId() });
    expect(changesForMedication(med, [a, b, other])).toEqual([b, a]);
  });
});

describe('regimen differences', () => {
  it('ignores ingredient capitalisation and reports per-slot dose changes', () => {
    const from = regimenSnapshot(med);
    expect(diffRegimen(from, { ...from, activeIngredient: 'levetiracetam' })).toEqual([]);
    const to = { ...from, slotDoses: { '20:00': 1000 } };
    expect(diffRegimen(from, to)).toEqual(['slotDose:20:00']);
    expect(slotDose(to, '20:00')).toBe(1000);
    expect(slotDose(to, '08:00')).toBe(500);
    expect(slotDose(to, null)).toBe(500);
    expect(slotDose(null, '08:00')).toBeUndefined();
  });

  it('reports each kind of change', () => {
    const from = regimenSnapshot(med);
    expect(diffRegimen(from, { ...from, name: 'Keppra', form: 'liquid', unit: 'ml' })).toEqual([
      'name',
      'form',
      'unit',
    ]);
    expect(diffRegimen(from, { ...from, frequency: 'TDS', scheduledTimes: ['08:00', '14:00', '20:00'] })).toEqual([
      'frequency',
      'scheduledTimes',
    ]);
    expect(diffRegimen(from, { ...from, scheduledDays: [1, 3] })).toEqual(['scheduledDays']);
    const prn = { ...from, frequency: 'PRN' as const, scheduledTimes: [], dose: 10 };
    expect(diffRegimen({ ...prn, dose: 5 }, prn)).toEqual(['dose']);
    expect(diffRegimen(from, { ...from, scheduledTimes: ['09:00', '21:00'] })).toEqual(
      ['dose'].filter(() => false).concat(['scheduledTimes']),
    );
  });

  it('knows the usual times for each frequency', () => {
    expect(defaultScheduledTimes('BD')).toEqual(['08:00', '20:00']);
    expect(defaultScheduledTimes('PRN')).toEqual([]);
  });

  it('a snapshot of a bare medication fills in defaults', () => {
    const snap = regimenSnapshot({ name: 'X', frequency: 'OD', dose: 5, unit: 'mg' });
    expect(snap).toMatchObject({
      activeIngredient: '',
      form: '',
      scheduledTimes: ['08:00'],
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      slotDoses: {},
    });
  });
});

it('fixtures stay valid', () => {
  expect(doseLogFixture(med.id).medicationId).toBe(med.id);
});
