import {
  FINDINGS,
  RECORD_SCHEMAS,
  activityFromLegacy,
  bodyAreaFromLegacy,
  factorFromLegacyId,
  findingFromKey,
  moodFromLegacy,
  seizureTypeFromLegacy,
  symptomFromLegacy,
  triggerFromLegacy,
  type BodyArea,
  type FindingEntry,
  type Phases,
  type SymptomEntry,
} from '@auratrack/model';
import { labelText } from '@auratrack/i18n';
import type { JsonValue } from '../merge';
import type { ImportDraft, StoredType } from '../store';
import { derivedId } from './ids';
import type { LegacyPatient, LegacyTable, Row } from './read';

// Turns 6.1 rows into v7 records. Rules:
//  - English labels become codes; anything that cannot be mapped is kept as the household's own code and listed for review.
//  - Laps and manual durations become phase marks, built so that the seizure time (what the emergency plan uses) is exactly
//    what 6.1 computed.
//  - Every imported record keeps the complete original 6.1 row in `legacy`, so a mistake here can never lose data.
//  - Ids come from the 6.1 uuid, so importing the same file again finds the same records.

export interface ReviewItem {
  kind:
    'symptom' | 'trigger' | 'finding' | 'mood' | 'activity' | 'factor' | 'seizure_type' | 'body_area' | 'factor_value';
  /** The text as 6.1 stored it. */
  text: string;
  /** The code it was kept under (the household's own code), if any. */
  keptAs: string | null;
  count: number;
}
export interface RejectedRow {
  table: LegacyTable | 'settings';
  index: number;
  reason: string;
}
export interface TableCount {
  found: number;
  imported: number;
  rejected: number;
}

export interface MapContext {
  householdId: string;
  deviceId: string;
  /** The patient's time zone: 6.1 did not store one, so it is assumed and said so in the report. */
  timeZone: string;
  now: number;
  /** Shared by all patients of a household, so the same own-symptom is one code. */
  customs: Map<string, { code: string; kind: string; label: string; patientId: string }>;
  review: Map<string, ReviewItem>;
}

const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Row => (isObj(v) ? v : {});
const norm = (s: string) => s.trim().toLowerCase();
const json = (v: unknown): JsonValue => JSON.parse(JSON.stringify(v ?? null)) as JsonValue;
/** Settings that belong to the device, not to a patient (6.1: src/data/settingKeys.js). */
const DEVICE_SETTING_KEYS = new Set([
  'userMode',
  'language',
  'theme',
  'accentColor',
  'fontSize',
  'historyPageSize',
  'dateFormat',
  'durationFormat',
  'timeFormat',
  'hapticFeedback',
  'wellbeingDailyReminderEnabled',
  'wellbeingReminderTime',
  'backupReminderEnabled',
  'backupReminderIntervalDays',
  'assumeDosesTaken',
  'assumeDosesTakenSince',
]);
/** Settings that became fields of the patient record. */
const PATIENT_FIELD_KEYS = new Set(['personName', 'dateOfBirth', 'emergencyContact']);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 6.1's seizure time, exactly as 6.1 computed it (src/utils/dangerFlags.js). The comparison report checks v7 against this. */
export function legacySeizureSeconds(event: Row): number {
  const manual = obj(event.manualDurations);
  if (num(manual.seizure) !== null) return manual.seizure as number;
  const laps = obj(event.laps);
  const start = num(event.startTime);
  if (laps.aura && start) {
    const end = (laps.seizure || laps.recovery || start + (num(event.duration) ?? 0) * 1000) as number;
    return Math.max(0, Math.round((end - (laps.aura as number)) / 1000));
  }
  return num(event.duration) ?? 0;
}

