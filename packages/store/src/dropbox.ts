import {
  EMERGENCY_PLAN_DEFAULTS,
  RecordingEventSchema,
  LockedMarkerSchema,
  markerOf,
  newId,
  reduceRecording,
  sessionFromMarker,
  type RecordingEvent,
  type RecordingSession,
} from '@auratrack/model';
import { z } from 'zod';
import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, type Bytes } from './bytes';
import { open, seal, type Sealed } from './crypto';
import type { AuraDb, DropBoxRow } from './db';

// The drop box (M3, slice 5; docs/decisions/locked-start.md). A locked app has no key to the records, but it can still
// post: every event is sealed with a PUBLIC key that is kept in the clear. Only the unlocked store holds the private key
// (sealed under the device key), so only it can read what was posted. Think of a post-box: anyone can post a letter,
// only the key holder can open the box.
//
// Each entry uses a fresh one-time key (ECDH P-256, then HKDF-SHA256, then AES-256-GCM): the standard "ECIES" pattern,
// built from WebCrypto alone. The recording id, the time, the notes and the patient are all inside the ciphertext.

const INFO = 'auratrack dropbox v1';
const PUBLIC_KEY = 'dropBoxPublicKey';
const PRIVATE_KEY = 'dropBoxPrivateKey';
const MARKER = 'lockedMarker';
const SCREEN = 'lockedScreen';
/** Most entries one drop box holds: a long locked recording is tens of entries, so this only stops a runaway writer. */
export const MAX_DROPBOX_ENTRIES = 5000;

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser does not support encryption.');
  return s;
};

export class DropBoxUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'DropBoxUnavailableError';
  }
}

/** What an entry holds once opened: which recording, and the event. */
const PostedSchema = z.strictObject({ recording: z.uuid(), event: RecordingEventSchema });
export type Posted = z.infer<typeof PostedSchema>;

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

async function entryKey(shared: Bytes, salt: Bytes): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(INFO) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const aadOf = (eid: string): Bytes => utf8(`dropbox:${eid}`);

// ---- keys

/** A new key pair: the public half (raw, base64url) to keep in the clear, the private half sealed under the device key. */
export async function newDropBoxKeys(deviceKey: CryptoKey): Promise<{ publicKey: string; sealedPrivate: Sealed }> {
  const pair = (await subtle().generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const publicKey = toBase64Url(new Uint8Array(await subtle().exportKey('raw', pair.publicKey)));
  const pkcs8 = toBase64Url(new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey)));
  return { publicKey, sealedPrivate: await seal(deviceKey, pkcs8, PRIVATE_KEY) };
}

/** Makes the key pair if the store has none yet (new stores, and older ones at their first unlock after 7.0.3). */
export async function ensureDropBoxKeys(db: AuraDb, deviceKey: CryptoKey): Promise<boolean> {
  const have = (await db.meta.get(PUBLIC_KEY)) && (await db.meta.get(PRIVATE_KEY));
  if (have) return false;
  const { publicKey, sealedPrivate } = await newDropBoxKeys(deviceKey);
  // Both halves in one go, so a store never has a public key without the private one that opens what it seals
  await db.meta.bulkPut([
    { key: PRIVATE_KEY, value: sealedPrivate },
    { key: PUBLIC_KEY, value: publicKey },
  ]);
  return true;
}

export async function loadDropBoxPrivateKey(db: AuraDb, deviceKey: CryptoKey): Promise<CryptoKey | null> {
  const sealed = (await db.meta.get(PRIVATE_KEY))?.value as Sealed | undefined;
  if (!sealed) return null;
  const pkcs8 = fromBase64Url(await open(deviceKey, sealed, PRIVATE_KEY));
  return subtle().importKey('pkcs8', pkcs8, ECDH, false, ['deriveBits']);
}

// ---- sealing and opening one entry

