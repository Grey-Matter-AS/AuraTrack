import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Store } from '../store';
import { compareImport } from './compare';
import { import6x } from './import';
import { encryptedFile, type Row } from './legacy.fixture';
import { TEST_PIN_KDF } from '../crypto';

// A deliberately messy 6.1 backup: the oddly shaped, partly filled records that years of real use can leave behind.
// Nothing may be lost or crash; whatever cannot be mapped is kept, listed or rejected with a reason.

let n = 0;
const newStore = () => Store.create(`messy-${Date.now()}-${n++}`, { pin: '2468' }, { pinKdf: TEST_PIN_KDF });
const T = new Date(2026, 5, 10, 9, 0).getTime();
const TZ = 'Europe/Oslo';

const messy = (): Row => ({
  schema: 'auratrack.backup',
  data: {
    settings: [
      { key: 'personName', value: '   ' },
      { key: 'dateOfBirth', value: 'someday' },
      { key: 'emergencyContact', value: 7 },
      { key: 'theme', value: 'dark' },
      { key: 'x'.repeat(100), value: 1 },
      { key: 'noValue' },
      { key: 'someList', value: [1, { a: 2 }] },
    ],
    events: [
      // no type, no symptoms, no uuid, stop only
      { startTime: T, duration: 30 },
      // symptoms in every shape
      {
        uuid: 'e-sym',
        startTime: T + 60_000,
        duration: 60,
        type: 'Uncategorized',
        symptoms: [
          { symptom: 'Eyes', detail: '', region: 'Head & Face', subRegion: 'Eyes', specificPart: 'Left Eye' }, // group only, area partly on the map
          { symptom: '', detail: 'Rapid Blinking' }, // option only
          { symptom: 'Racing Heart' }, // wizard label used as group
          {}, // empty: skipped
          'junk',
          { symptom: 'Odd', detail: 'Odd', region: 'Moon', subRegion: 'Crater', specificPart: 'x' }, // not on the map, not in the wizard
          { symptom: 'Arms', detail: 'Wobble', region: 'Arms', subRegion: 'Left Arm', specificPart: 'Elbow room' }, // area: part not on the map
          { symptom: 'Arms', detail: 'Wobble', region: 'Arms', subRegion: 'Elsewhere' }, // sub-region not on the map
        ],
        triggers: ['Stress', 'Stress', '', 5, 'Late night', 'late night'],
        postIctal: {
          findings: [
            'weakness', // a key
            'Headache', // an English label
            'Sleepiness', // old name
            'Odd thing', // own words
            {
              key: 'numbness',
              locations: [
                { region: 'Arms', subRegion: 'Left Arm', specificPart: 'Wrist' },
                { region: 'Arms', subRegion: 'Left Arm', specificPart: 'Wrist' },
              ],
            },
            { key: 'numbness', locations: [{ region: 'Arms', subRegion: 'Left Arm', specificPart: 'Wrist' }, 'junk'] }, // same finding again: areas are merged
            { key: 'custom', label: 'Hungry' },
            { key: 'custom', label: '' },
            { key: 'not_a_key', label: 'Mystery' },
            { key: 'not_a_key' },
            42,
          ],
          paralysisLocations: [{ region: 'Legs', subRegion: 'Left Leg', specificPart: 'Foot/Toes' }],
          recoveryMinutes: -5,
          recoveryOngoing: true,
        },
        eegSessionUuid: 'eeg-1',
        userModeAtTime: 'self',
      },
      { uuid: 'e-bad', duration: 4 }, // no start
      { uuid: 'e-str', startTime: 'yesterday' }, // start is not a number
      {
        uuid: 'e-late',
        startTime: T + 5 * 60_000,
        duration: 20,
        laps: { seizure: T + 6 * 60_000, recovery: T + 9 * 60_000 },
        manualDurations: { total: 20 },
      }, // laps without an aura lap
    ],
    medications: [
      {
        id: 7,
        uuid: 'm-1',
        name: 'Alpha',
        frequency: 'BD',
        dose: 5,
        unit: 'mg',
        scheduledTimes: ['08:00', '25:00', 'x'],
        scheduledDays: [1, 9, 'a'],
        slotDoses: { '08:00': 7, bad: 1, '20:00': -1 },
        active: true,
      },
      { uuid: 'm-2', name: 'Beta', frequency: 'PRN', dose: -3, stoppedAt: T, active: true, isRescue: false },
      { id: 9, name: 'Gamma', frequency: 'OD', dose: 1 }, // no uuid: found by its number
      { uuid: 'm-3', name: 'Delta', frequency: 'WEEKLY' }, // not a frequency
    ],
    medicationChanges: [
      {
        uuid: 'c-1',
        medicationId: 7,
        medicationName: 'Alpha',
        type: 'started',
        effectiveAt: T,
        from: null,
        to: {
          name: 'Alpha',
          frequency: 'BD',
          dose: 5,
          unit: 'mg',
          scheduledTimes: ['08:00'],
          scheduledDays: [0],
          slotDoses: { '08:00': 7 },
        },
      },
      { uuid: 'c-2', medicationUuid: 'm-1', medicationName: 'Alpha', type: 'changed', recordedAt: 5 }, // no effective date
      {
        uuid: 'c-3',
        medicationUuid: 'm-1',
        medicationName: 'Alpha',
        type: 'changed',
        effectiveAt: T,
        from: 'junk',
        to: { dose: 'lots' },
      },
      { uuid: 'c-4', medicationUuid: 'm-1', type: 'sideways', effectiveAt: T }, // not a type
    ],
    medicationLogs: [
      {
        uuid: 'l-1',
        medicationUuid: 'm-1',
        takenAt: T,
        scheduledTime: 'later',
        status: 'weird',
        doseSnapshot: 'x',
        note: 5,
      },
      { uuid: 'l-2', medicationId: 9, takenAt: T }, // found by number
      { uuid: 'l-3', medicationId: 77, takenAt: T }, // no such medication
      { uuid: 'l-4', medicationUuid: 'm-1' }, // no time
    ],
    wellbeingEntries: [
      {
        uuid: 'w-1',
        recordedAt: T,
        primaryMood: 'Happy',
        intensity: 9,
        dayKey: '2026-06-10',
        factors: {
          sleepQuality: { value: 3 },
          odd: { label: '', value: true },
          text: { label: 'Note', value: 'words' },
          none: { value: null },
          empty: { value: '' },
          nope: 5,
        },
      },
      { uuid: 'w-2', recordedAt: T, primaryMood: 'Happy', intensity: 'x', dayKey: '2026-06-10' }, // bad intensity: made 1
      { uuid: 'w-3', recordedAt: T, primaryMood: 'Happy', dayKey: 'not a day' }, // not valid
    ],
    eegSessions: [
      { uuid: 'eeg-1', startTime: T, status: 'ACTIVE', durationPreset: 5, title: 5, customHours: 3 },
      { uuid: 'eeg-2', status: 'ACTIVE' }, // no start
    ],
    eegActivities: [
      {
        uuid: 'a-1',
        sessionUuid: 'eeg-1',
        kind: 'ACTIVITY',
        activityLabel: 'Juggling',
        moodLabel: 'Giddy',
        startTime: T,
        durationSec: -5,
      },
      {
        uuid: 'a-2',
        sessionUuid: 'eeg-1',
        kind: 'SEIZURE_REFERENCE',
        activityLabel: 'Gelastic',
        startTime: T,
        linkedEventUuid: 'e-sym',
      },
      { uuid: 'a-3', sessionUuid: 'eeg-1', kind: 'ACTIVITY', startTime: T }, // no label at all
      { uuid: 'a-4', sessionUuid: 'eeg-1', startTime: T, activityLabel: 'Reading', moodLabel: 'Calm' },
      { uuid: 'a-5', sessionUuid: 'eeg-1' }, // no start
    ],
    tombstones: [
      { uuid: 'gone-1', table: 'medicationLogs', deletedAt: 1 },
      { uuid: 'gone-2', table: 'eegSessions', deletedAt: 1 },
      { uuid: 'gone-3', table: 'eegActivities', deletedAt: 1 },
      { uuid: 'gone-4', table: 'wellbeingEntries', deletedAt: 1 },
      { uuid: '', table: 'events', deletedAt: 1 },
      { uuid: 'x', table: 'events' },
    ],
  },
});

