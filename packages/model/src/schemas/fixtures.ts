import { newId } from '../ids';
import type { DoseLog, Medication, Seizure } from './index';

// Builders for tests: valid made-up records.
export const ids = { household: newId(), patient: newId(), device: newId() };
const base = () => ({
  id: newId(),
  householdId: ids.household,
  patientId: ids.patient,
  deviceId: ids.device,
  createdAt: 1_760_000_000_000,
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
  typeCode: 'seizure_type.focal_aware',
  ilae: null,
  symptoms: [],
  afterFindings: [],
  recoveryMinutes: null,
  recoveryOngoing: false,
  triggerCodes: [],
  notes: '',
  video: null,
  isManualEntry: false,
  isEmergencyStop: false,
  recordedBy: 'carer',
  eegSessionId: null,
  ...over,
});

export const medicationFixture = (over: Partial<Medication> = {}): Medication => ({
  ...base(),
  name: 'Levetiracetam',
  activeIngredient: 'Levetiracetam',
  form: 'tablet',
  dose: 500,
  unit: 'mg',
  slotDoses: {},
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
