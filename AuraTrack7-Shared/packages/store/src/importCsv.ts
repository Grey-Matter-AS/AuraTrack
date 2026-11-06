import { codesForLabel } from '@auratrack/i18n';
import {
  CSV_LIST,
  DATA_VERSION,
  ILAE_2025_GENERALIZED,
  ilae2025ForSaving,
  CSV_SECTIONS,
  CSV_SECTION_NAMES,
  DOSE_STATUSES,
  FrequencySchema,
  RECORD_SCHEMAS,
  diffRegimen,
  isCatalogueCode,
  localDateKey,
  parseAreaToken,
  parseFindingToken,
  parseSymptomToken,
  planMedicationChange,
  regimenSnapshot,
  type BodyArea,
  type ChangeType,
  type CsvSection,
  type FindingEntry,
  type Medication,
  type Regimen,
  type SymptomEntry,
} from '@auratrack/model';
import { derivedId } from './derivedId';

const ANSWERS = ['yes', 'no', 'unknown'] as const;
import type { JsonValue } from './merge';
import type { ImportDraft, Store, StoredType } from './store';

// Bringing records in from a CSV file in the export's own format (model/rules/csvFormat.ts): the template, or an exported
// file edited in a spreadsheet. It is checked first and nothing is written until the person says so. Nothing is guessed:
// a value that cannot be read exactly is a problem with its line and reason, and the row is left out. Records already in
// the app are never changed: a row whose id is there, or that has the same time as one that is, is counted as already there.
// Every imported record keeps its CSV row (in `importedFrom`), and the same file imported twice adds nothing the second time.

export type CsvDateOrder = 'dmy' | 'mdy' | 'ymd';

export interface CsvImportOptions {
  /** The person the records belong to. */
  patientId: string;
  /** How to read a date like 03/04/2026 (the person's date setting). Dates written 2026-04-03 are always clear. */
  dateOrder: CsvDateOrder;
  /** Stored with the seizures and between-seizures entries. Default: this device's. */
  timeZone?: string;
  now?: number;
}

export interface CsvProblem {
  section: CsvSection | 'file';
  /** The line in the file, from 1. */
  line: number;
  reason: string;
}

export interface CsvSectionCount {
  /** Rows with something in them. */
  found: number;
  ready: number;
  /** Already in the app (same id, or the same time): left out. */
  duplicates: number;
  rejected: number;
}

export interface CsvImportReport {
  delimiter: ',' | ';' | '\t';
  sections: Partial<Record<CsvSection, CsvSectionCount>>;
  problems: CsvProblem[];
  /** Blocks whose title the import does not know: left out whole. */
  unknownSections: string[];
  /** How the first rows' times were read, so a wrong date order shows before anything is written. */
  examples: { section: CsvSection; line: number; read: string }[];
  totals: CsvSectionCount;
  /** Rows neither ready, already there nor rejected with a reason. Always 0. */
  unaccounted: number;
  /** Records written (0 for a check). */
  applied: number;
}

// ---- reading the file

const TITLES = new Set<string>(CSV_SECTION_NAMES);

/** The file as rows of cells (RFC 4180 quoting; a quoted cell may hold the separator, quotes and new lines). */
export function parseCsvRows(text: string, delimiter: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cells.push(cell);
      rows.push({ cells, line: rowLine });
      cells = [];
      cell = '';
      line++;
      rowLine = line;
    } else cell += ch;
  }
  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    rows.push({ cells, line: rowLine });
  }
  return rows;
}

/** A spreadsheet in most European languages saves with semicolons; the heading lines say which one this file uses. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const raw of text.split(/\r?\n/).slice(0, 200)) {
    const plain = raw.replace(/"[^"]*"/g, '');
    for (const d of [',', ';', '\t'] as const) counts[d] += plain.split(d).length - 1;
  }
  return counts[';'] > counts[','] && counts[';'] >= counts['\t'] ? ';' : counts['\t'] > counts[','] ? '\t' : ',';
}

/** The export writes a leading ' before a text a spreadsheet would run as a formula; it is not part of the value. */
const clean = (cell: string): string => {
  const t = cell.trim();
  return /^'[=+\-@]/.test(t) ? t.slice(1) : t;
};

interface Block {
  section: CsvSection;
  rows: { values: Record<string, string>; line: number }[];
}

function blocksOf(text: string, delimiter: string, report: CsvImportReport): Block[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''), delimiter);
  const blocks: Block[] = [];
  let current: { section: CsvSection | null; head: string[] | null; block: Block | null } | null = null;
  for (const row of rows) {
    const cells = row.cells.map(clean);
    const filled = cells.filter((c) => c !== '');
    if (filled.length === 0) {
      current = null; // a blank line ends a block
      continue;
    }
    const first = (cells[0] ?? '').toUpperCase();
    if (filled.length === 1 && cells[0] !== '' && /^[A-Z_]+$/.test(first)) {
      if (TITLES.has(first)) {
        const block: Block = { section: first as CsvSection, rows: [] };
        blocks.push(block);
        current = { section: block.section, head: null, block };
      } else {
        report.unknownSections.push(cells[0] as string);
        current = { section: null, head: null, block: null };
      }
      continue;
    }
    if (!current) {
      report.problems.push({ section: 'file', line: row.line, reason: 'is not under a block title such as SEIZURES' });
      continue;
    }
    if (!current.head) {
      current.head = cells;
      continue;
    }
    if (!current.block) continue; // an unknown block, already listed
    const values: Record<string, string> = {};
    current.head.forEach((name, i) => {
      if (name !== '') values[name] = cells[i] ?? '';
    });
    current.block.rows.push({ values, line: row.line });
  }
  return blocks;
}

