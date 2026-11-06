import { newId } from '../ids';
import type { DoseLog, InterictalEvent, Medication, Seizure, SeizureProfile, SymptomSet } from './index';

// Builders for tests: valid made-up records.
export const ids = { household: newId(), patient: newId(), device: newId() };
const base = () => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1_760_000_000_000,
  dataVersion: 2,
});

export const seizureFixture = (over: Partial<Seizure> = {}): Seizure => ({
  ...base(),
  timeZone: 'Europe/Oslo',
  phases: {
    start: { at: 1_760_000_000_000, source: 'timed' },
    auraEnd: { at: 1_760_000_020_000, source: 'timed' },
    seizureEnd: { at: 1_760_000_140_000, source: 'timed' },
    recoveryEnd: null,
  },
  status: 'recorded',
  ilae2025: null,
  profile: null,
  symptoms: [],
  afterFindings: [],
  recoveryOngoing: false,
  triggerCodes: [],
  notes: '',
  video: null,
  isManualEntry: false,
  isEmergencyStop: false,
  recordedBy: 'carer',
  eegSessionId: null,
  prodromeSecondsBefore: null,
  quickNotes: [],
  recordedWhileLocked: false,
  cancelled: false,
  ...over,
});

export const interictalFixture = (over: Partial<InterictalEvent> = {}): InterictalEvent => ({
  ...base(),
  occurredAt: 1_760_100_000_000,
  timeZone: 'Europe/Oslo',
  symptomCode: 'symptom.small_twitching.single_muscle_jerks',
  area: null,
  notes: '',
  recordedBy: 'self',
  ...over,
});

export const symptomSetFixture = (over: Partial<SymptomSet> = {}): SymptomSet => ({
  ...base(),
  name: '',
  items: [{ code: 'symptom.big_shaking_jerking.rhythmic_shaking', phase: 'seizure' }],
  ...over,
});

export const seizureProfileFixture = (over: Partial<SeizureProfile> = {}): SeizureProfile => ({
  ...base(),
  name: 'Usual seizure',
  ilae: {
    class: 'focal',
    recall: 'yes',
    responsive: 'no',
    bilateralTonicClonic: 'no',
    observable: null,
    generalized: null,
  },
  signs: [{ code: 'symptom.big_shaking_jerking.rhythmic_shaking', phase: 'seizure' }],
  position: 0,
  ...over,
});

export const medicationFixture = (over: Partial<Medication> = {}): Medication => ({
  ...base(),
  name: 'Levetiracetam',
  activeIngredient: 'Levetiracetam',
  form: 'form.tablet',
  dose: 500,
  unit: 'mg',
  slotDoses: {},
  slotUnits: {},
  frequency: 'BD',
  scheduledTimes: ['08:00', '20:00'],
  scheduledDays: [0, 1, 2, 3, 4, 5, 6],
  isRescue: false,
  showInEmergency: false,
  reminderEnabled: false,
  active: true,
  startedAt: 1_750_000_000_000,
  stoppedAt: null,
  ...over,
});

export const doseLogFixture = (medicationId: string, over: Partial<DoseLog> = {}): DoseLog => ({
  ...base(),
  medicationId,
  scheduledTime: '08:00',
  takenAt: 1_760_000_000_000,
  status: 'taken',
  note: '',
  doseSnapshot: 500,
  unitSnapshot: 'mg',
  ...over,
});

type Base = { id: string; householdId: string; deviceId: string; createdAt: number };

/** The values a caller of `store.create` supplies: the store fills in id, householdId, deviceId and createdAt. */
export function stripBase<T extends Base>(record: T): Omit<T, keyof Base> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  delete copy.householdId;
  delete copy.deviceId;
  delete copy.createdAt;
  return copy as Omit<T, keyof Base>;
}