describe('a messy 6.1 backup', () => {
  it('imports what it can, rejects the rest with reasons, and loses nothing', async () => {
    const store = await newStore();
    const { report, legacy } = await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    expect(report.unaccounted).toBe(0);
    const rejected = report.patients[0]!.rejected.map((r) => `${r.table}: ${r.reason}`);
    expect(rejected).toEqual(
      expect.arrayContaining([
        'events: no start time',
        'medicationChanges: no effective date',
        'medicationLogs: no time',
        'medicationLogs: its medication is not in the backup',
        'eegSessions: no start time',
        'eegActivities: no start time',
        'tombstones: not a valid deletion',
      ]),
    );
    expect(rejected.some((r) => r.startsWith('medications: frequency'))).toBe(true);
    expect(rejected.some((r) => r.startsWith('wellbeingEntries: dayKey'))).toBe(true);
    expect(rejected.some((r) => r.startsWith('medicationChanges: type'))).toBe(true);
    expect(store.incomplete()).toEqual([]);
    // the comparison still runs, and counts only what was accepted
    const comparison = await compareImport(store, legacy, report);
    expect(comparison.rows.some((r) => r.metric.startsWith('rows rejected'))).toBe(true);
    expect(comparison.allMatch).toBe(true);
  });

  it('settings: a blank name falls back, a bad birth date is dropped, lists are kept', async () => {
    const store = await newStore();
    await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    expect(store.list('patient')[0]).toMatchObject({ name: 'Patient', dateOfBirth: null, emergencyContact: '' });
    const settings = Object.fromEntries(store.list('setting').map((s) => [s.key, s.value]));
    expect(settings.someList).toEqual([1, { a: 2 }]);
    expect(settings.theme).toBe('dark');
    expect('x'.repeat(100) in settings).toBe(false);
  });

  it('symptoms, triggers and findings of every shape', async () => {
    const store = await newStore();
    const { report } = await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    const sym = store.list('seizure').find((s) => s.symptoms.length > 3)!;
    expect(sym.typeCode).toBeNull();
    expect(sym.notes).toBe('');
    expect(sym.recordedBy).toBe('self');
    expect(sym.recoveryMinutes).toBeNull();
    expect(sym.recoveryOngoing).toBe(true);
    expect(sym.triggerCodes).toHaveLength(2); // Stress, and one own trigger for both spellings of "late night"
    expect(sym.symptoms.map((x) => x.code)).toEqual(
      expect.arrayContaining(['symptom.eyes.rapid_blinking', 'symptom.stomach_and_chest.racing_heart']),
    );
    const numbness = sym.afterFindings.find((f) => f.code === 'after.numbness')!;
    expect(numbness.areas).toHaveLength(1); // the same place twice counts once
    expect(sym.afterFindings.map((f) => f.code)).toEqual(
      expect.arrayContaining(['after.weakness', 'after.headache', 'after.drowsy', 'after.paralysis', 'after.custom']),
    );
    const kinds = new Set(report.review.map((r) => r.kind));
    expect(kinds).toEqual(
      new Set(['symptom', 'trigger', 'finding', 'body_area', 'mood', 'factor', 'factor_value', 'activity']),
    );
    expect(report.review.find((r) => r.kind === 'trigger' && r.text === 'Late night')?.count).toBe(2);
  });

  it('seizure timing without an aura lap follows 6.1: the stop ends the seizure', async () => {
    const store = await newStore();
    await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    const late = store.list('seizure').find((s) => s.phases.start.at === T + 5 * 60_000)!;
    expect(late.phases.auraEnd).toBeNull();
    expect(late.phases.seizureEnd?.at).toBe(T + 5 * 60_000 + 20_000);
  });

  it('medications: bad times, days and doses are cleaned, not copied; links by number work', async () => {
    const store = await newStore();
    await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    const alpha = store.list('medication').find((m) => m.name === 'Alpha')!;
    expect(alpha).toMatchObject({ scheduledTimes: ['08:00'], scheduledDays: [1], slotDoses: { '08:00': 7 } });
    const beta = store.list('medication').find((m) => m.name === 'Beta')!;
    expect(beta).toMatchObject({ dose: null, isRescue: true, stoppedAt: T });
    const gamma = store.list('medication').find((m) => m.name === 'Gamma')!;
    expect(store.list('doseLog').some((l) => l.medicationId === gamma.id)).toBe(true);
    expect(store.list('medicationChange').some((c) => c.medicationId === alpha.id && c.type === 'started')).toBe(true);
    // a dose with an unknown status is rejected, not guessed to be "taken"; a missing slot time stays missing
    expect(store.list('doseLog').filter((l) => l.medicationId === alpha.id)).toEqual([]);
    expect(store.list('doseLog').find((l) => l.medicationId === gamma.id)).toMatchObject({
      scheduledTime: null,
      status: 'taken',
    });
  });

  it('wellbeing and EEG: unknown moods, activities and factor values are kept as own codes', async () => {
    const store = await newStore();
    await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    const entry = store.list('wellbeingEntry').find((w) => Object.keys(w.factors).length > 1)!;
    expect(entry.intensity).toBe(3);
    expect(Object.values(entry.factors)).toEqual(expect.arrayContaining([3, true]));
    expect(store.list('wellbeingEntry').some((w) => w.intensity === 1)).toBe(true);
    const session = store.list('eegSession')[0]!;
    expect(session).toMatchObject({ status: 'active', durationPreset: '24h', title: '' });
    const activities = store.list('eegActivity');
    expect(
      activities.find((a) => a.durationSec === null && a.kind === 'activity' && a.activityCode?.startsWith('custom.')),
    ).toBeTruthy();
    expect(activities.find((a) => a.kind === 'seizure_reference')).toMatchObject({ activityCode: null });
    expect(activities.some((a) => a.activityCode === 'activity.reading' && a.moodCode === 'mood.calm')).toBe(true);
    expect(activities.some((a) => a.kind === 'activity' && a.activityCode === null)).toBe(true);
    expect(store.list('customCode').length).toBeGreaterThan(3);
  });

  it('all kinds of deletion are kept as deletions', async () => {
    const store = await newStore();
    await import6x(store, JSON.stringify(messy()), { timeZone: TZ });
    const gone = store
      .allVersioned()
      .filter((r) => r.deletedAt !== null)
      .map((r) => r.type)
      .sort();
    expect(gone).toEqual(['doseLog', 'eegActivity', 'eegSession', 'wellbeingEntry']);
  });

  it('an encrypted file that holds nothing of use is refused cleanly', async () => {
    const store = await newStore();
    await expect(
      import6x(store, await encryptedFile({ hello: 1 }, 'secret words'), { passphrase: 'secret words' }),
    ).rejects.toMatchObject({ name: 'Legacy6xFormatError' });
  });

  it('an encrypted file with a missing key block is just a wrong passphrase', async () => {
    const store = await newStore();
    await expect(
      import6x(store, JSON.stringify({ schema: 'auratrack.encrypted-backup' }), { passphrase: 'x' }),
    ).rejects.toMatchObject({ name: 'DecryptError' });
  });

  it('an all-patients file whose profile list does not name a patient still imports it', async () => {
    const store = await newStore();
    const file = JSON.stringify({
      schema: 'auratrack.household-backup',
      profiles: [{ id: 'other' }],
      patients: { p9: { events: [{ startTime: T, duration: 3 }] } },
    });
    const { report } = await import6x(store, file, { timeZone: TZ });
    expect(report.patients[0]?.name).toBe('');
    expect(store.list('patient')[0]?.name).toBe('Patient');
    expect(store.list('seizure')).toHaveLength(1);
  });

  it('the comparison copes with a patient that has no name, and with no import report', async () => {
    const store = await newStore();
    const { legacy } = await import6x(
      store,
      JSON.stringify({
        events: [
          { uuid: 'a', startTime: T, duration: 3 },
          { uuid: 'b', startTime: 'x' },
        ],
      }),
      { timeZone: TZ },
    );
    const comparison = await compareImport(store, legacy);
    expect(comparison.rows[0]?.patient).toBe('patient');
    expect(comparison.allMatch).toBe(false); // without the import report the rejected row is counted against 6.1
    const named = await compareImport(store, {
      ...legacy,
      patients: legacy.patients.map((p) => ({ ...p, profileId: 'p1' })),
    });
    expect(named.rows[0]?.patient).toBe('p1');
  });
});
