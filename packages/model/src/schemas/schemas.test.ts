import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { encodeHlc } from '../hlc';
import { doseLogFixture, ids, medicationFixture, seizureFixture } from './fixtures';
import {
  APPEND_ONLY_TYPES,
  ChangeLogEntrySchema,
  ClockTimeSchema,
  CodeSchema,
  DeviceSchema,
  HouseholdSchema,
  MERGE_RULES,
  PatientSchema,
  RECORD_SCHEMAS,
  RECORD_TYPES,
  SeizureSchema,
  SettingSchema,
  TombstoneSchema,
  WellbeingEntrySchema,
  EegActivitySchema,
  EegSessionSchema,
  CustomCodeSchema,
  MedicationChangeSchema,
  DoseLogSchema,
  MedicationSchema,
  CalendarDaySchema,
} from './index';

const base = () => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1,
});

describe('shared parts', () => {
  it('codes are lower-case and dotted, never free English text', () => {
    expect(CodeSchema.safeParse('trigger.stress').success).toBe(true);
    expect(CodeSchema.safeParse(`custom.${newId()}`).success).toBe(true);
    expect(CodeSchema.safeParse('Sleep deprivation').success).toBe(false);
    expect(CodeSchema.safeParse('').success).toBe(false);
  });

  it('clock times and calendar days have one written form', () => {
    expect(ClockTimeSchema.safeParse('08:00').success).toBe(true);
    expect(ClockTimeSchema.safeParse('24:00').success).toBe(false);
    expect(ClockTimeSchema.safeParse('8:00').success).toBe(false);
    expect(CalendarDaySchema.safeParse('2026-10-31').success).toBe(true);
    expect(CalendarDaySchema.safeParse('31/10/2026').success).toBe(false);
  });
});

describe('seizure', () => {
  it('accepts a complete record and keeps every field when parsed again', () => {
    const seizure = seizureFixture({
      ilae: {
        onset: 'focal',
        awareness: 'aware',
        motor: 'non_motor',
        feature: 'ilae.feature.sensory',
        spreadToBothSides: false,
      },
      symptoms: [
        {
          id: newId(),
          code: 'symptom.vision.flashing_lights_colors',
          area: { region: 'body.head_face', subRegion: 'body.head_face.eyes', part: null },
          moment: 0,
          order: 0,
          sincePrevious: { kind: 'unknown', ms: null },
          isFirst: true,
        },
      ],
      afterFindings: [
        {
          code: 'after.weakness',
          customLabel: null,
          areas: [{ region: 'body.arms', subRegion: 'body.arms.left_arm', part: null }],
        },
      ],
      triggerCodes: ['trigger.stress'],
      video: { fileName: 'clip.mp4' },
    });
    expect(SeizureSchema.parse(seizure)).toEqual(seizure);
  });

  it('refuses English text where a code belongs, and a missing start', () => {
    expect(SeizureSchema.safeParse(seizureFixture({ typeCode: 'Focal Aware' })).success).toBe(false);
    const noStart = {
      ...seizureFixture(),
      phases: { start: null, auraEnd: null, seizureEnd: null, recoveryEnd: null },
    };
    expect(SeizureSchema.safeParse(noStart).success).toBe(false);
  });

  it('refuses an unknown phase source or status', () => {
    const bad = seizureFixture();
    expect(
      SeizureSchema.safeParse({ ...bad, phases: { ...bad.phases, start: { at: 1, source: 'guessed' } } }).success,
    ).toBe(false);
    expect(SeizureSchema.safeParse({ ...bad, status: 'done' }).success).toBe(false);
  });
});

describe('medication', () => {
  it('accepts medications, doses and changes', () => {
    const med = medicationFixture();
    expect(MedicationSchema.parse(med)).toEqual(med);
    expect(DoseLogSchema.parse(doseLogFixture(med.id))).toBeTruthy();
    const regimen = { ...med, slotDoses: { '20:00': 750 } };
    const change = {
      ...base(),
      medicationId: med.id,
      medicationName: med.name,
      type: 'changed' as const,
      effectiveAt: 1,
      recordedAt: 2,
      from: { ...regimen, slotDoses: {} },
      to: regimen,
      changedFields: ['slotDose:20:00'],
      note: '',
      isBaseline: false,
    };
    expect(MedicationChangeSchema.safeParse(change).success).toBe(true);
  });

  it('refuses a bad frequency, time or status', () => {
    expect(MedicationSchema.safeParse(medicationFixture({ frequency: 'WEEKLY' as never })).success).toBe(false);
    expect(MedicationSchema.safeParse(medicationFixture({ scheduledTimes: ['25:00'] })).success).toBe(false);
    expect(DoseLogSchema.safeParse(doseLogFixture(newId(), { status: 'skipped' as never })).success).toBe(false);
  });
});