/** Seals a posted event for the key holder. Needs only the public key. */
export async function sealPosted(publicKey: string, posted: Posted): Promise<DropBoxRow> {
  const eid = newId();
  const ephemeral = (await subtle().generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const epk = new Uint8Array(await subtle().exportKey('raw', ephemeral.publicKey));
  const recipient = await subtle().importKey('raw', fromBase64Url(publicKey), ECDH, false, []);
  const shared = new Uint8Array(
    await subtle().deriveBits({ name: 'ECDH', public: recipient }, ephemeral.privateKey, 256),
  );
  const iv = randomBytes(12);
  const key = await entryKey(shared, epk);
  shared.fill(0);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: aadOf(eid) },
    key,
    utf8(JSON.stringify(posted)),
  );
  return { eid, epk: toBase64Url(epk), iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(ct)) };
}

export class UnreadableEntryError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'UnreadableEntryError';
  }
}

/** Opens an entry with the private key and checks it. Throws UnreadableEntryError for anything wrong, so it can be kept apart. */
export async function openPosted(privateKey: CryptoKey, row: DropBoxRow): Promise<Posted> {
  let text: string;
  try {
    const epk = fromBase64Url(row.epk);
    const sender = await subtle().importKey('raw', epk, ECDH, false, []);
    const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: sender }, privateKey, 256));
    const key = await entryKey(shared, epk);
    shared.fill(0);
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(row.iv), additionalData: aadOf(row.eid) },
      key,
      fromBase64Url(row.ct),
    );
    text = fromUtf8(new Uint8Array(plain));
  } catch {
    throw new UnreadableEntryError('could not be decrypted: damaged, or not posted with this key');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UnreadableEntryError('is not valid data');
  }
  const parsed = PostedSchema.safeParse(json);
  if (!parsed.success) throw new UnreadableEntryError('is not a recording event this version understands');
  return parsed.data;
}

// ---- what the PIN screen may show

/** The rescue medication and the contact on the alert card. Written in the clear, by choice (decision 5). */
export interface AlertCard {
  contact: string | null;
  rescue: { name: string; dose: number | null; unit: string }[];
}

/** What the locked app is allowed to know. Written while unlocked, wiped or narrowed when the settings say so. */
export interface LockedScreen {
  /** The PIN screen has a Start button. */
  start: boolean;
  patientId: string | null;
  /** Only when the user chose to show it; otherwise null and the screen says "Recording". */
  patientName: string | null;
  card: AlertCard | null;
  /** The user's own emergency plan, so the locked alert fires at the same minute as the unlocked one. */
  plan: { emergencyAlertMinutes: number; clusterMinCount: number; clusterWindowMinutes: number };
}

export const NO_LOCKED_SCREEN: LockedScreen = {
  start: false,
  patientId: null,
  patientName: null,
  card: null,
  plan: { ...EMERGENCY_PLAN_DEFAULTS },
};

export async function readLockedScreen(db: AuraDb): Promise<LockedScreen> {
  const stored = (await db.meta.get(SCREEN))?.value as Partial<LockedScreen> | undefined;
  return { ...NO_LOCKED_SCREEN, ...stored };
}

export const writeLockedScreen = (db: AuraDb, screen: LockedScreen): Promise<unknown> =>
  db.meta.put({ key: SCREEN, value: screen });

// ---- the locked recorder: runs with no key to the records

export interface LockedStatus {
  /** Locked Start can work now: the setting is on, a patient is known and the store has its key pair. */
  available: boolean;
  screen: LockedScreen;
  /** The recording being made while locked (its marks only, after a reload). */
  session: RecordingSession | null;
  /** Entries waiting in the drop box. */
  waiting: number;
  /** Start instants of recent seizures (read from the time index, no key needed), for the cluster warning at Start. */
  recentStarts: number[];
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * Posts recording events with the public key only. It keeps the clear marker up to date (the marks of the recording,
 * so a locked page that reloads keeps its clock). It never reads a record and has nothing that could.
 */
export class LockedRecorder {
  private session: RecordingSession | null = null;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: AuraDb,
    private readonly now: () => number = Date.now,
  ) {}

