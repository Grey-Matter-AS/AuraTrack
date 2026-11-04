import { fromBase64Url, fromUtf8 } from '../bytes';
import { DecryptError, MAX_PBKDF2_ITERATIONS } from '../crypto';

// Reads 6.1 backup files: plain or encrypted, one patient or all patients. Nothing here changes a record; it only finds
// the tables. (6.1's own schema names are used for detection; v7 backups have different ones.)

export type Row = Record<string, unknown>;
export const LEGACY_TABLES = [
  'events',
  'medications',
  'medicationLogs',
  'medicationChanges',
  'eegSessions',
  'eegActivities',
  'wellbeingEntries',
  'tombstones',
] as const;
export type LegacyTable = (typeof LEGACY_TABLES)[number];

export interface LegacyPatient {
  /** The 6.1 profile id (all-patients backups); null for a single-patient file. */
  profileId: string | null;
  name: string;
  tables: Record<LegacyTable, Row[]>;
  settings: { key: string; value: unknown }[];
}

export interface LegacyFile {
  kind: 'single' | 'household';
  encrypted: boolean;
  patients: LegacyPatient[];
}

export class Legacy6xFormatError extends Error {
  constructor(message = 'This is not an AuraTrack 6 backup file') {
    super(message);
    this.name = 'Legacy6xFormatError';
  }
}
export class PassphraseNeededError extends Error {
  constructor() {
    super('This backup is encrypted: a passphrase is needed');
    this.name = 'PassphraseNeededError';
  }
}

const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isObject) : []);

async function decrypt6x(file: Row, passphrase: string): Promise<unknown> {
  const kdf = file.kdf as Row | undefined;
  const cipher = file.cipher as Row | undefined;
  try {
    const iterations = Number(kdf?.iterations);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS)
      throw new Error('strength');
    const subtle = globalThis.crypto.subtle;
    const base = await subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase.normalize('NFKC')),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(String(kdf?.salt ?? '')), iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(String(cipher?.iv ?? '')) },
      key,
      fromBase64Url(String(file.ciphertext ?? '')),
    );
    return JSON.parse(fromUtf8(new Uint8Array(plain)));
  } catch {
    throw new DecryptError();
  }
}

function patientFrom(parsed: unknown, profileId: string | null, fallbackName: string): LegacyPatient {
  // An old plain list of seizures, a canonical backup ({schema, data}), or an object with tables
  const data: Row = Array.isArray(parsed)
    ? { events: parsed }
    : isObject(parsed) && isObject(parsed.data) && parsed.schema === 'auratrack.backup'
      ? parsed.data
      : isObject(parsed)
        ? parsed
        : {};
  const tables = Object.fromEntries(LEGACY_TABLES.map((t) => [t, rows(data[t])])) as Record<LegacyTable, Row[]>;
  const settings = rows(data.settings)
    .filter((r) => typeof r.key === 'string')
    .map((r) => ({ key: r.key as string, value: r.value }));
  const named = settings.find((s) => s.key === 'personName')?.value;
  return { profileId, name: typeof named === 'string' && named.trim() ? named.trim() : fallbackName, tables, settings };
}

const looksLikeBackup = (v: unknown): boolean =>
  Array.isArray(v) ||
  (isObject(v) &&
    (v.schema === 'auratrack.backup' || LEGACY_TABLES.some((t) => Array.isArray(v[t])) || Array.isArray(v.settings)));

export async function read6xFile(text: string, passphrase?: string): Promise<LegacyFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Legacy6xFormatError();
  }
  let encrypted = false;
  if (isObject(parsed) && parsed.schema === 'auratrack.encrypted-backup') {
    if (passphrase === undefined || passphrase === '') throw new PassphraseNeededError();
    parsed = await decrypt6x(parsed, passphrase);
    encrypted = true;
  }
  if (isObject(parsed) && parsed.schema === 'auratrack.household-backup' && isObject(parsed.patients)) {
    const profiles = rows(parsed.profiles);
    const patients = Object.entries(parsed.patients).map(([id, part]) => {
      const profile = profiles.find((p) => p.id === id);
      return patientFrom(part, id, typeof profile?.name === 'string' ? profile.name : '');
    });
    return { kind: 'household', encrypted, patients };
  }
  if (!looksLikeBackup(parsed)) throw new Legacy6xFormatError();
  return { kind: 'single', encrypted, patients: [patientFrom(parsed, null, '')] };
}
