import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addLocalDays,
  dateStamp,
  endOfLocalDay,
  localDateKey,
  localMonthKey,
  nextLocalDay,
  parseLocalDate,
  startOfLocalDay,
} from './dates';

afterEach(() => vi.unstubAllEnvs());

// Near midnight the UTC date differs from the local one: these cases failed with toISOString() in 6.x
describe.each(['Europe/Oslo', 'America/New_York', 'Pacific/Auckland'])('local dates in %s', (tz) => {
  it('gives the local calendar day at 23:30 and 00:30', () => {
    vi.stubEnv('TZ', tz);
    expect(localDateKey(new Date(2026, 2, 1, 23, 30))).toBe('2026-03-01');
    expect(localDateKey(new Date(2026, 2, 2, 0, 30))).toBe('2026-03-02');
    expect(localMonthKey(new Date(2026, 2, 31, 23, 59))).toBe('2026-03');
    expect(dateStamp(new Date(2026, 2, 31, 23, 59).getTime())).toBe('2026-03-31');
  });

  it('reads YYYY-MM-DD as local midnight, so a report range starts on the chosen day', () => {
    vi.stubEnv('TZ', tz);
    const from = parseLocalDate('2026-03-01');
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([2026, 2, 1, 0]);
    const seizure = new Date(2026, 2, 1, 0, 15).getTime();
    expect(seizure >= from.getTime() && seizure <= endOfLocalDay(parseLocalDate('2026-03-01'))).toBe(true);
    expect(startOfLocalDay(seizure)).toBe(from.getTime());
  });
});

describe('daylight saving', () => {
  it('steps whole calendar days, not 24 hours', () => {
    vi.stubEnv('TZ', 'Europe/Oslo');
    const day = new Date(2026, 2, 28).getTime(); // the day before the clocks go forward
    const next = nextLocalDay(day);
    expect(localDateKey(next)).toBe('2026-03-29');
    expect(nextLocalDay(next) - next).toBe(23 * 3_600_000);
    expect(localDateKey(addLocalDays(day, 2))).toBe('2026-03-30');
  });
});

it('rejects malformed date keys', () => {
  expect(Number.isNaN(parseLocalDate('03/01/2026').getTime())).toBe(true);
});

it('uses the current time when none is given', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12));
  expect(localDateKey()).toBe('2026-06-15');
  expect(startOfLocalDay()).toBe(new Date(2026, 5, 15).getTime());
  expect(localMonthKey()).toBe('2026-06');
  vi.useRealTimers();
});