describe('the other records', () => {
  it('household, device and patient', () => {
    expect(HouseholdSchema.safeParse({ id: newId(), name: 'Home', createdAt: 1 }).success).toBe(true);
    expect(DeviceSchema.safeParse({ id: newId(), householdId: newId(), name: 'Phone', createdAt: 1 }).success).toBe(
      true,
    );
    expect(
      PatientSchema.safeParse({ ...base(), name: 'A', dateOfBirth: '1990-01-02', emergencyContact: '', color: 'blue' })
        .success,
    ).toBe(true);
    expect(
      PatientSchema.safeParse({ ...base(), name: 'A', dateOfBirth: '2 Jan 1990', emergencyContact: '', color: 'blue' })
        .success,
    ).toBe(false);
  });

  it('wellbeing keeps its factors by code', () => {
    const entry = {
      ...base(),
      recordedAt: 1,
      dayKey: '2026-10-31',
      moodCode: 'mood.calm',
      intensity: 2,
      factors: { 'factor.stress': 2, 'factor.missed_meal': true },
      notes: '',
    };
    expect(WellbeingEntrySchema.safeParse(entry).success).toBe(true);
    expect(WellbeingEntrySchema.safeParse({ ...entry, intensity: 4 }).success).toBe(false);
  });

  it('EEG session and activity', () => {
    const session = {
      ...base(),
      startTime: 1,
      plannedEndTime: 2,
      actualEndTime: null,
      durationPreset: '24h',
      customHours: null,
      title: 'Home',
      notes: '',
      status: 'active' as const,
    };
    expect(EegSessionSchema.safeParse(session).success).toBe(true);
    const activity = {
      ...base(),
      sessionId: session.id,
      kind: 'activity' as const,
      activityCode: 'activity.sleeping',
      customText: '',
      moodCode: null,
      notes: '',
      startTime: 1,
      endTime: null,
      durationSec: null,
      linkedSeizureId: null,
    };
    expect(EegActivitySchema.safeParse(activity).success).toBe(true);
    expect(EegActivitySchema.safeParse({ ...activity, kind: 'other' }).success).toBe(false);
  });

  it('settings, custom codes, change log and tombstones', () => {
    expect(SettingSchema.safeParse({ ...base(), scope: 'device', key: 'language', value: 'nb' }).success).toBe(true);
    expect(SettingSchema.safeParse({ ...base(), scope: 'everywhere', key: 'x', value: 1 }).success).toBe(false);
    expect(
      CustomCodeSchema.safeParse({
        ...base(),
        kind: 'symptom',
        code: `custom.${newId()}`,
        label: 'Humming',
        parentCode: null,
      }).success,
    ).toBe(true);
    const stamp = encodeHlc({ wall: 5, counter: 0, node: 'd' });
    const entry = {
      id: newId(),
      householdId: ids.household,
      patientId: null,
      deviceId: ids.device,
      stamp,
      at: 5,
      recordType: 'seizure',
      recordId: newId(),
      kind: 'update' as const,
      fields: { notes: 'x' },
    };
    expect(ChangeLogEntrySchema.safeParse(entry).success).toBe(true);
    expect(ChangeLogEntrySchema.safeParse({ ...entry, stamp: 'nope' }).success).toBe(false);
    expect(
      TombstoneSchema.safeParse({ recordType: 'seizure', recordId: newId(), deletedAt: stamp, deviceId: ids.device })
        .success,
    ).toBe(true);
  });
});

describe('record registry', () => {
  it('lists every type once, and its append-only and merge-rule entries name real types', () => {
    expect(RECORD_TYPES.sort()).toEqual(Object.keys(RECORD_SCHEMAS).sort());
    for (const type of APPEND_ONLY_TYPES) expect(RECORD_TYPES).toContain(type);
    for (const type of Object.keys(MERGE_RULES)) expect(RECORD_TYPES).toContain(type);
  });

  it('ranks dose status: taken, then late, then assumed, then missed', () => {
    expect(MERGE_RULES.doseLog?.status?.rank).toEqual(['taken', 'late', 'assumed', 'missed']);
  });
});
