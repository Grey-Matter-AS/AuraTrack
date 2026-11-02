import {
  localDateKey,
  seizureSeconds,
  totalSeconds,
  type DoseLog,
  type EegActivity,
  type EegSession,
  type InterictalEvent,
  type Medication,
  type MedicationChange,
  type Seizure,
  type WellbeingEntry,
} from '@auratrack/model';
import { areaLabel } from './neurologist';

// R-5: everything in the period as CSV, one block per kind of record with its own heading line, for a spreadsheet. Words are
// in the person's language and the codes are kept beside them, so the file reads well and still sorts and counts reliably.

/** A cell: quoted, quotes doubled, and a text that a spreadsheet would run as a formula is made plain text. */
export function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const plain = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${plain.replace(/"/g, '""')}"`;
}

const row = (cells: readonly (string | number | boolean | null | undefined)[]): string => cells.map(cell).join(',');
const block = (title: string, head: readonly string[], rows: (string | number | boolean | null | undefined)[][]): string =>
  [title, head.join(','), ...rows.map(row)].join('\n');

const two = (n: number) => String(n).padStart(2, '0');
export const clockText = (at: number): string => {
  const d = new Date(at);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};
const stamp = (at: number | null) => (at === null ? '' : `${localDateKey(at)} ${clockText(at)}`);

export interface CsvInput {
  seizures: readonly Seizure[];
  between: readonly InterictalEvent[];
  medications: readonly Medication[];
  doses: readonly DoseLog[];
  changes: readonly MedicationChange[];
  wellbeing: readonly WellbeingEntry[];
  eegSessions: readonly EegSession[];
  eegActivities: readonly EegActivity[];
  from: number;
  to: number;
  label: (code: string) => string;
}

export function buildCsv(input: CsvInput): string {
  const { label, from, to } = input;
  const within = (at: number) => at >= from && at <= to;
  const seizures = input.seizures
    .filter((s) => s.status !== 'in_progress' && s.cancelled !== true && within(s.phases.start.at))
    .sort((a, b) => b.phases.start.at - a.phases.start.at);
  const names = new Map(input.medications.map((m) => [m.id, m.name]));
  const sections = [
    block(
      'SEIZURES',
      [
        'id', 'date', 'time', 'timeZone', 'type', 'typeCode', 'seizureSeconds', 'totalSeconds', 'auraEnd', 'seizureEnd', 'recoveryEnd',
        'symptoms', 'triggers', 'afterFindings', 'afterFindingAreas', 'recoveryMinutes', 'notes', 'recordedBy', 'status', 'autoStopped',
        'enteredLater', 'recordedWhileLocked', 'video',
      ],
      seizures.map((s) => [
        s.id,
        localDateKey(s.phases.start.at),
        clockText(s.phases.start.at),
        s.timeZone,
        s.typeCode ? label(s.typeCode) : '',
        s.typeCode ?? '',
        seizureSeconds(s.phases),
        totalSeconds(s.phases),
        stamp(s.phases.auraEnd?.at ?? null),
        stamp(s.phases.seizureEnd?.at ?? null),
        stamp(s.phases.recoveryEnd?.at ?? null),
        [...s.symptoms]
          .sort((a, b) => a.order - b.order)
          .map((x) => `${label(x.code)}${x.area ? ` (${areaLabel(x.area, label)})` : ''}`)
          .join('|'),
        s.triggerCodes.map(label).join('|'),
        s.afterFindings.map((f) => f.customLabel ?? label(f.code)).join('|'),
        s.afterFindings.flatMap((f) => f.areas.map((a) => areaLabel(a, label))).join('|'),
        s.recoveryMinutes,
        s.notes,
        s.recordedBy,
        s.status,
        s.isEmergencyStop,
        [s.phases.start, s.phases.auraEnd, s.phases.seizureEnd, s.phases.recoveryEnd].some((m) => m?.source === 'entered-later'),
        s.recordedWhileLocked === true,
        s.video?.fileName ?? '',
      ]),
    ),
    block(
      'BETWEEN_SEIZURES',
      ['id', 'date', 'time', 'symptom', 'symptomCode', 'area', 'notes'],
      input.between
        .filter((b) => within(b.occurredAt))
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .map((b) => [b.id, localDateKey(b.occurredAt), clockText(b.occurredAt), label(b.symptomCode), b.symptomCode, areaLabel(b.area, label), b.notes]),
    ),
    block(
      'MEDICATIONS',
      ['id', 'name', 'activeIngredient', 'form', 'dose', 'unit', 'frequency', 'scheduledTimes', 'slotDoses', 'rescue', 'active', 'startedAt', 'stoppedAt'],
      input.medications.map((m) => [
        m.id,
        m.name,
        m.activeIngredient,
        m.form,
        m.dose,
        m.unit,
        m.frequency,
        m.scheduledTimes.join('|'),
        Object.entries(m.slotDoses).map(([t, d]) => `${t}=${d}`).join('|'),
        m.isRescue,
        m.active,
        stamp(m.startedAt),
        stamp(m.stoppedAt),
      ]),
    ),
    block(
      'MEDICATION_LOGS',
      ['id', 'medicationId', 'medication', 'takenAt', 'scheduledTime', 'status', 'dose', 'unit', 'note'],
      input.doses
        .filter((d) => within(d.takenAt))
        .sort((a, b) => b.takenAt - a.takenAt)
        .map((d) => [d.id, d.medicationId, names.get(d.medicationId) ?? '', stamp(d.takenAt), d.scheduledTime ?? '', d.status, d.doseSnapshot, d.unitSnapshot, d.note]),
    ),
    block(
      'MEDICATION_CHANGES',
      ['id', 'medicationId', 'medication', 'type', 'effectiveAt', 'changedFields', 'fromDose', 'toDose', 'note'],
      input.changes
        .filter((c) => !c.isBaseline && within(c.effectiveAt))
        .sort((a, b) => a.effectiveAt - b.effectiveAt)
        .map((c) => [c.id, c.medicationId, c.medicationName, c.type, stamp(c.effectiveAt), c.changedFields.join('|'), c.from?.dose ?? '', c.to?.dose ?? '', c.note]),
    ),
    block(
      'WELLBEING_ENTRIES',
      ['id', 'recordedAt', 'day', 'mood', 'moodCode', 'intensity', 'factors', 'notes'],
      input.wellbeing
        .filter((w) => within(w.recordedAt))
        .sort((a, b) => b.recordedAt - a.recordedAt)
        .map((w) => [
          w.id,
          stamp(w.recordedAt),
          w.dayKey,
          label(w.moodCode),
          w.moodCode,
          w.intensity,
          Object.entries(w.factors).map(([k, v]) => `${label(k)}=${v}`).join('|'),
          w.notes,
        ]),
    ),
    block(
      'EEG_SESSIONS',
      ['id', 'startTime', 'plannedEndTime', 'actualEndTime', 'durationPreset', 'title', 'status', 'notes'],
      input.eegSessions
        .filter((s) => within(s.startTime))
        .map((s) => [s.id, stamp(s.startTime), stamp(s.plannedEndTime), stamp(s.actualEndTime), s.durationPreset, s.title, s.status, s.notes]),
    ),
    block(
      'EEG_ACTIVITIES',
      ['id', 'sessionId', 'kind', 'activity', 'activityCode', 'customText', 'mood', 'startTime', 'endTime', 'durationSec', 'linkedSeizureId', 'notes'],
      input.eegActivities
        .filter((a) => within(a.startTime))
        .map((a) => [
          a.id,
          a.sessionId,
          a.kind,
          a.activityCode ? label(a.activityCode) : '',
          a.activityCode ?? '',
          a.customText,
          a.moodCode ? label(a.moodCode) : '',
          stamp(a.startTime),
          stamp(a.endTime),
          a.durationSec,
          a.linkedSeizureId ?? '',
          a.notes,
        ]),
    ),
  ];
  return `${sections.join('\n\n')}\n`;
}
