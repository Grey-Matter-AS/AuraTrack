import Dexie, { type EntityTable } from 'dexie';
import type { Sealed } from './crypto';

// The IndexedDB tables. `records` and `changeLog` hold only sealed bytes. `dropbox` holds entries a locked app posted
// with the public key (docs/decisions/locked-start.md); only the unlocked store can read them.

export interface RecordRow extends Sealed {
  type: string;
  id: string;
  patientId: string | null;
  at: number;
}
export interface LogRow extends Sealed {
  id: string;
  stamp: string;
  recordType: string;
}
export interface MetaRow {
  key: string;
  value: unknown;
}
/** A seizure video, sealed with the data key. It stays on this device: it is not a record, so it never syncs. */
export interface VideoRow {
  seizureId: string;
  iv: Uint8Array;
  data: Uint8Array;
  mime: string;
  size: number;
  savedAt: number;
}
/** One posted event: the one-time public key, the IV and the ciphertext. Nothing about the recording is readable. */
export interface DropBoxRow extends Sealed {
  seq?: number;
  /** Random id that ties the ciphertext to its row. */
  eid: string;
  /** The one-time public key (raw, base64url). */
  epk: string;
  /** Set when the entry could not be read or was not valid: kept, never deleted, listed to the user. */
  quarantined?: string;
}

/** A video filmed while locked: sealed with its own one-time key for the drop box's public key, like an entry. */
export interface LockedClipRow {
  /** The recording (the seizure id) it belongs to. */
  recording: string;
  epk: string;
  iv: Uint8Array;
  data: Uint8Array;
  mime: string;
  fileName: string;
  size: number;
  savedAt: number;
  /** Set when it could not be read or not joined to its seizure: kept, never deleted. */
  quarantined?: string;
}

export class AuraDb extends Dexie {
  meta!: EntityTable<MetaRow, 'key'>;
  records!: Dexie.Table<RecordRow, [string, string]>;
  changeLog!: EntityTable<LogRow, 'id'>;
  dropbox!: Dexie.Table<DropBoxRow, number>;
  videos!: Dexie.Table<VideoRow, string>;
  lockedClips!: Dexie.Table<LockedClipRow, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      records: '[type+id], type, patientId, at',
      changeLog: 'id, stamp, recordType',
    });
    // 7.0.3: the drop box for recordings started from the PIN screen. A new table only, so no existing row is touched.
    this.version(2).stores({ dropbox: '++seq' });
    // 7.0.4: seizure videos, sealed, one per seizure. A new table only, so no existing row is touched.
    this.version(3).stores({ videos: 'seizureId' });
    // 7.0.7: videos filmed while locked, waiting for the unlock. A new table only, so no existing row is touched.
    this.version(4).stores({ lockedClips: 'recording' });
  }
}
