import { toBase64Url } from '../bytes';

// Made-up 6.1 data for tests: the shapes 6.1 stores, with a seeded random generator so every run is the same.
// (Never real data. Real backups are only ever read on the user's own computer.)

export type Row = Record<string, unknown>;

export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = new Date(2026, 6, 1, 6, 0).getTime();
export const START = T0;

const SYMPTOMS = [
  {
    symptom: 'Eyes',
    detail: 'Rapid Blinking',
    region: 'Head & Face',
    subRegion: 'Eyes',
    specificPart: 'Right Eye',
    med: 'Eyelid myoclonia',
  },
  {
    symptom: 'Movement',
    detail: 'Jerking',
    region: 'Arms',
    subRegion: 'Left Arm',
    specificPart: 'Upper Arm',
    med: 'x',
  },
  {
    symptom: 'Stomach & Chest',
    detail: 'Racing Heart',
    region: 'Internal/General',
    subRegion: '',
    specificPart: '',
    med: 'Tachycardia',
  },
  {
    symptom: 'Eyes',
    detail: 'Staring',
    region: 'Head & Face',
    subRegion: 'Eyes',
    specificPart: 'Both Eyes',
    med: 'Behavioral arrest',
  }, // not in the wizard: kept as own symptom
  {
    symptom: 'Speech',
    detail: 'Unable to Speak',
    region: 'Head & Face',
    subRegion: 'Mouth',
    specificPart: '',
    med: 'Speech arrest',
  }, // wizard label is "Unable to speak"
];
const TRIGGERS = ['Stress', 'Poor sleep', 'Heat / Overheating', 'Skipped meal'];
const TYPES = ['Focal Aware', 'Focal Impaired', 'Tonic-Clonic', 'Absence', 'Aura Only'];

/** One 6.1 event of each timing kind: laps, manual durations, plain total, long. */
export function makeEvents(count: number, random = rng(1)): Row[] {
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
  return Array.from({ length: count }, (_, i) => {
    const startTime = T0 + i * 7 * 60 * MIN + Math.floor(random() * 30) * MIN;
    const duration = [30, 90, 200, 310, 420, 800][i % 6] as number;
    const kind = i % 4;
    const aura = Math.round(duration * 0.2);
    const seizure = Math.round(duration * 0.5);
    const base: Row = {
      uuid: `ev-${i}`,
      startTime,
      date: 'x',
      time: 'y',
      duration,
      type: pick(TYPES),
      symptoms: [pick(SYMPTOMS), pick(SYMPTOMS)],
      triggers: [pick(TRIGGERS)],
      notes: i % 5 === 0 ? 'a note' : '',
      isComplete: i % 3 !== 0,
      isEdited: i % 7 === 0,
      isManualEntry: i % 9 === 0,
      isEmergencyStop: duration >= 720,
      userModeAtTime: i % 2 ? 'CARETAKER' : 'SELF',
      videoAttached: i % 11 === 0,
      editLog: i % 7 === 0 ? [{ editedAt: startTime + 1000, changedFields: ['notes'] }] : [],
      postIctal:
        i % 2
          ? {
              findings: ['Sleepiness', 'Headache', 'Muscle soreness'],
              paralysisLocations: [{ region: 'Arms', subRegion: 'Left Arm', specificPart: 'Hand/Fingers' }],
            }
          : {
              findings: [
                { key: 'weakness', locations: [{ region: 'Legs', subRegion: 'Left Leg', specificPart: 'Knee' }] },
                { key: 'custom', label: 'Hungry' },
              ],
              recoveryMinutes: 30,
              recoveryOngoing: false,
            },
    };
    if (kind === 0)
      return {
        ...base,
        laps: {
          aura: startTime + aura * 1000,
          seizure: startTime + (aura + seizure) * 1000,
          recovery: startTime + duration * 1000,
        },
        manualDurations: { total: duration },
      };
    if (kind === 1)
      return {
        ...base,
        laps: {},
        manualDurations: { total: duration, aura, seizure, recovery: duration - aura - seizure },
      };
    if (kind === 2) return { ...base, laps: { aura: startTime + aura * 1000 }, manualDurations: { total: duration } }; // aura tapped, nothing after: stop ends the seizure
    return { ...base, laps: {}, manualDurations: { total: duration } };
  });
}

