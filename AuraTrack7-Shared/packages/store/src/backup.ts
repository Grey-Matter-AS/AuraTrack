import {
  CATALOGUE_VERSION,
  ChangeLogEntrySchema,
  HlcStringSchema,
  RECORD_SCHEMAS,
  type ChangeLogEntry,
} from '@auratrack/model';
import { z } from 'zod';
import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8 } from './bytes';
import { DecryptError, backupKey, open, seal } from './crypto';
import { stableStringify, type JsonValue, type VersionedRecord } from './merge';
import type { ApplyResult, Store } from './store';

// Backup v7: one encrypted file with every patient and every record of the household on this device: the records with their
// per-field stamps (deleted ones included, as tombstones) and the whole change log. It is checked when it is made and when
// it is restored: counts per record type must match, and anything that does not validate is listed, never dropped.

export const BACKUP_SCHEMA = 'auratrack.v7.backup';
export const BACKUP_VERSION = 1;
export const ENCRYPTED_BACKUP_SCHEMA = 'auratrack.v7.encrypted-backup';
export const BACKUP_PBKDF2_ITERATIONS = 600_000;
export const MIN_BACKUP_PASSPHRASE_LENGTH = 8;

export class BackupFormatError extends Error {
  constructor(message = 'This is not an AuraTrack backup file') {
    super(message);
    this.name = 'BackupFormatError';
  }
}
export class PassphraseTooShortError extends Error {
  constructor() {
    super(`The passphrase must be at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters`);
    this.name = 'PassphraseTooShortError';
  }
}
export class BackupVerificationError extends Error {
  constructor(
    message: string,
    readonly report: BackupCheck,
  ) {
    super(message);
    this.name = 'BackupVerificationError';
  }
}

const JsonSchema = z.json();
const VersionedRecordSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  fields: z.record(z.string(), z.object({ value: JsonSchema, stamp: HlcStringSchema })),
  deletedAt: HlcStringSchema.nullable(),
});

const CountsSchema = z.object({
  records: z.record(z.string(), z.number().int().nonnegative()),
  tombstones: z.number().int().nonnegative(),
  changeLog: z.number().int().nonnegative(),
});
export type BackupCounts = z.infer<typeof CountsSchema>;

const PayloadSchema = z.object({
  schema: z.literal(BACKUP_SCHEMA),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int().nonnegative(),
  catalogueVersion: z.number().int(),
  householdId: z.string(),
  deviceId: z.string(),
  counts: CountsSchema,
  records: z.array(VersionedRecordSchema),
  changeLog: z.array(z.unknown()),
});
export type BackupPayload = Omit<z.infer<typeof PayloadSchema>, 'records' | 'changeLog'> & {
  records: VersionedRecord[];
  changeLog: ChangeLogEntry[];
};

const EncryptedFileSchema = z.object({
  schema: z.literal(ENCRYPTED_BACKUP_SCHEMA),
  version: z.literal(1),
  exportedAt: z.number().int().nonnegative(),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int(),
    salt: z.string(),
  }),
  cipher: z.object({ name: z.literal('AES-GCM'), iv: z.string() }),
  ciphertext: z.string(),
});
export type EncryptedBackupFile = z.infer<typeof EncryptedFileSchema>;

export function countRecords(records: readonly VersionedRecord[], changeLog: number): BackupCounts {
  const counts: Record<string, number> = {};
  let tombstones = 0;
  for (const record of records) {
    if (record.deletedAt !== null) tombstones++;
    else counts[record.type] = (counts[record.type] ?? 0) + 1;
  }
  return { records: counts, tombstones, changeLog };
}

/**
 * Makes the encrypted backup file (as an object; `JSON.stringify` it to save). With a `patientId` the file holds that person only:
 * restoring it adds them to another phone or household without touching anyone else.
 */
export async function createBackup(
  store: Store,
  passphrase: string,
  options: { now?: () => number; iterations?: number; patientId?: string } = {},
): Promise<EncryptedBackupFile> {
  if (passphrase.normalize('NFKC').length < MIN_BACKUP_PASSPHRASE_LENGTH) throw new PassphraseTooShortError();
  const everything = await store.snapshot();
  // One person: their records (the person included, and what was deleted, as tombstones) and the change log lines for them
  const { records, changeLog } = options.patientId
    ? {
        records: everything.records.filter((r) => r.fields['patientId']?.value === options.patientId),
        changeLog: everything.changeLog.filter((e) => e.patientId === options.patientId),
      }
    : everything;
  const now = options.now?.() ?? Date.now();
  const payload: BackupPayload = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: now,
    catalogueVersion: CATALOGUE_VERSION,
    householdId: store.info.householdId,
    deviceId: store.info.deviceId,
    counts: countRecords(records, changeLog.length),
    records,
    changeLog,
  };
  const iterations = options.iterations ?? BACKUP_PBKDF2_ITERATIONS;
  const salt = randomBytes(16);
  const sealed = await seal(await backupKey(passphrase, salt, iterations), JSON.stringify(payload), BACKUP_SCHEMA);
  return {
    schema: ENCRYPTED_BACKUP_SCHEMA,
    version: 1,
    exportedAt: now,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64Url(salt) },
    cipher: { name: 'AES-GCM', iv: sealed.iv },
    ciphertext: sealed.ct,
  };
}

