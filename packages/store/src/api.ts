import type { ChangeLogEntry, ChangePlan, RecordType } from '@auratrack/model';
import Dexie from 'dexie';
import {
  createBackup,
  readBackup,
  restoreBackup,
  suggestedBackupName,
  type BackupCounts,
  type RestoreReport,
} from './backup';
import { compareImport, type ComparisonReport } from './import6x/compare';
import { import6x, type ImportReport } from './import6x/import';
import { AuraDb } from './db';
import { LockedRecorder, NO_LOCKED_SCREEN, type LockedScreen, type LockedStatus } from './dropbox';
import { RecordingService, type RecoveryReport } from './recording';
import { qrMatrixOf, recoveryKitMatrix, recoveryKitQr } from './recovery';
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
      if (arg.type === 'seizure') await current().deleteVideo(arg.id); // a deleted seizure takes its video with it
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
    /**
     * Applies a planned change to a medicine: the medicine is written, then the record in its history. If the history record
     * cannot be written, the medicine is put back as it was, so the two never disagree (README 4.4).
     */
    async changeMedication(arg: { plan: ChangePlan }): Promise<Values> {
      const s = current();
      const { medication, change } = arg.plan;
      let id: string;
      let undo: () => Promise<unknown>;
      if ('create' in medication) {
        const created = (await s.create('medication', medication.create as never)) as unknown as { id: string };
        id = created.id;
        undo = () => s.delete('medication', id);
      } else {
        id = medication.id;
        const previous = s.get('medication', id) as unknown as Values | null;
        await s.update('medication', id, medication.patch as never);
        undo = async () => {
          if (!previous) return;
          const back: Values = {};
          for (const key of Object.keys(medication.patch)) back[key] = previous[key];
          await s.update('medication', id, back as never);
        };
      }
      try {
        const written = (await s.create('medicationChange', { ...change, medicationId: id } as never)) as Values;
        await refreshIfNeeded('medication');
        return { ...written, medicationId: id };
      } catch (e) {
        await undo().catch(() => undefined);
        throw e;
      }
    },
    /**
     * Keeps a seizure's video, sealed, on this device, and notes its file name on the seizure. Replaces an earlier video.
     * The video is not a record: it is not synced and not part of a backup (it can be large and is private to this phone).
     */
    async videoPut(arg: { seizureId: string; mime: string; bytes: Uint8Array; fileName: string }): Promise<void> {
      const s = current();
      if (!s.get('seizure', arg.seizureId)) throw new StoreError('There is no such seizure');
      await s.putVideo(arg.seizureId, arg.mime, arg.bytes);
      await s.update('seizure', arg.seizureId, { video: { fileName: arg.fileName.slice(0, 255) } } as never);
    },
    async videoGet(arg: { seizureId: string }): Promise<{ mime: string; bytes: Uint8Array } | null> {
      return current().getVideo(arg.seizureId);
    },
    /** Removes the video from this device and the file name from the seizure. The seizure stays. */
    async videoDelete(arg: { seizureId: string }): Promise<void> {
      const s = current();
      await s.deleteVideo(arg.seizureId);
      if (s.get('seizure', arg.seizureId)) await s.update('seizure', arg.seizureId, { video: null } as never);
    },
    videoList(): Promise<{ seizureId: string; mime: string; size: number }[]> {
      return current().videos();
    },
    /** The ids of the records of this type that were changed after they were first written (the audit marker). */
    async editedIds(arg: { type: StoredType }): Promise<string[]> {
      const log = await current().changesSince(null);
      return [...new Set(log.filter((e) => e.recordType === arg.type && e.kind === 'update').map((e) => e.recordId))];
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
    async backup(arg: { passphrase: string; patientId?: string }): Promise<{ fileName: string; text: string }> {
      const file = await createBackup(current(), arg.passphrase, arg.patientId ? { patientId: arg.patientId } : {});
      return { fileName: suggestedBackupName(), text: JSON.stringify(file) };
    },
    /** Opens a backup file and says what is in it, without changing anything. Wrong passphrase and foreign files are errors. */
    async checkBackup(arg: { text: string; passphrase: string }): Promise<{
      counts: BackupCounts;
      countsMatch: boolean;
      invalid: number;
      badChanges: number;
      exportedAt: number;
      patients: string[];
    }> {
      const { payload, check } = await readBackup(arg.text, arg.passphrase);
      const people = payload.records
        .filter((r) => r.type === 'patient' && r.deletedAt === null)
        .map((r) => String(r.fields['name']?.value ?? ''));
      return {
        counts: check.actual,
        countsMatch: check.countsMatch,
        invalid: check.invalid.length,
        badChanges: check.badChanges,
        exportedAt: payload.exportedAt,
        patients: people,
      };
    },
    restore(arg: { text: string; passphrase: string }): Promise<RestoreReport> {
      return restoreBackup(current(), arg.text, arg.passphrase);
    },
    /** Makes the recovery kit (text and a QR code as SVG). Needs the current PIN or secret. */
    async recoveryKit(arg: {
      credential: Credential;
    }): Promise<{ kit: string; qrSvg: string; qr: { size: number; dark: boolean[] } }> {
      const kit = await current().addRecoveryKit(arg.credential);
      return { kit, qrSvg: await recoveryKitQr(kit), qr: recoveryKitMatrix(kit) };
    },
    /** Adds Face ID / fingerprint unlocking. The page does the WebAuthn part and sends the secret it got. */
    addPasskey(arg: { credential: Credential; secret: Uint8Array; handle: PasskeyRecord }): Promise<void> {
      return current().addPasskey(arg.credential, arg.secret, arg.handle);
    },
    removePasskey(): Promise<void> {
      return current().removePasskey();
    },
    /**
     * Erases this device's data and keys: the whole database goes in one step, so nothing is left half-deleted (F-805).
     * Needs the PIN (or passkey secret) again, so a phone left open cannot be wiped by a stranger. A backup is the only way back.
     */
    async erase(arg: { credential: UnlockCredential }): Promise<void> {
      (await Store.unlock(config.name, arg.credential, config.options)).close();
      store?.close();
      store = null;
      recording = null;
      locked?.reset();
      locked = null;
      await Dexie.delete(config.name);
    },
    changePin(arg: { current: UnlockCredential; newPin: string }): Promise<void> {
      return current().changePin(arg.current, arg.newPin);
    },
    qrMatrix(arg: { text: string; level?: 'L' | 'M' }): { size: number; dark: boolean[] } {
      return qrMatrixOf(arg.text, arg.level);
    },
    // Household sync (docs/plan/M6-plan.md). What a meeting between two devices asks of the store.
    syncIndex(arg: { scope: string }): Promise<{ id: string; stamp: string }[]> {
      return current().syncIndex(arg.scope);
    },
    syncEntries(arg: { ids: string[] }): Promise<ChangeLogEntry[]> {
      return current().syncEntries(arg.ids);
    },
    async applySynced(arg: {
      entries: ChangeLogEntry[];
    }): Promise<{ applied: number; duplicates: number; rejected: number }> {
      const result = await current().applySynced(arg.entries);
      return { applied: result.applied, duplicates: result.duplicates, rejected: result.rejected.length };
    },
    householdState(): Promise<unknown> {
      return current().getSecret('household');
    },
    async saveHouseholdState(arg: { state: unknown }): Promise<void> {
      await current().putSecret('household', arg.state);
    },
    /** What this device keeps about the household's hub: its own token (never shared), and removals not yet told to the hub. */
    hubLocal(): Promise<unknown> {
      return current().getSecret('hubLocal');
    },
    async saveHubLocal(arg: { value: unknown }): Promise<void> {
      await current().putSecret('hubLocal', arg.value);
    },
    /** This device's own key pair for receiving keys sealed to it (private half stays here), and what it has already sent. */
    deviceKeys(): Promise<unknown> {
      return current().getSecret('deviceKeys');
    },
    async saveDeviceKeys(arg: { value: unknown }): Promise<void> {
      await current().putSecret('deviceKeys', arg.value);
    },
    storeIsEmpty(): boolean {
      return current().isEmpty();
    },
    async adoptHousehold(arg: { householdId: string }): Promise<StoreInfo> {
      await current().adoptHousehold(arg.householdId);
      return current().info;
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
