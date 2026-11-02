import type { MessageKey, MessageParams } from '@auratrack/i18n';

/** "just now", "5 minutes ago"... for the time since two devices last met. */
export function agoText(t: (key: MessageKey, params?: MessageParams) => string, now: number, at: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return t('hh.ago.now');
  if (minutes < 60) return t('hh.ago.minutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t('hh.ago.hours', { n: hours });
  return t('hh.ago.days', { n: Math.round(hours / 24) });
}
