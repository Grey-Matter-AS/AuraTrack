import { compareHlc, type HlcString } from '@auratrack/model';

// Merge rules (README 4.4). Every record keeps, for each field, its value and the HLC stamp of the edit that
// wrote it. Merging two copies of a record picks the winner per field, so edits to different fields on
// different devices both survive. The picks are a maximum over a total order, which makes merging
// commutative, associative and idempotent: devices converge whatever order or number of times they meet.

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface FieldEntry {
  readonly value: JsonValue;
  readonly stamp: HlcString;
}

export interface VersionedRecord {
  readonly id: string;
  readonly type: string;
  readonly fields: Readonly<Record<string, FieldEntry>>;
  /** Set when the record was deleted: the stamp of the deletion. A tombstone is final. */
  readonly deletedAt: HlcString | null;
}

/**
 * How a field is merged. Default is `newest`: the latest edit wins.
 * `rank`: the value listed first wins whatever the clocks say (dose status: taken, then assumed, then missed).
 * A value outside the list loses to any listed value.
 */
export type FieldRule = 'newest' | { readonly rank: readonly string[] };
export type MergeRules = Readonly<Record<string, FieldRule>>;

export class MergeMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MergeMismatchError';
  }
}

/** JSON with sorted keys, so equal values always give equal text. */
export function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] as JsonValue)}`).join(',')}}`;
}

const rankOf = (rule: FieldRule, value: JsonValue): number => {
  if (rule === 'newest') return 0;
  const index = typeof value === 'string' ? rule.rank.indexOf(value) : -1;
  return index === -1 ? -Infinity : -index;
};

/** Positive when `a` wins over `b`. Total order: rank, then stamp, then the value itself as a last tie-break. */
function compareEntries(rule: FieldRule, a: FieldEntry, b: FieldEntry): number {
  const rankA = rankOf(rule, a.value);
  const rankB = rankOf(rule, b.value);
  if (rankA !== rankB) return rankA > rankB ? 1 : -1;
  const byStamp = compareHlc(a.stamp, b.stamp);
  if (byStamp !== 0) return byStamp;
  const left = stableStringify(a.value);
  const right = stableStringify(b.value);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function mergeField(rule: FieldRule, a: FieldEntry, b: FieldEntry): FieldEntry {
  return compareEntries(rule, a, b) >= 0 ? a : b;
}

const laterStamp = (a: HlcString | null, b: HlcString | null): HlcString | null => {
  if (a === null) return b;
  if (b === null) return a;
  return compareHlc(a, b) >= 0 ? a : b;
};

export function mergeRecords(a: VersionedRecord, b: VersionedRecord, rules: MergeRules = {}): VersionedRecord {
  if (a.id !== b.id) throw new MergeMismatchError(`Cannot merge different records: ${a.id} and ${b.id}`);
  if (a.type !== b.type) throw new MergeMismatchError(`Record ${a.id} has two types: ${a.type} and ${b.type}`);
  const fields: Record<string, FieldEntry> = {};
  for (const name of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
    const left = a.fields[name];
    const right = b.fields[name];
    const rule = rules[name] ?? 'newest';
    fields[name] = left && right ? mergeField(rule, left, right) : (left ?? (right as FieldEntry));
  }
  return { id: a.id, type: a.type, fields, deletedAt: laterStamp(a.deletedAt, b.deletedAt) };
}

export const isDeleted = (record: VersionedRecord): boolean => record.deletedAt !== null;

/** The plain values of a record, or null once it is deleted. */
export function currentValues(record: VersionedRecord): Record<string, JsonValue> | null {
  if (isDeleted(record)) return null;
  return Object.fromEntries(Object.entries(record.fields).map(([name, entry]) => [name, entry.value]));
}

export interface AppendOnlyMerge<T> {
  readonly merged: ReadonlyMap<string, T>;
  /** Ids that exist on both sides with different content. Neither copy is dropped silently: it is reported. */
  readonly conflicts: readonly string[];
}

/**
 * Records that are only ever added (medication changes, the audit trail): the merge is a union by id.
 * Two different records under the same id should never happen; if they do, the choice is deterministic
 * (the smaller serialisation wins, the same on every device) and the id is reported for review.
 */
export function mergeAppendOnly<T extends { readonly id: string }>(
  a: ReadonlyMap<string, T>,
  b: ReadonlyMap<string, T>,
  serialise: (record: T) => string = (record) => stableStringify(record as unknown as JsonValue),
): AppendOnlyMerge<T> {
  const merged = new Map(a);
  const conflicts: string[] = [];
  for (const [id, incoming] of b) {
    const existing = merged.get(id);
    if (existing === undefined) {
      merged.set(id, incoming);
      continue;
    }
    const left = serialise(existing);
    const right = serialise(incoming);
    if (left === right) continue;
    conflicts.push(id);
    if (right < left) merged.set(id, incoming);
  }
  return { merged, conflicts: conflicts.sort() };
}
