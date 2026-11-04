// The backup reminder (F-110): due when the chosen number of days has passed since the last backup, or since the first use
// when there has never been one; not while snoozed or switched off.
export interface ReminderInput {
  now: number;
  enabled: boolean;
  intervalDays: number;
  /** When the last backup was made; 0 when never. */
  lastBackupAt: number;
  snoozedUntil: number;
  /** When the app was first used (the oldest person's record). */
  firstUseAt: number;
}

const DAY = 86_400_000;

export interface ReminderState {
  due: boolean;
  /** Whole days since the last backup, or null when there never was one. */
  days: number | null;
}

export function backupReminder(input: ReminderInput): ReminderState {
  const days = input.lastBackupAt > 0 ? Math.floor((input.now - input.lastBackupAt) / DAY) : null;
  if (!input.enabled || input.now < input.snoozedUntil) return { due: false, days };
  const since = input.lastBackupAt > 0 ? input.lastBackupAt : input.firstUseAt;
  const due = since > 0 && input.now - since >= input.intervalDays * DAY;
  return { due, days };
}

/** A snooze is three days. */
export const SNOOZE_MS = 3 * DAY;
