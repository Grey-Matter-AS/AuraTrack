import type { AutoFields } from '../schemas/common';
import type { DoseLog, Medication, MedicationChange, Regimen } from '../schemas';
import { RegimenSchema } from '../schemas';
import { localDateKey, nextLocalDay, startOfLocalDay } from './dates';
import { GRACE_MS, getDoseStatus, getScheduledDosesForDay, slotDayKey, type ScheduledDose } from './doses';
import { diffRegimen, regimenSnapshot } from './regimen';

// Changing a medicine, and the day's doses. A medicine is never rewritten silently: every confirmed change adds a record
// that holds the regimen before and after, and a stopped medicine is kept. Pure functions: the screens only ask the store
// to write what these return.

export type MedicationFlags = Pick<Medication, 'isRescue' | 'showInEmergency' | 'reminderEnabled'>;
export type ChangeType = MedicationChange['type'];

/** The values to store a medicine with (what `store.create('medication', ...)` is given, minus the ids). */
export type MedicationValues = Omit<Medication, AutoFields>;
export type ChangeValues = Omit<MedicationChange, AutoFields>;

export type ChangeProblem = 'name_empty' | 'future' | 'no_times' | 'no_change' | 'already_stopped' | 'not_stopped';

export interface ChangePlan {
  /** The medicine to add, or the fields of the existing one to change. */
  medication: { create: MedicationValues } | { id: string; patch: Partial<MedicationValues> };
  /** The record that is added to the history, always. */
  change: ChangeValues;
}

export interface ChangeInput {
  patientId: string;
  /** The medicine as it is now; null for a new one. */
  before: Medication | null;
  /** The regimen and flags to apply (ignored for 'stopped'). */
  next: Regimen & MedicationFlags;
  type: ChangeType;
  /** When the change takes effect (an instant); may be in the past, never in the future. */
  effectiveAt: number;
  /** Now. */
  recordedAt: number;
  note: string;
}

/** A whole day of slack for a clock a few minutes off, but a change cannot take effect tomorrow. */
const FUTURE_SLACK_MS = 5 * 60_000;

const flagsOf = (m: MedicationFlags): MedicationFlags => ({
  isRescue: m.isRescue,
  showInEmergency: m.showInEmergency,
  reminderEnabled: m.reminderEnabled,
});

function values(
  regimen: Regimen,
  flags: MedicationFlags,
  active: boolean,
  startedAt: number | null,
  stoppedAt: number | null,
  patientId: string,
): MedicationValues {
  return { patientId, ...RegimenSchema.parse(regimen), ...flagsOf(flags), active, startedAt, stoppedAt };
}

/** What to write for a started, changed, stopped or corrected medicine; or the reason it cannot be. */
export function planMedicationChange(input: ChangeInput): ChangePlan | { problem: ChangeProblem } {
  const { before, next, type } = input;
  if (input.effectiveAt > input.recordedAt + FUTURE_SLACK_MS) return { problem: 'future' };
  const common = {
    patientId: input.patientId,
    effectiveAt: input.effectiveAt,
    recordedAt: input.recordedAt,
    note: input.note.slice(0, 5000),
    isBaseline: false,
  };

  if (type === 'stopped') {
    if (!before || !before.active) return { problem: 'already_stopped' };
    const from = regimenSnapshot(before);
    return {
      medication: { id: before.id, patch: { active: false, stoppedAt: input.effectiveAt } },
      change: {
        ...common,
        medicationId: before.id,
        medicationName: before.name,
        type,
        from,
        to: null,
        changedFields: [],
      },
    };
  }

  if (next.name.trim() === '') return { problem: 'name_empty' };
  if (next.frequency !== 'PRN' && next.scheduledTimes.length === 0) return { problem: 'no_times' };
  const regimen = RegimenSchema.parse({ ...regimenSnapshot(next), name: next.name.trim() });

  if (type === 'started') {
    if (before && before.active) return { problem: 'not_stopped' };
    const created = values(regimen, next, true, input.effectiveAt, null, input.patientId);
    if (before)
      return {
        // Taking up a stopped medicine again: the same record, active again, with its own history before it
        medication: { id: before.id, patch: created },
        change: {
          ...common,
          medicationId: before.id,
          medicationName: regimen.name,
          type,
          from: null,
          to: regimen,
          changedFields: [],
        },
      };
    return {
      medication: { create: created },
      // The id of the new medicine is not known yet: the caller fills it in from the record it creates
      change: {
        ...common,
        medicationId: '',
        medicationName: regimen.name,
        type,
        from: null,
        to: regimen,
        changedFields: [],
      },
    };
  }

  // changed, or a correction of what was entered wrongly
  if (!before) return { problem: 'no_change' };
  const from = regimenSnapshot(before);
  const changedFields = diffRegimen(from, regimen);
  const flagsChanged = (['isRescue', 'showInEmergency', 'reminderEnabled'] as const).some((k) => before[k] !== next[k]);
  if (changedFields.length === 0 && !flagsChanged) return { problem: 'no_change' };
  return {
    medication: {
      id: before.id,
      patch: values(regimen, next, before.active, before.startedAt, before.stoppedAt, before.patientId),
    },
    change: {
      ...common,
      medicationId: before.id,
      medicationName: regimen.name,
      type,
      from,
      to: regimen,
      changedFields,
    },
  };
}