/** Phase marks from 6.1's laps and manual durations, keeping 6.1's seizure time. */
export function mapPhases(event: Row): Phases | null {
  const start = num(event.startTime);
  if (start === null) return null;
  const mark = (at: number, source: 'timed' | 'edited' | 'entered-later') => ({ at: Math.round(at), source });
  const source = event.isManualEntry === true ? 'entered-later' : 'timed';
  const duration = Math.max(0, num(event.duration) ?? 0) * 1000;
  const manual = obj(event.manualDurations);
  const laps = obj(event.laps);
  const startMark = mark(start, source);

  const manualSeizure = num(manual.seizure);
  if (manualSeizure !== null) {
    const aura = num(manual.aura) ?? 0;
    const recovery = num(manual.recovery) ?? 0;
    const auraEnd = aura > 0 ? mark(start + aura * 1000, 'edited') : null;
    const seizureEnd = mark((auraEnd?.at ?? start) + manualSeizure * 1000, 'edited');
    const recoveryEnd = recovery > 0 ? mark(seizureEnd.at + recovery * 1000, 'edited') : null;
    return { start: startMark, auraEnd, seizureEnd, recoveryEnd };
  }
  const lapAura = num(laps.aura);
  const lapSeizure = num(laps.seizure);
  const lapRecovery = num(laps.recovery);
  if (lapAura) {
    return {
      start: startMark,
      auraEnd: mark(lapAura, source),
      // With no seizure lap, 6.1 ended the seizure at the recovery lap, or at the stop
      seizureEnd: lapSeizure ? mark(lapSeizure, source) : lapRecovery ? null : mark(start + duration, source),
      recoveryEnd: lapRecovery ? mark(lapRecovery, source) : null,
    };
  }
  return { start: startMark, auraEnd: null, seizureEnd: mark(start + duration, source), recoveryEnd: null };
}

const LEGACY_FINDINGS: Record<string, string> = { confusion: 'confused', sleepiness: 'drowsy', weakness: 'weakness' };
const findingByLabel = new Map(FINDINGS.map((f) => [norm(labelText('en', f.code)), f.code.slice('after.'.length)]));

export class Mapper {
  readonly drafts: ImportDraft[] = [];
  readonly rejected: RejectedRow[] = [];
  readonly counts: Partial<Record<LegacyTable | 'settings', TableCount>> = {};

  constructor(
    private readonly ctx: MapContext,
    readonly patient: LegacyPatient,
    readonly patientId: string,
    private readonly patientKey: string,
  ) {}

  private id(table: string, key: string): Promise<string> {
    return derivedId(this.ctx.householdId, this.patientKey, table, key);
  }

  private rowKey(row: Row): string {
    return typeof row.uuid === 'string' && row.uuid ? row.uuid : `noid:${JSON.stringify(row)}`;
  }

  private count(table: LegacyTable | 'settings', field: keyof TableCount, by = 1): void {
    const c = (this.counts[table] ??= { found: 0, imported: 0, rejected: 0 });
    c[field] += by;
  }

  private reject(table: LegacyTable | 'settings', index: number, reason: string): void {
    this.rejected.push({ table, index, reason });
    this.count(table, 'rejected');
  }

  private note(kind: ReviewItem['kind'], text: string, keptAs: string | null): void {
    const key = `${kind}|${norm(text)}`;
    const item = this.ctx.review.get(key);
    if (item) item.count++;
    else this.ctx.review.set(key, { kind, text, keptAs, count: 1 });
  }

  /** The household's own code for a label, made once. */
  private async custom(
    kind: 'symptom' | 'trigger' | 'finding' | 'mood' | 'activity' | 'factor',
    label: string,
  ): Promise<string> {
    const key = `${kind}|${norm(label)}`;
    const known = this.ctx.customs.get(key);
    if (known) return known.code;
    const code = `custom.${await derivedId(this.ctx.householdId, 'custom', key)}`;
    this.ctx.customs.set(key, { code, kind, label: label.trim().slice(0, 120), patientId: this.patientId });
    return code;
  }

  private base(id: string, createdAt: number | null): Record<string, JsonValue> {
    return {
      id,
      householdId: this.ctx.householdId,
      patientId: this.patientId,
      deviceId: this.ctx.deviceId,
      createdAt: Math.max(0, Math.round(createdAt ?? this.ctx.now)),
    };
  }

