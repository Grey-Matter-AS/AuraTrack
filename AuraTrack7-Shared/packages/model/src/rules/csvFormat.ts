import { PhaseNameSchema, type BodyArea, type PhaseName } from '../schemas';

// The CSV format (F-705 export, and its import): one block per kind of record, each a title line, a heading line and rows.
// The export writes it and the import reads it, so an exported file can be edited in a spreadsheet and brought back. The empty
// export is the template. Columns are found by their heading, so their order does not matter and extra columns are ignored.
// Words are in the person's language for reading; the `...Code(s)` columns hold the codes the import reads first.

export const CSV_SECTIONS = {
  SEIZURES: [
    'id',
    'date',
    'time',
    'timeZone',
    'type',
    'typeCode',
    'profile',
    'ilae2025Type',
    'ilae2025Start',
    'ilae2025Remembered',
    'ilae2025Responded',
    'ilae2025BilateralTonicClonic',
    'ilae2025Observable',
    'ilae2025Kind',
    'seizureSeconds',
    'totalSeconds',
    'auraEnd',
    'seizureEnd',
    'recoveryEnd',
    'symptoms',
    'symptomCodes',
    'triggers',
    'triggerCodes',
    'afterFindings',
    'afterFindingCodes',
    'afterFindingAreas',
    'recoveryMinutes',
    'warningSecondsBefore',
    'notes',
    'recordedBy',
    'status',
    'autoStopped',
    'enteredLater',
    'recordedWhileLocked',
    'video',
  ],
  BETWEEN_SEIZURES: ['id', 'date', 'time', 'symptom', 'symptomCode', 'area', 'areaCode', 'notes', 'recordedBy'],
  MEDICATIONS: [
    'id',
    'name',
    'activeIngredient',
    'form',
    'dose',
    'unit',
    'frequency',
    'scheduledTimes',
    'scheduledDays',
    'slotDoses',
    'rescue',
    'showInEmergency',
    'reminder',
    'active',
    'startedAt',
    'stoppedAt',
  ],
  MEDICATION_LOGS: ['id', 'medicationId', 'medication', 'takenAt', 'scheduledTime', 'status', 'dose', 'unit', 'note'],
  MEDICATION_CHANGES: [
    'id',
    'medicationId',
    'medication',
    'type',
    'effectiveAt',
    'changedFields',
    'fromDose',
    'toDose',
    'note',
    // The medicine as it is after the change (empty for a stop); an empty cell keeps what it was before
    'name',
    'activeIngredient',
    'form',
    'dose',
    'unit',
    'frequency',
    'scheduledTimes',
    'scheduledDays',
    'slotDoses',
  ],
  WELLBEING_ENTRIES: ['id', 'recordedAt', 'day', 'mood', 'moodCode', 'intensity', 'factors', 'factorCodes', 'notes'],
  EEG_SESSIONS: [
    'id',
    'startTime',
    'plannedEndTime',
    'actualEndTime',
    'durationPreset',
    'customHours',
    'title',
    'status',
    'notes',
  ],
  EEG_ACTIVITIES: [
    'id',
    'sessionId',
    'kind',
    'activity',
    'activityCode',
    'customText',
    'mood',
    'moodCode',
    'startTime',
    'endTime',
    'durationSec',
    'linkedSeizureId',
    'notes',
  ],
} as const;
export type CsvSection = keyof typeof CSV_SECTIONS;
export const CSV_SECTION_NAMES = Object.keys(CSV_SECTIONS) as CsvSection[];

/** Several values in one cell are separated by this. */
export const CSV_LIST = '|';

/** A body area as one token: `region`, `region/subRegion`, `region/subRegion/part` or `region//part`. */
export function areaToken(area: BodyArea | null): string {
  if (!area) return '';
  if (area.part !== null) return `${area.region}/${area.subRegion ?? ''}/${area.part}`;
  return area.subRegion !== null ? `${area.region}/${area.subRegion}` : area.region;
}

export function parseAreaToken(token: string): BodyArea | null {
  const text = token.trim();
  if (text === '') return null;
  const [region = '', sub = '', part = ''] = text.split('/').map((x) => x.trim());
  if (region === '') return null;
  return { region, subRegion: sub === '' ? null : sub, part: part === '' ? null : part };
}

/** A symptom as one token: `code`, `code@area` and/or `code#phase` (before, during or after). */
export function symptomToken(code: string, area: BodyArea | null, phase?: PhaseName): string {
  return `${code}${area ? `@${areaToken(area)}` : ''}${phase ? `#${phase}` : ''}`;
}

export function parseSymptomToken(token: string): { code: string; area: BodyArea | null; phase: PhaseName | null } {
  let rest = token.trim();
  let phase: PhaseName | null = null;
  const hash = rest.lastIndexOf('#');
  if (hash >= 0) {
    const p = rest.slice(hash + 1).trim();
    const parsed = PhaseNameSchema.safeParse(p); // the four phases, and the three written before 7.2
    if (parsed.success) phase = parsed.data;
    rest = rest.slice(0, hash);
  }
  const at = rest.indexOf('@');
  const code = (at >= 0 ? rest.slice(0, at) : rest).trim();
  return { code, area: at >= 0 ? parseAreaToken(rest.slice(at + 1)) : null, phase };
}

/** An after-seizure finding as one token: `code`, or `code@area+area` with the places it was seen. */
export function findingToken(code: string, areas: readonly BodyArea[]): string {
  return areas.length > 0 ? `${code}@${areas.map(areaToken).join('+')}` : code;
}

export function parseFindingToken(token: string): { code: string; areas: BodyArea[] } {
  const text = token.trim();
  const at = text.indexOf('@');
  if (at < 0) return { code: text, areas: [] };
  return {
    code: text.slice(0, at).trim(),
    areas: text
      .slice(at + 1)
      .split('+')
      .map(parseAreaToken)
      .filter((a): a is BodyArea => a !== null),
  };
}
