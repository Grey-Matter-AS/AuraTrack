// Local calendar dates. Never use toISOString() for a calendar day: it gives the UTC date, which is yesterday or
// tomorrow near midnight. Never use new Date('YYYY-MM-DD'): it is read as UTC midnight.
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (value: number | Date): Date => (value instanceof Date ? new Date(value.getTime()) : new Date(value));

/** 'YYYY-MM-DD' of the local calendar day. */
export function localDateKey(value: number | Date = Date.now()): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM' of the local calendar month. */
export const localMonthKey = (value: number | Date = Date.now()): string => localDateKey(value).slice(0, 7);

/** 'YYYY-MM-DD' to a Date at local midnight. Malformed input gives an invalid Date. */
export function parseLocalDate(key: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
}

export function startOfLocalDay(value: number | Date = Date.now()): number {
  const d = toDate(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(value: number | Date = Date.now()): number {
  const d = toDate(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Local date offset by whole calendar days (safe across daylight-saving changes). */
export function addLocalDays(value: number | Date, days: number): Date {
  const d = toDate(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Start of the next local day (not "+24 h", which is wrong on the days the clocks change). */
export function nextLocalDay(dayStart: number): number {
  return startOfLocalDay(addLocalDays(dayStart, 1));
}

/** The date part of file names: the local date. */
export const dateStamp = (value: number | Date = Date.now()): string => localDateKey(value);
