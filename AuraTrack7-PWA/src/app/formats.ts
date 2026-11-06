// How dates, times and lengths of time read, following the display settings (F-603). The recording screen's live timer is not
// here: it always shows m:ss, so it reads the same to everyone who watches it.

export interface FormatSettings {
  dateFormat: 'dmy' | 'mdy' | 'ymd';
  timeFormat: '24h' | '12h';
  durationFormat: 'clock' | 'words';
}

export interface Formats {
  /** "14:05" or "2:05 PM". */
  time(at: number): string;
  /** "Mon 5 Oct", "Mon Oct 5" or "2026-10-05". */
  day(at: number): string;
  /** The day with its year, for reports: "05 Oct 2026", "Oct 5, 2026" or "2026-10-05". */
  date(at: number): string;
  /** The day and the month on their own, for a chart's axis: "05/10" or "10-05". */
  dayMonth(at: number): string;
  /** "5 October 2026" in the person's language, or "2026-10-05". */
  longDate(at: number): string;
  /** The day and the time. */
  when(at: number): string;
  /** "14:05:32": a seizure's times are always shown to the second. */
  timeSec(at: number): string;
  /** The day and the time to the second, for anything about a seizure. */
  whenSec(at: number): string;
  /** "1:05" or "1 min 5 s"; from an hour, "1:01:05" or "1 h 1 min 5 s". */
  duration(seconds: number): string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function makeFormats(
  language: string,
  settings: FormatSettings,
  units: { h: string; min: string; s: string },
): Formats {
  const twelve = settings.timeFormat === '12h';
  const time = (at: number) =>
    new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', hour12: twelve }).format(new Date(at));
  const timeSec = (at: number) =>
    new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: twelve }).format(
      new Date(at),
    );
  const day = (at: number) => {
    const d = new Date(at);
    if (settings.dateFormat === 'ymd') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parts = new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(
      d,
    );
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const [weekday, dayOfMonth, month] = [part('weekday'), part('day'), part('month')];
    return settings.dateFormat === 'mdy' ? `${weekday} ${month} ${dayOfMonth}` : `${weekday} ${dayOfMonth} ${month}`;
  };
  const duration = (seconds: number) => {
    const sec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (settings.durationFormat === 'clock') return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    const out = [h > 0 ? `${h} ${units.h}` : '', m > 0 || h > 0 ? `${m} ${units.min}` : '', `${s} ${units.s}`];
    return out
      .filter((x) => x !== '')
      .join(' ')
      .replace(/^0 min /, '');
  };
  const date = (at: number) => {
    const d = new Date(at);
    if (settings.dateFormat === 'ymd') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parts = new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(
      d,
    );
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const [dayOfMonth, month, year] = [part('day'), part('month'), part('year')];
    return settings.dateFormat === 'mdy' ? `${month} ${dayOfMonth}, ${year}` : `${dayOfMonth} ${month} ${year}`;
  };
  const longDate = (at: number) => {
    if (settings.dateFormat === 'ymd') return date(at);
    const parts = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(
      new Date(at),
    );
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const [dayOfMonth, month, year] = [part('day'), part('month'), part('year')];
    return settings.dateFormat === 'mdy' ? `${month} ${dayOfMonth}, ${year}` : `${dayOfMonth} ${month} ${year}`;
  };
  const dayMonth = (at: number) => {
    const d = new Date(at);
    const [month, dayOfMonth] = [pad(d.getMonth() + 1), pad(d.getDate())];
    return settings.dateFormat === 'dmy' ? `${dayOfMonth}/${month}` : `${month}-${dayOfMonth}`;
  };
  return {
    time,
    timeSec,
    day,
    date,
    dayMonth,
    longDate,
    when: (at) => `${day(at)} ${time(at)}`,
    whenSec: (at) => `${day(at)} ${timeSec(at)}`,
    duration,
  };
}
