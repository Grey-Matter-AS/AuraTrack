import {
  APPEND_ONLY_TYPES,
  ChangeLogEntrySchema,
  ClockDriftError,
  MERGE_RULES,
  RECORD_SCHEMAS,
  compareHlc,
  decodeHlc,
  encodeHlc,
  initialHlc,
  newId,
  receiveHlc,
  tickHlc,
  type ChangeLogEntry,
  type Hlc,
  type RecordOf,
  type RecordType,
} from '@auratrack/model';
import Dexie, { type EntityTable } from 'dexie';
import { buildRecoveryKit, newRecoverySecret, parseRecoveryKit } from './recovery';
import {
  exportDeviceKey,
  generateDeviceKey,
  importDeviceKey,
  kdfIsCurrent,
  open,
  seal,
  unlockWithPin,
  unlockWithSecret,
  WrongSecretError,
  wrapDeviceKeyWithPin,
  wrapDeviceKeyWithSecret,
  type PinKdf,
  type Sealed,
  type WrappedKey,
} from './crypto';
import {
  currentValues,
  isDeleted,
  mergeRecords,
  stableStringify,
  type JsonValue,
  type MergeRules,
  type VersionedRecord,
} from './merge';

// The store: encrypted IndexedDB through Dexie, a decrypted working set in memory, and the change log.
//  - IndexedDB only holds sealed bytes. Only non-sensitive things are indexed: the record type, the patient id and a time.
//  - A local edit and a change that arrives from another device go through the same code, so they cannot disagree.
//  - Nothing reaches memory before it is on disk.

/** Types the store keeps as records. The change log has its own table. */
export type StoredType = Exclude<RecordType, 'changeLog'>;
const isAppendOnly = (type: string) => (APPEND_ONLY_TYPES as readonly string[]).includes(type);
const isStoredType = (type: string): type is StoredType => type !== 'changeLog' && type in RECORD_SCHEMAS;

interface RecordRow extends Sealed {
  type: string;
  id: string;
  patientId: string | null;
  at: number;
}
interface LogRow extends Sealed {
  id: string;
  stamp: string;
  recordType: string;
}
interface MetaRow {
  key: string;
  value: unknown;
}

class AuraDb extends Dexie {
  meta!: EntityTable<MetaRow, 'key'>;
  records!: Dexie.Table<RecordRow, [string, string]>;
  changeLog!: EntityTable<LogRow, 'id'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      records: '[type+id], type, patientId, at',
      changeLog: 'id, stamp, recordType',
    });
  }
}

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
export class ValidationError extends StoreError {
  constructor(
    readonly type: string,
    readonly issues: string,
  ) {
    super(`${type} is not valid: ${issues}`);
    this.name = 'ValidationError';
  }
}
export class NotFoundError extends StoreError {}
export class AppendOnlyError extends StoreError {}

export type Credential = { readonly pin: string } | { readonly secret: Uint8Array };
/** What can unlock an existing store: a PIN, a passkey secret, or the printed recovery kit. */
export type UnlockCredential = Credential | { readonly recoveryKit: string };

export interface StoreInfo {
  readonly householdId: string;
  readonly deviceId: string;
}

/** One record to import: `entryId` and `recordId` are fixed by the importer so a repeat import is recognised. */
export interface ImportDraft {
  entryId: string;
  recordId: string;
  type: StoredType;
  patientId: string | null;
  kind: 'import' | 'delete';
  fields: Record<string, JsonValue> | null;
}

export interface ApplyResult {
  applied: number;
  /** Entries this device already had. */
  duplicates: number;
  rejected: { entryId: string; reason: string }[];
  /** Append-only records that exist on two devices with different content: the choice is deterministic, and listed for review. */
  conflicts: string[];
}

export interface StoreOptions {
  now?: () => number;
  /** How a new PIN wrap is made; the default is Argon2id at full strength. Cheaper settings are for tests only. */
  pinKdf?: PinKdf;
}

