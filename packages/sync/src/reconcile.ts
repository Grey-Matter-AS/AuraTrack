import { sha256Hex } from './seal';

// Finding what two devices lack, without sending the whole log: entries are grouped by the day of their stamp, each day
// gets a digest of its entry ids, and only the days whose digests differ are compared id by id. The ids are what
// matter, not their order or when they arrived, so a device that got an old entry late is still found out.

export interface IndexItem {
  readonly id: string;
  readonly stamp: string;
}

const DAY_MS = 86_400_000;
/** The day of a stamp (days since the epoch, as text). A stamp that is not well formed goes to day "bad". */
export function dayOf(stamp: string): string {
  const wall = Number(stamp.slice(0, 15));
  return Number.isFinite(wall) && stamp.length > 16 ? String(Math.floor(wall / DAY_MS)) : 'bad';
}

export function groupByDay(items: readonly IndexItem[]): Map<string, string[]> {
  const days = new Map<string, string[]>();
  for (const item of items) {
    const day = dayOf(item.stamp);
    const list = days.get(day);
    if (list) list.push(item.id);
    else days.set(day, [item.id]);
  }
  for (const ids of days.values()) ids.sort();
  return days;
}

/** `count:digest` for each day. */
export async function digests(items: readonly IndexItem[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [day, ids] of groupByDay(items))
    out[day] = `${ids.length}:${(await sha256Hex(ids.join(','))).slice(0, 24)}`;
  return out;
}

/** The days where the two summaries are not the same (including a day only one side has). */
export function differingDays(mine: Record<string, string>, theirs: Record<string, string>): string[] {
  const days = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  return [...days].filter((d) => mine[d] !== theirs[d]).sort();
}

export function idsOnDays(items: readonly IndexItem[], days: readonly string[]): Record<string, string[]> {
  const grouped = groupByDay(items);
  const out: Record<string, string[]> = {};
  for (const day of days) out[day] = grouped.get(day) ?? [];
  return out;
}

/** Ids I have that the other side listed no copy of, on the days it listed. */
export function missingOnTheirSide(mine: Record<string, string[]>, theirs: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [day, ids] of Object.entries(mine)) {
    const has = new Set(theirs[day] ?? []);
    for (const id of ids) if (!has.has(id)) out.push(id);
  }
  return out;
}
