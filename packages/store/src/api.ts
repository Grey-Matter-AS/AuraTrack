import type { ChangeLogEntry, RecordType } from '@auratrack/model';
import { createBackup, restoreBackup, suggestedBackupName, type RestoreReport } from './backup';
import { compareImport, type ComparisonReport } from './import6x/compare';
import { import6x, type ImportReport } from './import6x/import';
import { recoveryKitQr } from './recovery';
import {
  Store,
  StoreError,
  type ApplyResult,
  type Credential,
  type StoreInfo,
  type StoreOptions,
  type StoredType,
  type UnlockCredential,
} from './store';

// What the page can ask the worker to do with the store. The worker owns the unlocked Store; the page never holds a key.

export interface StoreApiConfig {
  /** The IndexedDB database name. */
  name: string;
  options?: StoreOptions;
}

export interface StoreStatus {
  exists: boolean;
  unlocked: boolean;
  info: StoreInfo | null;
}

export type Values = Record<string, unknown>;

export function createStoreApi(config: StoreApiConfig) {
  let store: Store | null = null;
  const current = (): Store => {
    if (!store) throw new StoreError('The store is locked');
    return store;
  };

  const api = {
    async status(): Promise<StoreStatus> {
      return { exists: await Store.exists(config.name), unlocked: store !== null, info: store?.info ?? null };
    },
    async create(arg: { credential: Credential }): Promise<StoreInfo> {
      store?.close();
      store = await Store.create(config.name, arg.credential, config.options);
      return store.info;
    },
    async unlock(arg: { credential: UnlockCredential }): Promise<StoreInfo> {
      store?.close();
      store = await Store.unlock(config.name, arg.credential, config.options);
      return store.info;
    },
    lock(): void {
      store?.close();
      store = null;
    },
    list(arg: { type: StoredType; patientId?: string }): Values[] {
      return current().list(
        arg.type,
        (record) => arg.patientId === undefined || (record as Values).patientId === arg.patientId,
      ) as Values[];
    },
    get(arg: { type: StoredType; id: string }): Values | null {
      return current().get(arg.type, arg.id) as Values | null;
    },
    async createRecord(arg: { type: StoredType; values: Values }): Promise<Values> {
      return (await current().create(arg.type, arg.values as never)) as Values;
    },
    async update(arg: { type: StoredType; id: string; patch: Values }): Promise<Values> {
      return (await current().update(arg.type, arg.id, arg.patch as never)) as Values;
    },
    remove(arg: { type: StoredType; id: string }): Promise<void> {
      return current().delete(arg.type, arg.id);
    },
    applyChanges(arg: { entries: ChangeLogEntry[] }): Promise<ApplyResult> {
      return current().applyChanges(arg.entries);
    },
    changesSince(arg: { stamp: string | null }): Promise<ChangeLogEntry[]> {
      return current().changesSince(arg.stamp);
    },
    incomplete(): { type: string; id: string }[] {
      return current().incomplete();
    },
    /** Reads a 6.1 backup into the store and checks it against 6.1's own numbers. Safe to run again. */
    async importLegacy(arg: {
      text: string;
      passphrase?: string;
      timeZone?: string;
    }): Promise<{ report: ImportReport; comparison: ComparisonReport }> {
      const options = {
        ...(arg.passphrase !== undefined ? { passphrase: arg.passphrase } : {}),
        ...(arg.timeZone !== undefined ? { timeZone: arg.timeZone } : {}),
      };
      const { report, legacy } = await import6x(current(), arg.text, options);
      return { report, comparison: await compareImport(current(), legacy, report) };
    },
    /** The encrypted backup file as text, and the name to save it under. */
    async backup(arg: { passphrase: string }): Promise<{ fileName: string; text: string }> {
      const file = await createBackup(current(), arg.passphrase);
      return { fileName: suggestedBackupName(), text: JSON.stringify(file) };
    },
    restore(arg: { text: string; passphrase: string }): Promise<RestoreReport> {
      return restoreBackup(current(), arg.text, arg.passphrase);
    },
    /** Makes the recovery kit (text and a QR code as SVG). Needs the current PIN or secret. */
    async recoveryKit(arg: { credential: Credential }): Promise<{ kit: string; qrSvg: string }> {
      const kit = await current().addRecoveryKit(arg.credential);
      return { kit, qrSvg: await recoveryKitQr(kit) };
    },
    changePin(arg: { current: UnlockCredential; newPin: string }): Promise<void> {
      return current().changePin(arg.current, arg.newPin);
    },
    /** Counts per record type, for the developer page and for checking an import or a restore. */
    counts(): Partial<Record<RecordType, number>> {
      const out: Partial<Record<RecordType, number>> = {};
      for (const record of current().allVersioned())
        if (record.deletedAt === null) out[record.type as RecordType] = (out[record.type as RecordType] ?? 0) + 1;
      return out;
    },
  };
  return { api, store: current };
}

export type StoreApi = ReturnType<typeof createStoreApi>['api'];
