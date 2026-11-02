import type { ChangeLogEntry } from '@auratrack/model';
import type { HouseholdState } from './membership';
import { openJson, newestKey, sealJson, SealError, type KeyEntry } from './seal';
import { HOUSEHOLD_SCOPE } from './session';

// The last resort: an update as a file (or a few QR codes), made on one device and opened on another, with no network.
// It holds the entries of the scopes both follow, each sealed with that scope's key, so a device opens only what it holds the
// key for. Applying it is the same as meeting: entries already there are skipped, and nothing is ever removed.

const MAGIC = 'AURA-UPDATE-1';

export interface UpdateScope {
  scope: string;
  entries: ChangeLogEntry[];
}

export async function buildUpdate(
  state: HouseholdState,
  deviceId: string,
  scopes: readonly UpdateScope[],
  now: number,
): Promise<string> {
  const parts: Record<string, string> = {};
  for (const { scope, entries } of scopes) {
    const keys = scope === HOUSEHOLD_SCOPE ? state.keyring.household : (state.keyring.patients[scope] ?? []);
    const key = newestKey(keys);
    if (!key) continue;
    parts[scope] = await sealJson(key, entries, `update:${scope}`);
  }
  // The header says whose it is, and which keys it needs, and nothing else
  return `${MAGIC}\n${JSON.stringify({ hid: state.membership.householdId, from: deviceId, at: now, parts })}`;
}

export class UpdateError extends Error {
  constructor(readonly reason: 'not_an_update' | 'other_household' | 'damaged') {
    super(reason);
    this.name = 'UpdateError';
  }
}

export interface OpenedUpdate {
  householdId: string;
  from: string;
  at: number;
  /** Entries per scope this device could open. */
  scopes: UpdateScope[];
  /** Scopes it could not open (no key here). */
  skipped: string[];
}

export async function openUpdate(text: string, state: HouseholdState): Promise<OpenedUpdate> {
  if (!text.startsWith(`${MAGIC}\n`)) throw new UpdateError('not_an_update');
  let head: { hid?: unknown; from?: unknown; at?: unknown; parts?: unknown };
  try {
    head = JSON.parse(text.slice(MAGIC.length + 1));
  } catch {
    throw new UpdateError('damaged');
  }
  if (head.hid !== state.membership.householdId) throw new UpdateError('other_household');
  if (
    typeof head.from !== 'string' ||
    typeof head.at !== 'number' ||
    typeof head.parts !== 'object' ||
    head.parts === null
  )
    throw new UpdateError('damaged');
  const scopes: UpdateScope[] = [];
  const skipped: string[] = [];
  for (const [scope, sealed] of Object.entries(head.parts as Record<string, unknown>)) {
    const keys: KeyEntry[] =
      scope === HOUSEHOLD_SCOPE ? [...state.keyring.household] : [...(state.keyring.patients[scope] ?? [])];
    if (keys.length === 0 || typeof sealed !== 'string') {
      skipped.push(scope);
      continue;
    }
    try {
      const entries = (await openJson(keys, sealed, `update:${scope}`)) as ChangeLogEntry[];
      if (!Array.isArray(entries)) throw new UpdateError('damaged');
      scopes.push({
        scope,
        entries: entries.filter(
          (e) =>
            e &&
            e.householdId === head.hid &&
            (scope === HOUSEHOLD_SCOPE ? e.patientId === null : e.patientId === scope),
        ),
      });
    } catch (error) {
      if (error instanceof SealError) skipped.push(scope);
      else throw error;
    }
  }
  return { householdId: head.hid, from: head.from, at: head.at, scopes, skipped };
}

/** An update as QR frames: `AU1/<n>/<of>/<text>`. */
export function toFrames(text: string, size = 700): string[] {
  const total = Math.max(1, Math.ceil(text.length / size));
  return Array.from({ length: total }, (_, i) => `AU1/${i + 1}/${total}/${text.slice(i * size, (i + 1) * size)}`);
}

export interface FrameCollector {
  add(frame: string): { have: number; of: number; complete: boolean } | null;
  text(): string | null;
}

export function collectFrames(): FrameCollector {
  const got = new Map<number, string>();
  let of = 0;
  return {
    add(frame) {
      const m = /^AU1\/(\d+)\/(\d+)\/([\s\S]*)$/.exec(frame);
      if (!m) return null;
      const n = Number(m[1]);
      const total = Number(m[2]);
      if (n < 1 || total < 1 || n > total || total > 400 || (of !== 0 && total !== of)) return null;
      of = total;
      got.set(n, m[3] as string);
      return { have: got.size, of, complete: got.size === of };
    },
    text() {
      if (of === 0 || got.size !== of) return null;
      return Array.from({ length: of }, (_, i) => got.get(i + 1) as string).join('');
    },
  };
}
