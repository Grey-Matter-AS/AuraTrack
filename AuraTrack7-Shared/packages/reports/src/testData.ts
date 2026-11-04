import { labelText, message, type MessageKey, type MessageParams } from '@auratrack/i18n';
import type {
  DoseLog,
  EegActivity,
  EegSession,
  InterictalEvent,
  Medication,
  MedicationChange,
  Patient,
  Seizure,
  WellbeingEntry,
} from '@auratrack/model';
import { emergencyPlan, localDateKey } from '@auratrack/model';
import type { ReportContext } from './context';
import type { NeurologistInput } from './neurologist';

// Made-up records for the report tests. Nothing here is real data. A fixed clock and a fixed pseudo-random sequence, so the
// numbers a test checks never change.

export const NOW = new Date(2026, 9, 15, 12, 0, 0).getTime(); // 15 October 2026
const DAY = 86_400_000;
const at = (daysAgo: number, hour: number, minute = 0) => {
  const d = new Date(NOW - daysAgo * DAY);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0).getTime();
};

export const patient: Patient = {
  id: 'p1', householdId: 'h', deviceId: 'd', createdAt: at(120, 9), patientId: 'p1',
  name: 'Random Seed Patient', dateOfBirth: '2010-05-17', emergencyContact: 'Sam 555 0100', color: '#1d4ed8',
};

let seed = 7;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);