  /** Validates and queues a record. A record that is not valid is rejected and listed, never imported half-formed. */
  private async emit(
    table: LegacyTable,
    index: number,
    type: StoredType,
    recordId: string,
    values: Record<string, JsonValue>,
  ): Promise<boolean> {
    const checked = (
      RECORD_SCHEMAS[type] as {
        safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
      }
    ).safeParse(values);
    if (!checked.success) {
      this.reject(
        table,
        index,
        (checked.error?.issues ?? []).map((i) => `${i.path.map(String).join('.')}: ${i.message}`).join('; '),
      );
      return false;
    }
    this.drafts.push({
      entryId: await derivedId('entry', recordId),
      recordId,
      type,
      patientId: this.patientId,
      kind: 'import',
      fields: values,
    });
    this.count(table, 'imported');
    return true;
  }

  private mapArea(region: string, sub: string, part: string): BodyArea | null {
    const area = bodyAreaFromLegacy(region, sub, part);
    const asked = [region, sub, part].filter((x) => x && !['n/a', 'internal/general', 'general'].includes(norm(x)));
    if (!area && asked.length > 0) this.note('body_area', asked.join(' › '), null);
    else if (area && ((sub && !area.subRegion) || (part && !area.part)))
      this.note('body_area', [region, sub, part].filter(Boolean).join(' › '), area.region);
    return area;
  }

  // ---- events -> seizures
  async events(): Promise<void> {
    const rows = this.patient.tables.events;
    for (const [index, row] of rows.entries()) {
      this.count('events', 'found');
      const phases = mapPhases(row);
      if (!phases) {
        this.reject('events', index, 'no start time');
        continue;
      }
      const id = await this.id('events', this.rowKey(row));
      const typeText = str(row.type).trim();
      const type = seizureTypeFromLegacy(typeText);
      let notes = str(row.notes);
      if (!type && typeText && norm(typeText) !== 'uncategorized') {
        this.note('seizure_type', typeText, null);
        notes = `${notes}${notes ? '\n' : ''}[Imported from 6.1: seizure type "${typeText}"]`;
      }

      const symptoms: SymptomEntry[] = [];
      for (const [i, s] of arr(row.symptoms).entries()) {
        const sym = obj(s);
        const group = str(sym.symptom);
        const detail = str(sym.detail);
        const found = symptomFromLegacy(group, detail || group) ?? (detail ? null : symptomFromLegacy('', group));
        let code: string;
        if (found) code = found.code;
        else {
          const label = detail && norm(detail) !== norm(group) ? `${group}: ${detail}` : group || detail;
          if (!label) continue;
          code = await this.custom('symptom', label);
          this.note('symptom', label, code);
        }
        symptoms.push({
          id: await this.id('symptom', `${id}|${i}`),
          code,
          area: this.mapArea(str(sym.region), str(sym.subRegion), str(sym.specificPart)),
          moment: i,
          order: i,
          sincePrevious: { kind: 'unknown', ms: null },
          isFirst: i === 0,
        });
      }

      const post = obj(row.postIctal);
      const findings = this.mapFindings(post);
      const triggerCodes: string[] = [];
      for (const t of arr(row.triggers)) {
        const text = str(t).trim();
        if (!text) continue;
        const known = triggerFromLegacy(text);
        const code = known ? known.code : await this.custom('trigger', text);
        if (!known) this.note('trigger', text, code);
        if (!triggerCodes.includes(code)) triggerCodes.push(code);
      }

      const recoveryMinutes = num(post.recoveryMinutes);
      const values: Record<string, JsonValue> = {
        ...this.base(id, num(row.startTime)),
        timeZone: this.ctx.timeZone,
        phases: json(phases),
        status: row.isComplete === true ? 'complete' : 'recorded',
        typeCode: type?.code ?? null,
        ilae: null,
        symptoms: json(symptoms),
        afterFindings: json(findings),
        recoveryMinutes: recoveryMinutes !== null && recoveryMinutes >= 0 ? Math.round(recoveryMinutes) : null,
        recoveryOngoing: post.recoveryOngoing === true,
        triggerCodes,
        notes: notes.slice(0, 5000),
        video: row.videoAttached === true ? { fileName: '' } : null,
        isManualEntry: row.isManualEntry === true,
        isEmergencyStop: row.isEmergencyStop === true,
        recordedBy: str(row.userModeAtTime).toUpperCase() === 'CARETAKER' ? 'carer' : 'self',
        eegSessionId: null,
        legacy: json(row),
      };
      const eegUuid = str(row.eegSessionUuid);
      if (eegUuid) values.eegSessionId = await this.id('eegSessions', eegUuid);
      await this.emit('events', index, 'seizure', id, values);
    }
  }

