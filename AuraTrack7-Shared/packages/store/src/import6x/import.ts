import { RECORD_SCHEMAS } from '@auratrack/model';
import type { Store } from '../store';
import { derivedId } from './ids';
import { Mapper, type MapContext, type RejectedRow, type ReviewItem, type TableCount } from './map';
import { read6xFile, type LegacyFile, type LegacyPatient, type LegacyTable } from './read';

export interface ImportOptions {
  /** For an encrypted 6.1 backup. */
  passphrase?: string;
  /** 6.1 did not store a time zone; this is assumed for every seizure. Default: this device's. */
  timeZone?: string;
  now?: number;
}

export interface PatientImport {
  name: string;
  patientId: string;
  /** The key the ids were derived from: the 6.1 profile id, or 'single'. */
  patientKey: string;
  tables: Partial<Record<LegacyTable | 'settings', TableCount>>;
  rejected: RejectedRow[];
}

export interface ImportReport {
  file: { kind: LegacyFile['kind']; encrypted: boolean; patients: number };
  patients: PatientImport[];
  /** Everything that could not be mapped to the catalogue and was kept as the household's own code. Check these. */
  review: ReviewItem[];
  customCodes: number;
  totals: { found: number; imported: number; rejected: number };
  /** Found rows that are neither imported nor rejected with a reason. Always 0. */
  unaccounted: number;
  applied: number;
  /** Records already in the store from an earlier import of the same file. */
  duplicates: number;
  timeZone: string;
  timeZoneAssumed: boolean;
}

export const patientKeyOf = (patient: LegacyPatient): string => patient.profileId ?? 'single';
export const patientIdFor = (householdId: string, patientKey: string): Promise<string> =>
  derivedId(householdId, 'patient', patientKey);

/** Imports a 6.1 backup into the store. Safe to run again: records that are already there are recognised and skipped. */
export async function import6x(
  store: Store,
  text: string,
  options: ImportOptions = {},
): Promise<{ report: ImportReport; legacy: LegacyFile }> {
  const legacy = await read6xFile(text, options.passphrase);
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ctx: MapContext = {
    householdId: store.info.householdId,
    deviceId: store.info.deviceId,
    timeZone,
    now: options.now ?? Date.now(),
    customs: new Map(),
    review: new Map(),
  };

  const patients: PatientImport[] = [];
  const drafts: Parameters<Store['importDrafts']>[0][number][] = [];
  for (const patient of legacy.patients) {
    const key = patientKeyOf(patient);
    const patientId = await patientIdFor(ctx.householdId, key);
    const mapper = new Mapper(ctx, patient, patientId, key);
    await mapper.patientAndSettings(null);
    const known = await mapper.medications();
    await mapper.medicationChanges(known);
    await mapper.doseLogs(known);
    await mapper.events();
    await mapper.wellbeing();
    await mapper.eeg();
    await mapper.tombstones();
    drafts.push(...mapper.drafts);
    patients.push({ name: patient.name, patientId, patientKey: key, tables: mapper.counts, rejected: mapper.rejected });
  }

  for (const custom of ctx.customs.values()) {
    const id = await derivedId(ctx.householdId, 'customcode', custom.code);
    const values = {
      id,
      householdId: ctx.householdId,
      patientId: custom.patientId,
      deviceId: ctx.deviceId,
      createdAt: ctx.now,
      kind: custom.kind,
      code: custom.code,
      label: custom.label,
      parentCode: null,
    };
    if (!RECORD_SCHEMAS.customCode.safeParse(values).success) continue;
    drafts.push({
      entryId: await derivedId('entry', id),
      recordId: id,
      type: 'customCode',
      patientId: custom.patientId,
      kind: 'import',
      fields: values,
    });
  }

  const stored = await store.importDrafts(drafts);
  const totals = { found: 0, imported: 0, rejected: 0 };
  for (const p of patients) {
    for (const c of Object.values(p.tables)) {
      totals.found += c.found;
      totals.imported += c.imported;
      totals.rejected += c.rejected;
    }
  }
  const report: ImportReport = {
    file: { kind: legacy.kind, encrypted: legacy.encrypted, patients: legacy.patients.length },
    patients,
    review: [...ctx.review.values()].sort(
      (a, b) => a.kind.localeCompare(b.kind) || b.count - a.count || a.text.localeCompare(b.text),
    ),
    customCodes: ctx.customs.size,
    totals,
    unaccounted: totals.found - totals.imported - totals.rejected,
    applied: stored.applied,
    duplicates: stored.duplicates,
    timeZone,
    timeZoneAssumed: options.timeZone === undefined,
  };
  return { report, legacy };
}
