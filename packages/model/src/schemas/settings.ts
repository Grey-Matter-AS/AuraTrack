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