  private mapFindings(post: Row): FindingEntry[] {
    const out: FindingEntry[] = [];
    const same = (a: BodyArea, b: BodyArea) =>
      a.region === b.region && a.subRegion === b.subRegion && a.part === b.part;
    const add = (code: string, customLabel: string | null, areas: BodyArea[]) => {
      let finding = out.find((f) => f.code === code && f.customLabel === customLabel);
      if (!finding) out.push((finding = { code, customLabel, areas: [] }));
      // The same place named twice counts once, whether in one entry or across entries
      for (const area of areas) if (!finding.areas.some((known) => same(known, area))) finding.areas.push(area);
    };
    const areasOf = (locations: unknown): BodyArea[] =>
      arr(locations)
        .map((l) => obj(l))
        .map((l) => this.mapArea(str(l.region), str(l.subRegion), str(l.specificPart)))
        .filter((a): a is BodyArea => a !== null);
    const own = (label: string, areas: BodyArea[]) => {
      this.note('finding', label, 'after.custom');
      add('after.custom', label.slice(0, 120), areas);
    };
    for (const item of arr(post.findings)) {
      if (typeof item === 'string') {
        const key = LEGACY_FINDINGS[norm(item)] ?? (findingFromKey(item) ? item : findingByLabel.get(norm(item)));
        if (key) add(`after.${key}`, null, []);
        else own(item, []);
      } else if (isObj(item) && typeof item.key === 'string') {
        if (item.key === 'custom') {
          if (str(item.label)) own(str(item.label), areasOf(item.locations));
        } else if (findingFromKey(item.key)) add(`after.${item.key}`, null, areasOf(item.locations));
        else own(str(item.label) || item.key, areasOf(item.locations));
      }
    }
    const paralysis = areasOf(post.paralysisLocations);
    if (paralysis.length) add('after.paralysis', null, paralysis);
    return out;
  }

