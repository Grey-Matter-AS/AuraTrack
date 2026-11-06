import {
  seizureKindKey,
  seizureLengthSeconds,
  type EegActivity,
  type EegSession,
  type Medication,
  type MedicationChange,
  type Patient,
  type Seizure,
} from '@auratrack/model';
import type { ReportContext } from './context';
import { clinicalName, seizureTitle } from './names';
import { areaLabel, changeLines, doseSummary, type ChangeRow } from './neurologist';

// The other reports as data: the event log (R-2), the monthly diary (R-3) and the EEG diary (R-4).

const finished = (s: Seizure): boolean => s.status !== 'in_progress' && s.cancelled !== true;

function changeRows(changes: readonly MedicationChange[], from: number, to: number, ctx: ReportContext): ChangeRow[] {
  return changes
    .filter((c) => !c.isBaseline && c.effectiveAt >= from && c.effectiveAt <= to)
    .sort((a, b) => a.effectiveAt - b.effectiveAt)
    .map((c) => {
      const r = c.to ?? c.from;
      return {
        date: ctx.fmt.date(c.effectiveAt),
        time: ctx.fmt.time(c.effectiveAt),
        medication: c.medicationName || r?.name || '',
        detail: r ? [r.activeIngredient, r.form ? ctx.label(r.form) : ''].filter(Boolean).join(', ') : '',
        typeLabel: ctx.t(`med.change.${c.type}` as never),
        lines: changeLines(c, ctx.t, ctx.label),
        note: c.note,
      };
    });
}

// ── R-2 Event log

export interface EventLogReport {
  generated: string;
  period: { from: string; to: string };
  events: { date: string; time: string; type: string; duration: string; notes: string; symptoms: string }[];
  changes: ChangeRow[];
}

