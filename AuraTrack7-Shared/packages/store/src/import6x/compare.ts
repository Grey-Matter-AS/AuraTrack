import {
  clusterCounts,
  emergencyPlan,
  isLongSeizure,
  localMonthKey,
  seizureSeconds,
  totalSeconds,
  type Seizure,
} from '@auratrack/model';
import type { Store } from '../store';
import { patientIdFor, patientKeyOf, type ImportReport } from './import';
import { legacySeizureSeconds } from './map';
import type { LegacyFile, LegacyTable, Row } from './read';

// The import comparison report: 6.1's own numbers, recomputed from the 6.1 file, next to the same numbers from the imported
// data. Seizures per month, durations, the emergency-plan flags, medication changes and doses. Every row says whether the
// two agree. A row that does not agree is something to look at before switching over.

export interface ComparisonRow {
  patient: string;
  section: string;
  metric: string;
  v6: string | number;
  v7: string | number;
  match: boolean;
  /** Why the numbers can differ even when the import is right, e.g. rows that were rejected and listed in the import report. */
  note?: string;
}
export interface ComparisonReport {
  rows: ComparisonRow[];
  mismatches: ComparisonRow[];
  /** Seizures whose seizure time differs, with both numbers. */
  seizureTimeDifferences: { patient: string; legacyKey: string; v6: number; v7: number | null }[];
  allMatch: boolean;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function tally<T>(items: readonly T[], key: (item: T) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== null) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** 6.1's cluster rule (src/utils/dangerFlags.js clusterCounts), on start times only. */
function legacyClusterFlags(starts: readonly number[], windowMs: number, minCount: number): number {
  const sorted = [...starts].sort((a, b) => a - b);
  let flagged = 0;
  sorted.forEach((t, i) => {
    let count = 1;
    for (let j = i - 1; j >= 0 && t - (sorted[j] as number) <= windowMs; j--) count++;
    for (let j = i + 1; j < sorted.length && (sorted[j] as number) - t <= windowMs; j++) count++;
    if (count >= minCount) flagged++;
  });
  return flagged;
}

/**
 * `report` is the import report: rows it rejected (and listed, with a reason) are left out of 6.1's numbers here, and shown
 * on their own line, so that every source row is either compared or visibly rejected.
 */
export async function compareImport(
  store: Store,
  legacy: LegacyFile,
  report?: ImportReport,
): Promise<ComparisonReport> {
  const rows: ComparisonRow[] = [];
  const seizureTimeDifferences: ComparisonReport['seizureTimeDifferences'] = [];
  const plan = emergencyPlan();

  for (const patient of legacy.patients) {
    const label = patient.name || patient.profileId || 'patient';
    const pid = await patientIdFor(store.info.householdId, patientKeyOf(patient));
    const add = (section: string, metric: string, v6: string | number, v7: string | number) =>
      rows.push({ patient: label, section, metric, v6, v7, match: v6 === v7 });
    const mine = <T extends { patientId: string }>(list: T[]) => list.filter((r) => r.patientId === pid);

    // Records
    const rejected = report?.patients.find((p) => p.patientKey === patientKeyOf(patient))?.rejected ?? [];
    const skip = (table: string) => new Set(rejected.filter((r) => r.table === table).map((r) => r.index));
    const accepted = (table: LegacyTable): Row[] => patient.tables[table].filter((_, index) => !skip(table).has(index));
    const t = {
      ...patient.tables,
      events: accepted('events'),
      medications: accepted('medications'),
      medicationChanges: accepted('medicationChanges'),
      medicationLogs: accepted('medicationLogs'),
      wellbeingEntries: accepted('wellbeingEntries'),
      eegSessions: accepted('eegSessions'),
      eegActivities: accepted('eegActivities'),
    };
    const live = (name: 'events' | 'medicationLogs' | 'wellbeingEntries' | 'eegSessions' | 'eegActivities') =>
      liveRows(t[name], t.tombstones, name);
    const seizures = mine(store.list('seizure'));
    add('records', 'seizures', live('events').length, seizures.length);
    add('records', 'medications', t.medications.length, mine(store.list('medication')).length);
    add('records', 'medication changes', t.medicationChanges.length, mine(store.list('medicationChange')).length);
    add('records', 'dose logs', live('medicationLogs').length, mine(store.list('doseLog')).length);
    add('records', 'wellbeing entries', live('wellbeingEntries').length, mine(store.list('wellbeingEntry')).length);
    add('records', 'EEG sessions', live('eegSessions').length, mine(store.list('eegSession')).length);
    add('records', 'EEG activities', live('eegActivities').length, mine(store.list('eegActivity')).length);

    if (rejected.length)
      rows.push({
        patient: label,
        section: 'records',
        metric: 'rows rejected (see the import report)',
        v6: rejected.length,
        v7: rejected.length,
        match: true,
        note: rejected.map((r) => `${r.table}: ${r.reason}`).join('; '),
      });

    // Seizures per month
    const events = live('events');
    const v6Months = tally(events, (e) => (num(e.startTime) === null ? null : localMonthKey(e.startTime as number)));
    const v7Months = tally(seizures, (s) => localMonthKey(s.phases.start.at));
    for (const month of [...new Set([...v6Months.keys(), ...v7Months.keys()])].sort())
      add('seizures per month', month, v6Months.get(month) ?? 0, v7Months.get(month) ?? 0);

    // Durations
    const byLegacyKey = new Map<string, Seizure>();
    for (const s of seizures)
      byLegacyKey.set(rowKey((store.versioned('seizure', s.id)?.fields.legacy?.value ?? {}) as Row), s);
    let v6Seizure = 0;
    let v7Seizure = 0;
    let v6Total = 0;
    let v7Total = 0;
    for (const e of events) {
      const key = rowKey(e);
      const match = byLegacyKey.get(key);
      const legacySeconds = legacySeizureSeconds(e);
      v6Seizure += legacySeconds;
      v6Total += num(e.duration) ?? 0;
      if (!match) continue;
      const seconds = seizureSeconds(match.phases);
      v7Seizure += seconds ?? 0;
      v7Total += totalSeconds(match.phases) ?? 0;
      if (seconds !== legacySeconds)
        seizureTimeDifferences.push({ patient: label, legacyKey: key, v6: legacySeconds, v7: seconds });
    }
    add('durations', 'seizure time, all seizures (s)', Math.round(v6Seizure), Math.round(v7Seizure));
    add('durations', 'recorded duration, all seizures (s)', Math.round(v6Total), Math.round(v7Total));

    // The emergency plan, with its default settings
    add(
      'emergency plan',
      `seizures of ${plan.alertMinutes} min or more`,
      events.filter((e) => legacySeizureSeconds(e) >= plan.alertSec).length,
      seizures.filter((s) => isLongSeizure(s.phases, plan)).length,
    );
    const starts = events.map((e) => num(e.startTime)).filter((x): x is number => x !== null);
    const v7Clustered = [...clusterCounts(seizures, plan).values()].filter((c) => c >= plan.clusterMinCount).length;
    add(
      'emergency plan',
      `seizures in a cluster (${plan.clusterMinCount} in ${plan.clusterWindowMinutes} min)`,
      legacyClusterFlags(starts, plan.clusterWindowMs, plan.clusterMinCount),
      v7Clustered,
    );

    // Medication changes and doses
    const v6Changes = tally(t.medicationChanges, (c) => (typeof c.type === 'string' ? c.type : null));
    const v7Changes = tally(mine(store.list('medicationChange')), (c) => c.type);
    for (const type of ['started', 'changed', 'stopped', 'correction'])
      add('medication changes', type, v6Changes.get(type) ?? 0, v7Changes.get(type) ?? 0);
    const v6Doses = tally(t.medicationLogs, (l) =>
      num(l.takenAt) === null
        ? null
        : `${localMonthKey(l.takenAt as number)} ${typeof l.status === 'string' ? l.status : 'taken'}`,
    );
    const v7Doses = tally(mine(store.list('doseLog')), (l) => `${localMonthKey(l.takenAt)} ${l.status}`);
    for (const key of [...new Set([...v6Doses.keys(), ...v7Doses.keys()])].sort())
      add('doses per month', key, v6Doses.get(key) ?? 0, v7Doses.get(key) ?? 0);
  }

  const mismatches = rows.filter((r) => !r.match);
  return { rows, mismatches, seizureTimeDifferences, allMatch: mismatches.length === 0 };
}

const rowKey = (row: Row): string =>
  typeof row.uuid === 'string' && row.uuid ? row.uuid : `noid:${JSON.stringify(row)}`;

/** Source rows that 6.1 had not deleted: a tombstone for a row's uuid means it is gone, and stays gone in v7. */
function liveRows(rows: Row[], tombstones: Row[], table: string): Row[] {
  const gone = new Set(tombstones.filter((t) => t.table === table).map((t) => t.uuid));
  return rows.filter((row) => !gone.has(row.uuid));
}