export function context(language = 'en'): ReportContext {
  const two = (n: number) => String(n).padStart(2, '0');
  return {
    t: (key: MessageKey, params?: MessageParams) => message(language as 'en', key, params),
    label: (code) => labelText(language as 'en', code),
    language,
    fmt: {
      date: (ms) => localDateKey(ms),
      dayMonth: (ms) => localDateKey(ms).slice(5),
      longDate: (ms) => localDateKey(ms),
      time: (ms) => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`,
      duration: (s) => `${Math.floor(s / 60)}:${two(Math.round(s % 60))}`,
    },
    now: NOW,
    appVersion: '7.0.4',
  };
}

const TYPES = ['seizure_type.focal_aware', 'seizure_type.focal_impaired', 'seizure_type.tonic_clonic', 'seizure_type.absence'];
const TRIGGERS = ['trigger.stress', 'trigger.sleep_deprivation', 'trigger.missed_medication'];

export function seizures(count = 40): Seizure[] {
  seed = 7;
  const out: Seizure[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const start = at(daysAgo, 3 + Math.floor(rand() * 18), Math.floor(rand() * 60));
    const seconds = i % 9 === 0 ? 330 + Math.floor(rand() * 200) : 20 + Math.floor(rand() * 200);
    const full = i % 3 !== 0;
    out.push({
      id: `s${i}`, householdId: 'h', deviceId: 'd', createdAt: start, patientId: 'p1', timeZone: 'Europe/Oslo',
      phases: {
        start: { at: start, source: 'timed' },
        auraEnd: full ? { at: start + 15_000, source: 'timed' } : null,
        seizureEnd: { at: start + 15_000 + seconds * 1000, source: i % 11 === 0 ? 'edited' : 'timed' },
        recoveryEnd: full ? { at: start + 15_000 + seconds * 1000 + 300_000, source: 'timed' } : null,
      },
      status: i % 8 === 7 ? 'recorded' : 'complete',
      typeCode: i % 8 === 7 ? null : TYPES[i % TYPES.length] ?? null,
      ilae: null,
      symptoms: [
        { id: `y${i}a`, code: 'symptom.awareness.fully_awake_aware', area: null, moment: 0, order: 0, sincePrevious: { kind: 'unknown', ms: null }, isFirst: true, phase: 'during' },
        ...(i % 2 === 0
          ? [{ id: `y${i}b`, code: 'symptom.small_twitching.single_muscle_jerks', area: { region: 'body.arms', subRegion: 'body.arms.left_arm', part: null }, moment: 1, order: 1, sincePrevious: { kind: 'exact' as const, ms: 5000 }, isFirst: false, phase: 'during' as const }]
          : [{ id: `y${i}c`, code: 'symptom.awareness.confused_dream_like', area: null, moment: 1, order: 1, sincePrevious: { kind: 'unknown' as const, ms: null }, isFirst: false, phase: 'during' as const }]),
      ],
      afterFindings: i % 4 === 0 ? [{ code: 'after.confused', customLabel: null, areas: [] }] : [],
      recoveryMinutes: full ? 5 : null,
      recoveryOngoing: false,
      triggerCodes: i % 5 === 0 ? [TRIGGERS[i % TRIGGERS.length] as string] : [],
      notes: i % 6 === 0 ? 'Seed note with longer wording to exercise report wrapping and pagination in the PDF.' : '',
      video: null,
      isManualEntry: false,
      isEmergencyStop: i === 17,
      recordedBy: i % 2 === 0 ? 'carer' : 'self',
      eegSessionId: null,
    });
  }
  return out;
}

export const medications: Medication[] = [
  {
    id: 'm1', householdId: 'h', deviceId: 'd', createdAt: at(100, 9), patientId: 'p1', name: 'Lamotrigine', activeIngredient: 'Lamotrigine',
    form: 'tablet', dose: 100, unit: 'mg', slotDoses: { '20:00': 150 }, frequency: 'BD', scheduledTimes: ['08:00', '20:00'],
    scheduledDays: [0, 1, 2, 3, 4, 5, 6], isRescue: false, showInEmergency: false, reminderEnabled: false, active: true,
    startedAt: at(100, 9), stoppedAt: null,
  },
  {
    id: 'm2', householdId: 'h', deviceId: 'd', createdAt: at(100, 9), patientId: 'p1', name: 'Midazolam', activeIngredient: 'Midazolam',
    form: 'buccal', dose: 10, unit: 'mg', slotDoses: {}, frequency: 'PRN', scheduledTimes: [], scheduledDays: [0, 1, 2, 3, 4, 5, 6],
    isRescue: true, showInEmergency: true, reminderEnabled: false, active: true, startedAt: at(100, 9), stoppedAt: null,
  },
];

const lamotrigine = ((): Medication => {
  const m = medications[0];
  if (!m) throw new Error('no test medication');
  return m;
})();
const regimen = (m: Medication, over: Partial<Medication> = {}) => {
  const r = { ...m, ...over };
  return {
    name: r.name, activeIngredient: r.activeIngredient, form: r.form, dose: r.dose, unit: r.unit, slotDoses: r.slotDoses,
    frequency: r.frequency, scheduledTimes: r.scheduledTimes, scheduledDays: r.scheduledDays,
  };
};
export const changes: MedicationChange[] = [
  {
    id: 'c1', householdId: 'h', deviceId: 'd', createdAt: at(100, 9), patientId: 'p1', medicationId: 'm1', medicationName: 'Lamotrigine',
    type: 'started', effectiveAt: at(100, 9), recordedAt: at(100, 9), from: null, to: regimen(lamotrigine, { dose: 100, slotDoses: {} }),
    changedFields: [], note: '', isBaseline: false,
  },
  {
    id: 'c2', householdId: 'h', deviceId: 'd', createdAt: at(30, 9), patientId: 'p1', medicationId: 'm1', medicationName: 'Lamotrigine',
    type: 'changed', effectiveAt: at(30, 20), recordedAt: at(30, 9), from: regimen(lamotrigine, { dose: 100, slotDoses: {} }),
    to: regimen(lamotrigine), changedFields: ['slotDose:20:00'], note: 'Evening dose raised', isBaseline: false,
  },
];

export const doses: DoseLog[] = Array.from({ length: 40 }, (_, i) => ({
  id: `d${i}`, householdId: 'h', deviceId: 'd', createdAt: at(i, 8), patientId: 'p1', medicationId: 'm1', scheduledTime: '08:00',
  takenAt: at(i % 30, 8, 10), status: (['taken', 'taken', 'late', 'assumed', 'missed'] as const)[i % 5] ?? 'taken', note: '',
  doseSnapshot: 100, unitSnapshot: 'mg',
}));

export const wellbeing: WellbeingEntry[] = Array.from({ length: 30 }, (_, i) => ({
  id: `w${i}`, householdId: 'h', deviceId: 'd', createdAt: at(i * 2, 20), patientId: 'p1', recordedAt: at(i * 2, 20), dayKey: localDateKey(at(i * 2, 20)),
  moodCode: i % 3 === 0 ? 'mood.calm' : 'mood.anxious_worried', intensity: 1 + (i % 3),
  factors: i % 2 === 0 ? { 'factor.stress': 2, 'factor.sleep_hours': 6 } : { 'factor.sleeplessness': true }, notes: '',
}));

export const between: InterictalEvent[] = [
  { id: 'b1', householdId: 'h', deviceId: 'd', createdAt: at(5, 10), patientId: 'p1', occurredAt: at(5, 10), timeZone: 'Europe/Oslo', symptomCode: 'symptom.awareness.confused_dream_like', area: null, notes: 'After lunch', recordedBy: 'carer' },
];

export const eegSession: EegSession = {
  id: 'e1', householdId: 'h', deviceId: 'd', createdAt: at(10, 9), patientId: 'p1', startTime: at(10, 9), plannedEndTime: at(9, 9),
  actualEndTime: at(9, 8), durationPreset: '24h', customHours: null, title: 'Night EEG', notes: 'Cap placed by the nurse', status: 'completed',
};
export const eegActivities: EegActivity[] = [
  { id: 'a1', householdId: 'h', deviceId: 'd', createdAt: at(10, 10), patientId: 'p1', sessionId: 'e1', kind: 'activity', activityCode: 'activity.sleeping', customText: '', moodCode: 'mood.calm', notes: '', startTime: at(10, 22), endTime: at(9, 6), durationSec: 28_800, linkedSeizureId: null },
  { id: 'a2', householdId: 'h', deviceId: 'd', createdAt: at(10, 10), patientId: 'p1', sessionId: 'e1', kind: 'seizure_reference', activityCode: 'seizure_type.focal_aware', customText: '', moodCode: null, notes: '', startTime: at(10, 23, 30), endTime: at(10, 23, 31), durationSec: 60, linkedSeizureId: 's1' },
];

export function neurologistInput(over: Partial<NeurologistInput> = {}): NeurologistInput {
  return {
    patient,
    carerName: 'Kari Nordmann',
    carerPhone: '',
    recordedBy: 'carer',
    neurologist: { name: 'Dr. Random Example', institution: 'Example Hospital', contact: '555 0199' },
    includeDateOfBirth: true,
    reportNotes: 'Sleep is the usual trigger.',
    plan: emergencyPlan(),
    from: at(90, 0),
    to: at(0, 23, 59),
    seizures: seizures(),
    medications,
    changes,
    doses,
    wellbeing,
    wellbeingEnabled: true,
    factorDefs: [
      { code: 'factor.stress', type: 'scale', unit: '' },
      { code: 'factor.sleeplessness', type: 'boolean', unit: '' },
      { code: 'factor.sleep_hours', type: 'number', unit: 'h' },
    ],
    ...over,
  };
}