export function buildEventLog(
  input: { seizures: readonly Seizure[]; changes: readonly MedicationChange[]; from: number; to: number },
  ctx: ReportContext,
): EventLogReport {
  const { t, label, fmt } = ctx;
  const events = input.seizures
    .filter(finished)
    .filter((s) => s.phases.start.at >= input.from && s.phases.start.at <= input.to)
    .sort((a, b) => b.phases.start.at - a.phases.start.at)
    .map((s) => {
      const after = s.afterFindings.map((f) => f.customLabel ?? label(f.code));
      const seconds = seizureLengthSeconds(s.phases);
      return {
        date: fmt.date(s.phases.start.at),
        time: fmt.timeSec(s.phases.start.at),
        type: clinicalName(s, t),
        duration: seconds === null ? '-' : fmt.duration(seconds),
        notes: [
          s.notes,
          after.length > 0 ? `${t('rep.afterSymptoms')}: ${after.join(', ')}` : '',
          s.video ? `${t('rep.video')}: ${s.video.fileName}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        symptoms: [...s.symptoms]
          .sort((a, b) => a.order - b.order)
          .map((sym) => {
            const place = areaLabel(sym.area, label);
            return place ? `${label(sym.code)} @ ${place}` : label(sym.code);
          })
          .join(' | '),
      };
    });
  return {
    generated: fmt.date(ctx.now),
    period: { from: fmt.date(input.from), to: fmt.date(input.to) },
    events,
    changes: changeRows(input.changes, input.from, input.to, ctx),
  };
}

// ── R-3 Monthly seizure diary

export const DIARY_COLORS: Record<string, string> = {
  'seizure_type.tonic_clonic': '#dc2626',
  'seizure_type.focal_aware': '#f59e0b',
  'seizure_type.focal_impaired': '#ef4444',
  'seizure_type.absence': '#3b82f6',
  'seizure_type.aura_only': '#a855f7',
};
const UNTYPED_COLOR = '#6b7280';

export interface DiaryCell {
  kind: 'empty' | 'day';
  day?: number;
  count?: number;
  triggers?: boolean;
  types?: { abbrev: string; count: number; color: string }[];
}
export interface DiaryReport {
  title: string;
  patient: string;
  total: number;
  weekdays: string[];
  rows: number;
  cells: DiaryCell[];
  legend: { abbrev: string; label: string; color: string }[];
  medications: string;
  changeLines: string[];
}

/** Two letters for a type: the first letters of the words of its name ("Focal impaired" gives FI). */
export function abbreviation(text: string): string {
  const words = text.split(/[\s/-]+/).filter(Boolean);
  const letters = words.length >= 2 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : text.slice(0, 2);
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

export function buildDiary(
  input: {
    patient: Patient;
    seizures: readonly Seizure[];
    medications: readonly Medication[];
    changes: readonly MedicationChange[];
    year: number;
    /** 1 to 12 */
    month: number;
  },
  ctx: ReportContext,
): DiaryReport {
  const { t } = ctx;
  const { year, month } = input;
  const daysInMonth = new Date(year, month, 0).getDate();
  const first = new Date(year, month - 1, 1).getDay();
  const inMonth = input.seizures
    .filter(finished)
    .filter((s) => {
      const d = new Date(s.phases.start.at);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  const byDay = new Map<number, Seizure[]>();
  for (const s of inMonth) {
    const d = new Date(s.phases.start.at).getDate();
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  const typeKey = (s: Seizure) => seizureKindKey(s) ?? 'none';
  const titles = new Map(inMonth.map((s) => [typeKey(s), seizureTitle(s, t)]));
  const typeName = (key: string) => (key === 'none' ? t('rep.untyped') : (titles.get(key) ?? t('rep.untyped')));
  const rows = Math.ceil((first + daysInMonth) / 7);
  const cells: DiaryCell[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const day = i - first + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push({ kind: 'empty' });
      continue;
    }
    const list = byDay.get(day) ?? [];
    const counts = new Map<string, number>();
    for (const s of list) counts.set(typeKey(s), (counts.get(typeKey(s)) ?? 0) + 1);
    cells.push({
      kind: 'day',
      day,
      count: list.length,
      triggers: list.some((s) => s.triggerCodes.length > 0),
      types: [...counts].map(([code, count]) => ({
        abbrev: abbreviation(typeName(code)),
        count,
        color: DIARY_COLORS[code] ?? UNTYPED_COLOR,
      })),
    });
  }
  const legendCodes = [...new Set(inMonth.map(typeKey))];
  const active = input.medications.filter((m) => m.active);
  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();
  return {
    title: `${new Intl.DateTimeFormat(ctx.language, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))} - ${t('rep.diaryTitle')}`,
    patient: input.patient.name,
    total: inMonth.length,
    weekdays: Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(ctx.language, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))),
    rows,
    cells,
    legend: legendCodes.map((code) => ({ abbrev: abbreviation(typeName(code)), label: typeName(code), color: DIARY_COLORS[code] ?? UNTYPED_COLOR })),
    medications: active.map((m) => `${m.name} ${doseSummary(m)} ${m.frequency}`.replace(/\s+/g, ' ').trim()).join(' | '),
    changeLines: changeRows(input.changes, monthStart, monthEnd, ctx).map(
      (r) => `${r.date} ${r.time} - ${r.medication}: ${r.typeLabel}${r.lines.length ? ` (${r.lines.join('; ')})` : ''}`,
    ),
  };
}

// ── R-4 EEG diary

export interface EegReport {
  generated: string;
  session: { title: string; start: string; end: string; planned: string; status: string; notes: string } | null;
  items: { kind: 'activity' | 'seizure'; what: string; start: string; end: string; duration: string; mood: string; notes: string }[];
}

/** "Seizure - Usual seizure": the linked seizure named by its profile or ILAE 2025 type, or just "Seizure". */
function seizureRefText(a: EegActivity, seizures: readonly Seizure[], ctx: ReportContext): string {
  const seizure = seizures.find((s) => s.id === a.linkedSeizureId);
  const name = seizure && seizureKindKey(seizure) !== null ? seizureTitle(seizure, ctx.t) : null;
  return name ? `${ctx.t('eeg.seizure')} - ${name}` : ctx.t('eeg.seizure');
}

export function buildEegDiary(
  input: { session: EegSession | null; activities: readonly EegActivity[]; seizures?: readonly Seizure[] },
  ctx: ReportContext,
): EegReport {
  const { t, label, fmt } = ctx;
  const when = (at: number) => `${fmt.date(at)} ${fmt.time(at)}`;
  const s = input.session;
  return {
    generated: fmt.date(ctx.now),
    session: s
      ? {
          title: s.title || t('eeg.untitled'),
          start: when(s.startTime),
          end: s.actualEndTime ? when(s.actualEndTime) : t('eeg.running.session'),
          planned: s.plannedEndTime ? when(s.plannedEndTime) : '',
          status: s.status === 'active' ? t('eeg.running.session') : t('eeg.ended'),
          notes: s.notes,
        }
      : null,
    items: [...input.activities]
      .sort((a, b) => a.startTime - b.startTime)
      .map((a) => ({
        kind: a.kind === 'seizure_reference' ? ('seizure' as const) : ('activity' as const),
        what:
          a.kind === 'seizure_reference'
            ? seizureRefText(a, input.seizures ?? [], ctx)
            : a.customText || label(a.activityCode ?? ''),
        start: when(a.startTime),
        end: a.endTime ? when(a.endTime) : t('eeg.running.session'),
        duration: a.durationSec !== null ? fmt.duration(a.durationSec) : '',
        mood: a.moodCode ? label(a.moodCode) : '',
        notes: a.notes,
      })),
  };
}