  async status(): Promise<LockedStatus> {
    const screen = await readLockedScreen(this.db);
    const hasKey = (await this.db.meta.get(PUBLIC_KEY)) !== undefined;
    return {
      available: hasKey && screen.start && screen.patientId !== null,
      screen,
      session: await this.current(),
      waiting: await this.db.dropbox.count(),
      recentStarts: await this.recentStarts(),
    };
  }

  /** Seizure start times from the clear time index; deleted records are indexed as 0 and so are left out. */
  private async recentStarts(): Promise<number[]> {
    const since = this.now() - WEEK_MS;
    const rows = await this.db.records.where('type').equals('seizure').toArray();
    return rows.map((row) => row.at).filter((at) => at > since);
  }

  /** The recording in progress, from memory or, after a reload, from the marker. */
  private async current(): Promise<RecordingSession | null> {
    if (this.loaded) return this.session;
    this.loaded = true;
    const marker = LockedMarkerSchema.safeParse((await this.db.meta.get(MARKER))?.value);
    const screen = await readLockedScreen(this.db);
    if (marker.success && marker.data.status === 'running' && screen.patientId)
      this.session = sessionFromMarker(
        marker.data,
        screen.patientId,
        'carer',
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
    return this.session;
  }

  /** Forget what was held in memory (the store was unlocked and the drop box emptied). */
  reset(): void {
    this.session = null;
    this.loaded = true;
  }

  /**
   * Posts one event. A `start` begins a new recording for the patient on the PIN screen; any other event belongs to the
   * recording in progress. Returns the recording as it is now. Events that change nothing are not posted again.
   */
  post(event: RecordingEvent): Promise<RecordingSession | null> {
    const run = this.queue.then(() => this.write(event));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(event: RecordingEvent): Promise<RecordingSession | null> {
    const status = await this.status();
    if (!status.available) throw new DropBoxUnavailableError('Starting without the PIN is not available');
    const publicKey = (await this.db.meta.get(PUBLIC_KEY))?.value as string;
    if (event.kind === 'start' && event.patientId !== status.screen.patientId)
      throw new DropBoxUnavailableError('A locked recording is for the patient on the PIN screen');
    const current = status.session;
    if (event.kind !== 'start' && !current) throw new DropBoxUnavailableError('No recording is running');
    const next = reduceRecording(event.kind === 'start' ? null : current, event);
    if (!next) throw new DropBoxUnavailableError('No recording is running');
    if (event.kind !== 'start' && next === current) return current; // nothing changed: nothing to post
    if (status.waiting >= MAX_DROPBOX_ENTRIES)
      throw new DropBoxUnavailableError('The drop box is full: unlock to empty it');
    const row = await sealPosted(publicKey, PostedSchema.parse({ recording: next.seizureId, event }));
    // The entry and the marker land together: a reload never sees a marker that is ahead of what was posted
    await this.db.transaction('rw', this.db.dropbox, this.db.meta, async () => {
      await this.db.dropbox.add(row);
      await this.db.meta.put({ key: MARKER, value: markerOf(next) });
    });
    this.session = next;
    return next;
  }
}

export const clearMarker = (db: AuraDb): Promise<void> => db.meta.delete(MARKER);

export function groupByRecording(
  entries: { row: DropBoxRow; posted: Posted }[],
): Map<string, { rows: DropBoxRow[]; events: RecordingEvent[] }> {
  const groups = new Map<string, { rows: DropBoxRow[]; events: RecordingEvent[] }>();
  for (const { row, posted } of entries) {
    const group = groups.get(posted.recording) ?? { rows: [], events: [] };
    group.rows.push(row);
    group.events.push(posted.event);
    groups.set(posted.recording, group);
  }
  return groups;
}
