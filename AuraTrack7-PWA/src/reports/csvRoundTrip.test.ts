import 'fake-indexeddb/auto';
import { labelText } from '@auratrack/i18n';
import { newId, planMedicationChange, type Medication, type Seizure } from '@auratrack/model';
import { buildCsv } from '@auratrack/reports';
import { Store, TEST_PIN_KDF, importCsv } from '@auratrack/store';
import { describe, expect, it } from 'vitest';

// The export and the import are one format: records exported to CSV and brought into an empty app come back the same.
// Words are written in Norwegian, so the import has to read the codes, not the words.

let counter = 0;
const S = 1000;
const at = (y: number, m: number, d: number, h: number, mi: number) => new Date(y, m - 1, d, h, mi).getTime();

async function store(patientId: string) {
  const s = await Store.create(`roundtrip-${Date.now()}-${counter++}`, { pin: '2468' }, { pinKdf: TEST_PIN_KDF });
  await s.create('patient', { id: patientId, patientId, name: 'Alex', dateOfBirth: null, emergencyContact: '', color: '#336699' });
  return s;
}

describe('CSV export, then import', () => {
  it('brings every kind of record back as it was', async () => {
    const patientId = newId();
    const from = await store(patientId);
    const start = at(2026, 10, 5, 14, 5);
    const area = { region: 'body.head_and_face', subRegion: 'body.head_and_face.eyes', part: null };
    const seizure = (await from.create('seizure', {
      patientId,
      timeZone: 'Europe/Oslo',
      phases: {
        start: { at: start, source: 'timed' },
        auraEnd: { at: start + 10 * S, source: 'timed' },
        seizureEnd: { at: start + 70 * S, source: 'timed' },
        recoveryEnd: { at: start + 300 * S, source: 'timed' },
      },
      status: 'complete',
      typeCode: 'seizure_type.absence',
      ilae: null,
      ilae2025: { class: 'unknown', recall: 'yes', responsive: 'unknown', bilateralTonicClonic: 'no', observable: 'yes', generalized: null },
      profile: { id: newId(), name: 'Usual seizure' },
      symptoms: [
        { id: newId(), code: 'symptom.small_twitching.muscle_flickering', area, moment: 0, order: 0, sincePrevious: { kind: 'unknown', ms: null }, isFirst: true, phase: 'during' },
      ],
      afterFindings: [{ code: 'after.confused', customLabel: null, areas: [area] }],
      prodromeSecondsBefore: 120,
      recoveryMinutes: 15,
      recoveryOngoing: false,
      triggerCodes: ['trigger.stress'],
      notes: 'Line one, "two"\nand three',
      video: null,
      isManualEntry: false,
      isEmergencyStop: false,
      recordedBy: 'self',
      eegSessionId: null,
    } as never)) as unknown as Seizure;
    await from.create('interictalEvent', {
      patientId, occurredAt: at(2026, 10, 4, 10, 0), timeZone: 'Europe/Oslo',
      symptomCode: 'symptom.small_twitching.muscle_flickering', area, notes: 'Morning', recordedBy: 'carer',
    } as never);
    // A medicine started, then raised, the way the Medicines screen does it
    const regimen = { name: 'Lamotrigine', activeIngredient: 'lamotrigine', form: 'tablet', dose: 100, unit: 'mg', slotDoses: {}, frequency: 'BD' as const, scheduledTimes: ['08:00', '20:00'], scheduledDays: [] };
    const flags = { isRescue: false, showInEmergency: false, reminderEnabled: true };
    const started = planMedicationChange({ patientId, before: null, next: { ...regimen, ...flags }, type: 'started', effectiveAt: at(2026, 1, 1, 8, 0), recordedAt: Date.now(), note: '' });
    if ('problem' in started || !('create' in started.medication)) throw new Error('not planned');
    const med = (await from.create('medication', started.medication.create as never)) as unknown as Medication;
    await from.create('medicationChange', { ...started.change, medicationId: med.id } as never);
    const raised = planMedicationChange({ patientId, before: med, next: { ...regimen, dose: 150, ...flags }, type: 'changed', effectiveAt: at(2026, 3, 1, 8, 0), recordedAt: Date.now(), note: 'Raised' });
    if ('problem' in raised || 'create' in raised.medication) throw new Error('not planned');
    await from.update('medication', med.id, raised.medication.patch as never);
    await from.create('medicationChange', raised.change as never);
    await from.create('doseLog', { patientId, medicationId: med.id, scheduledTime: '08:00', takenAt: at(2026, 10, 5, 8, 10), status: 'late', note: '', doseSnapshot: 150, unitSnapshot: 'mg' } as never);
    await from.create('wellbeingEntry', { patientId, recordedAt: at(2026, 10, 4, 21, 0), dayKey: '2026-10-04', moodCode: 'mood.happy', intensity: 2, factors: { 'factor.sleep_hours': 7.5 }, notes: '' } as never);
    const session = (await from.create('eegSession', { patientId, startTime: at(2026, 10, 5, 13, 0), plannedEndTime: null, actualEndTime: null, durationPreset: '24h', customHours: null, title: 'EEG', notes: '', status: 'completed' } as never)) as unknown as { id: string };
    await from.create('eegActivity', { patientId, sessionId: session.id, kind: 'seizure_reference', activityCode: 'seizure_type.absence', customText: '', moodCode: null, notes: '', startTime: start, endTime: null, durationSec: null, linkedSeizureId: seizure.id } as never);

    const list = <T>(s: Store, type: Parameters<Store['list']>[0]) => s.list(type) as unknown as T[];
    const text = buildCsv({
      seizures: from.list('seizure'),
      between: from.list('interictalEvent'),
      medications: from.list('medication'),
      doses: from.list('doseLog'),
      changes: from.list('medicationChange'),
      wellbeing: from.list('wellbeingEntry'),
      eegSessions: from.list('eegSession'),
      eegActivities: from.list('eegActivity'),
      from: at(2025, 1, 1, 0, 0),
      to: at(2027, 1, 1, 0, 0),
      label: (code) => labelText('nb', code),
    });

    const into = await store(patientId);
    const report = await importCsv(into, text, { patientId, dateOrder: 'dmy', timeZone: 'Europe/Oslo' });
    expect(report.problems).toEqual([]);
    expect(report.unaccounted).toBe(0);

    const back = list<Seizure>(into, 'seizure')[0]!;
    expect(back.id).toBe(seizure.id);
    expect(Object.values(back.phases).map((m) => m?.at ?? null)).toEqual(Object.values(seizure.phases).map((m) => m?.at ?? null));
    const keep = (s: Seizure) => ({
      typeCode: s.typeCode,
      ilae2025: s.ilae2025,
      symptoms: s.symptoms.map((x) => [x.code, x.area, x.phase]),
      afterFindings: s.afterFindings,
      triggerCodes: s.triggerCodes,
      prodromeSecondsBefore: s.prodromeSecondsBefore,
      recoveryMinutes: s.recoveryMinutes,
      notes: s.notes,
      recordedBy: s.recordedBy,
      status: s.status,
    });
    expect(keep(back)).toEqual(keep(seizure));
    // The profile's name is written for reading, but a spreadsheet cannot say which profile record it was
    expect(text).toContain('Usual seizure');
    expect(back.profile ?? null).toBeNull();

    const strip = <T extends object>(r: T) =>
      Object.fromEntries(
        Object.entries(r).filter(([key]) => !['id', 'householdId', 'deviceId', 'createdAt'].includes(key)),
      );
    expect(into.list('interictalEvent').map(strip)).toEqual(from.list('interictalEvent').map(strip));
    expect(into.list('wellbeingEntry').map(strip)).toEqual(from.list('wellbeingEntry').map(strip));
    expect(into.list('doseLog').map(strip)).toEqual(from.list('doseLog').map(strip));
    const regimenOf = (m: Medication) => ({ name: m.name, dose: m.dose, frequency: m.frequency, scheduledTimes: m.scheduledTimes, active: m.active, startedAt: m.startedAt });
    expect(into.list('medication').map(regimenOf)).toEqual(from.list('medication').map(regimenOf));
    const history = (s: Store) =>
      s.list('medicationChange').sort((a, b) => a.effectiveAt - b.effectiveAt).map((c) => [c.type, c.effectiveAt, c.from?.dose ?? null, c.to?.dose ?? null, c.note]);
    expect(history(into)).toEqual(history(from));
    expect(into.list('eegActivity')[0]).toMatchObject({ sessionId: session.id, linkedSeizureId: seizure.id, activityCode: 'seizure_type.absence' });

    // and the same file again adds nothing
    expect((await importCsv(into, text, { patientId, dateOrder: 'dmy' })).applied).toBe(0);
  });
});