// ---- reading one value

class RowProblem extends Error {}
const fail = (reason: string): never => {
  throw new RowProblem(reason);
};

const pad = (n: number) => String(n).padStart(2, '0');

function readDay(text: string, order: CsvDateOrder, column: string): { y: number; m: number; d: number } {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t)))
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t))) {
    const [a, b] = [Number(match[1]), Number(match[2])];
    y = Number(match[3]);
    if (order === 'mdy') [m, d] = [a, b];
    else if (order === 'dmy') [d, m] = [a, b];
    else return fail(`${column}: "${t}" could be read two ways; write it as year-month-day, like 2026-04-03`);
  } else return fail(`${column}: "${t}" is not a date (write it like 2026-04-03)`);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d)
    return fail(`${column}: "${t}" is not a real date`);
  return { y, m, d };
}

function readClock(text: string, column: string): { h: number; mi: number; s: number } {
  const t = text.trim().toUpperCase();
  const match = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?$/.exec(t);
  if (!match) return fail(`${column}: "${text.trim()}" is not a time (write it like 14:05)`);
  let h = Number(match[1]);
  const [mi, s] = [Number(match[2]), Number(match[3] ?? 0)];
  if (match[4]) {
    if (h < 1 || h > 12) return fail(`${column}: "${text.trim()}" is not a time`);
    h = (h % 12) + (match[4] === 'PM' ? 12 : 0);
  }
  if (h > 23 || mi > 59 || s > 59) return fail(`${column}: "${text.trim()}" is not a time`);
  return { h, mi, s };
}

function instantOf(
  day: { y: number; m: number; d: number },
  clock: { h: number; mi: number; s: number },
  column: string,
) {
  const date = new Date(day.y, day.m - 1, day.d, clock.h, clock.mi, clock.s);
  if (date.getHours() !== clock.h || date.getMinutes() !== clock.mi)
    return fail(`${column}: ${pad(clock.h)}:${pad(clock.mi)} did not exist on that day (the clocks changed)`);
  return date.getTime();
}