/** A record's field values as text that is the same wherever it is written. */
const plain = (record: VersionedRecord): string =>
  stableStringify(Object.fromEntries(Object.entries(record.fields).map(([name, field]) => [name, field.value])));

const rulesFor = (type: string): MergeRules => (MERGE_RULES as Record<string, MergeRules | undefined>)[type] ?? {};

/** A non-sensitive time to index a record by, so ranges can be read without decrypting everything. */
function indexTime(type: string, values: Record<string, JsonValue> | null): number {
  if (!values) return 0;
  const num = (v: JsonValue | undefined) => (typeof v === 'number' ? v : 0);
  if (type === 'seizure') {
    const phases = values.phases;
    const start = phases && typeof phases === 'object' && !Array.isArray(phases) ? phases.start : null;
    return start && typeof start === 'object' && !Array.isArray(start) ? num(start.at) : num(values.createdAt);
  }
  if (type === 'interictalEvent') return num(values.occurredAt);
  if (type === 'doseLog') return num(values.takenAt);
  if (type === 'wellbeingEntry') return num(values.recordedAt);
  if (type === 'eegSession' || type === 'eegActivity') return num(values.startTime);
  return num(values.createdAt);
}

export class Store {
  private readonly set = new Map<StoredType, Map<string, VersionedRecord>>();
  private readonly logIds = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private clock: Hlc;

  private constructor(
    private readonly db: AuraDb,
    private readonly key: CryptoKey,
    readonly info: StoreInfo,
    clock: Hlc,
    private readonly now: () => number,
    private readonly pinKdf: PinKdf | undefined,
  ) {
    this.clock = clock;
  }

  /** Is there a store under this name? */
  static async exists(name: string): Promise<boolean> {
    if (!(await Dexie.exists(name))) return false;
    const db = new AuraDb(name);
    try {
      return (await db.meta.get('wrappedKey')) !== undefined;
    } finally {
      db.close();
    }
  }

  /** First run: makes the device key, wraps it with the PIN (or a passkey secret) and makes this device's identity. */
  static async create(
    name: string,
    credential: Credential,
    options: StoreOptions & { householdId?: string; deviceId?: string } = {},
  ): Promise<Store> {
    if (await Store.exists(name)) throw new StoreError(`A store named ${name} already exists`);
    const key = await generateDeviceKey();
    const wrapped =
      'pin' in credential
        ? await wrapDeviceKeyWithPin(key, credential.pin, options.pinKdf)
        : await wrapDeviceKeyWithSecret(key, credential.secret);
    const info: StoreInfo = { householdId: options.householdId ?? newId(), deviceId: options.deviceId ?? newId() };
    const db = new AuraDb(name);
    await db.meta.bulkPut([
      { key: 'wrappedKey', value: wrapped },
      { key: 'householdId', value: info.householdId },
      { key: 'deviceId', value: info.deviceId },
      { key: 'hlc', value: encodeHlc(initialHlc(info.deviceId)) },
    ]);
    const unlocked =
      'pin' in credential
        ? await unlockWithPin(wrapped, credential.pin)
        : await unlockWithSecret(wrapped, credential.secret);
    return Store.load(db, unlocked, info, initialHlc(info.deviceId), options);
  }

