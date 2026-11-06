import { LANGUAGES } from '@auratrack/i18n';
import { LANGUAGE_CODES, newId, type Setting } from '@auratrack/model';
import { ids, seizureFixture } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { resolveSettings, settingRecord, usualSymptoms } from './settings';

const setting = (key: string, value: unknown, over: Partial<Setting> = {}): Setting => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1,
  scope: 'device',
  key,
  value: value as never,
  ...over,
});

describe('the language list', () => {
  it('is the same in the model and in the words package', () => {
    expect([...LANGUAGE_CODES]).toEqual([...LANGUAGES]);
  });
});

describe('resolving settings', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(resolveSettings([], null)).toMatchObject({
      wakeLock: true,
      symptomStrip: false,
      lockedStart: true,
      lockedShowName: false,
      alertSound: false,
      recordingHaptics: true,
      recordedBy: 'carer',
      language: 'en',
      plan: { alertMinutes: 5, clusterMinCount: 3, clusterWindowMinutes: 8 },
    });
  });

  it('takes the newest valid value, and ignores a wrong one', () => {
    const records = [
      setting('wakeLock', true, { createdAt: 1 }),
      setting('wakeLock', false, { createdAt: 5 }),
      setting('alertSound', 'loud'),
    ];
    const resolved = resolveSettings(records, ids.patient);
    expect(resolved.wakeLock).toBe(false);
    expect(resolved.alertSound).toBe(false);
  });

  it('keeps a patient setting to its own patient', () => {
    const other = newId();
    const records = [
      setting('recordedBy', 'self', { scope: 'patient', patientId: other }),
      setting('symptomStrip', true, { scope: 'patient' }),
    ];
    expect(resolveSettings(records, ids.patient)).toMatchObject({ recordedBy: 'carer', symptomStrip: true });
    expect(resolveSettings(records, other).recordedBy).toBe('self');
  });

  it('reads the emergency plan wherever it is kept, and keeps it within its limits', () => {
    const records = [
      setting('emergencyAlertMinutes', 3, { scope: 'patient' }),
      setting('clusterMinCount', 99, { scope: 'household' }),
    ];
    expect(resolveSettings(records, ids.patient).plan).toMatchObject({ alertMinutes: 3, clusterMinCount: 20 });
  });

  it('finds the record to change for a setting', () => {
    const records = [setting('wakeLock', true), setting('wakeLock', false, { createdAt: 9 })];
    expect(settingRecord(records, 'wakeLock', ids.patient)?.createdAt).toBe(9);
    expect(settingRecord(records, 'alertSound', ids.patient)).toBeUndefined();
  });
});

describe('the symptom strip choices', () => {
  const entry = (code: string, phase?: 'prodrome' | 'aura' | 'seizure' | 'recovery') => ({
    id: newId(),
    code,
    area: null,
    moment: 0,
    order: 0,
    sincePrevious: { kind: 'unknown' as const, ms: null },
    isFirst: false,
    ...(phase ? { phase } : {}),
  });

  it('lists the symptoms seen most often during seizures, most common first, up to the count', () => {
    const seizures = [
      seizureFixture({ symptoms: [entry('symptom.a', 'seizure'), entry('symptom.b', 'seizure')] }),
      seizureFixture({ symptoms: [entry('symptom.b'), entry('symptom.c', 'aura')] }),
      seizureFixture({ symptoms: [entry('symptom.b', 'seizure'), entry('symptom.a', 'seizure')] }),
    ];
    expect(usualSymptoms(seizures)).toEqual(['symptom.b', 'symptom.a']);
    expect(usualSymptoms(seizures, 1)).toEqual(['symptom.b']);
    expect(usualSymptoms([])).toEqual([]);
  });

  it('breaks a tie by code, so the strip does not shuffle', () => {
    const seizures = [seizureFixture({ symptoms: [entry('symptom.z', 'seizure'), entry('symptom.m', 'seizure')] })];
    expect(usualSymptoms(seizures)).toEqual(['symptom.m', 'symptom.z']);
  });
});
