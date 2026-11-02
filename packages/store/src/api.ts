import type { ChangeLogEntry, RecordType } from '@auratrack/model';
import { createBackup, restoreBackup, suggestedBackupName, type RestoreReport } from './backup';
import { compareImport, type ComparisonReport } from './import6x/compare';
import { import6x, type ImportReport } from './import6x/import';
import { AuraDb } from './db';
import { LockedRecorder, NO_LOCKED_SCREEN, type LockedScreen, type LockedStatus } from './dropbox';
import { RecordingService, type RecoveryReport } from './recording';
import { recoveryKitQr } from './recovery';
import type { RecordingEvent, RecordingSession } from '@auratrack/model';
import {
  Store,
  StoreError,
  type ApplyResult,
  type DropBoxReport,
  type Credential,
  type PasskeyRecord,
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
  /** The passkey to ask for at the PIN screen, if one is set up. */
  passkey: PasskeyRecord | null;
}

export type Values = Record<string, unknown>;

export function createStoreApi(config: StoreApiConfig) {
  let store: Store | null = null;
  const current = (): Store => {
    if (!store) throw new StoreError('The store is locked');
    return store;
  };

  let recording: RecordingService | null = null;
  let locked: LockedRecorder | null = null;
  const lockedRecorder = (): LockedRecorder => (locked ??= new LockedRecorder(new AuraDb(config.name)));
  const service = (): RecordingService => {
    if (!recording) throw new StoreError('The store is locked');
    return recording;
  };
  /** The PIN screen shows the patient, the card and the Start button from settings, so it follows them. */
  const touchesLockedScreen = (type: string) => type === 'setting' || type === 'patient' || type === 'medication';
  const refreshIfNeeded = async (type: string) => {
    if (touchesLockedScreen(type)) await store?.publishLockedScreen().catch(() => undefined);
  };
  const opened = (next: Store) => {
    store?.close();
    store = next;
    recording = new RecordingService(next, config.options?.now);
    locked?.reset();
    return next.info;
  };

  const api = {
    async status(): Promise<StoreStatus> {
      const exists = await Store.exists(config.name);
      return {
        exists,
        unlocked: store !== null,
        info: store?.info ?? null,
        passkey: exists ? await Store.passkeyOf(config.name) : null,
      };
    },
    async create(arg: { credential: Credential }): Promise<StoreInfo> {
      return opened(await Store.create(config.name, arg.credential, config.options));
    },
    async unlock(arg: { credential: UnlockCredential }): Promise<StoreInfo> {
      return opened(await Store.unlock(config.name, arg.credential, config.options));
    },
    lock(): void {
      store?.close();
      store = null;
      recording = null;
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
      const created = (await current().create(arg.type, arg.values as never)) as Values;
      await refreshIfNeeded(arg.type);
      return created;
    },
    async update(arg: { type: StoredType; id: string; patch: Values }): Promise<Values> {
      const updated = (await current().update(arg.type, arg.id, arg.patch as never)) as Values;
      await refreshIfNeeded(arg.type);
      return updated;
    },
    async remove(arg: { type: StoredType; id: string }): Promise<void> {
      await current().delete(arg.type, arg.id);
      await refreshIfNeeded(arg.type);
    },
    applyChanges(arg: { entries: ChangeLogEntry[] }): Promise<ApplyResult> {
      return current().applyChanges(arg.entries);
    },
    changesSince(arg: { stamp: string | null }): Promise<ChangeLogEntry[]> {
      return current().changesSince(arg.stamp);
    },
    /** Applies one event of a recording (Start, End aura, a note, ...) and saves it. Safe to send again. */
    async recordingEvent(arg: { seizureId: string; event: RecordingEvent }): Promise<RecordingSession> {
      return service().apply(arg.seizureId, arg.event);
    },
    /** Finds recordings left in progress by a closed or crashed app. */
    async recordingRecover(): Promise<RecoveryReport> {
      return service().recover();
    },
    /** What the PIN screen may do. Works while the store is locked: it reads only what was kept in the clear. */
    async lockedStatus(): Promise<LockedStatus> {
      if (!(await Store.exists(config.name)))
        return { available: false, screen: NO_LOCKED_SCREEN, session: null, waiting: 0, recentStarts: [] };
      return lockedRecorder().status();
    },
    /** Posts an event of a recording started from the PIN screen. Works while the store is locked. */
    lockedPost(arg: { event: RecordingEvent }): Promise<RecordingSession | null> {
      return lockedRecorder().post(arg.event);
    },
    /** What emptying the drop box did at the last unlock. */
    dropBoxReport(): DropBoxReport {
      return current().lastDropBox;
    },
    /** Rewrites what the PIN screen may show, from the settings and the patient. */
    refreshLockedScreen(arg: { patientId?: string }): Promise<LockedScreen> {
      return current().publishLockedScreen(arg.patientId);
    },
    /** The edit history of one record (F-311): when it changed and which fields, oldest first. */
    async history(arg: { type: StoredType; id: string }): Promise<{ at: number; kind: string; fields: string[] }[]> {
      const log = await current().changesSince(null);
      return log
        .filter((entry) => entry.recordType === arg.type && entry.recordId === arg.id)
        .map((entry) => ({ at: entry.at, kind: entry.kind, fields: Object.keys(entry.fields ?? {}) }));
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
    /** Adds Face ID / fingerprint unlocking. The page does the WebAuthn part and sends the secret it got. */
    addPasskey(arg: { credential: Credential; secret: Uint8Array; handle: PasskeyRecord }): Promise<void> {
      return current().addPasskey(arg.credential, arg.secret, arg.handle);
    },
    removePasskey(): Promise<void> {
      return current().removePasskey();
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
