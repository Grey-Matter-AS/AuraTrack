import type { Frequency, Medication, MedicationChange, Regimen } from '../schemas';

// Regimen history. A regimen is the clinically relevant part of a medication. Every confirmed change stores the full
// regimen before (from) and after (to), so the regimen in force at any moment can be read straight off the history.

const DEFAULT_TIMES: Record<Frequency, readonly string[]> = {
  OD: ['08:00'],
  BD: ['08:00', '20:00'],
  TDS: ['08:00', '14:00', '20:00'],
  QDS: ['08:00', '12:00', '16:00', '20:00'],
  PRN: [],
};

export const defaultScheduledTimes = (frequency: Frequency): string[] => [...(DEFAULT_TIMES[frequency] ?? [])];

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

type RegimenSource = Pick<Medication, 'name' | 'frequency' | 'dose' | 'unit'> &
  Partial<Pick<Medication, 'activeIngredient' | 'form' | 'slotDoses' | 'scheduledTimes' | 'scheduledDays'>>;

export function regimenSnapshot(med: RegimenSource): Regimen {
  return {
    name: med.name,
    activeIngredient: med.activeIngredient ?? '',
    form: med.form ?? '',
    dose: med.dose,
    unit: med.unit,
    slotDoses: { ...med.slotDoses },
    frequency: med.frequency,
    scheduledTimes: [...(med.scheduledTimes ?? defaultScheduledTimes(med.frequency))],
    scheduledDays: [...(med.scheduledDays ?? ALL_DAYS)],
  };
}

/** Dose for one time slot: its own dose if set, otherwise the medication's default dose. */
export function slotDose(
  regimen: Pick<Regimen, 'dose' | 'slotDoses'> | null | undefined,
  time: string | null,
): number | null | undefined {
  const own = time !== null ? regimen?.slotDoses[time] : undefined;
  return own ?? regimen?.dose;
}

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean => {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((v, i) => v === right[i]);
};

/** The clinically relevant fields that differ, e.g. ['name', 'slotDose:20:00', 'form']. */
export function diffRegimen(from: Regimen, to: Regimen): string[] {
  const fields: string[] = [];
  // Ingredient spelling case does not make it a different medicine ("lamotrigine" = "Lamotrigine")
  const norm = (key: string, value: string) => (key === 'activeIngredient' ? value.toLowerCase() : value);
  for (const key of ['name', 'activeIngredient', 'form', 'unit', 'frequency'] as const) {
    if (norm(key, from[key]) !== norm(key, to[key])) fields.push(key);
  }
  // Scheduled medications compare the effective dose of each slot both regimens share (new or removed slots show up
  // under scheduledTimes); as-needed medications compare the single dose
  const sharedTimes = to.frequency === 'PRN' ? [] : to.scheduledTimes.filter((t) => from.scheduledTimes.includes(t));
  if (sharedTimes.length) {
    for (const time of sharedTimes)
      if (Number(slotDose(from, time)) !== Number(slotDose(to, time))) fields.push(`slotDose:${time}`);
  } else if (Number(from.dose) !== Number(to.dose)) {
    fields.push('dose');
  }
  if (!sameList(from.scheduledTimes, to.scheduledTimes)) fields.push('scheduledTimes');
  if (!sameList(from.scheduledDays, to.scheduledDays)) fields.push('scheduledDays');
  return fields;
}

export const changesForMedication = (
  med: Pick<Medication, 'id'>,
  changes: readonly MedicationChange[],
): MedicationChange[] =>
  changes
    .filter((c) => c.medicationId === med.id)
    .sort((a, b) => a.effectiveAt - b.effectiveAt || a.recordedAt - b.recordedAt);

type MedicationState = RegimenSource & Pick<Medication, 'id' | 'active' | 'startedAt'>;

/**
 * The regimen in force at `ts`, or null when the medication was not being taken then.
 * A medication without any change record (older data) falls back to its current state.
 */
export function regimenAt(med: MedicationState, changes: readonly MedicationChange[], ts: number): Regimen | null {
  const own = changesForMedication(med, changes);
  const first = own[0];
  if (!first) {
    if (!med.active) return null;
    if (med.startedAt !== null && ts < med.startedAt) return null;
    return regimenSnapshot(med);
  }
  const applicable = own.filter((c) => c.effectiveAt <= ts);
  const latest = applicable[applicable.length - 1];
  if (!latest) {
    // Before the first record: if that record is a change (no 'started' on file), the medication was already being
    // taken on the change's "from" regimen
    if (first.type === 'started' || (med.startedAt !== null && ts < med.startedAt)) return null;
    return first.from;
  }
  if (latest.type === 'stopped') return null;
  // The newest change is the medication's current state: read the live record so a later non-clinical edit is still reflected
  if (latest === own[own.length - 1]) return med.active ? regimenSnapshot(med) : null;
  return latest.to ?? regimenSnapshot(med);
}