export const RENAME_REASONS = ['typo', 'brand', 'different'] as const;
export type RenameReason = (typeof RENAME_REASONS)[number];

/**
 * Renaming a confirmed medicine asks why (F-503). A typo or a brand name is the same medicine: a correction, or a change of
 * name, in its own history. A different medicine is not a rename: the old one is stopped and a new one is started.
 */
export function renameType(reason: Exclude<RenameReason, 'different'>): ChangeType {
  return reason === 'typo' ? 'correction' : 'changed';
}

// ── The day's doses

export type DoseState = 'upcoming' | 'due' | 'taken' | 'late' | 'missed' | 'assumed';

export interface DosePanelRow {
  key: string;
  medicationId: string;
  name: string;
  dose: number | null;
  unit: string;
  scheduledTime: string;
  scheduledTs: number;
  /** The log for this slot, if one was written. */
  log: DoseLog | null;
  state: DoseState;
}

type Panelled = Parameters<typeof getScheduledDosesForDay>[0][number];

/** The doses scheduled for one day with what was logged for each: taken, late, missed, assumed, due now, or still to come. */
export function dosePanel(input: {
  medications: readonly Panelled[];
  changes: readonly MedicationChange[];
  logs: readonly DoseLog[];
  now: number;
  /** Any instant in the day; defaults to today. */
  day?: number;
}): DosePanelRow[] {
  const dayMs = input.day ?? input.now;
  const dayKey = localDateKey(dayMs);
  return getScheduledDosesForDay(input.medications, dayMs, input.changes).map((dose: ScheduledDose) => {
    const log =
      input.logs.find(
        (l) =>
          l.medicationId === dose.medicationId &&
          l.scheduledTime === dose.scheduledTime &&
          slotDayKey(dose.scheduledTime, l.takenAt) === dayKey,
      ) ?? null;
    const state: DoseState = log ? log.status : dose.scheduledTs <= input.now ? 'due' : 'upcoming';
    return {
      key: `${dose.medicationId}|${dose.scheduledTime}|${dayKey}`,
      medicationId: dose.medicationId,
      name: dose.medicationName,
      dose: dose.dose ?? null,
      unit: dose.unit,
      scheduledTime: dose.scheduledTime,
      scheduledTs: dose.scheduledTs,
      log,
      state,
    };
  });
}

export type DoseLogValues = Omit<DoseLog, AutoFields>;

/** The log for a scheduled dose marked as taken at `takenAt`: 'taken' within 90 minutes of the slot, 'late' after. */
export function takenDose(row: DosePanelRow, patientId: string, takenAt: number, note = ''): DoseLogValues {
  return {
    patientId,
    medicationId: row.medicationId,
    scheduledTime: row.scheduledTime,
    takenAt,
    status: getDoseStatus(row.scheduledTime, takenAt, row.scheduledTs),
    note,
    doseSnapshot: row.dose,
    unitSnapshot: row.unit,
  };
}

