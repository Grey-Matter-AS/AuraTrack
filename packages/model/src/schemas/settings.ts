import { z } from 'zod';

// The settings added for recording and the lock screen (M3). A setting is stored as a `Setting` record (scope, key,
// value); this table says which scope each key lives in, what values are allowed and what it is when nobody set it.
// Older keys that came with the 6.1 import (hapticFeedback, durationFormat, ...) keep their 6.1 names.

/** The nine languages of the app (the same list as `LANGUAGES` in @auratrack/i18n; the web app's tests check they agree). */
export const LANGUAGE_CODES = ['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es'] as const;

export const LOCKED_ALERT_CONTENT = ['nothing', 'rescue', 'rescue_and_contacts'] as const;

export const SETTING_DEFS = {
  /** The screen stays on while recording. */
  wakeLock: { scope: 'device', schema: z.boolean(), default: true },
  /** Usual symptoms under the phase buttons while recording (off by default; README 5). */
  symptomStrip: { scope: 'patient', schema: z.boolean(), default: false },
  /** What the emergency alert shows while the app is locked: nothing, the rescue medication, or that and the contacts. */
  lockedAlertContent: { scope: 'device', schema: z.enum(LOCKED_ALERT_CONTENT), default: 'rescue_and_contacts' },
  /** Ask for the PIN (or passkey) when the app is opened and after it has been in the background. */
  appLockEnabled: { scope: 'device', schema: z.boolean(), default: true },
  /** Seconds in the background before the app locks; 0 locks at once. */
  autoLockSeconds: { scope: 'device', schema: z.number().int().min(0).max(3600), default: 60 },
  /** The labels of the quick-note buttons on the recording screen (the user's own words, up to 8). */
  quickNoteLabels: { scope: 'patient', schema: z.array(z.string().min(1).max(24)).max(8), default: [] as string[] },
  /** The PIN screen has a Start button, so a recording can begin without the PIN (README 4.5). */
  lockedStart: { scope: 'device', schema: z.boolean(), default: true },
  /** Show the patient's name on the PIN screen (off: the screen says only "Recording"). */
  lockedShowName: { scope: 'device', schema: z.boolean(), default: false },
  /** A beep with the emergency alert. Off by default; some phones mute it with the silent switch. */
  alertSound: { scope: 'device', schema: z.boolean(), default: false },
  /** A short vibration on taps while recording, where the browser allows it (not on iPhone). */
  recordingHaptics: { scope: 'device', schema: z.boolean(), default: true },
  /** Who records: 'carer' (phase buttons) or 'self' (a simpler screen with one Stop button). */
  recordedBy: { scope: 'patient', schema: z.enum(['self', 'carer']), default: 'carer' },
  /** How the screens look. The names are 6.1's, so an imported value is used as it is. */
  theme: { scope: 'device', schema: z.enum(['dark', 'light', 'system']), default: 'dark' },
  accentColor: { scope: 'device', schema: z.enum(['blue', 'red', 'green', 'purple', 'amber']), default: 'blue' },
  fontSize: { scope: 'device', schema: z.enum(['small', 'normal', 'large', 'xlarge']), default: 'normal' },
  /** Seizures per page in History. */
  historyPageSize: { scope: 'device', schema: z.number().int().min(5).max(100), default: 20 },
  dateFormat: { scope: 'device', schema: z.enum(['dmy', 'mdy', 'ymd']), default: 'dmy' },
  /** How a length of time reads: 12:34 (minutes and seconds) or 12 min 34 s. */
  durationFormat: { scope: 'device', schema: z.enum(['clock', 'words']), default: 'clock' },
  timeFormat: { scope: 'device', schema: z.enum(['24h', '12h']), default: '24h' },
  /** Medications: unlogged doses become "assumed" after 90 minutes (F-507), counted from when this was turned on. */
  assumeDosesTaken: { scope: 'device', schema: z.boolean(), default: false },
  assumeDosesTakenSince: { scope: 'device', schema: z.string().max(40), default: '' },
  /** Dose reminders (F-509), while the app is open or was used recently. */
  doseReminders: { scope: 'device', schema: z.boolean(), default: false },
  /** The backup reminder (F-110): on, after this many days, snoozed until, and when the last backup was made. */
  backupReminderEnabled: { scope: 'device', schema: z.boolean(), default: true },
  backupReminderIntervalDays: { scope: 'device', schema: z.number().int().min(1).max(365), default: 30 },
  backupSnoozedUntil: { scope: 'device', schema: z.number().int().min(0), default: 0 },
  lastBackupAt: { scope: 'device', schema: z.number().int().min(0), default: 0 },
  /** The install banner (F-108) and the "What's new" note: the version last seen. */
  installBannerDismissed: { scope: 'device', schema: z.boolean(), default: false },
  whatsNewSeen: { scope: 'device', schema: z.string().max(20), default: '' },
  /** Optional modules, off until switched on (F-554, F-585). */
  wellbeingEnabled: { scope: 'patient', schema: z.boolean(), default: false },
  eegEnabled: { scope: 'patient', schema: z.boolean(), default: false },
  /**
   * The factors of the daily check-in, as the person set them up (F-552). Empty means the usual ten. Each is yes/no, a scale
   * of four steps, or a number with a unit; one added by hand has a `label` in the person's own words.
   */
  wellbeingFactors: {
    scope: 'patient',
    schema: z
      .array(
        z.object({
          code: z.string().min(1).max(120),
          type: z.enum(['boolean', 'scale', 'number']),
          unit: z.string().max(20),
          label: z.string().max(60).optional(),
        }),
      )
      .max(40),
    default: [] as { code: string; type: 'boolean' | 'scale' | 'number'; unit: string; label?: string }[],
  },
  wellbeingDailyReminderEnabled: { scope: 'device', schema: z.boolean(), default: false },
  wellbeingReminderTime: { scope: 'device', schema: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), default: '20:00' },
  /** Video: record with the camera during a seizure (F-209); which camera. The file stays on this device. */
  videoEnabled: { scope: 'device', schema: z.boolean(), default: false },
  videoCamera: { scope: 'device', schema: z.enum(['back', 'front']), default: 'back' },
  /** The carer's own name, for reports (F-601). */
  carerName: { scope: 'patient', schema: z.string().max(120), default: '' },
  /** The clinician and the report (F-606). */
  neurologistName: { scope: 'patient', schema: z.string().max(120), default: '' },
  neurologistInstitution: { scope: 'patient', schema: z.string().max(120), default: '' },
  neurologistContact: { scope: 'patient', schema: z.string().max(120), default: '' },
  reportIncludeDateOfBirth: { scope: 'patient', schema: z.boolean(), default: true },
  reportNotes: { scope: 'patient', schema: z.string().max(2000), default: '' },
  /** The language of the screens. */
  language: { scope: 'device', schema: z.enum(LANGUAGE_CODES), default: 'en' },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_DEFS)[K]['schema']>;
export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

/** The value to use: the stored one if it is valid for this key, otherwise the default. A bad stored value never breaks a screen. */
export function settingValue<K extends SettingKey>(key: K, stored: unknown): SettingValue<K> {
  const def = SETTING_DEFS[key];
  const parsed = def.schema.safeParse(stored);
  return (parsed.success ? parsed.data : def.default) as SettingValue<K>;
}
