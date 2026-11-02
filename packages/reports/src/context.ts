import type { MessageKey, MessageParams } from '@auratrack/i18n';

// What every report is given besides the records: the words, how dates and lengths read, and the time. Built by the app from
// the person's language and display settings, so a report reads like the screens do.

export type ReportText = (key: MessageKey, params?: MessageParams) => string;

export interface ReportContext {
  t: ReportText;
  /** The words for a catalogue or custom code (a symptom, a trigger, a seizure type). */
  label: (code: string) => string;
  /** The BCP 47 language, for month and weekday names. */
  language: string;
  fmt: {
    /** "05 Oct 2026" */
    date(at: number): string;
    /** "5 October 2026" */
    longDate(at: number): string;
    /** "14:05" */
    time(at: number): string;
    /** "1:05" or "1 min 5 s", as the display setting says. */
    duration(seconds: number): string;
  };
  now: number;
  appVersion: string;
}

export const DAY_MS = 86_400_000;