export interface BackupCheck {
  /** Counts the backup says it holds, and what it really holds. */
  expected: BackupCounts;
  actual: BackupCounts;
  countsMatch: boolean;
  /** Records whose values do not validate (kept in the backup, and restored, but listed). */
  invalid: { type: string; id: string; reason: string }[];
  /** Change-log lines that are not valid changes (they cannot be restored). */
  badChanges: number;
}

/** Decrypts a backup and checks it. A wrong passphrase gives DecryptError; a foreign file gives BackupFormatError. */
export async function readBackup(
  file: string | object,
  passphrase: string,
): Promise<{ payload: BackupPayload; check: BackupCheck }> {
  let raw: unknown;
  try {
    raw = typeof file === 'string' ? JSON.parse(file) : file;
  } catch {
    throw new BackupFormatError();
  }
  const envelope = EncryptedFileSchema.safeParse(raw);
  if (!envelope.success) throw new BackupFormatError();
  const { kdf, cipher, ciphertext } = envelope.data;
  let text: string;
  try {
    text = await open(
      await backupKey(passphrase, fromBase64Url(kdf.salt), kdf.iterations),
      { iv: cipher.iv, ct: ciphertext },
      BACKUP_SCHEMA,
    );
  } catch (error) {
    if (error instanceof DecryptError) throw error;
    throw new DecryptError();
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new BackupFormatError('The backup is damaged');
  }
  const parsed = PayloadSchema.safeParse(parsedJson);
  if (!parsed.success) throw new BackupFormatError('The backup is damaged');
  const payload = parsed.data as unknown as BackupPayload;

  const actual = countRecords(payload.records, payload.changeLog.length);
  const invalid: BackupCheck['invalid'] = [];
  for (const record of payload.records) {
    if (record.deletedAt !== null) continue;
    const schema = (RECORD_SCHEMAS as Record<string, z.ZodType | undefined>)[record.type];
    if (!schema) {
      invalid.push({ type: record.type, id: record.id, reason: 'unknown record type' });
      continue;
    }
    const result = schema.safeParse(
      Object.fromEntries(Object.entries(record.fields).map(([name, field]) => [name, field.value])),
    );
    if (!result.success)
      invalid.push({
        type: record.type,
        id: record.id,
        reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
  }
  const badChanges = payload.changeLog.filter((entry) => !ChangeLogEntrySchema.safeParse(entry).success).length;
  const countsMatch =
    stableStringify(payload.counts as unknown as JsonValue) === stableStringify(actual as unknown as JsonValue);
  return { payload, check: { expected: payload.counts, actual, countsMatch, invalid, badChanges } };
}

export interface RestoreReport {
  backup: BackupCounts;
  /** What the store holds for the backup's records after the restore. */
  restored: BackupCounts;
  applied: ApplyResult;
  invalid: BackupCheck['invalid'];
  /** Records whose fields in the store differ from the backup after the restore. Always empty when it worked. */
  mismatched: { type: string; id: string }[];
  ok: boolean;
}

const plain = (record: VersionedRecord) =>
  stableStringify({
    fields: Object.fromEntries(Object.entries(record.fields).map(([n, f]) => [n, { value: f.value, stamp: f.stamp }])),
    deletedAt: record.deletedAt,
  });

/**
 * Puts a backup into a store by replaying its change log (so stamps, history and deletions all come back), then checks that
 * every record in the backup is in the store exactly as it was. A damaged backup (counts that do not match) is refused.
 */
export async function restoreBackup(store: Store, file: string | object, passphrase: string): Promise<RestoreReport> {
  const { payload, check } = await readBackup(file, passphrase);
  if (!check.countsMatch || check.badChanges > 0)
    throw new BackupVerificationError(
      check.countsMatch ? 'The backup contains changes that are not valid' : 'The backup does not match its own counts',
      check,
    );
  const applied = await store.applyChanges(payload.changeLog);
  const mismatched: RestoreReport['mismatched'] = [];
  for (const record of payload.records) {
    const now = store.versioned(record.type as never, record.id);
    if (!now || plain(now) !== plain(record)) mismatched.push({ type: record.type, id: record.id });
  }
  const { records } = await store.snapshot();
  const restored = countRecords(
    records.filter((r) => payload.records.some((p) => p.id === r.id && p.type === r.type)),
    payload.changeLog.length,
  );
  return {
    backup: payload.counts,
    restored,
    applied,
    invalid: check.invalid,
    mismatched,
    ok: mismatched.length === 0 && applied.rejected.length === 0,
  };
}

/** The backup file name: the local date, never the UTC one. */
export const suggestedBackupName = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `auratrack-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.atbak`;
};

// Re-exported so callers can build a file reader without importing bytes
export { fromUtf8, utf8 };
