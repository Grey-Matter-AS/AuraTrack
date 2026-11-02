import { describe, expect, it } from 'vitest';
import { makeFormats, type FormatSettings } from './formats';

const units = { h: 'h', min: 'min', s: 's' };
const base: FormatSettings = { dateFormat: 'dmy', timeFormat: '24h', durationFormat: 'clock' };
const at = new Date(2026, 9, 5, 14, 5).getTime(); // Monday 5 October 2026, 14:05

describe('formats', () => {
  it('writes the time on a 24-hour or a 12-hour clock', () => {
    expect(makeFormats('en', base, units).time(at)).toBe('14:05');
    expect(makeFormats('en', { ...base, timeFormat: '12h' }, units).time(at)).toMatch(/^0?2:05 PM$/);
  });

  it('writes the day in the chosen order', () => {
    expect(makeFormats('en', base, units).day(at)).toBe('Mon 5 Oct');
    expect(makeFormats('en', { ...base, dateFormat: 'mdy' }, units).day(at)).toBe('Mon Oct 5');
    expect(makeFormats('en', { ...base, dateFormat: 'ymd' }, units).day(at)).toBe('2026-10-05');
  });

  it('uses the local day, not the UTC day, just after midnight', () => {
    const justAfterMidnight = new Date(2026, 9, 5, 0, 10).getTime();
    expect(makeFormats('en', { ...base, dateFormat: 'ymd' }, units).day(justAfterMidnight)).toBe('2026-10-05');
  });

  it('writes the day with its year for reports, in the chosen order', () => {
    expect(makeFormats('en', base, units).date(at)).toBe('05 Oct 2026');
    expect(makeFormats('en', { ...base, dateFormat: 'mdy' }, units).date(at)).toBe('Oct 05, 2026');
    expect(makeFormats('en', { ...base, dateFormat: 'ymd' }, units).date(at)).toBe('2026-10-05');
    expect(makeFormats('en', base, units).longDate(at)).toBe('5 October 2026');
    expect(makeFormats('en', { ...base, dateFormat: 'ymd' }, units).longDate(at)).toBe('2026-10-05');
  });

  it('joins the day and the time', () => {
    expect(makeFormats('en', base, units).when(at)).toBe('Mon 5 Oct 14:05');
  });

  it('writes lengths of time as a clock or in words', () => {
    const clock = makeFormats('en', base, units).duration;
    expect([0, 5, 65, 600, 3665].map(clock)).toEqual(['0:00', '0:05', '1:05', '10:00', '1:01:05']);
    const words = makeFormats('en', { ...base, durationFormat: 'words' }, units).duration;
    expect([0, 5, 65, 600, 3665].map(words)).toEqual(['0 s', '5 s', '1 min 5 s', '10 min 0 s', '1 h 1 min 5 s']);
  });

  it('treats a negative or fractional length as the whole seconds it is, never below zero', () => {
    const clock = makeFormats('en', base, units).duration;
    expect(clock(-3)).toBe('0:00');
    expect(clock(65.9)).toBe('1:05');
  });
});