/** A dose that was not on the schedule: rescue medicine, or a dose taken outside its time. */
export function extraDose(
  med: Pick<Medication, 'id' | 'dose' | 'unit'>,
  patientId: string,
  takenAt: number,
  dose: number | null,
  note = '',
): DoseLogValues {
  return {
    patientId,
    medicationId: med.id,
    scheduledTime: null,
    takenAt,
    status: 'taken',
    note,
    doseSnapshot: dose ?? med.dose,
    unitSnapshot: med.unit,
  };
}

// ── The history grid

export interface GridCell {
  medicationId: string;
  name: string;
  scheduledTime: string;
  scheduledTs: number;
  dose: number | null;
  unit: string;
  log: DoseLog | null;
  state: DoseState;
}
export interface GridDay {
  /** 'YYYY-MM-DD' */
  day: string;
  dayStart: number;
  cells: GridCell[];
}

/** One entry per day from `to` back to `from` (newest first), each with the doses scheduled that day. */
export function doseGrid(input: {
  medications: readonly Panelled[];
  changes: readonly MedicationChange[];
  logs: readonly DoseLog[];
  from: number;
  to: number;
  now: number;
}): GridDay[] {
  const days: GridDay[] = [];
  for (let dayStart = startOfLocalDay(input.from); dayStart <= input.to; dayStart = nextLocalDay(dayStart)) {
    const rows = dosePanel({
      medications: input.medications,
      changes: input.changes,
      logs: input.logs,
      now: input.now,
      day: dayStart,
    });
    days.push({
      day: localDateKey(dayStart),
      dayStart,
      cells: rows.map((r) => ({
        medicationId: r.medicationId,
        name: r.name,
        scheduledTime: r.scheduledTime,
        scheduledTs: r.scheduledTs,
        dose: r.dose,
        unit: r.unit,
        log: r.log,
        state: r.state,
      })),
    });
  }
  return days.reverse();
}

/** Doses taken, late, assumed and missed per medicine (for the reports and the summary under the grid). */
export function adherence(logs: readonly Pick<DoseLog, 'medicationId' | 'status' | 'scheduledTime'>[]) {
  const out = new Map<string, { taken: number; late: number; assumed: number; missed: number }>();
  for (const l of logs) {
    if (l.scheduledTime === null) continue; // extra doses are not part of the schedule
    const row = out.get(l.medicationId) ?? { taken: 0, late: 0, assumed: 0, missed: 0 };
    row[l.status] += 1;
    out.set(l.medicationId, row);
  }
  return out;
}

// ── Reminders

export interface DoseReminder {
  key: string;
  patientId: string;
  medicationId: string;
  name: string;
  dose: number | null;
  unit: string;
  scheduledTime: string;
  scheduledTs: number;
}

/**
 * Doses to remind about now, for every person (F-509): a medicine with its reminder on, whose slot has come, with no log
 * yet, inside the 90 minutes before it counts as late. Anything older is left to the missed-dose sweep.
 */
export function dueReminders(input: {
  medications: readonly (Medication & Panelled)[];
  changes: readonly MedicationChange[];
  logs: readonly DoseLog[];
  now: number;
}): DoseReminder[] {
  const out: DoseReminder[] = [];
  const people = new Set(input.medications.map((m) => m.patientId));
  for (const patientId of people) {
    const own = (r: { patientId: string }) => r.patientId === patientId;
    const rows = dosePanel({
      medications: input.medications.filter((m) => own(m) && m.reminderEnabled && m.active),
      changes: input.changes.filter(own),
      logs: input.logs.filter(own),
      now: input.now,
    });
    for (const row of rows)
      if (row.state === 'due' && input.now - row.scheduledTs < GRACE_MS)
        out.push({
          key: row.key,
          patientId,
          medicationId: row.medicationId,
          name: row.name,
          dose: row.dose,
          unit: row.unit,
          scheduledTime: row.scheduledTime,
          scheduledTs: row.scheduledTs,
        });
  }
  return out.sort((a, b) => a.scheduledTs - b.scheduledTs);
}