export function makeMedications(): { meds: Row[]; changes: Row[]; logs: Row[] } {
  const reg = (dose: number) => ({
    name: 'Levetiracetam',
    activeIngredient: 'Levetiracetam',
    form: 'tablet',
    dose,
    unit: 'mg',
    slotDoses: {},
    frequency: 'BD',
    scheduledTimes: ['08:00', '20:00'],
    scheduledDays: [0, 1, 2, 3, 4, 5, 6],
  });
  const meds: Row[] = [
    {
      uuid: 'med-lev',
      ...reg(750),
      isRescue: false,
      showInEmergency: false,
      reminderEnabled: true,
      active: true,
      startedAt: T0 - 30 * DAY,
    },
    {
      uuid: 'med-dia',
      name: 'Diazepam',
      dose: 10,
      unit: 'mg',
      frequency: 'PRN',
      scheduledTimes: [],
      scheduledDays: [],
      isRescue: true,
      showInEmergency: true,
      active: true,
      slotDoses: {},
    },
    {
      uuid: 'med-old',
      name: 'Old drug',
      dose: 5,
      unit: 'mg',
      frequency: 'OD',
      scheduledTimes: ['08:00'],
      scheduledDays: [],
      isRescue: false,
      active: false,
      deletedAt: T0 + DAY,
      startedAt: T0 - 90 * DAY,
      slotDoses: {},
    },
  ];
  const changes: Row[] = [
    {
      uuid: 'ch-1',
      medicationUuid: 'med-lev',
      medicationName: 'Levetiracetam',
      type: 'started',
      effectiveAt: T0 - 30 * DAY,
      recordedAt: T0 - 30 * DAY,
      from: null,
      to: reg(500),
      changedFields: [],
      note: '',
      isBaseline: true,
    },
    {
      uuid: 'ch-2',
      medicationUuid: 'med-lev',
      medicationName: 'Levetiracetam',
      type: 'changed',
      effectiveAt: T0 + 10 * DAY,
      recordedAt: T0 + 10 * DAY,
      from: reg(500),
      to: reg(750),
      changedFields: ['slotDose:08:00'],
      note: 'raised',
      isBaseline: false,
    },
    {
      uuid: 'ch-3',
      medicationUuid: 'med-ghost',
      medicationName: 'Ghost',
      type: 'started',
      effectiveAt: T0,
      recordedAt: T0,
      from: null,
      to: reg(1),
      changedFields: [],
      note: '',
      isBaseline: false,
    }, // its medication is not in the file
  ];
  const logs: Row[] = [];
  for (let d = 0; d < 20; d++) {
    logs.push({
      uuid: `log-${d}-am`,
      medicationUuid: 'med-lev',
      scheduledTime: '08:00',
      takenAt: T0 + d * DAY + 2 * 60 * MIN,
      status: d % 5 === 0 ? 'late' : 'taken',
      note: '',
      doseSnapshot: 500,
      unitSnapshot: 'mg',
    });
    logs.push({
      uuid: `log-${d}-pm`,
      medicationUuid: 'med-lev',
      scheduledTime: '20:00',
      takenAt: T0 + d * DAY + 14 * 60 * MIN,
      status: d % 7 === 0 ? 'missed' : 'assumed',
      note: '',
      doseSnapshot: 500,
      unitSnapshot: 'mg',
    });
  }
  return { meds, changes, logs };
}

