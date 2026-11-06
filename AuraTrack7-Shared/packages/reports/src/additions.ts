import {
  buildDangerMap,
  frequencyBuckets,
  seizureKindKey,
  AUTO_STOP_AT_S,
  isLongRecord,
  seizureLengthSeconds,
  timelineItems,
  type EmergencyPlan,
  type Seizure,
  type TimelineItem,
} from '@auratrack/model';
import type { ReportContext } from './context';
import { DAY_MS } from './context';
import { ilae2025Text, seizureTitle } from './names';
import { areaLabel, type Flag, type NeurologistInput, type NeurologistReport } from './neurologist';

// The sections added in version 7 to the neurologist report (docs/plan/M5.md, item 2). Each is switched on by itself and built
// only when it is, so the 6.1 report is exactly what it was until one is chosen.

export interface Additions {
  /** A first page with the numbers that matter, before the report. */
  summary: boolean;
  /** Each detailed seizure as a vertical timeline. */
  seizureTimelines: boolean;
  /** Spaced by the real time between symptoms, not evenly. */
  trueScale: boolean;
  /** Seizures, symptoms between seizures, medicine changes and missed doses along the period. */
  periodTimeline: boolean;
  betweenSymptoms: boolean;
  /** Where on the body the symptoms were. */
  bodyMaps: boolean;
  ilae: boolean;
  recoveryTimes: boolean;
  /** The hours of the day, and day and night. */
  timeOfDay: boolean;
  /** Clusters and long seizures against the person's own rule. */
  clusters: boolean;
  /** Medicine changes and how steadily doses were taken, beside the seizures per week. */
  medicationVsFrequency: boolean;
}

export const NO_ADDITIONS: Additions = {
  summary: false,
  seizureTimelines: false,
  trueScale: false,
  periodTimeline: false,
  betweenSymptoms: false,
  bodyMaps: false,
  ilae: false,
  recoveryTimes: false,
  timeOfDay: false,
  clusters: false,
  medicationVsFrequency: false,
};
export const ADDITION_KEYS = Object.keys(NO_ADDITIONS) as (keyof Additions)[];

export interface SummaryData {
  facts: { label: string; value: string }[];
  flags: Flag[];
  lines: string[];
}
export interface PeriodTimelineData {
  from: number;
  to: number;
  items: TimelineItem[];
  ticks: { at: number; label: string }[];
  legend: { seriesLabels: { series: number; label: string }[] };
  typeSeries: Record<string, number>;
}
export interface BodyMapData {
  /** Symptom counts per drawn region, for the figure during the seizure and for what was found afterwards. */
  during: Record<BodyPart, number>;
  after: Record<BodyPart, number>;
}
export type BodyPart = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'whole';
export interface AdditionsData {
  summary?: SummaryData;
  periodTimeline?: PeriodTimelineData;
  between?: { symptoms: { label: string; count: number }[]; weekly: { day: string; count: number }[]; total: number };
  bodyMap?: BodyMapData;
  /** ILAE 2025 types counted. */
  ilae?: { rows: { label: string; count: number }[]; recorded: number; total: number };
  recovery?: { n: number; median: number | null; min: number | null; max: number | null; buckets: { label: string; count: number }[] };
  timeOfDay?: { hours: number[]; periods: { label: string; count: number }[] };
  clusters?: { episodes: { from: string; to: string; count: number }[]; long: { when: string; duration: string }[] };
  medVsFrequency?: { weeks: { day: string; count: number; adherence: number | null }[]; changes: { index: number; label: string }[] };
  trueScale: boolean;
  /** Each detailed seizure is drawn as a vertical timeline. */
  seizureTimelines: boolean;
}

const REGION_PART: Record<string, BodyPart> = {
  'body.head_and_face': 'head',
  'body.torso': 'torso',
  'body.whole_body': 'whole',
};
const SUB_PART: Record<string, BodyPart> = {
  'body.arms.left_arm': 'leftArm',
  'body.arms.right_arm': 'rightArm',
  'body.legs.left_leg': 'leftLeg',
  'body.legs.right_leg': 'rightLeg',
};
export function bodyPartOf(area: { region: string; subRegion: string | null } | null): BodyPart | null {
  if (!area) return null;
  return (area.subRegion ? SUB_PART[area.subRegion] : undefined) ?? REGION_PART[area.region] ?? null;
}
const emptyParts = (): Record<BodyPart, number> => ({ head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, whole: 0 });

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

/** The seizures of the period that began inside it, finished and not cancelled. */
const inPeriod = (input: NeurologistInput): Seizure[] =>
  input.seizures.filter((s) => s.status !== 'in_progress' && s.cancelled !== true && s.phases.start.at >= input.from && s.phases.start.at <= input.to);

