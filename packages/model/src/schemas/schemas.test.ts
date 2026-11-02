import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { encodeHlc } from '../hlc';
import {
  doseLogFixture,
  ids,
  interictalFixture,
  medicationFixture,
  seizureFixture,
  symptomSetFixture,
} from './fixtures';
import {
  APPEND_ONLY_TYPES,
  ChangeLogEntrySchema,
  ClockTimeSchema,
  CodeSchema,
  DeviceSchema,
  HouseholdSchema,
  MERGE_RULES,
  PatientSchema,
  emergencyContactLine,
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
  InterictalEventSchema,
  LOCKED_ALERT_CONTENT,
  SETTING_DEFS,
  SETTING_KEYS,
  SymptomSetSchema,
  settingValue,
} from './index';

const base = () => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1,
});

describe('emergencyContactLine', () => {
  it('joins the name and the phone, or gives whichever there is', () => {
    expect(emergencyContactLine({ emergencyContact: 'Sam', emergencyPhone: '555' })).toBe('Sam, 555');
    expect(emergencyContactLine({ emergencyContact: 'Sam' })).toBe('Sam');
    expect(emergencyContactLine({ emergencyContact: '', emergencyPhone: '555' })).toBe('555');
    expect(emergencyContactLine({ emergencyContact: '' })).toBe('');
  });
  it('a person saved before the phone field existed is still valid', () => {
    const old = { ...base(), name: 'A', dateOfBirth: null, emergencyContact: 'Sam 555', color: 'blue' };
    expect(PatientSchema.safeParse(old).success).toBe(true);
  });
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

describe('added in 7.0.3: phases on symptoms, prodrome hours, between-seizures events, symptom sets', () => {
  const symptom = (over: object = {}) => ({
    id: newId(),
    code: 'symptom.big_shaking_jerking.rhythmic_shaking',
    area: null,
    moment: 0,
    order: 0,
    sincePrevious: { kind: 'exact', ms: 0 },
    isFirst: true,
    ...over,
  });

  it('a seizure written before 7.0.3 (no phase, no prodrome hours) is still valid and unchanged when parsed', () => {
    const old = seizureFixture({ symptoms: [symptom()] as never });
    const parsed = SeizureSchema.parse(old);
    expect(parsed).toEqual(old);
    expect('phase' in parsed.symptoms[0]!).toBe(false);
    expect('prodromeSecondsBefore' in parsed).toBe(false);
  });

  it('accepts a phase on a symptom and the warning-sign time, and refuses anything else', () => {
    for (const phase of ['before', 'during', 'after']) {
      expect(SeizureSchema.safeParse(seizureFixture({ symptoms: [symptom({ phase })] as never })).success).toBe(true);
    }
    expect(SeizureSchema.safeParse(seizureFixture({ symptoms: [symptom({ phase: 'later' })] as never })).success).toBe(
      false,
    );
    const prodrome = (value: number | null) =>
      SeizureSchema.safeParse({ ...seizureFixture(), prodromeSecondsBefore: value }).success;
    expect(prodrome(5)).toBe(true); // a few seconds' warning
    expect(prodrome(90 * 60)).toBe(true); // an hour and a half
    expect(prodrome(7 * 24 * 3600)).toBe(true); // the longest: a week
    expect(prodrome(null)).toBe(true);
    expect(prodrome(0)).toBe(true);
    expect(prodrome(-1)).toBe(false);
    expect(prodrome(7 * 24 * 3600 + 1)).toBe(false);
    expect(prodrome(2.5)).toBe(false); // whole seconds
  });

  it('between-seizures events hold one symptom code, a time, an optional body area and a note', () => {
    expect(InterictalEventSchema.safeParse(interictalFixture()).success).toBe(true);
    const area = { region: 'body.head_and_face', subRegion: null, part: null };
    expect(InterictalEventSchema.safeParse(interictalFixture({ area })).success).toBe(true);
    expect(InterictalEventSchema.safeParse({ ...interictalFixture(), symptomCode: 'Headache' }).success).toBe(false);
    expect(InterictalEventSchema.safeParse({ ...interictalFixture(), occurredAt: -1 }).success).toBe(false);
    expect(InterictalEventSchema.safeParse({ ...interictalFixture(), recordedBy: 'nurse' }).success).toBe(false);
  });

  it('a symptom set has at least one item, each with a phase, and may be for every seizure type', () => {
    expect(SymptomSetSchema.safeParse(symptomSetFixture()).success).toBe(true);
    expect(SymptomSetSchema.safeParse(symptomSetFixture({ seizureTypeCode: null, name: 'Usual start' })).success).toBe(
      true,
    );
    expect(SymptomSetSchema.safeParse(symptomSetFixture({ items: [] })).success).toBe(false);
    expect(
      SymptomSetSchema.safeParse(symptomSetFixture({ items: [{ code: 'symptom.x', phase: 'meanwhile' }] as never }))
        .success,
    ).toBe(false);
    expect(
      SymptomSetSchema.safeParse(
        symptomSetFixture({
          items: Array.from({ length: 41 }, () => ({ code: 'symptom.x', phase: 'during' as const })),
        }),
      ).success,
    ).toBe(false);
  });

  it('both new record types are in the registry, merged field by field (no special rule, not append-only)', () => {
    expect(RECORD_TYPES).toEqual(expect.arrayContaining(['interictalEvent', 'symptomSet']));
    expect(APPEND_ONLY_TYPES).not.toContain('interictalEvent');
    expect(MERGE_RULES.interictalEvent).toBeUndefined();
    expect(MERGE_RULES.symptomSet).toBeUndefined();
  });
});

describe('setting keys', () => {
  it('every key has a scope and a default that its own schema accepts', () => {
    for (const key of SETTING_KEYS) {
      const def = SETTING_DEFS[key];
      expect(['device', 'patient', 'household']).toContain(def.scope);
      expect(def.schema.safeParse(def.default).success).toBe(true);
      expect(SettingSchema.safeParse({ ...base(), scope: def.scope, key, value: def.default }).success).toBe(true);
    }
  });

  it('gives the stored value when it is valid and the default when it is missing or wrong', () => {
    expect(settingValue('wakeLock', undefined)).toBe(true);
    expect(settingValue('wakeLock', false)).toBe(false);
    expect(settingValue('wakeLock', 'yes')).toBe(true);
    expect(settingValue('symptomStrip', undefined)).toBe(false);
    expect(settingValue('autoLockSeconds', 300)).toBe(300);
    expect(settingValue('autoLockSeconds', -5)).toBe(60);
    expect(settingValue('autoLockSeconds', 1.5)).toBe(60);
    expect(settingValue('autoLockSeconds', 3601)).toBe(60);
    expect(settingValue('quickNoteLabels', ['FELL', 'BLUE'])).toEqual(['FELL', 'BLUE']);
    expect(settingValue('quickNoteLabels', Array(9).fill('x'))).toEqual([]);
  });

  it('what the locked alert shows defaults to the rescue medication and contacts, as decided (README 6)', () => {
    expect(settingValue('lockedAlertContent', undefined)).toBe('rescue_and_contacts');
    expect(settingValue('lockedAlertContent', 'nothing')).toBe('nothing');
    expect(settingValue('lockedAlertContent', 'everything')).toBe('rescue_and_contacts');
    expect(LOCKED_ALERT_CONTENT).toEqual(['nothing', 'rescue', 'rescue_and_contacts']);
  });
});
