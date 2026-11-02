const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds as m:ss, or h:mm:ss from an hour. */
export function clock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec % 60)}` : `${m}:${pad(sec % 60)}`;
}

/** "Mon 14:05" in the chosen language, from an instant. */
export const whenText = (language: string, at: number): string =>
  new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));

/** "14:05" in the chosen language. */
export const timeText = (language: string, at: number): string =>
  new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