  // ---- medications
  private regimen(raw: unknown): JsonValue {
    if (!isObj(raw)) return null;
    const times = arr(raw.scheduledTimes).filter((t): t is string => typeof t === 'string' && HHMM.test(t));
    const days = arr(raw.scheduledDays).filter(
      (d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6,
    );
    const slotDoses = Object.fromEntries(
      Object.entries(obj(raw.slotDoses)).filter(([k, v]) => HHMM.test(k) && num(v) !== null && (v as number) >= 0),
    );
    return json({
      name: str(raw.name).slice(0, 120),
      activeIngredient: str(raw.activeIngredient).slice(0, 120),
      form: str(raw.form).slice(0, 120),
      dose: num(raw.dose) !== null && (raw.dose as number) >= 0 ? raw.dose : null,
      unit: str(raw.unit).slice(0, 20),
      slotDoses,
      frequency: str(raw.frequency),
      scheduledTimes: times,
      scheduledDays: days,
    });
  }

  async medications(): Promise<Set<string>> {
    const known = new Set<string>();
    for (const [index, row] of this.patient.tables.medications.entries()) {
      this.count('medications', 'found');
      const name = str(row.name).trim();
      if (!name) {
        this.reject('medications', index, 'no name');
        continue;
      }
      const uuid = this.rowKey(row);
      const id = await this.id('medications', uuid);
      const times = arr(row.scheduledTimes).filter((t): t is string => typeof t === 'string' && HHMM.test(t));
      const days = arr(row.scheduledDays).filter(
        (d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6,
      );
      const stopped = num(row.stoppedAt) ?? num(row.deletedAt);
      const values: Record<string, JsonValue> = {
        ...this.base(id, num(row.startedAt)),
        name: name.slice(0, 120),
        activeIngredient: str(row.activeIngredient).slice(0, 120),
        form: str(row.form).slice(0, 120),
        dose: num(row.dose) !== null && (row.dose as number) >= 0 ? (row.dose as number) : null,
        unit: str(row.unit).slice(0, 20) || 'mg',
        slotDoses: (this.regimen(row) as Record<string, JsonValue>).slotDoses ?? {},
        frequency: str(row.frequency),
        scheduledTimes: times,
        scheduledDays: days,
        isRescue: row.isRescue === true || str(row.frequency) === 'PRN',
        showInEmergency: row.showInEmergency === true,
        reminderEnabled: row.reminderEnabled === true,
        // A medication 6.1 had deleted is kept as a stopped one, so its history still has a medication to belong to
        active: row.deletedAt != null ? false : row.active !== false,
        startedAt: num(row.startedAt),
        stoppedAt: stopped,
        legacy: json(row),
      };
      if (await this.emit('medications', index, 'medication', id, values)) {
        known.add(uuid);
        const numeric = num(row.id);
        if (numeric !== null) known.add(`#${numeric}`);
      }
    }
    return known;
  }

  private async medicationRef(row: Row, known: Set<string>): Promise<string | null> {
    const uuid = str(row.medicationUuid);
    if (uuid && known.has(uuid)) return this.id('medications', uuid);
    const numeric = num(row.medicationId);
    if (!uuid && numeric !== null) {
      const match = this.patient.tables.medications.find((m) => num(m.id) === numeric);
      if (match && known.has(this.rowKey(match))) return this.id('medications', this.rowKey(match));
    }
    return null;
  }

  async medicationChanges(known: Set<string>): Promise<void> {
    for (const [index, row] of this.patient.tables.medicationChanges.entries()) {
      this.count('medicationChanges', 'found');
      const medicationId = await this.medicationRef(row, known);
      const effectiveAt = num(row.effectiveAt);
      if (!medicationId || effectiveAt === null) {
        this.reject(
          'medicationChanges',
          index,
          medicationId ? 'no effective date' : 'its medication is not in the backup',
        );
        continue;
      }
      const id = await this.id('medicationChanges', this.rowKey(row));
      await this.emit('medicationChanges', index, 'medicationChange', id, {
        ...this.base(id, num(row.recordedAt) ?? effectiveAt),
        medicationId,
        medicationName: str(row.medicationName).slice(0, 120),
        type: str(row.type),
        effectiveAt: Math.round(effectiveAt),
        recordedAt: Math.round(num(row.recordedAt) ?? effectiveAt),
        from: this.regimen(row.from),
        to: this.regimen(row.to),
        changedFields: arr(row.changedFields)
          .filter((f): f is string => typeof f === 'string')
          .map((f) => f.slice(0, 40)),
        note: str(row.note).slice(0, 5000),
        isBaseline: row.isBaseline === true,
        legacy: json(row),
      });
    }
  }

  async doseLogs(known: Set<string>): Promise<void> {
    for (const [index, row] of this.patient.tables.medicationLogs.entries()) {
      this.count('medicationLogs', 'found');
      const medicationId = await this.medicationRef(row, known);
      const takenAt = num(row.takenAt);
      if (!medicationId || takenAt === null) {
        this.reject('medicationLogs', index, medicationId ? 'no time' : 'its medication is not in the backup');
        continue;
      }
      const id = await this.id('medicationLogs', this.rowKey(row));
      const scheduled = str(row.scheduledTime);
      await this.emit('medicationLogs', index, 'doseLog', id, {
        ...this.base(id, takenAt),
        medicationId,
        scheduledTime: HHMM.test(scheduled) ? scheduled : null,
        takenAt: Math.round(takenAt),
        status: str(row.status) || 'taken',
        note: str(row.note).slice(0, 5000),
        doseSnapshot:
          num(row.doseSnapshot) !== null && (row.doseSnapshot as number) >= 0 ? (row.doseSnapshot as number) : null,
        unitSnapshot: str(row.unitSnapshot).slice(0, 20),
        legacy: json(row),
      });
    }
  }

  // ---- wellbeing
  async wellbeing(): Promise<void> {
    for (const [index, row] of this.patient.tables.wellbeingEntries.entries()) {
      this.count('wellbeingEntries', 'found');
      const recordedAt = num(row.recordedAt);
      const moodText = str(row.primaryMood).trim();
      if (recordedAt === null || !moodText) {
        this.reject('wellbeingEntries', index, recordedAt === null ? 'no time' : 'no mood');
        continue;
      }
      const id = await this.id('wellbeingEntries', this.rowKey(row));
      const knownMood = moodFromLegacy(moodText);
      const moodCode = knownMood ? knownMood.code : await this.custom('mood', moodText);
      if (!knownMood) this.note('mood', moodText, moodCode);
      const factors: Record<string, JsonValue> = {};
      for (const [key, factor] of Object.entries(obj(row.factors))) {
        const f = obj(factor);
        const value = f.value;
        if (typeof value !== 'number' && typeof value !== 'boolean') {
          if (value != null && value !== '') this.note('factor_value', `${key}: ${String(value)}`, null);
          continue;
        }
        const known = factorFromLegacyId(key);
        const label = str(f.label) || key;
        const code = known ? known.code : await this.custom('factor', label);
        if (!known) this.note('factor', label, code);
        factors[code] = value;
      }
      await this.emit('wellbeingEntries', index, 'wellbeingEntry', id, {
        ...this.base(id, num(row.createdAt) ?? recordedAt),
        recordedAt: Math.round(recordedAt),
        dayKey: str(row.dayKey),
        moodCode,
        intensity: Math.min(3, Math.max(1, Math.round(num(row.intensity) ?? 1))),
        factors,
        notes: str(row.notes).slice(0, 5000),
        legacy: json(row),
      });
    }
  }

  // ---- EEG
  async eeg(): Promise<void> {
    const sessions = new Set<string>();
    for (const [index, row] of this.patient.tables.eegSessions.entries()) {
      this.count('eegSessions', 'found');
      const start = num(row.startTime);
      if (start === null) {
        this.reject('eegSessions', index, 'no start time');
        continue;
      }
      const uuid = this.rowKey(row);
      const id = await this.id('eegSessions', uuid);
      const ok = await this.emit('eegSessions', index, 'eegSession', id, {
        ...this.base(id, num(row.createdAt) ?? start),
        startTime: Math.round(start),
        plannedEndTime: num(row.plannedEndTime),
        actualEndTime: num(row.actualEndTime),
        durationPreset: str(row.durationPreset).slice(0, 20) || '24h',
        customHours: num(row.customHours),
        title: str(row.title).slice(0, 120),
        notes: str(row.notes).slice(0, 5000),
        status: str(row.status).toUpperCase() === 'ACTIVE' ? 'active' : 'completed',
        legacy: json(row),
      });
      if (ok) sessions.add(uuid);
    }
    for (const [index, row] of this.patient.tables.eegActivities.entries()) {
      this.count('eegActivities', 'found');
      const start = num(row.startTime);
      const sessionUuid = str(row.sessionUuid);
      if (start === null || !sessions.has(sessionUuid)) {
        this.reject('eegActivities', index, start === null ? 'no start time' : 'its session is not in the backup');
        continue;
      }
      const id = await this.id('eegActivities', this.rowKey(row));
      const isSeizure = str(row.kind).toUpperCase() === 'SEIZURE_REFERENCE';
      const label = str(row.activityLabel).trim();
      let activityCode: string | null = null;
      if (isSeizure) activityCode = seizureTypeFromLegacy(label)?.code ?? null;
      else if (label) {
        const known = activityFromLegacy(label);
        activityCode = known ? known.code : await this.custom('activity', label);
        if (!known) this.note('activity', label, activityCode);
      }
      const moodText = str(row.moodLabel).trim();
      let moodCode: string | null = null;
      if (moodText) {
        const known = moodFromLegacy(moodText);
        moodCode = known ? known.code : await this.custom('mood', moodText);
        if (!known) this.note('mood', moodText, moodCode);
      }
      const linked = str(row.linkedEventUuid);
      await this.emit('eegActivities', index, 'eegActivity', id, {
        ...this.base(id, num(row.createdAt) ?? start),
        sessionId: await this.id('eegSessions', sessionUuid),
        kind: isSeizure ? 'seizure_reference' : 'activity',
        activityCode,
        customText: str(row.customActivityText).slice(0, 120),
        moodCode,
        notes: str(row.notes).slice(0, 5000),
        startTime: Math.round(start),
        endTime: num(row.endTime),
        durationSec:
          num(row.durationSec) !== null && (row.durationSec as number) >= 0
            ? Math.round(row.durationSec as number)
            : null,
        linkedSeizureId: linked ? await this.id('events', linked) : null,
        legacy: json(row),
      });
    }
  }

  // ---- the patient and the settings
  async patientAndSettings(color: string | null): Promise<void> {
    const setting = (key: string) => this.patient.settings.find((s) => s.key === key)?.value;
    const dob = str(setting('dateOfBirth'));
    const name = (str(setting('personName')).trim() || this.patient.name || 'Patient').slice(0, 120);
    this.drafts.push({
      entryId: await derivedId('entry', this.patientId),
      recordId: this.patientId,
      type: 'patient',
      patientId: this.patientId,
      kind: 'import',
      fields: {
        ...this.base(this.patientId, null),
        name,
        dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
        emergencyContact: str(setting('emergencyContact')).slice(0, 120),
        color: (color ?? 'blue').slice(0, 20),
      },
    });
    for (const [index, { key, value }] of this.patient.settings.entries()) {
      this.count('settings', 'found');
      if (PATIENT_FIELD_KEYS.has(key)) {
        this.count('settings', 'imported'); // lives on the patient record
        continue;
      }
      if (value === undefined || key.length > 80) {
        this.reject('settings', index, 'no value');
        continue;
      }
      const scope = DEVICE_SETTING_KEYS.has(key) ? 'device' : 'patient';
      const id =
        scope === 'device'
          ? await derivedId(this.ctx.householdId, 'device-setting', key)
          : await this.id('settings', key);
      this.drafts.push({
        entryId: await derivedId('entry', id, this.patientKey),
        recordId: id,
        type: 'setting',
        patientId: this.patientId,
        kind: 'import',
        fields: { ...this.base(id, null), scope, key, value: json(value) },
      });
      this.count('settings', 'imported');
    }
  }

  // ---- tombstones
  async tombstones(): Promise<void> {
    const types: Partial<Record<string, { table: string; type: StoredType }>> = {
      events: { table: 'events', type: 'seizure' },
      medicationLogs: { table: 'medicationLogs', type: 'doseLog' },
      eegSessions: { table: 'eegSessions', type: 'eegSession' },
      eegActivities: { table: 'eegActivities', type: 'eegActivity' },
      wellbeingEntries: { table: 'wellbeingEntries', type: 'wellbeingEntry' },
    };
    for (const [index, row] of this.patient.tables.tombstones.entries()) {
      this.count('tombstones', 'found');
      const target = types[str(row.table)];
      const uuid = str(row.uuid);
      if (!target || !uuid || num(row.deletedAt) === null) {
        this.reject('tombstones', index, 'not a valid deletion');
        continue;
      }
      const recordId = await this.id(target.table, uuid);
      this.drafts.push({
        entryId: await derivedId('entry', recordId, 'delete'),
        recordId,
        type: target.type,
        patientId: this.patientId,
        kind: 'delete',
        fields: null,
      });
      this.count('tombstones', 'imported');
    }
  }
}
