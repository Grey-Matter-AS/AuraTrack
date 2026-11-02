import { describe, expect, it } from 'vitest';
import { SNOOZE_MS, backupReminder } from './backupReminder';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const base = { now: NOW, enabled: true, intervalDays: 30, lastBackupAt: 0, snoozedUntil: 0, firstUseAt: 0 };

describe('the backup reminder', () => {
  it('is due once the interval has passed since the last backup, and not a day before', () => {
    expect(backupReminder({ ...base, lastBackupAt: NOW - 30 * DAY })).toEqual({ due: true, days: 30 });
    expect(backupReminder({ ...base, lastBackupAt: NOW - 30 * DAY + 1 })).toMatchObject({ due: false, days: 29 });
  });

  it('counts from the first use when there was never a backup, and says there was none', () => {
    expect(backupReminder({ ...base, firstUseAt: NOW - 31 * DAY })).toEqual({ due: true, days: null });
    expect(backupReminder({ ...base, firstUseAt: NOW - 5 * DAY })).toEqual({ due: false, days: null });
  });

  it('is not due when nothing is known about the first use and there was no backup', () => {
    expect(backupReminder(base).due).toBe(false);
  });

  it('stays quiet while snoozed, and comes back when the snooze ends', () => {
    const old = { ...base, lastBackupAt: NOW - 60 * DAY };
    expect(backupReminder({ ...old, snoozedUntil: NOW + SNOOZE_MS }).due).toBe(false);
    expect(backupReminder({ ...old, snoozedUntil: NOW }).due).toBe(true);
  });

  it('stays quiet when switched off', () => {
    expect(backupReminder({ ...base, enabled: false, lastBackupAt: NOW - 90 * DAY }).due).toBe(false);
  });

  it('uses the chosen interval', () => {
    expect(backupReminder({ ...base, intervalDays: 7, lastBackupAt: NOW - 7 * DAY }).due).toBe(true);
    expect(backupReminder({ ...base, intervalDays: 90, lastBackupAt: NOW - 60 * DAY }).due).toBe(false);
  });
});
