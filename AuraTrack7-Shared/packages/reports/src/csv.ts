import {
  BODY_REGIONS,
  EEG_ACTIVITIES,
  FINDINGS,
  MOODS,
  SEIZURE_TYPES,
  SYMPTOMS,
  TRIGGERS,
  WELLBEING_FACTORS,
  CSV_LIST,
  CSV_SECTIONS,
  areaToken,
  findingToken,
  localDateKey,
  symptomToken,
  type CsvSection,
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
import { LANGUAGES, labelText } from '@auratrack/i18n';
import { areaLabel } from './neurologist';

// R-5: everything in the period as CSV, one block per kind of record with its own heading line, for a spreadsheet. Words are
// in the person's language and the codes are kept beside them, so the file reads well and still sorts and counts reliably.
// The columns are the shared format (model/rules/csvFormat.ts): the import reads the same file back, and the export with
// nothing in it is the template.

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
const slots = (doses: Readonly<Record<string, number>>) =>
  Object.entries(doses)
    .map(([time, dose]) => `${time}=${dose}`)
    .join(CSV_LIST);
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
  const head = (name: CsvSection) => CSV_SECTIONS[name];
  const sections = [
    block(
      'SEIZURES',
      head('SEIZURES'),
      seizures.map((s) => {
        const symptoms = [...s.symptoms].sort((a, b) => a.order - b.order);
        return [
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
          symptoms.map((x) => `${label(x.code)}${x.area ? ` (${areaLabel(x.area, label)})` : ''}`).join(CSV_LIST),
          symptoms.map((x) => symptomToken(x.code, x.area, x.phase)).join(CSV_LIST),
          s.triggerCodes.map(label).join(CSV_LIST),
          s.triggerCodes.join(CSV_LIST),
          s.afterFindings.map((f) => f.customLabel ?? label(f.code)).join(CSV_LIST),
          s.afterFindings.map((f) => findingToken(f.code, f.areas)).join(CSV_LIST),
          s.afterFindings.flatMap((f) => f.areas.map((a) => areaLabel(a, label))).join(CSV_LIST),
          s.recoveryMinutes,
          s.prodromeSecondsBefore ?? '',
          s.notes,
          s.recordedBy,
          s.status,
          s.isEmergencyStop,
          [s.phases.start, s.phases.auraEnd, s.phases.seizureEnd, s.phases.recoveryEnd].some(
            (m) => m?.source === 'entered-later',
          ),
          s.recordedWhileLocked === true,
          s.video?.fileName ?? '',
        ];
      }),
    ),
    block(
      'BETWEEN_SEIZURES',
      head('BETWEEN_SEIZURES'),
      input.between
        .filter((b) => within(b.occurredAt))
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .map((b) => [
          b.id,
          localDateKey(b.occurredAt),
          clockText(b.occurredAt),
          label(b.symptomCode),
          b.symptomCode,
          areaLabel(b.area, label),
          areaToken(b.area),
          b.notes,
          b.recordedBy,
        ]),
    ),
    block(
      'MEDICATIONS',
      head('MEDICATIONS'),
      input.medications.map((m) => [
        m.id,
        m.name,
        m.activeIngredient,
        m.form,
        m.dose,
        m.unit,
        m.frequency,
        m.scheduledTimes.join(CSV_LIST),
        m.scheduledDays.join(CSV_LIST),
        slots(m.slotDoses),
        m.isRescue,
        m.showInEmergency,
        m.reminderEnabled,
        m.active,
        stamp(m.startedAt),
        stamp(m.stoppedAt),
      ]),
    ),
    block(
      'MEDICATION_LOGS',
      head('MEDICATION_LOGS'),
      input.doses
        .filter((d) => within(d.takenAt))
        .sort((a, b) => b.takenAt - a.takenAt)
        .map((d) => [
          d.id,
          d.medicationId,
          names.get(d.medicationId) ?? '',
          stamp(d.takenAt),
          d.scheduledTime ?? '',
          d.status,
          d.doseSnapshot,
          d.unitSnapshot,
          d.note,
        ]),
    ),
    block(
      'MEDICATION_CHANGES',
      head('MEDICATION_CHANGES'),
      input.changes
        .filter((c) => !c.isBaseline && within(c.effectiveAt))
        .sort((a, b) => a.effectiveAt - b.effectiveAt)
        .map((c) => [
          c.id,
          c.medicationId,
          c.medicationName,
          c.type,
          stamp(c.effectiveAt),
          c.changedFields.join(CSV_LIST),
          c.from?.dose ?? '',
          c.to?.dose ?? '',
          c.note,
          c.to?.name ?? '',
          c.to?.activeIngredient ?? '',
          c.to?.form ?? '',
          c.to?.dose ?? '',
          c.to?.unit ?? '',
          c.to?.frequency ?? '',
          c.to ? c.to.scheduledTimes.join(CSV_LIST) : '',
          c.to ? c.to.scheduledDays.join(CSV_LIST) : '',
          c.to ? slots(c.to.slotDoses) : '',
        ]),
    ),
    block(
      'WELLBEING_ENTRIES',
      head('WELLBEING_ENTRIES'),
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
          Object.entries(w.factors)
            .map(([k, v]) => `${label(k)}=${v}`)
            .join(CSV_LIST),
          Object.entries(w.factors)
            .map(([k, v]) => `${k}=${v}`)
            .join(CSV_LIST),
          w.notes,
        ]),
    ),
    block(
      'EEG_SESSIONS',
      head('EEG_SESSIONS'),
      input.eegSessions
        .filter((s) => within(s.startTime))
        .map((s) => [
          s.id,
          stamp(s.startTime),
          stamp(s.plannedEndTime),
          stamp(s.actualEndTime),
          s.durationPreset,
          s.customHours ?? '',
          s.title,
          s.status,
          s.notes,
        ]),
    ),
    block(
      'EEG_ACTIVITIES',
      head('EEG_ACTIVITIES'),
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
          a.moodCode ?? '',
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

/** The template for the import: the export's blocks and headings with no rows. */
export const csvTemplate = (label: (code: string) => string): string =>
  buildCsv({
    seizures: [],
    between: [],
    medications: [],
    doses: [],
    changes: [],
    wellbeing: [],
    eegSessions: [],
    eegActivities: [],
    from: 0,
    to: 0,
    label,
  });

/** Every code a file may use, with its name in each of the nine languages, for filling in the template. */
export function buildCodeList(): string {
  const body = BODY_REGIONS.flatMap((r) => [r.code, ...r.subRegions.flatMap((s) => [s.code, ...s.parts.map((p) => p.code)])]);
  const kinds: [string, readonly string[]][] = [
    ['seizure type (typeCode)', SEIZURE_TYPES.map((x) => x.code)],
    ['symptom (symptomCodes)', SYMPTOMS.map((x) => x.code)],
    ['body area (after @)', body],
    ['trigger (triggerCodes)', TRIGGERS.map((x) => x.code)],
    ['after the seizure (afterFindingCodes)', FINDINGS.map((x) => x.code)],
    ['mood (moodCode)', MOODS.map((x) => x.code)],
    ['wellbeing factor (factorCodes)', WELLBEING_FACTORS.map((x) => x.code)],
    ['EEG activity (activityCode)', EEG_ACTIVITIES.map((x) => x.code)],
  ];
  const lines = [['kind', 'code', ...LANGUAGES].join(',')];
  for (const [kind, codes] of kinds)
    for (const code of codes) lines.push(row([kind, code, ...LANGUAGES.map((l) => labelText(l, code))]));
  return `${lines.join('\n')}\n`;
}