export function makeBackup(options: { events?: number; name?: string } = {}): Row {
  const { meds, changes, logs } = makeMedications();
  const events = makeEvents(options.events ?? 24);
  return {
    schema: 'auratrack.backup',
    version: 2,
    exportedAt: T0 + 60 * DAY,
    data: {
      settings: [
        { key: 'personName', value: options.name ?? 'Test Patient' },
        { key: 'dateOfBirth', value: '1995-04-12' },
        { key: 'emergencyContact', value: '+47 123' },
        { key: 'language', value: 'nb' },
        { key: 'emergencyAlertMinutes', value: 5 },
        { key: 'neurologistName', value: 'Dr. Example' },
      ],
      events,
      medications: meds,
      medicationLogs: logs,
      medicationChanges: changes,
      eegSessions: [
        {
          uuid: 'eeg-1',
          startTime: T0,
          plannedEndTime: T0 + DAY,
          actualEndTime: T0 + DAY,
          durationPreset: '24h',
          title: 'Home',
          notes: '',
          status: 'COMPLETED',
        },
      ],
      eegActivities: [
        {
          uuid: 'eegA-1',
          sessionUuid: 'eeg-1',
          kind: 'ACTIVITY',
          activityLabel: 'Reading',
          customActivityText: '',
          moodLabel: 'Tired',
          notes: '',
          startTime: T0 + MIN,
          endTime: T0 + 30 * MIN,
          durationSec: 1740,
        },
        {
          uuid: 'eegA-2',
          sessionUuid: 'eeg-1',
          kind: 'SEIZURE_REFERENCE',
          activityLabel: 'Focal Aware',
          startTime: T0 + 60 * MIN,
          endTime: T0 + 61 * MIN,
          durationSec: 60,
          linkedEventUuid: 'ev-0',
        },
        { uuid: 'eegA-3', sessionUuid: 'eeg-missing', kind: 'ACTIVITY', activityLabel: 'Walking', startTime: T0 }, // its session is not in the file
      ],
      wellbeingEntries: Array.from({ length: 10 }, (_, d) => ({
        uuid: `wb-${d}`,
        recordedAt: T0 + d * DAY + 20 * 60 * MIN,
        dayKey: '2026-07-01',
        primaryMood: d % 2 ? 'Calm' : 'Tired and flat',
        intensity: (d % 3) + 1,
        factors: {
          sleepQuality: { label: 'Sleep quality', type: 'scale', value: 2 },
          hydration: { label: 'Hydration', type: 'number', unit: 'L', value: 1.5 },
          missedMeal: { label: 'Missed meal', type: 'boolean', value: d % 2 === 0 },
        },
        notes: '',
      })),
      tombstones: [
        { uuid: 'ev-gone', table: 'events', deletedAt: T0 + DAY },
        { uuid: 'x', table: 'nonsense', deletedAt: 1 },
      ],
    },
  };
}

// ---- file forms

export const plainFile = (backup: Row = makeBackup()) => JSON.stringify(backup);

/** A 6.1 encrypted backup, made the way 6.1 made them (PBKDF2-SHA256, AES-GCM, no additional data). */
export async function encryptedFile(payload: unknown, passphrase: string, iterations = 1000): Promise<string> {
  const subtle = crypto.subtle;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload))),
  );
  return JSON.stringify({
    schema: 'auratrack.encrypted-backup',
    version: 1,
    exportedAt: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64Url(salt) },
    cipher: { name: 'AES-GCM', length: 256, iv: toBase64Url(iv) },
    ciphertext: toBase64Url(ct),
  });
}

export function householdFile(): string {
  return JSON.stringify({
    schema: 'auratrack.household-backup',
    version: 1,
    profiles: [
      { id: 'p1', name: 'Alex', color: 'blue' },
      { id: 'p2', name: 'Sam', color: 'green' },
    ],
    patients: { p1: makeBackup({ name: 'Alex', events: 6 }), p2: makeBackup({ name: 'Sam', events: 4 }) },
  });
}