const shown = (at: number) => {
  const d = new Date(at);
  return `${localDateKey(at)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

class Row {
  constructor(
    readonly values: Record<string, string>,
    readonly line: number,
    private readonly order: CsvDateOrder,
    private readonly decimalComma: boolean,
  ) {}
  text(column: string, max = 5000): string {
    const value = this.values[column] ?? '';
    if (value.length > max) return fail(`${column}: longer than ${max} characters`);
    return value;
  }
  has(column: string): boolean {
    return (this.values[column] ?? '') !== '';
  }
  /** One of the given codes, or null when empty. */
  choice<T extends string>(column: string, allowed: readonly T[]): T | null {
    const raw = this.text(column, 60).trim();
    if (raw === '') return null;
    return allowed.find((x) => x === raw) ?? fail(`${column}: "${raw}" is not one of ${allowed.join(', ')}`);
  }
  required(column: string): string {
    return this.has(column) ? this.text(column) : fail(`${column}: is empty`);
  }
  number(column: string): number | null {
    const raw = this.text(column);
    if (raw === '') return null;
    const t = this.decimalComma ? raw.replace(/^(-?\d+),(\d+)$/, '$1.$2') : raw;
    const n = Number(t);
    return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(t) ? n : fail(`${column}: "${raw}" is not a number`);
  }
  whole(column: string, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
    const n = this.number(column);
    if (n === null) return null;
    return Number.isInteger(n) && n >= min && n <= max ? n : fail(`${column}: ${n} is not a whole number from ${min}`);
  }
  bool(column: string, otherwise: boolean): boolean {
    const t = this.text(column).toLowerCase();
    if (t === '') return otherwise;
    if (['true', 'yes', '1', 'sann', 'ja', 'oui', 'sí', 'si', 'kyllä', 'wahr', 'vrai', 'verdadero'].includes(t))
      return true;
    if (['false', 'no', '0', 'usann', 'nei', 'nej', 'non', 'ei', 'falsch', 'faux', 'falso'].includes(t)) return false;
    return fail(`${column}: "${this.text(column)}" is not yes or no`);
  }
  day(column: string): string {
    const d = readDay(this.required(column), this.order, column);
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  /** A date and a time in two columns. */
  at(dateColumn: string, timeColumn: string): number {
    return instantOf(
      readDay(this.required(dateColumn), this.order, dateColumn),
      readClock(this.required(timeColumn), timeColumn),
      timeColumn,
    );
  }
  /** "2026-04-03 14:05" in one column, or null when empty. */
  stamp(column: string): number | null {
    const raw = this.text(column);
    if (raw === '') return null;
    const match = /^(\S+)[ T]+(.+)$/.exec(raw);
    if (!match) return fail(`${column}: "${raw}" needs a date and a time, like 2026-04-03 14:05`);
    return instantOf(readDay(match[1] as string, this.order, column), readClock(match[2] as string, column), column);
  }
  clock(column: string): string | null {
    const raw = this.text(column);
    if (raw === '') return null;
    const c = readClock(raw, column);
    return `${pad(c.h)}:${pad(c.mi)}`;
  }
  list(column: string): string[] {
    return this.text(column)
      .split(CSV_LIST)
      .map((x) => x.trim())
      .filter((x) => x !== '');
  }
  oneOf<T extends string>(column: string, allowed: readonly T[], otherwise?: T): T {
    const t = this.text(column).trim();
    if (t === '' && otherwise !== undefined) return otherwise;
    const found = allowed.find((a) => a.toLowerCase() === t.toLowerCase());
    return found ?? fail(`${column}: "${t}" is not one of ${allowed.join(', ')}`);
  }
}

// ---- codes

type Kind = 'form' | 'symptom' | 'trigger' | 'finding' | 'mood' | 'activity' | 'factor' | 'body';
const PREFIX: Record<Kind, string> = {
  form: 'form.',
  symptom: 'symptom.',
  trigger: 'trigger.',
  finding: 'after.',
  mood: 'mood.',
  activity: 'activity.',
  factor: 'factor.',
  body: 'body.',
};
const CUSTOM_KIND: Partial<Record<Kind, string>> = {
  symptom: 'symptom',
  trigger: 'trigger',
  finding: 'finding',
  mood: 'mood',
  activity: 'activity',
  factor: 'factor',
};

class Codes {
  constructor(private readonly customs: { code: string; kind: string; label: string }[]) {}
  private fits(code: string, kind: Kind): boolean {
    if (code.startsWith('custom.')) return this.customs.some((c) => c.code === code && c.kind === CUSTOM_KIND[kind]);
    return code.startsWith(PREFIX[kind]) && isCatalogueCode(code);
  }
  /** A code as written, which must exist and be of the right kind. */
  code(code: string, kind: Kind, column: string): string {
    return this.fits(code, kind) ? code : fail(`${column}: "${code}" is not a known code here`);
  }
  /** A name in any of the nine languages, or the household's own word, which must name exactly one code of this kind. */
  named(name: string, kind: Kind, column: string): string {
    const own = this.customs.filter(
      (c) => c.kind === CUSTOM_KIND[kind] && c.label.toLowerCase() === name.toLowerCase(),
    );
    const codes = [...new Set([...codesForLabel(name).filter((c) => this.fits(c, kind)), ...own.map((c) => c.code)])];
    if (codes.length === 1) return codes[0] as string;
    return codes.length === 0
      ? fail(`${column}: "${name}" is not a name the app knows; use the code column`)
      : fail(`${column}: "${name}" could be more than one thing; use the code column`);
  }
  either(row: Row, codeColumn: string, nameColumn: string, kind: Kind): string | null {
    if (row.has(codeColumn)) return this.code(row.text(codeColumn), kind, codeColumn);
    if (row.has(nameColumn)) return this.named(row.text(nameColumn), kind, nameColumn);
    return null;
  }
  area(area: BodyArea | null, column: string): BodyArea | null {
    if (!area) return null;
    for (const code of [area.region, area.subRegion, area.part])
      if (code !== null && !this.fits(code, 'body')) fail(`${column}: "${code}" is not a body area the app knows`);
    return area;
  }
}

// ---- the plan

interface Existing {
  ids: Set<string>;
  seizureMinutes: Set<number>;
  betweenMinutes: Set<string>;
  doseMinutes: Set<string>;
  wellbeingMinutes: Set<number>;
  sessionStarts: Set<number>;
  medications: Medication[];
  sessions: Set<string>;
  seizures: Set<string>;
}

const minute = (at: number) => Math.floor(at / 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function planCsvImport(
  store: Store,
  text: string,
  options: CsvImportOptions,
): Promise<{ report: CsvImportReport; drafts: ImportDraft[] }> {
  const now = options.now ?? Date.now();
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { householdId, deviceId } = store.info;
  const patientId = options.patientId;
  const delimiter = detectDelimiter(text);
  const report: CsvImportReport = {
    delimiter,
    sections: {},
    problems: [],
    unknownSections: [],
    examples: [],
    totals: { found: 0, ready: 0, duplicates: 0, rejected: 0 },
    unaccounted: 0,
    applied: 0,
  };
  const blocks = blocksOf(text, delimiter, report);
  const codes = new Codes(store.list('customCode').map((c) => ({ code: c.code, kind: c.kind, label: c.label })));
  const mine = <T extends { patientId: string }>(list: T[]) => list.filter((r) => r.patientId === patientId);
  const existing: Existing = {
    ids: new Set(),
    seizureMinutes: new Set(mine(store.list('seizure')).map((s) => minute(s.phases.start.at))),
    betweenMinutes: new Set(mine(store.list('interictalEvent')).map((b) => `${b.symptomCode}@${minute(b.occurredAt)}`)),
    doseMinutes: new Set(mine(store.list('doseLog')).map((d) => `${d.medicationId}@${minute(d.takenAt)}`)),
    wellbeingMinutes: new Set(mine(store.list('wellbeingEntry')).map((w) => minute(w.recordedAt))),
    sessionStarts: new Set(mine(store.list('eegSession')).map((s) => minute(s.startTime))),
    medications: mine(store.list('medication')),
    sessions: new Set(mine(store.list('eegSession')).map((s) => s.id)),
    seizures: new Set(mine(store.list('seizure')).map((s) => s.id)),
  };
  const kinds: StoredType[] = [
    'seizure',
    'interictalEvent',
    'medication',
    'medicationChange',
    'doseLog',
    'wellbeingEntry',
    'eegSession',
    'eegActivity',
  ];
  for (const type of kinds) for (const r of store.list(type) as { id: string }[]) existing.ids.add(r.id);

  const drafts: ImportDraft[] = [];
  const count = (section: CsvSection) =>
    (report.sections[section] ??= { found: 0, ready: 0, duplicates: 0, rejected: 0 });
  const reject = (section: CsvSection, line: number, reason: string) => {
    report.problems.push({ section, line, reason });
    count(section).rejected++;
  };
  const example = (section: CsvSection, line: number, at: number) => {
    if (report.examples.filter((e) => e.section === section).length < 3)
      report.examples.push({ section, line, read: shown(at) });
  };
  const base = (id: string) => ({ id, householdId, patientId, deviceId, createdAt: now, dataVersion: DATA_VERSION });
  /** The id a row asks for (kept when it is a valid id), or one made from what identifies it, so a repeat is the same. */
  const idFor = async (row: Row, type: string, ...key: string[]) => {
    const own = row.text('id').trim();
    return UUID.test(own) ? own.toLowerCase() : derivedId(householdId, 'csv', type, patientId, ...key);
  };
  const emit = async (section: CsvSection, row: Row, type: StoredType, values: Record<string, unknown>) => {
    const fields = { ...values, importedFrom: { csv: row.values } } as unknown as Record<string, JsonValue>;
    const checked = (
      RECORD_SCHEMAS[type] as {
        safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
      }
    ).safeParse(fields);
    if (!checked.success)
      fail((checked.error?.issues ?? []).map((i) => `${i.path.map(String).join('.')}: ${i.message}`).join('; '));
    const recordId = values.id as string;
    drafts.push({
      entryId: await derivedId('entry', 'csv', recordId),
      recordId,
      type,
      patientId,
      kind: 'import',
      fields,
    });
    existing.ids.add(recordId);
    count(section).ready++;
  };
  const sectionRows = (section: CsvSection) =>
    blocks
      .filter((b) => b.section === section)
      .flatMap((b) => b.rows)
      .map((r) => new Row(r.values, r.line, options.dateOrder, delimiter === ';'));
  /** Runs each row; a problem rejects that row only. */
  const each = async (section: CsvSection, work: (row: Row) => Promise<unknown>) => {
    for (const row of sectionRows(section)) {
      count(section).found++;
      try {
        if ((await work(row)) === 'duplicate') count(section).duplicates++;
      } catch (error) {
        if (!(error instanceof RowProblem)) throw error;
        reject(section, row.line, error.message);
      }
    }
  };
  const duplicateId = (id: string) => existing.ids.has(id);

  // Seizures
  await each('SEIZURES', async (row) => {
    const start = row.at('date', 'time');
    example('SEIZURES', row.line, start);
    const id = await idFor(row, 'seizure', String(start));
    if (duplicateId(id) || existing.seizureMinutes.has(minute(start))) return 'duplicate';
    const mark = (at: number | null) => (at === null ? null : { at, source: 'entered-later' as const });
    let auraEnd = row.stamp('auraEnd');
    let seizureEnd = row.stamp('seizureEnd');
    let recoveryEnd = row.stamp('recoveryEnd');
    // The seizure length counts from the start, aura included; the recovery follows the end of the seizure
    const lengthSec = row.whole('lengthSeconds');
    const recoverySec = row.whole('recoverySeconds');
    if (seizureEnd === null && lengthSec !== null) seizureEnd = start + lengthSec * 1000;
    if (recoveryEnd === null && recoverySec !== null) {
      const end =
        seizureEnd ?? fail('recoverySeconds: the end of the seizure is needed first (seizureEnd or lengthSeconds)');
      recoveryEnd = end + recoverySec * 1000;
    }
    const marks = [start, auraEnd, seizureEnd, recoveryEnd].filter((x): x is number => x !== null);
    if (marks.some((at, i) => i > 0 && at < (marks[i - 1] as number)))
      fail('the times are not in order: start, end of aura, end of seizure, back to usual self');
    if (auraEnd === start) auraEnd = null;
    const status = row.oneOf('status', ['recorded', 'complete', 'in_progress'] as const, 'recorded');
    if (status === 'in_progress') fail('status: an unfinished recording cannot be brought in');
    const symptoms: SymptomEntry[] = [];
    const tokens = row.has('symptomCodes')
      ? row.list('symptomCodes').map((t) => {
          const parsed = parseSymptomToken(t);
          return parsed.badPhase === undefined
            ? parsed
            : fail(`symptomCodes: "${parsed.badPhase}" is not a phase (prodrome, aura, seizure or recovery)`);
        })
      : row
          .list('symptoms')
          .map((name) =>
            /\(.*\)$/.test(name)
              ? fail('symptoms: write the body area in symptomCodes, like code@body.arm/body.arm.left')
              : { code: codes.named(name, 'symptom', 'symptoms'), area: null, phase: null },
          );
    for (const [i, t] of tokens.entries())
      symptoms.push({
        id: await derivedId(id, 'symptom', String(i)),
        code: codes.code(t.code, 'symptom', 'symptomCodes'),
        area: codes.area(t.area, 'symptomCodes'),
        moment: i,
        order: i,
        sincePrevious: { kind: 'unknown', ms: null },
        isFirst: i === 0,
        // A symptom given without its phase belongs to the seizure, as in the editor
        phase: t.phase ?? 'seizure',
      });
    const triggers = row.has('triggerCodes')
      ? row.list('triggerCodes').map((c) => codes.code(c, 'trigger', 'triggerCodes'))
      : row.list('triggers').map((n) => codes.named(n, 'trigger', 'triggers'));
    const findingWords = row.list('afterFindings');
    const findings: FindingEntry[] = row.has('afterFindingCodes')
      ? row.list('afterFindingCodes').map((token, i) => {
          const f = parseFindingToken(token);
          const custom = f.code === 'after.custom';
          return {
            code: custom ? f.code : codes.code(f.code, 'finding', 'afterFindingCodes'),
            customLabel: custom
              ? (findingWords[i] ?? fail('afterFindings: the words for your own finding are missing'))
              : null,
            areas: f.areas.map((a) => codes.area(a, 'afterFindingCodes') as BodyArea),
          };
        })
      : findingWords.map((n) => ({ code: codes.named(n, 'finding', 'afterFindings'), customLabel: null, areas: [] }));
    await emit('SEIZURES', row, 'seizure', {
      ...base(id),
      timeZone: row.has('timeZone') ? row.text('timeZone', 64) : timeZone,
      phases: {
        start: mark(start),
        auraEnd: mark(auraEnd),
        seizureEnd: mark(seizureEnd),
        recoveryEnd: mark(recoveryEnd),
      },
      status,
      // The ILAE 2025 answers come back; the profile does not (a spreadsheet cannot say which profile record it was)
      ilae2025: ilae2025ForSaving({
        class: row.choice('ilae2025Start', ['focal', 'generalized', 'unknown']),
        recall: row.choice('ilae2025Remembered', ANSWERS),
        responsive: row.choice('ilae2025Responded', ANSWERS),
        bilateralTonicClonic: row.choice('ilae2025BilateralTonicClonic', ANSWERS),
        observable: row.choice('ilae2025Observable', ANSWERS),
        generalized: row.choice('ilae2025Kind', ILAE_2025_GENERALIZED),
      }),
      symptoms,
      afterFindings: findings,
      prodromeSecondsBefore: row.whole('warningSecondsBefore', 0, 7 * 24 * 3600),
      recoveryOngoing: false,
      triggerCodes: triggers,
      notes: row.text('notes'),
      video: null,
      isManualEntry: true,
      isEmergencyStop: row.bool('autoStopped', false),
      recordedBy: row.oneOf('recordedBy', ['carer', 'self'] as const, 'carer'),
      eegSessionId: null,
      // A spreadsheet cannot say which profile record it was; the profile's name is in the file for reading only
      profile: null,
      quickNotes: [],
      recordedWhileLocked: row.bool('recordedWhileLocked', false),
      cancelled: false,
    });
    existing.seizureMinutes.add(minute(start));
    existing.seizures.add(id);
  });

  // Between seizures
  await each('BETWEEN_SEIZURES', async (row) => {
    const at = row.at('date', 'time');
    example('BETWEEN_SEIZURES', row.line, at);
    const symptomCode = codes.either(row, 'symptomCode', 'symptom', 'symptom') ?? fail('symptomCode: is empty');
    const id = await idFor(row, 'between', String(at), symptomCode);
    const key = `${symptomCode}@${minute(at)}`;
    if (duplicateId(id) || existing.betweenMinutes.has(key)) return 'duplicate';
    await emit('BETWEEN_SEIZURES', row, 'interictalEvent', {
      ...base(id),
      occurredAt: at,
      timeZone,
      symptomCode,
      area: codes.area(parseAreaToken(row.text('areaCode')), 'areaCode'),
      notes: row.text('notes'),
      recordedBy: row.oneOf('recordedBy', ['carer', 'self'] as const, 'carer'),
    });
    existing.betweenMinutes.add(key);
  });

  // Medicines and their changes: replayed through the same rule the Medicines screen uses
  const regimenOf = (row: Row, before: Regimen | null): Regimen => {
    const keep = <K extends keyof Regimen>(column: string, key: K, read: () => Regimen[K]): Regimen[K] =>
      row.has(column) ? read() : before ? before[key] : read();
    const slotDoses = () =>
      Object.fromEntries(
        row.list('slotDoses').map((pair) => {
          const [time = '', dose = ''] = pair.split('=');
          const c = readClock(time, 'slotDoses');
          const n = Number(dose.replace(',', '.'));
          if (!Number.isFinite(n) || n < 0) fail(`slotDoses: "${pair}" is not a time=dose pair`);
          return [`${pad(c.h)}:${pad(c.mi)}`, n];
        }),
      );
    const slotUnits = () => {
      const pairs = row.list('slotUnits').map((pair) => {
        const at = pair.indexOf('=');
        const c = readClock(at < 0 ? pair : pair.slice(0, at), 'slotUnits');
        const unit = at < 0 ? '' : pair.slice(at + 1).trim();
        if (!unit || unit.length > 20) fail(`slotUnits: "${pair}" is not a time=unit pair`);
        return [`${pad(c.h)}:${pad(c.mi)}`, unit] as const;
      });
      return Object.fromEntries(pairs);
    };
    const units = keep('slotUnits', 'slotUnits', slotUnits);
    return {
      name: keep('name', 'name', () => row.text('name', 120).trim()),
      activeIngredient: keep('activeIngredient', 'activeIngredient', () => row.text('activeIngredient', 120)),
      form:
        row.has('formCode') || row.has('form') || !before ? codes.either(row, 'formCode', 'form', 'form') : before.form,
      dose: keep('dose', 'dose', () => row.number('dose')),
      unit: keep('unit', 'unit', () => row.text('unit', 20)),
      frequency: keep('frequency', 'frequency', () => row.oneOf('frequency', FrequencySchema.options)),
      scheduledTimes: keep('scheduledTimes', 'scheduledTimes', () =>
        row.list('scheduledTimes').map((t) => {
          const c = readClock(t, 'scheduledTimes');
          return `${pad(c.h)}:${pad(c.mi)}`;
        }),
      ),
      scheduledDays: keep('scheduledDays', 'scheduledDays', () =>
        row
          .list('scheduledDays')
          .map((d) => (/^[0-6]$/.test(d) ? Number(d) : fail(`scheduledDays: "${d}" is not 0 to 6`))),
      ),
      slotDoses: keep('slotDoses', 'slotDoses', slotDoses),
      slotUnits: units,
    };
  };
  const PROBLEM_WORDS: Record<string, string> = {
    name_empty: 'the name is empty',
    future: 'the date is in the future',
    no_times: 'a medicine taken on a schedule needs its times',
    no_change: 'nothing changed',
    already_stopped: 'the medicine was not being taken',
    not_stopped: 'the medicine is already being taken',
  };
  const medsByFileId = new Map<string, Medication>();
  const medsByName = new Map<string, Medication[]>();
  const known = (m: Medication) => {
    const list = medsByName.get(m.name.toLowerCase()) ?? [];
    list.push(m);
    medsByName.set(m.name.toLowerCase(), list);
  };
  existing.medications.forEach(known);
  const changeRows = sectionRows('MEDICATION_CHANGES');
  const usedChanges = new Set<Row>();
  const findMedication = (row: Row, column = 'medication'): Medication => {
    const ref = row.text('medicationId').trim();
    const byId = ref ? (medsByFileId.get(ref) ?? existing.medications.find((m) => m.id === ref)) : undefined;
    if (byId) return byId;
    const named = medsByName.get(row.text(column).trim().toLowerCase()) ?? [];
    if (named.length === 1) return named[0] as Medication;
    return named.length > 1
      ? fail(`${column}: more than one medicine is called "${row.text(column)}"; use medicationId`)
      : fail(`${column}: no medicine "${row.text(column) || ref}" in the file or in the app`);
  };
  await each('MEDICATIONS', async (row) => {
    const regimen = regimenOf(row, null);
    const id = await idFor(row, 'medication', regimen.name.toLowerCase());
    const fileId = row.text('id').trim();
    const same = existing.medications.find((m) => m.id === id || m.name.toLowerCase() === regimen.name.toLowerCase());
    if (same) {
      if (fileId) medsByFileId.set(fileId, same);
      return 'duplicate';
    }
    const flags = {
      isRescue: row.bool('rescue', false),
      showInEmergency: row.bool('showInEmergency', false),
      reminderEnabled: row.bool('reminder', false),
    };
    const active = row.bool('active', true);
    const startedAt = row.stamp('startedAt');
    const stoppedAt = row.stamp('stoppedAt');
    const mine = changeRows.filter(
      (c) =>
        (fileId !== '' && c.text('medicationId').trim() === fileId) ||
        (c.text('medicationId').trim() === '' &&
          c.text('medication').trim().toLowerCase() === regimen.name.toLowerCase()),
    );
    const steps: { type: ChangeType; at: number; row: Row | null; regimen: Regimen | null; note: string }[] = [];
    let history = 'from the row';
    try {
      const sorted = mine
        .map((c) => ({
          c,
          at: c.stamp('effectiveAt') ?? fail('effectiveAt: is empty'),
          type: c.oneOf('type', ['started', 'changed', 'stopped', 'correction'] as const),
        }))
        .sort((a, b) => a.at - b.at);
      if (sorted.length > 0 && sorted[0]?.type !== 'started')
        fail(`the first change of ${regimen.name} must be its start, so the dose before it is known`);
      let current: Regimen | null = null;
      for (const s of sorted) {
        const after: Regimen | null = s.type === 'stopped' ? null : regimenOf(s.c, current);
        steps.push({ type: s.type, at: s.at, row: s.c, regimen: after, note: s.c.text('note') });
        if (after) current = after;
      }
      if (sorted.length > 0) {
        const last = steps[steps.length - 1];
        if (current && diffRegimen(current, regimen).length > 0)
          fail(`the changes of ${regimen.name} do not end at the dose and times in MEDICATIONS`);
        if ((last?.type === 'stopped') === active)
          fail(`the changes of ${regimen.name} do not end the way "active" says`);
        history = 'from its changes';
      }
    } catch (error) {
      if (!(error instanceof RowProblem)) throw error;
      for (const c of mine) {
        reject('MEDICATION_CHANGES', c.line, error.message);
        count('MEDICATION_CHANGES').found++;
        usedChanges.add(c);
      }
      steps.length = 0;
    }
    if (history === 'from the row') {
      steps.push({ type: 'started', at: startedAt ?? now, row: null, regimen, note: '' });
      if (!active) steps.push({ type: 'stopped', at: stoppedAt ?? now, row: null, regimen: null, note: '' });
    }
    let medication: Medication | null = null;
    const pending: ImportDraft[] = [];
    for (const [i, step] of steps.entries()) {
      const plan = planMedicationChange({
        patientId,
        before: medication,
        next: { ...(step.regimen ?? (medication ? regimenSnapshot(medication) : regimen)), ...flags },
        type: step.type,
        effectiveAt: step.at,
        recordedAt: now,
        note: step.note,
      });
      if ('problem' in plan) throw new RowProblem(`${regimen.name}: ${PROBLEM_WORDS[plan.problem] ?? plan.problem}`);
      const values =
        'create' in plan.medication
          ? plan.medication.create
          : { ...(medication as Medication), ...plan.medication.patch };
      medication = { ...base(id), ...values } as Medication;
      const changeId =
        step.row && UUID.test(step.row.text('id').trim())
          ? step.row.text('id').trim().toLowerCase()
          : await derivedId(householdId, 'csv', 'change', id, String(i));
      pending.push({
        entryId: await derivedId('entry', 'csv', changeId),
        recordId: changeId,
        type: 'medicationChange',
        patientId,
        kind: 'import',
        fields: {
          ...base(changeId),
          ...plan.change,
          medicationId: id,
          importedFrom: { csv: (step.row ?? row).values },
        } as unknown as Record<string, JsonValue>,
      });
    }
    if (!medication) return fail('nothing to bring in');
    await emit('MEDICATIONS', row, 'medication', { ...medication });
    for (const p of pending) {
      if (!RECORD_SCHEMAS.medicationChange.safeParse(p.fields).success) fail('a change of this medicine is not valid');
      drafts.push(p);
    }
    for (const c of mine)
      if (!usedChanges.has(c)) {
        usedChanges.add(c);
        count('MEDICATION_CHANGES').found++;
        count('MEDICATION_CHANGES').ready++;
      }
    if (fileId) medsByFileId.set(fileId, medication);
    known(medication);
  });
  const fileMedicines = sectionRows('MEDICATIONS').map((m) => ({
    id: m.text('id').trim(),
    name: m.text('name').trim().toLowerCase(),
  }));
  for (const c of changeRows)
    if (!usedChanges.has(c)) {
      count('MEDICATION_CHANGES').found++;
      const ref = c.text('medicationId').trim();
      const name = c.text('medication').trim().toLowerCase();
      const inFile = fileMedicines.some((m) => (ref !== '' && m.id === ref) || (ref === '' && m.name === name));
      if (existing.ids.has(c.text('id').trim().toLowerCase())) count('MEDICATION_CHANGES').duplicates++;
      else if (
        inFile &&
        !existing.medications.some((m) => m.id === (medsByFileId.get(ref)?.id ?? '') || m.name.toLowerCase() === name)
      )
        reject('MEDICATION_CHANGES', c.line, 'its medicine in MEDICATIONS could not be brought in (see that line)');
      else
        reject(
          'MEDICATION_CHANGES',
          c.line,
          'changes to a medicine already in the app are made in Medicines, so its history stays in order',
        );
    }

  // Doses
  await each('MEDICATION_LOGS', async (row) => {
    const medication = findMedication(row);
    const takenAt = row.stamp('takenAt') ?? fail('takenAt: is empty');
    example('MEDICATION_LOGS', row.line, takenAt);
    const id = await idFor(row, 'dose', medication.id, String(takenAt));
    const key = `${medication.id}@${minute(takenAt)}`;
    if (duplicateId(id) || existing.doseMinutes.has(key)) return 'duplicate';
    await emit('MEDICATION_LOGS', row, 'doseLog', {
      ...base(id),
      medicationId: medication.id,
      scheduledTime: row.clock('scheduledTime'),
      takenAt,
      status: row.oneOf('status', DOSE_STATUSES),
      note: row.text('note'),
      doseSnapshot: row.has('dose') ? row.number('dose') : medication.dose,
      unitSnapshot: row.has('unit') ? row.text('unit', 20) : medication.unit,
    });
    existing.doseMinutes.add(key);
  });

  // Wellbeing
  await each('WELLBEING_ENTRIES', async (row) => {
    const recordedAt = row.stamp('recordedAt') ?? fail('recordedAt: is empty');
    example('WELLBEING_ENTRIES', row.line, recordedAt);
    const id = await idFor(row, 'wellbeing', String(recordedAt));
    if (duplicateId(id) || existing.wellbeingMinutes.has(minute(recordedAt))) return 'duplicate';
    const pairs = row.has('factorCodes') ? row.list('factorCodes') : row.list('factors');
    const factors: Record<string, number | boolean> = {};
    for (const pair of pairs) {
      const at = pair.lastIndexOf('=');
      if (at < 0) fail(`factors: "${pair}" is not name=value`);
      const name = pair.slice(0, at).trim();
      const raw = pair
        .slice(at + 1)
        .trim()
        .toLowerCase();
      const code = row.has('factorCodes')
        ? codes.code(name, 'factor', 'factorCodes')
        : codes.named(name, 'factor', 'factors');
      const value = raw === 'true' ? true : raw === 'false' ? false : Number(raw.replace(',', '.'));
      if (typeof value === 'number' && !Number.isFinite(value)) fail(`factors: "${pair}" has no number or yes/no`);
      factors[code] = value;
    }
    await emit('WELLBEING_ENTRIES', row, 'wellbeingEntry', {
      ...base(id),
      recordedAt,
      dayKey: row.has('day') ? row.day('day') : localDateKey(recordedAt),
      moodCode: codes.either(row, 'moodCode', 'mood', 'mood') ?? fail('moodCode: is empty'),
      intensity: row.whole('intensity', 1, 3) ?? 2,
      factors,
      notes: row.text('notes'),
    });
    existing.wellbeingMinutes.add(minute(recordedAt));
  });

  // EEG sessions and what happened during them
  const sessionsByFileId = new Map<string, string>();
  await each('EEG_SESSIONS', async (row) => {
    const startTime = row.stamp('startTime') ?? fail('startTime: is empty');
    example('EEG_SESSIONS', row.line, startTime);
    const id = await idFor(row, 'eeg', String(startTime));
    const fileId = row.text('id').trim();
    if (duplicateId(id) || existing.sessionStarts.has(minute(startTime))) {
      if (fileId && existing.sessions.has(id)) sessionsByFileId.set(fileId, id);
      return 'duplicate';
    }
    await emit('EEG_SESSIONS', row, 'eegSession', {
      ...base(id),
      startTime,
      plannedEndTime: row.stamp('plannedEndTime'),
      actualEndTime: row.stamp('actualEndTime'),
      durationPreset: row.text('durationPreset', 20) || 'custom',
      customHours: row.number('customHours'),
      title: row.text('title', 120),
      notes: row.text('notes'),
      status: row.oneOf('status', ['active', 'completed'] as const, 'completed'),
    });
    if (fileId) sessionsByFileId.set(fileId, id);
    existing.sessions.add(id);
    existing.sessionStarts.add(minute(startTime));
  });
  await each('EEG_ACTIVITIES', async (row) => {
    const ref = row.required('sessionId').trim();
    const sessionId =
      sessionsByFileId.get(ref) ??
      (existing.sessions.has(ref) ? ref : fail(`sessionId: no EEG session "${ref}" in the file or in the app`));
    const kind = row.oneOf('kind', ['activity', 'seizure_reference'] as const, 'activity');
    const startTime = row.stamp('startTime') ?? fail('startTime: is empty');
    const id = await idFor(row, 'eegActivity', sessionId, String(startTime));
    if (duplicateId(id)) return 'duplicate';
    const linked = row.text('linkedSeizureId').trim();
    if (linked && !existing.seizures.has(linked))
      fail(`linkedSeizureId: no seizure "${linked}" in the file or in the app`);
    await emit('EEG_ACTIVITIES', row, 'eegActivity', {
      ...base(id),
      sessionId,
      kind,
      // A seizure reference names its seizure through linkedSeizureId; only activities have a code
      activityCode: kind === 'activity' ? codes.either(row, 'activityCode', 'activity', 'activity') : null,
      customText: row.text('customText', 120),
      moodCode: codes.either(row, 'moodCode', 'mood', 'mood'),
      notes: row.text('notes'),
      startTime,
      endTime: row.stamp('endTime'),
      durationSec: row.whole('durationSec'),
      linkedSeizureId: linked || null,
    });
  });

  for (const c of Object.values(report.sections)) {
    report.totals.found += c.found;
    report.totals.ready += c.ready;
    report.totals.duplicates += c.duplicates;
    report.totals.rejected += c.rejected;
  }
  report.unaccounted = report.totals.found - report.totals.ready - report.totals.duplicates - report.totals.rejected;
  return { report, drafts };
}

/** Checks the file and says what an import would do; writes nothing. */
export async function checkCsvImport(store: Store, text: string, options: CsvImportOptions): Promise<CsvImportReport> {
  return (await planCsvImport(store, text, options)).report;
}

/** Brings the rows that are ready into the store. Running it again with the same file adds nothing. */
export async function importCsv(store: Store, text: string, options: CsvImportOptions): Promise<CsvImportReport> {
  const { report, drafts } = await planCsvImport(store, text, options);
  const stored = await store.importDrafts(drafts);
  return { ...report, applied: stored.applied };
}

export { CSV_SECTIONS };
