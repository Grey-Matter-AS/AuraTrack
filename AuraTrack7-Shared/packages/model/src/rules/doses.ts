import type { DoseLog, DoseStatus, Medication, MedicationChange } from '../schemas';
import { localDateKey, nextLocalDay, parseLocalDate, startOfLocalDay } from './dates';
import { changesForMedication, regimenAt, regimenSnapshot, slotDose } from './regimen';

export { defaultScheduledTimes } from './regimen';

// Scheduled doses, dose status, and the missed / assumed doses that fill in what was never logged.

/** A dose logged more than this long after its slot is 'late'; with "assume taken" on, an unlogged dose becomes 'assumed' after it. */
export const GRACE_MS = 90 * 60 * 1000;
/** How far back "assume taken" fills in days the app was not opened. */
export const ASSUME_BACKFILL_DAYS = 31;

/** The instant of 'HH:MM' on the local day containing `dayMs`. */
export function scheduledTimestampForDay(time: string, dayMs: number): number {
  const base = new Date(dayMs);
  const [h = 0, m = 0] = time.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0).getTime();
}

/** 'taken' within 90 minutes of the slot, 'late' after that, 'missed' when never logged. */
export function getDoseStatus(
  scheduledTime: string,
  loggedAt: number | null,
  dayMs?: number,
): 'taken' | 'late' | 'missed' {
  if (loggedAt === null) return 'missed';
  const scheduled = scheduledTimestampForDay(scheduledTime, dayMs ?? loggedAt);
  return (loggedAt - scheduled) / 60_000 <= 90 ? 'taken' : 'late';
}

/** Scheduled for that weekday? No days listed, or all seven, means daily. */
export function isMedScheduledForDay(item: { scheduledDays?: readonly number[] | undefined }, dayMs: number): boolean {
  const days = item.scheduledDays;
  if (!days || days.length === 0 || days.length === 7) return true;
  return days.includes(new Date(dayMs).getDay());
}

export interface ScheduledDose {
  medicationId: string;
  medicationName: string;
  dose: number | null | undefined;
  unit: string;
  scheduledTime: string;
  scheduledTs: number;
}

type ScheduledMedication = Pick<Medication, 'id' | 'name' | 'active' | 'isRescue' | 'startedAt'> &
  Parameters<typeof regimenSnapshot>[0];

function doseFor(
  med: ScheduledMedication,
  regimen: ReturnType<typeof regimenSnapshot>,
  dayMs: number,
  time: string,
): ScheduledDose {
  return {
    medicationId: med.id,
    medicationName: med.name,
    dose: slotDose(regimen, time),
    unit: regimen.unit,
    scheduledTime: time,
    scheduledTs: scheduledTimestampForDay(time, dayMs),
  };
}

/**
 * Every active non-rescue medication times its scheduled times, for one day. Each slot uses the regimen in force at
 * that slot's time, so a change effective from the 20:00 dose leaves the same day's 08:00 dose on the old regimen.
 */
export function getScheduledDosesForDay(
  medications: readonly ScheduledMedication[],
  dayMs: number,
  changes: readonly MedicationChange[],
): ScheduledDose[] {
  const dayStart = startOfLocalDay(dayMs);
  const dayEnd = nextLocalDay(dayStart) - 1;
  const doses: ScheduledDose[] = [];
  for (const med of medications) {
    const candidates = new Set<string>();
    for (const ts of [dayStart, dayEnd]) regimenAt(med, changes, ts)?.scheduledTimes.forEach((t) => candidates.add(t));
    for (const change of changesForMedication(med, changes)) {
      if (change.effectiveAt >= dayStart && change.effectiveAt <= dayEnd)
        change.to?.scheduledTimes.forEach((t) => candidates.add(t));
    }
    for (const time of candidates) {
      const regimen = regimenAt(med, changes, scheduledTimestampForDay(time, dayMs));
      if (!regimen || regimen.frequency === 'PRN' || med.isRescue) continue;
      if (!regimen.scheduledTimes.includes(time) || !isMedScheduledForDay(regimen, dayMs)) continue;
      doses.push(doseFor(med, regimen, dayMs, time));
    }
  }
  return doses.sort((a, b) => a.scheduledTs - b.scheduledTs);
}

export interface MissedDosePlan {
  medications: readonly ScheduledMedication[];
  changes: readonly MedicationChange[];
  logs: readonly Pick<DoseLog, 'medicationId' | 'scheduledTime' | 'takenAt'>[];
  now: number;
  /** "Assume doses taken" setting. */
  assume: boolean;
  /** The day the setting was turned on, 'YYYY-MM-DD' or an instant. */
  assumeSince?: string | number | null;
}

export interface DoseDraft {
  medicationId: string;
  scheduledTime: string;
  takenAt: number;
  status: Extract<DoseStatus, 'missed' | 'assumed'>;
  doseSnapshot: number | null;
  unitSnapshot: string;
}

/**
 * The calendar day of the slot a dose log belongs to. A dose taken just after midnight for a late-evening slot belongs to the
 * evening before, so it must not leave that slot looking "missed". The slot nearest to when it was taken wins.
 */
export function slotDayKey(scheduledTime: string, takenAt: number): string {
  const same = startOfLocalDay(takenAt);
  const before = startOfLocalDay(new Date(same - 1));
  const distance = (day: number) => Math.abs(takenAt - scheduledTimestampForDay(scheduledTime, day));
  return localDateKey(distance(before) < distance(same) ? before : same);
}

const sinceStart = (value: string | number | null | undefined, fallback: number): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDate(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : startOfLocalDay(date);
};

/**
 * The dose logs to add for scheduled doses that passed without a log (a pure plan; the store writes it, once).
 * Default: today only, as 'missed', once 90 minutes have passed. With "assume taken" on: 'assumed' instead, and back-filled
 * for days the app was not opened (from when the setting was turned on, at most 31 days).
 */
export function planMissedDoses(plan: MissedDosePlan): DoseDraft[] {
  const todayStart = startOfLocalDay(plan.now);
  let firstDay = todayStart;
  if (plan.assume) {
    const backfillLimit = startOfLocalDay(new Date(todayStart - ASSUME_BACKFILL_DAYS * 86_400_000));
    firstDay = Math.min(todayStart, Math.max(sinceStart(plan.assumeSince, todayStart), backfillLimit));
  }
  // A dose is only "missed" (or "assumed") once the 90 minutes in which it still counts as taken are over, so a reminder
  // and a late tap are never met by a log that says missed
  const cutoff = plan.now - GRACE_MS;
  const logged = new Set(
    plan.logs
      .filter((l) => l.scheduledTime !== null)
      .map((l) => `${l.medicationId}|${l.scheduledTime}|${slotDayKey(l.scheduledTime as string, l.takenAt)}`),
  );
  const drafts: DoseDraft[] = [];
  for (let day = firstDay; day <= todayStart; day = nextLocalDay(day)) {
    for (const dose of getScheduledDosesForDay(plan.medications, day, plan.changes)) {
      if (dose.scheduledTs > cutoff) continue; // not yet due, or still inside the grace period
      const key = `${dose.medicationId}|${dose.scheduledTime}|${localDateKey(dose.scheduledTs)}`;
      if (logged.has(key)) continue;
      logged.add(key);
      drafts.push({
        medicationId: dose.medicationId,
        scheduledTime: dose.scheduledTime,
        takenAt: dose.scheduledTs,
        status: plan.assume ? 'assumed' : 'missed',
        doseSnapshot: dose.dose ?? null,
        unitSnapshot: dose.unit,
      });
    }
  }
  return drafts;
}