  /** Opens an existing store. A wrong PIN or secret throws WrongSecretError. */
  static async unlock(name: string, credential: UnlockCredential, options: StoreOptions = {}): Promise<Store> {
    const db = new AuraDb(name);
    const wrapped = (await db.meta.get('wrappedKey'))?.value as WrappedKey | undefined;
    if (!wrapped) {
      db.close();
      throw new StoreError(`No store named ${name}`);
    }
    try {
      const key = await Store.unlockAndUpgrade(db, wrapped, credential, options);
      const householdId = (await db.meta.get('householdId'))?.value as string;
      const deviceId = (await db.meta.get('deviceId'))?.value as string;
      const clock = decodeHlc((await db.meta.get('hlc'))?.value as string);
      return await Store.load(db, key, { householdId, deviceId }, clock, options);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Unlocks, and if the PIN wrap uses older or weaker settings (a store made with PBKDF2 in M1), makes a new wrap under
   * the current ones. The device key itself does not change, so no record is touched. The new wrap is written only after
   * it has been shown to open, so a failure leaves the old wrap exactly as it was.
   */
  private static async unlockAndUpgrade(
    db: AuraDb,
    wrapped: WrappedKey,
    credential: UnlockCredential,
    options: StoreOptions,
  ): Promise<CryptoKey> {
    if (!('pin' in credential) || kdfIsCurrent(wrapped.kdf, options.pinKdf))
      return Store.unwrapWith(db, wrapped, credential);
    const movable = await unlockWithPin(wrapped, credential.pin, true); // a wrong PIN throws here
    try {
      const upgraded = await wrapDeviceKeyWithPin(movable, credential.pin, options.pinKdf);
      await unlockWithPin(upgraded, credential.pin); // proves the new wrap opens before it replaces the old one
      await db.meta.put({ key: 'wrappedKey', value: upgraded });
    } catch {
      // keep the old wrap and carry on: the PIN worked, and the upgrade is tried again at the next unlock
    }
    return importDeviceKey(await exportDeviceKey(movable));
  }

  private static async unwrapWith(
    db: AuraDb,
    wrapped: WrappedKey,
    credential: UnlockCredential,
    extractable = false,
  ): Promise<CryptoKey> {
    if ('pin' in credential) return unlockWithPin(wrapped, credential.pin, extractable);
    if ('secret' in credential) return unlockWithSecret(wrapped, credential.secret, extractable);
    const kit = await parseRecoveryKit(credential.recoveryKit);
    const recovery = (await db.meta.get('recoveryWrappedKey'))?.value as WrappedKey | undefined;
    const householdId = (await db.meta.get('householdId'))?.value;
    if (!recovery || kit.householdId !== householdId) throw new WrongSecretError();
    return unlockWithSecret(recovery, kit.secret, extractable);
  }

  /**
   * Makes a recovery kit: the device key wrapped a second time under a new secret. Needs the current PIN or secret,
   * because the working key cannot be taken out of WebCrypto. Returns the kit text; print it and keep it safe.
   */
  async addRecoveryKit(current: Credential): Promise<string> {
    const wrapped = (await this.db.meta.get('wrappedKey'))?.value as WrappedKey;
    const key = await Store.unwrapWith(this.db, wrapped, current, true);
    const secret = newRecoverySecret();
    await this.db.meta.put({ key: 'recoveryWrappedKey', value: await wrapDeviceKeyWithSecret(key, secret) });
    return buildRecoveryKit(this.info.householdId, secret);
  }

  /** Sets a new PIN. Needs the current credential (or the recovery kit, if the PIN was forgotten). */
  async changePin(current: UnlockCredential, newPin: string): Promise<void> {
    const wrapped = (await this.db.meta.get('wrappedKey'))?.value as WrappedKey;
    const key = await Store.unwrapWith(this.db, wrapped, current, true);
    await this.db.meta.put({ key: 'wrappedKey', value: await wrapDeviceKeyWithPin(key, newPin, this.pinKdf) });
  }

  /** Everything, with stamps: the records (tombstones included) and the whole change log. For backups. */
  async snapshot(): Promise<{ records: VersionedRecord[]; changeLog: ChangeLogEntry[] }> {
    return { records: this.allVersioned(), changeLog: await this.changesSince(null) };
  }

  private static async load(
    db: AuraDb,
    key: CryptoKey,
    info: StoreInfo,
    clock: Hlc,
    options: StoreOptions,
  ): Promise<Store> {
    const store = new Store(db, key, info, clock, options.now ?? Date.now, options.pinKdf);
    for (const row of await db.records.toArray()) {
      if (!isStoredType(row.type)) continue;
      const record = JSON.parse(await open(key, row, `${row.type}:${row.id}`)) as VersionedRecord;
      store.bucket(row.type).set(row.id, record);
    }
    for (const id of await db.changeLog.toCollection().primaryKeys()) store.logIds.add(id);
    return store;
  }

  close(): void {
    this.db.close();
  }

  private bucket(type: StoredType): Map<string, VersionedRecord> {
    let bucket = this.set.get(type);
    if (!bucket) this.set.set(type, (bucket = new Map()));
    return bucket;
  }

  /** One writer at a time: stamps stay in order and the clock on disk never lags the data. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private tick(): Hlc {
    return (this.clock = tickHlc(this.clock, this.now()));
  }

  // ---- reading

  /** The current values of a record, or null if it is missing, deleted or not (yet) a valid record. */
  get<T extends StoredType>(type: T, id: string): RecordOf<T> | null {
    const record = this.set.get(type)?.get(id);
    return record ? this.parse(type, record) : null;
  }

  list<T extends StoredType>(type: T, where?: (record: RecordOf<T>) => boolean): RecordOf<T>[] {
    const out: RecordOf<T>[] = [];
    for (const record of this.set.get(type)?.values() ?? []) {
      const parsed = this.parse(type, record);
      if (parsed && (!where || where(parsed))) out.push(parsed);
    }
    return out;
  }

  private parse<T extends StoredType>(type: T, record: VersionedRecord): RecordOf<T> | null {
    const values = currentValues(record);
    if (!values) return null;
    const result = RECORD_SCHEMAS[type].safeParse(values);
    return result.success ? (result.data as RecordOf<T>) : null;
  }

  /** The record with its per-field stamps, for sync, backup and tests. */
  versioned(type: StoredType, id: string): VersionedRecord | null {
    return this.set.get(type)?.get(id) ?? null;
  }

  allVersioned(): VersionedRecord[] {
    return [...this.set.values()].flatMap((bucket) => [...bucket.values()]);
  }

  /** Records that arrived but are not valid (for instance a change that is still waiting for the rest of its record). */
  incomplete(): { type: string; id: string }[] {
    const out: { type: string; id: string }[] = [];
    for (const [type, bucket] of this.set) {
      for (const record of bucket.values())
        if (!isDeleted(record) && !this.parse(type, record)) out.push({ type, id: record.id });
    }
    return out;
  }

  // ---- writing

  /** Makes a record. `id`, `householdId`, `deviceId` and `createdAt` are filled in if missing. Invalid records are refused. */
  create<T extends StoredType>(
    type: T,
    values: Omit<RecordOf<T>, 'id' | 'householdId' | 'deviceId' | 'createdAt'> &
      Partial<Pick<RecordOf<T>, 'id' | 'householdId' | 'deviceId' | 'createdAt'>>,
  ): Promise<RecordOf<T>> {
    return this.serial(async () => {
      const full = {
        id: newId(),
        householdId: this.info.householdId,
        deviceId: this.info.deviceId,
        createdAt: this.now(),
        ...values,
      } as Record<string, JsonValue>;
      const id = full.id as string;
      if (this.set.get(type)?.has(id)) throw new StoreError(`${type} ${id} already exists`);
      this.check(type, full);
      await this.commit(this.entry('create', type, id, full, this.patientOf(full)));
      return this.get(type, id) as RecordOf<T>;
    });
  }

  /** Changes some fields. Only the fields that are given are stamped, so edits to other fields on other devices survive. */
  update<T extends StoredType>(type: T, id: string, patch: Partial<Omit<RecordOf<T>, 'id'>>): Promise<RecordOf<T>> {
    return this.serial(async () => {
      if (isAppendOnly(type)) throw new AppendOnlyError(`${type} records are only ever added to`);
      const existing = this.set.get(type)?.get(id);
      if (!existing || isDeleted(existing)) throw new NotFoundError(`${type} ${id} not found`);
      const fields = patch as Record<string, JsonValue>;
      const changed = Object.fromEntries(
        Object.entries(fields).filter(
          ([name, value]) => stableStringify(existing.fields[name]?.value ?? null) !== stableStringify(value ?? null),
        ),
      );
      if (Object.keys(changed).length === 0) return this.get(type, id) as RecordOf<T>;
      const next = { ...currentValues(existing), ...changed } as Record<string, JsonValue>;
      this.check(type, next);
      await this.commit(this.entry('update', type, id, changed, this.patientOf(next)));
      return this.get(type, id) as RecordOf<T>;
    });
  }

  /** Deletes a record. The deletion is a tombstone that reaches the other devices and cannot be undone by a later edit. */
  delete(type: StoredType, id: string): Promise<void> {
    return this.serial(async () => {
      if (isAppendOnly(type)) throw new AppendOnlyError(`${type} records are only ever added to`);
      const existing = this.set.get(type)?.get(id);
      if (!existing || isDeleted(existing)) throw new NotFoundError(`${type} ${id} not found`);
      await this.commit(this.entry('delete', type, id, null, this.patientOf(currentValues(existing) ?? {})));
    });
  }

  private patientOf(values: Record<string, JsonValue>): string | null {
    return typeof values.patientId === 'string' ? values.patientId : null;
  }

  private check(type: StoredType, values: Record<string, JsonValue>): void {
    const result = RECORD_SCHEMAS[type].safeParse(values);
    if (!result.success)
      throw new ValidationError(type, result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }

  private entry(
    kind: ChangeLogEntry['kind'],
    type: string,
    recordId: string,
    fields: Record<string, JsonValue> | null,
    patientId: string | null,
  ): ChangeLogEntry {
    const stamp = encodeHlc(this.tick());
    return {
      id: newId(),
      householdId: this.info.householdId,
      patientId,
      deviceId: this.info.deviceId,
      stamp,
      at: this.now(),
      recordType: type,
      recordId,
      kind,
      fields: fields as ChangeLogEntry['fields'],
    };
  }

  /** Changes from another device (or the importer). Idempotent: entries already seen are skipped, whatever the order they arrive in. */
  applyChanges(entries: readonly ChangeLogEntry[]): Promise<ApplyResult> {
    return this.serial(async () => {
      const result: ApplyResult = { applied: 0, duplicates: 0, rejected: [], conflicts: [] };
      // Validate before anything else: entries come from other devices and are not trusted
      const valid: ChangeLogEntry[] = [];
      for (const raw of entries) {
        const parsed = ChangeLogEntrySchema.safeParse(raw);
        if (parsed.success) valid.push(parsed.data);
        else
          result.rejected.push({ entryId: typeof raw?.id === 'string' ? raw.id : '?', reason: 'not a valid change' });
      }
      for (const entry of valid.sort((a, b) => compareHlc(a.stamp, b.stamp))) {
        if (this.logIds.has(entry.id)) {
          result.duplicates++;
          continue;
        }
        if (!isStoredType(entry.recordType)) {
          result.rejected.push({ entryId: entry.id, reason: `unknown record type ${entry.recordType}` });
          continue;
        }
        try {
          this.clock = receiveHlc(this.clock, decodeHlc(entry.stamp), this.now());
        } catch (error) {
          if (!(error instanceof ClockDriftError)) throw error;
          result.rejected.push({ entryId: entry.id, reason: 'its clock is too far ahead' });
          continue;
        }
        const conflict = await this.commit(entry);
        if (conflict) result.conflicts.push(entry.recordId);
        result.applied++;
      }
      return result;
    });
  }

  /**
   * Adds records that come from outside (the 6.1 importer). Each draft carries a fixed id, so importing the same file twice
   * adds nothing the second time. Drafts are stamped now, in order, like any other local change.
   */
  importDrafts(drafts: readonly ImportDraft[]): Promise<{ applied: number; duplicates: number; conflicts: string[] }> {
    return this.serial(async () => {
      const result = { applied: 0, duplicates: 0, conflicts: [] as string[] };
      for (const draft of drafts) {
        if (this.logIds.has(draft.entryId)) {
          result.duplicates++;
          continue;
        }
        const entry: ChangeLogEntry = {
          id: draft.entryId,
          householdId: this.info.householdId,
          patientId: draft.patientId,
          deviceId: this.info.deviceId,
          stamp: encodeHlc(this.tick()),
          at: this.now(),
          recordType: draft.type,
          recordId: draft.recordId,
          kind: draft.kind,
          fields: draft.fields,
        };
        if (await this.commit(entry)) result.conflicts.push(draft.recordId);
        result.applied++;
      }
      return result;
    });
  }

  /** The change log from a stamp on, oldest first: what is sent to a device that has not seen it yet. */
  async changesSince(stamp: string | null = null): Promise<ChangeLogEntry[]> {
    const rows = await (stamp === null
      ? this.db.changeLog.orderBy('stamp').toArray()
      : this.db.changeLog.where('stamp').above(stamp).sortBy('stamp'));
    return Promise.all(
      rows.map(async (row) => JSON.parse(await open(this.key, row, `changeLog:${row.id}`)) as ChangeLogEntry),
    );
  }

  /** Merges one entry into its record, writes record + log line + clock to disk in one go, then updates memory. Returns true on an append-only conflict. */
  private async commit(entry: ChangeLogEntry): Promise<boolean> {
    const type = entry.recordType as StoredType;
    const existing = this.set.get(type)?.get(entry.recordId);
    const fragment: VersionedRecord = {
      id: entry.recordId,
      type,
      fields: Object.fromEntries(
        Object.entries(entry.fields ?? {}).map(([name, value]) => [
          name,
          { value: value as JsonValue, stamp: entry.stamp },
        ]),
      ),
      deletedAt: entry.kind === 'delete' ? entry.stamp : null,
    };
    let merged: VersionedRecord;
    let conflict = false;
    if (existing && isAppendOnly(type) && entry.kind !== 'delete') {
      // Added to, never edited: a second copy that differs is reported, and the same one wins on every device
      const kept = plain(existing);
      const incoming = plain(fragment);
      conflict = kept !== incoming;
      merged = conflict && incoming < kept ? fragment : existing;
    } else {
      merged = existing ? mergeRecords(existing, fragment, rulesFor(type)) : fragment;
    }
    const aad = `${type}:${entry.recordId}`;
    const values = currentValues(merged);
    const [recordSeal, logSeal] = await Promise.all([
      seal(this.key, JSON.stringify(merged), aad),
      seal(this.key, JSON.stringify(entry), `changeLog:${entry.id}`),
    ]);
    const patientId = entry.patientId ?? (values && typeof values.patientId === 'string' ? values.patientId : null);
    await this.db.transaction('rw', this.db.records, this.db.changeLog, this.db.meta, async () => {
      await this.db.records.put({ type, id: entry.recordId, patientId, at: indexTime(type, values), ...recordSeal });
      await this.db.changeLog.put({ id: entry.id, stamp: entry.stamp, recordType: type, ...logSeal });
      await this.db.meta.put({ key: 'hlc', value: encodeHlc(this.clock) });
    });
    this.bucket(type).set(entry.recordId, merged);
    this.logIds.add(entry.id);
    return conflict;
  }
}

/** Asks the browser not to evict this origin's storage. Returns whether storage is persistent. */
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persisted' | 'persist'> | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false;
  return (await storage.persisted?.()) || (await storage.persist());
}

/** Is the app running as an installed PWA? Browser storage is much safer there (iOS clears Safari's after a week). */
export function isInstalledPwa(
  env: {
    matchMedia?: (query: string) => { matches: boolean };
    navigator?: { standalone?: boolean };
  } = globalThis as never,
): boolean {
  return env.matchMedia?.('(display-mode: standalone)').matches === true || env.navigator?.standalone === true;
}