/** Groups of seizures that the person's own cluster rule flagged, with the span of each. */
export function clusterEpisodes(seizures: readonly Seizure[], plan: EmergencyPlan): { from: number; to: number; count: number }[] {
  const flagged = buildDangerMap(seizures, plan);
  const ascending = seizures.filter((s) => flagged[s.id]?.flags.includes('cluster')).sort((a, b) => a.phases.start.at - b.phases.start.at);
  const out: { from: number; to: number; count: number }[] = [];
  for (const s of ascending) {
    const at = s.phases.start.at;
    const last = out[out.length - 1];
    if (last && at - last.to <= plan.clusterWindowMs) {
      last.to = at;
      last.count += 1;
    } else out.push({ from: at, to: at, count: 1 });
  }
  return out;
}

export function buildAdditions(
  input: NeurologistInput,
  report: NeurologistReport,
  ctx: ReportContext,
  flags: Additions,
): AdditionsData {
  const { t, label, fmt } = ctx;
  const period = inPeriod(input);
  const data: AdditionsData = { trueScale: flags.trueScale, seizureTimelines: flags.seizureTimelines };

  if (flags.summary) {
    const span = input.to - input.from;
    const before = input.seizures.filter(
      (s) => s.status !== 'in_progress' && s.cancelled !== true && s.phases.start.at >= input.from - span - 1 && s.phases.start.at < input.from,
    ).length;
    const durations = period.map((s) => ({ s, sec: seizureLengthSeconds(s.phases) })).filter((x): x is { s: Seizure; sec: number } => x.sec !== null);
    const longest = durations.sort((a, b) => b.sec - a.sec)[0];
    const episodes = clusterEpisodes(period, input.plan).length;
    const last = [...period].sort((a, b) => b.phases.start.at - a.phases.start.at)[0];
    const scheduled = input.doses.filter((d) => d.scheduledTime !== null && d.takenAt >= input.from && d.takenAt <= input.to);
    const taken = scheduled.filter((d) => d.status !== 'missed').length;
    const changed = input.changes.filter((c) => !c.isBaseline && c.effectiveAt >= input.from && c.effectiveAt <= input.to).length;
    const facts = [
      { label: t('rep.sumSeizures'), value: String(period.length) },
      { label: t('rep.sumBefore'), value: before > 0 || period.length > 0 ? `${before} (${period.length - before >= 0 ? '+' : ''}${period.length - before})` : '0' },
      { label: t('rep.sumLongest'), value: longest ? `${fmt.duration(longest.sec)} (${fmt.date(longest.s.phases.start.at)})` : '-' },
      { label: t('rep.sumClusters'), value: String(episodes) },
      { label: t('rep.sumLast'), value: last ? fmt.date(last.phases.start.at) : '-' },
      { label: t('rep.sumChanges'), value: String(changed) },
      { label: t('rep.sumAdherence'), value: scheduled.length > 0 ? `${Math.round((taken / scheduled.length) * 100)}%` : '-' },
      { label: t('rep.confidence'), value: `${t(`rep.confidence.${report.quality.confidence}` as never)} (${report.quality.percent}%)` },
    ];
    data.summary = {
      facts,
      flags: report.flags.slice(0, 4),
      lines: [t('rep.sumHelp')],
    };
  }

  if (flags.periodTimeline) {
    const names = new Map(input.medications.map((m) => [m.id, m.name]));
    const items = timelineItems({
      seizures: period,
      between: input.between ?? [],
      changes: input.changes,
      doses: input.doses.filter((d) => names.has(d.medicationId)),
      medicationNames: names,
      from: input.from,
      to: input.to,
      plan: input.plan,
    });
    // One colour per kind of seizure (profile or ILAE 2025 type), in the order they first appear
    const typeSeries: Record<string, number> = {};
    const titles: Record<string, string> = {};
    for (const s of [...period].sort((a, b) => a.phases.start.at - b.phases.start.at)) {
      const key = seizureKindKey(s);
      if (key && !(key in typeSeries)) {
        typeSeries[key] = (Object.keys(typeSeries).length % 7) + 1;
        titles[key] = seizureTitle(s, t);
      }
    }
    const days = Math.max(1, Math.round((input.to - input.from) / DAY_MS));
    const every = Math.max(1, Math.ceil(days / 8));
    const ticks: { at: number; label: string }[] = [];
    for (let i = 0; i <= days; i += every) ticks.push({ at: input.from + i * DAY_MS, label: fmt.date(input.from + i * DAY_MS).replace(/^\d{4}-/, '') });
    data.periodTimeline = {
      from: input.from,
      to: input.to,
      items,
      ticks,
      typeSeries,
      legend: { seriesLabels: Object.entries(typeSeries).map(([key, series]) => ({ series, label: titles[key] ?? key })) },
    };
  }

  if (flags.betweenSymptoms) {
    const mine = (input.between ?? []).filter((b) => b.occurredAt >= input.from && b.occurredAt <= input.to);
    const counts = new Map<string, number>();
    for (const b of mine) counts.set(label(b.symptomCode), (counts.get(label(b.symptomCode)) ?? 0) + 1);
    data.between = {
      total: mine.length,
      symptoms: [...counts].map(([l, count]) => ({ label: l, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 8),
      weekly: frequencyBuckets(
        mine.map((b) => ({ phases: { start: { at: b.occurredAt, source: 'timed' as const }, auraEnd: null, seizureEnd: null, recoveryEnd: null } })),
        input.from,
        input.to,
        'week',
        input.plan,
      ).map((b) => ({ day: b.day, count: b.count })),
    };
  }

  if (flags.bodyMaps) {
    const during = emptyParts();
    const after = emptyParts();
    for (const s of period) {
      for (const sym of s.symptoms) {
        const part = bodyPartOf(sym.area);
        if (part) during[part] += 1;
      }
      for (const f of s.afterFindings)
        for (const area of f.areas) {
          const part = bodyPartOf(area);
          if (part) after[part] += 1;
        }
    }
    data.bodyMap = { during, after };
  }

  if (flags.ilae) {
    const types = new Map<string, number>();
    for (const s of period) {
      const name = ilae2025Text(s, t);
      if (name) types.set(name, (types.get(name) ?? 0) + 1);
    }
    data.ilae = {
      rows: [...types]
        .map(([l, count]) => ({ label: l, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      recorded: [...types.values()].reduce((a, b) => a + b, 0),
      total: period.length,
    };
  }

  if (flags.recoveryTimes) {
    const minutes: number[] = [];
    for (const s of period) {
      const p = s.phases;
      if (p.seizureEnd && p.recoveryEnd) minutes.push((p.recoveryEnd.at - p.seizureEnd.at) / 60_000);
    }
    const edges: [string, number, number][] = [
      ['< 5 min', 0, 5],
      ['5-15 min', 5, 15],
      ['15-30 min', 15, 30],
      ['30-60 min', 30, 60],
      ['> 60 min', 60, Infinity],
    ];
    data.recovery = {
      n: minutes.length,
      median: median(minutes),
      min: minutes.length ? Math.min(...minutes) : null,
      max: minutes.length ? Math.max(...minutes) : null,
      buckets: edges.map(([lab, lo, hi]) => ({ label: lab, count: minutes.filter((m) => m >= lo && m < hi).length })),
    };
  }

  if (flags.timeOfDay) {
    const hours = Array.from({ length: 24 }, () => 0);
    for (const s of period) hours[new Date(s.phases.start.at).getHours()] = (hours[new Date(s.phases.start.at).getHours()] ?? 0) + 1;
    const sum = (from: number, to: number) => hours.slice(from, to).reduce((a, b) => a + b, 0);
    data.timeOfDay = {
      hours,
      periods: [
        { label: t('rep.tdNight'), count: sum(0, 6) + sum(22, 24) },
        { label: t('rep.tdMorning'), count: sum(6, 12) },
        { label: t('rep.tdAfternoon'), count: sum(12, 18) },
        { label: t('rep.tdEvening'), count: sum(18, 22) },
      ],
    };
  }

  if (flags.clusters) {
    const long = period
      .filter((s) => isLongRecord(s, input.plan))
      .sort((a, b) => a.phases.start.at - b.phases.start.at)
      .map((s) => {
        const length = seizureLengthSeconds(s.phases);
        // Stopped by the timer at 12 minutes: the end is not known, so it reads "12:00+" rather than a length
        const duration = length === null ? `${fmt.duration(AUTO_STOP_AT_S)}+` : fmt.duration(length);
        return { when: `${fmt.date(s.phases.start.at)} ${fmt.timeSec(s.phases.start.at)}`, duration };
      });
    data.clusters = {
      episodes: clusterEpisodes(period, input.plan).map((e) => ({ from: `${fmt.date(e.from)} ${fmt.time(e.from)}`, to: fmt.time(e.to), count: e.count })),
      long,
    };
  }

  if (flags.medicationVsFrequency) {
    const weeks = frequencyBuckets(period, input.from, input.to, 'week', input.plan);
    const scheduled = input.doses.filter((d) => d.scheduledTime !== null);
    const rows = weeks.map((w, i) => {
      const end = weeks[i + 1]?.start ?? input.to + 1;
      const inWeek = scheduled.filter((d) => d.takenAt >= w.start && d.takenAt < end);
      return { day: w.day, count: w.count, adherence: inWeek.length > 0 ? inWeek.filter((d) => d.status !== 'missed').length / inWeek.length : null };
    });
    const changes = input.changes
      .filter((c) => !c.isBaseline && c.effectiveAt >= input.from && c.effectiveAt <= input.to)
      .map((c) => ({ index: Math.max(0, weeks.findLastIndex((w) => w.start <= c.effectiveAt)), label: `${c.medicationName}: ${t(`med.change.${c.type}` as never)}` }));
    data.medVsFrequency = { weeks: rows, changes };
  }

  void areaLabel;
  return data;
}
