import type { DoseLog, InterictalEvent, MedicationChange, Seizure } from '../schemas';
import { addLocalDays, localDateKey, startOfLocalDay } from './dates';
import { isLongRecord, seizureLengthSeconds, type EmergencyPlan } from './emergency';
import { ilae2025Type } from './ilae2025';

// What History shows: the filters, the pages, the frequency chart and the timeline over days and weeks. All pure, so the
// same numbers feed the screen and (in M5) the reports.

export interface HistoryFilters {
  /** A kind key (see seizureKindKey), 'none' for seizures not classified, or null for every kind. */
  type: string | 'none' | null;
  /** First and last local day, 'YYYY-MM-DD', or '' for no limit. */
  from: string;
  to: string;
  needsDetails: boolean;
}
export const NO_FILTERS: HistoryFilters = { type: null, from: '', to: '', needsDetails: false };

type Kinded = Pick<Seizure, 'typeCode' | 'ilae2025' | 'profile'>;
type Filterable = Kinded & Pick<Seizure, 'status' | 'phases'>;

/**
 * What kind of seizure it is, as one key for filters and colours (D-17): `profile:<id>` for a seizure saved with a profile;
 * `ilae2025:<type>` for one classified by ILAE 2025 alone; the plain-language type code for one recorded before 7.2
 * (so a filter kept from then still works); null when it is not classified.
 */
export function seizureKindKey(s: Kinded): string | null {
  if (s.profile) return `profile:${s.profile.id}`;
  const type = s.ilae2025 ? ilae2025Type(s.ilae2025) : null;
  if (type) return `ilae2025:${type}`;
  return s.typeCode;
}

/** A seizure waits for details when its timing is saved but nothing else, or it is not classified. */
export const needsDetails = (s: Kinded & Pick<Seizure, 'status'>): boolean =>
  s.status === 'recorded' || seizureKindKey(s) === null;

export const filtersActive = (f: HistoryFilters): boolean =>
  f.type !== null || f.from !== '' || f.to !== '' || f.needsDetails;

/** The seizures that pass the filters, in the order given. The days are the local days the seizure began on. */
export function filterSeizures<T extends Filterable>(list: readonly T[], f: HistoryFilters): T[] {
  return list.filter((s) => {
    const kind = seizureKindKey(s);
    if (f.type === 'none' ? kind !== null : f.type !== null && kind !== f.type) return false;
    if (f.needsDetails && !needsDetails(s)) return false;
    const day = localDateKey(s.phases.start.at);
    if (f.from !== '' && day < f.from) return false;
    if (f.to !== '' && day > f.to) return false;
    return true;
  });
}

export interface Page<T> {
  items: T[];
  /** 1-based, kept within the pages that exist. */
  page: number;
  pages: number;
}

export function paginate<T>(list: readonly T[], page: number, size: number): Page<T> {
  const per = Math.max(1, Math.floor(size));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const at = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { items: list.slice((at - 1) * per, at * per), page: at, pages };
}

export type BucketSize = 'day' | 'week' | 'month';

export interface FrequencyBucket {
  /** The first local day of the bucket, 'YYYY-MM-DD'. */
  day: string;
  start: number;
  count: number;
  /** Seizures in the bucket at or over the emergency alert time. */
  long: number;
}

/** The first day of the week (Monday) or month that holds this day. */
function bucketStart(dayStart: number, size: BucketSize): number {
  if (size === 'day') return dayStart;
  const d = new Date(dayStart);
  if (size === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const back = (d.getDay() + 6) % 7; // Monday = 0
  return startOfLocalDay(addLocalDays(d, -back));
}

const nextBucket = (start: number, size: BucketSize): number => {
  const d = new Date(start);
  return size === 'day'
    ? startOfLocalDay(addLocalDays(d, 1))
    : size === 'week'
      ? startOfLocalDay(addLocalDays(d, 7))
      : new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
};

/**
 * Seizures per day, week or month from `from` to `to` (instants), empty ones included so the chart has no holes. A week or
 * month that the range cuts into counts all its seizures: the bars are whole weeks and months.
 */
export function frequencyBuckets(
  seizures: readonly Pick<Seizure, 'phases'>[],
  from: number,
  to: number,
  size: BucketSize,
  plan: EmergencyPlan,
): FrequencyBucket[] {
  const buckets: FrequencyBucket[] = [];
  for (let at = bucketStart(startOfLocalDay(from), size); at <= to; at = nextBucket(at, size))
    buckets.push({ day: localDateKey(at), start: at, count: 0, long: 0 });
  for (const s of seizures) {
    const key = bucketStart(startOfLocalDay(s.phases.start.at), size);
    const bucket = buckets.find((b) => b.start === key);
    if (!bucket) continue;
    bucket.count += 1;
    if (isLongRecord(s, plan)) bucket.long += 1;
  }
  return buckets;
}

/** One thing on the timeline. */
export type TimelineItem =
  | { kind: 'seizure'; id: string; at: number; seconds: number | null; kindKey: string | null; long: boolean }
  | { kind: 'between'; id: string; at: number; code: string }
  | { kind: 'medication'; id: string; at: number; medicationId: string; name: string; change: MedicationChange['type'] }
  | { kind: 'missed'; id: string; at: number; medicationId: string; name: string };

/** Everything from `from` to `to` (instants) in time order: seizures, between-seizures entries, medicine changes, missed doses. */
export function timelineItems(input: {
  seizures: readonly Seizure[];
  between: readonly InterictalEvent[];
  changes: readonly MedicationChange[];
  doses: readonly DoseLog[];
  medicationNames: ReadonlyMap<string, string>;
  from: number;
  to: number;
  plan: EmergencyPlan;
}): TimelineItem[] {
  const within = (at: number) => at >= input.from && at <= input.to;
  const items: TimelineItem[] = [];
  for (const s of input.seizures)
    if (within(s.phases.start.at))
      items.push({
        kind: 'seizure',
        id: s.id,
        at: s.phases.start.at,
        seconds: seizureLengthSeconds(s.phases),
        kindKey: seizureKindKey(s),
        long: isLongRecord(s, input.plan),
      });
  for (const b of input.between)
    if (within(b.occurredAt)) items.push({ kind: 'between', id: b.id, at: b.occurredAt, code: b.symptomCode });
  for (const c of input.changes)
    if (!c.isBaseline && within(c.effectiveAt))
      items.push({
        kind: 'medication',
        id: c.id,
        at: c.effectiveAt,
        medicationId: c.medicationId,
        name: c.medicationName,
        change: c.type,
      });
  for (const d of input.doses)
    if (d.status === 'missed' && within(d.takenAt))
      items.push({
        kind: 'missed',
        id: d.id,
        at: d.takenAt,
        medicationId: d.medicationId,
        name: input.medicationNames.get(d.medicationId) ?? '',
      });
  return items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
