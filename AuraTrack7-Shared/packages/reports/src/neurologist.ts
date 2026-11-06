import {
  SYMPTOMS,
  TRIGGERS,
  adherence,
  buildDangerMap,
  clusterWindowLabel,
  emergencyContactLine,
  frequencyBuckets,
  getScheduledDosesForDay,
  isLongRecord,
  localDateKey,
  nextLocalDay,
  regimenAt,
  regimenSnapshot,
  seizureSeconds,
  startOfLocalDay,
  auraSeconds,
  recoverySeconds,
  seizureLengthSeconds,
  type BodyArea,
  type DoseLog,
  type EmergencyPlan,
  type FactorDef,
  type FrequencyBucket,
  type InterictalEvent,
  type Medication,
  type MedicationChange,
  type Patient,
  type Regimen,
  type Seizure,
  type WellbeingEntry,
  type PhaseName,
} from '@auratrack/model';
import { DAY_MS, type ReportContext } from './context';
import { clinicalClass } from './names';

// The neurologist report as data (R-1 in docs/plan/report-inventory.md): every section of the 6.1 report, worked out from the
// records, with the same rules (the most-frequent lists, the flags, how adherence is counted). The PDF is drawn from this.

export interface NeurologistInput {
  patient: Patient;
  carerName: string;
  carerPhone: string;
  recordedBy: 'self' | 'carer';
  neurologist: { name: string; institution: string; contact: string };
  includeDateOfBirth: boolean;
  reportNotes: string;
  plan: EmergencyPlan;
  /** The period, from the start of the first day to the end of the last, as instants. */
  from: number;
  to: number;
  seizures: readonly Seizure[];
  medications: readonly Medication[];
  changes: readonly MedicationChange[];
  doses: readonly DoseLog[];
  wellbeing: readonly WellbeingEntry[];
  wellbeingEnabled: boolean;
  factorDefs: readonly FactorDef[];
  /** Symptoms logged between seizures (used by the extra sections). */
  between?: readonly InterictalEvent[];
}

export interface Flag {
  level: 'warning' | 'notice';
  label: string;
  detail: string;
}
export interface ChangeRow {
  date: string;
  time: string;
  medication: string;
  detail: string;
  typeLabel: string;
  lines: string[];
  note: string;
}
export interface SeizureLine {
  index: number;
  id: string;
  date: string;
  time: string;
  type: string;
  /** The seizure length: the start (aura included) to the end of the seizure; recovery is not counted. */
  length: string;
  /** How long before the start the first warning signs came (prodrome), or "-". */
  warning: string;
  aura: string;
  seizure: string;
  recovery: string;
  hasNote: boolean;
  edited: boolean;
  by: 'CT' | 'SE' | '';
}
export interface DetailCard {
  id: string;
  date: string;
  time: string;
  type: string;
  by: string;
  /** The seizure length: the start (aura included) to the end of the seizure; recovery is not counted. */
  length: string;
  /** How long before the start the first warning signs came (prodrome), or "-". */
  warning: string;
  aura: string;
  seizure: string;
  recovery: string;
  notes: string;
  video: string;
  badges: string[];
  afterFindings: string[];
  symptoms: { path: string; term: string; location: string }[];
  timeline: SeizureTimeline;
}
/** One seizure as a vertical timeline: the marks of its parts and the symptoms in the order they happened. */
export interface SeizureTimeline {
  totalMs: number;
  marks: { kind: 'start' | 'auraEnd' | 'seizureEnd' | 'recoveryEnd'; atMs: number; time: string }[];
  /** `atMs` is when the symptom came, counted from the start, or null when only its place in the order is known. */
  moments: { label: string; place: string; phase: PhaseName; atMs: number | null; first: boolean }[];
}
export interface SymptomGroup {
  index: number;
  date: string;
  time: string;
  type: string;
  /** The seizure length (aura included, recovery not). */
  length: string;
  symptoms: { path: string; term: string; location: string }[];
}
export interface ChartData {
  bucket: 'day' | 'week' | 'month';
  /** `axis` is the day as the chart prints it, in the person's date order. */
  frequency: (FrequencyBucket & { axis: string })[];
  /** Seizure length against the start time, for the duration trend. */
  durations: { at: number; seconds: number }[];
  types: { label: string; count: number }[];
  /** The last ten seizures, as seconds in each part. */
  phases: { label: string; aura: number; seizure: number; recovery: number }[];
  /** Per factor, how often it was present on days with and without a seizure. */
  factors: { label: string; seizureDays: string; otherDays: string; seizureShare: number; otherShare: number }[];
}

export interface NeurologistReport {
  generated: string;
  period: { from: string; to: string; days: number };
  preparedBy: string;
  /** The carer's phone, when a carer prepared it. */
  preparedByPhone: string;
  forLines: string[];
  patient: { name: string; lines: string[] };
  summary: { value: string; lines: string[] };
  stats: { seizures: string; average: string; days: string; types: string };
  medications: { name: string; detail: string; stopped: string; dose: string; how: string }[];
  adherenceLines: string[];
  changes: ChangeRow[];
  recent: SeizureLine[];
  clinical: { label: string; value: string }[];
  wellbeing: {
    days: number;
    entries: number;
    moods: string;
    factors: string;
    recent: { when: string; mood: string; strength: string; factors: string; notes: string }[];
  } | null;
  flags: Flag[];
  planRule: string;
  chart: ChartData;
  details: DetailCard[];
  symptomLog: SymptomGroup[];
  quality: {
    fully: number;
    partial: number;
    untagged: number;
    autoStopped: number;
    edited: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    percent: number;
  };
  notes: string;
  footer: string[];
}

const TERMS = new Map<string, string>(SYMPTOMS.map((s) => [s.code, s.medicalTerm]));
const FACTOR_OF_TRIGGER = new Map(TRIGGERS.map((t) => [t.code as string, t.factor as string | null]));
const AWAKE = 'symptom.awareness.fully_awake_aware';
const CONFUSED = 'symptom.awareness.confused_dream_like';
const BLACKOUT = 'symptom.awareness.total_blackout';

/** A body area as words: the parts below the region, or the region itself when there is nothing more. */
export function areaLabel(area: BodyArea | null, label: (code: string) => string): string {
  if (!area) return '';
  const below = [area.subRegion, area.part].filter((c): c is string => c !== null);
  return (below.length > 0 ? below : [area.region]).map(label).join(' > ');
}

const isEdited = (s: Seizure): boolean =>
  [s.phases.start, s.phases.auraEnd, s.phases.seizureEnd, s.phases.recoveryEnd].some((m) => m?.source === 'edited');

const finished = (s: Seizure): boolean => s.status !== 'in_progress' && s.cancelled !== true;

/** "500 mg", or "250 mg + 500 mg" when the doses differ between the times of the day. */
export function doseSummary(
  r: Pick<Regimen, 'dose' | 'unit' | 'slotDoses' | 'slotUnits' | 'scheduledTimes' | 'frequency'>,
): string {
  // One unit for every time: "100 + 150 mg" (or "100 mg" when the doses are the same). Units that differ are each
  // written with their dose: "500 mg + 1 tablet". Doses in different units are never added up.
  const slots = r.frequency === 'PRN' ? [] : r.scheduledTimes.map((t) => ({ dose: r.slotDoses[t] ?? r.dose, unit: r.slotUnits?.[t] ?? r.unit }));
  const known = slots.filter((x): x is { dose: number; unit: string } => x.dose !== null);
  if (known.length === 0) return r.dose === null ? '' : `${r.dose} ${r.unit}`.trim();
  const units = new Set(known.map((x) => x.unit));
  if (units.size > 1) return known.map((x) => `${x.dose} ${x.unit}`.trim()).join(' + ');
  const unit = known[0]?.unit ?? r.unit;
  const doses = known.map((x) => x.dose);
  return new Set(doses).size > 1 ? `${doses.join(' + ')} ${unit}`.trim() : `${doses[0]} ${unit}`.trim();
}

const countedList = (counts: Map<string, number>, limit: number, suffix = (n: number) => `${n}x`): string =>
  [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => `${label} (${suffix(count)})`)
    .join(', ');

export function buildNeurologistReport(input: NeurologistInput, ctx: ReportContext): NeurologistReport {
  const { t, label, fmt } = ctx;
  const { plan, from, to } = input;
  const all = [...input.seizures].filter(finished).sort((a, b) => b.phases.start.at - a.phases.start.at);
  const period = all.filter((s) => s.phases.start.at >= from && s.phases.start.at <= to);
  const days = Math.max(1, Math.floor((to - from) / DAY_MS) + 1);
  const seconds = (s: Seizure) => seizureLengthSeconds(s.phases);
  const lengths = period.map(seconds).filter((n): n is number => n !== null);
  const average = lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
  const daysCovered = new Set(period.map((s) => localDateKey(s.phases.start.at))).size;
  const typeName = (s: Seizure) => clinicalClass(s, t, label);
  const byType = new Map<string, number>();
  for (const s of period) byType.set(typeName(s), (byType.get(typeName(s)) ?? 0) + 1);

  // Awareness and what the person was like afterwards
  const awareness = { awake: 0, confused: 0, blackout: 0 };
  const afterCounts = new Map<string, number>();
  for (const s of period) {
    for (const sym of s.symptoms) {
      if (sym.code === AWAKE) awareness.awake += 1;
      else if (sym.code === CONFUSED) awareness.confused += 1;
      else if (sym.code === BLACKOUT) awareness.blackout += 1;
    }
    for (const f of s.afterFindings) {
      const name = f.customLabel ?? label(f.code);
      afterCounts.set(name, (afterCounts.get(name) ?? 0) + 1);
    }
  }
  const awarenessTotal = awareness.awake + awareness.confused + awareness.blackout;

  // Triggers, and how often the same thing was also logged in that day's check-in
  const factorDays = (code: string) =>
    new Set(
      input.wellbeing
        .filter((e) => {
          const v = e.factors[code];
          return v === true || (typeof v === 'number' && v > 0);
        })
        .map((e) => e.dayKey),
    );
  const triggerCounts = new Map<string, number>();
  const triggerConfirmed = new Map<string, number>();
  for (const s of period)
    for (const code of s.triggerCodes) {
      triggerCounts.set(code, (triggerCounts.get(code) ?? 0) + 1);
      const factor = FACTOR_OF_TRIGGER.get(code);
      if (input.wellbeingEnabled && factor && factorDays(factor).has(localDateKey(s.phases.start.at)))
        triggerConfirmed.set(code, (triggerConfirmed.get(code) ?? 0) + 1);
    }

  const long = period.filter((s) => isLongRecord(s, plan));
  const flags: Flag[] = [];
  if (long.length > 0)
    flags.push({
      level: 'warning',
      label: t('rep.flagLong', { count: long.length, minutes: plan.alertMinutes }),
      detail: long
        .map((s) => `${fmt.date(s.phases.start.at)} ${fmt.timeSec(s.phases.start.at)} (${fmt.duration(seconds(s) ?? 0)})`)
        .join('; '),
    });
  const midpoint = from + Math.floor(days / 2) * DAY_MS;
  const firstHalf = period.filter((s) => s.phases.start.at < midpoint).length;
  const secondHalf = period.length - firstHalf;
  if (secondHalf > firstHalf * 1.5 && secondHalf > 1)
    flags.push({
      level: 'warning',
      label: t('rep.flagFrequency'),
      detail: t('rep.flagFrequencyDetail', { recent: secondHalf, prior: firstHalf }),
    });
  const ascending = [...period].sort((a, b) => a.phases.start.at - b.phases.start.at);
  if (ascending.length >= 4) {
    const half = Math.floor(ascending.length / 2);
    const avg = (list: Seizure[]) => list.reduce((n, s) => n + (seconds(s) ?? 0), 0) / list.length;
    const early = avg(ascending.slice(0, half));
    const recent = avg(ascending.slice(half));
    if (recent > early * 1.3)
      flags.push({
        level: 'warning',
        label: t('rep.flagDuration'),
        detail: t('rep.flagDurationDetail', { recent: fmt.duration(recent), earlier: fmt.duration(early) }),
      });
  }
  const autoStopped = period.filter((s) => s.isEmergencyStop).length;
  if (autoStopped > 0)
    flags.push({ level: 'warning', label: t('rep.flagAuto', { count: autoStopped }), detail: t('rep.flagAutoDetail') });
  const edited = period.filter(isEdited).length;
  if (edited > 0)
    flags.push({ level: 'notice', label: t('rep.flagEdited', { count: edited }), detail: t('rep.flagEditedDetail') });
  const topTriggers = [...triggerCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  if (topTriggers.length > 0)
    flags.push({
      level: 'notice',
      label: t('rep.flagTriggers', { count: period.filter((s) => s.triggerCodes.length > 0).length }),
      detail: topTriggers
        .map(([code, count]) => {
          const confirmed = triggerConfirmed.get(code);
          return `${label(code)} (${count}x${confirmed ? `; ${t('rep.triggerMatch', { count: confirmed })}` : ''})`;
        })
        .join(', '),
    });

  // How completely the seizures were recorded
  const hasAllMarks = (s: Seizure) => s.phases.auraEnd !== null && s.phases.seizureEnd !== null && s.phases.recoveryEnd !== null;
  const fully = period.filter((s) => s.status === 'complete' && hasAllMarks(s)).length;
  const partial = period.filter((s) => s.status === 'complete' && !hasAllMarks(s)).length;
  const untagged = period.filter((s) => s.status !== 'complete').length;
  const percent = period.length > 0 ? Math.round((fully / period.length) * 100) : 0;
  const confidence = percent >= 80 ? 'HIGH' : percent >= 50 ? 'MEDIUM' : 'LOW';

  // Medicines: what was taken in the period, with the dose at its start and its end; and the doses expected and logged
  const live = input.medications;
  const periodMeds = live.filter((m) => {
    if (m.startedAt !== null && m.startedAt > to) return false;
    return m.stoppedAt !== null ? m.stoppedAt >= from : m.active;
  });
  const end = Math.min(to, ctx.now);
  let expected = 0;
  for (let day = startOfLocalDay(from); day <= end; day = nextLocalDay(day))
    expected += getScheduledDosesForDay(live, day, input.changes).filter((d) => d.scheduledTs >= from && d.scheduledTs <= end).length;
  const periodLogs = input.doses.filter((d) => d.takenAt >= from && d.takenAt <= to);
  const counted = adherence(periodLogs);
  const sum = { taken: 0, late: 0, assumed: 0, missed: 0 };
  for (const row of counted.values()) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += row[k];
  const medications = periodMeds.map((m) => {
    const startR = regimenAt(m, input.changes, from);
    const endR = regimenAt(m, input.changes, end) ?? regimenSnapshot(m);
    const a = startR ? doseSummary(startR) : '';
    const b = doseSummary(endR);
    return {
      name: m.name,
      detail: [m.activeIngredient, m.form].filter(Boolean).join(', '),
      stopped: m.stoppedAt !== null && m.stoppedAt <= to ? t('rep.stoppedOn', { date: fmt.date(m.stoppedAt) }) : '',
      dose: a !== '' && a !== b ? `${a} -> ${b}` : b,
      how: m.frequency === 'PRN' ? t('rep.asNeeded') : `${m.frequency} - ${t(`med.freq.${m.frequency}` as never)}`,
    };
  });
  const scheduled = periodLogs.filter((l) => l.scheduledTime !== null).length;
  const adherenceLines =
    periodLogs.length > 0
      ? [
          `${t('rep.dosesLogged', { count: periodLogs.length })}${expected > 0 ? ` ${t('rep.dosesExpected', { count: expected })}` : ''}`,
          t('rep.adherence', { ...sum, scheduled }),
          ...(sum.assumed > 0 ? [t('rep.assumedNote')] : []),
        ]
      : [];

  const changes: ChangeRow[] = input.changes
    .filter((c) => !c.isBaseline && c.effectiveAt >= from && c.effectiveAt <= to)
    .sort((a, b) => a.effectiveAt - b.effectiveAt)
    .map((c) => {
      const r = c.to ?? c.from;
      return {
        date: fmt.date(c.effectiveAt),
        time: fmt.time(c.effectiveAt),
        medication: c.medicationName || r?.name || '',
        detail: r ? [r.activeIngredient, r.form].filter(Boolean).join(', ') : '',
        typeLabel: t(`med.change.${c.type}` as never),
        lines: changeLines(c, t),
        note: c.note,
      };
    });

  const lastTen = all.slice(0, 10);
  const windowDays = Math.min(10, days);
  const windowStart = to - (windowDays - 1) * DAY_MS;
  const lastTenDays = all.filter((s) => s.phases.start.at >= windowStart && s.phases.start.at <= to);
  const recentSeizures = lastTenDays.length >= lastTen.length ? lastTenDays : lastTen;
  const parts = (s: Seizure) => {
    const p = s.phases;
    return {
      length: seizureLengthSeconds(p),
      warning: s.prodromeSecondsBefore ?? null,
      aura: auraSeconds(p) ?? 0,
      seizure: seizureSeconds(p),
      recovery: recoverySeconds(p) ?? 0,
    };
  };
  const dur = (n: number | null) => (n === null ? '-' : fmt.duration(n));
  const recent: SeizureLine[] = recentSeizures.map((s, i) => {
    const p = parts(s);
    return {
      index: i + 1,
      id: s.id,
      date: fmt.date(s.phases.start.at),
      time: fmt.timeSec(s.phases.start.at),
      type: typeName(s),
      length: dur(p.length),
      warning: dur(p.warning),
      aura: dur(p.aura),
      seizure: dur(p.seizure),
      recovery: dur(p.recovery),
      hasNote: s.notes.trim() !== '',
      edited: isEdited(s),
      by: s.recordedBy === 'carer' ? 'CT' : 'SE',
    };
  });

  const symptomRows = (s: Seizure) =>
    [...s.symptoms]
      .sort((a, b) => a.order - b.order)
      .map((sym) => ({ path: label(sym.code), term: TERMS.get(sym.code) ?? '-', location: areaLabel(sym.area, label) || '-' }));

  const detailMap = new Map<string, Seizure>();
  for (const s of all.slice(0, 3)) detailMap.set(s.id, s);
  for (const s of period) if (isLongRecord(s, plan) || isEdited(s)) detailMap.set(s.id, s);
  const danger = buildDangerMap(period, plan);
  const details: DetailCard[] = [...detailMap.values()]
    .sort((a, b) => b.phases.start.at - a.phases.start.at)
    .map((s) => {
      const p = parts(s);
      return {
        id: s.id,
        date: fmt.date(s.phases.start.at),
        time: fmt.timeSec(s.phases.start.at),
        type: typeName(s),
        by: s.recordedBy === 'carer' ? t('rep.byCarer') : t('rep.bySelf'),
        length: dur(p.length),
      warning: dur(p.warning),
        aura: dur(p.aura),
        seizure: dur(p.seizure),
        recovery: dur(p.recovery),
        notes: s.notes,
        video: s.video?.fileName ?? '',
        badges: [
          isLongRecord(s, plan) ? t('rep.badgeLong', { minutes: plan.alertMinutes }) : '',
          danger[s.id]?.flags.includes('cluster') ? t('rep.badgeCluster', { count: danger[s.id]?.clusterCount ?? 0 }) : '',
          s.isEmergencyStop ? t('rep.badgeAuto') : '',
          isEdited(s) ? t('rep.badgeEdited') : '',
          ...s.triggerCodes.map(label),
        ].filter(Boolean),
        afterFindings: s.afterFindings.map((f) => f.customLabel ?? label(f.code)),
        symptoms: symptomRows(s),
        timeline: seizureTimeline(s, ctx),
      };
    });
  const symptomLog: SymptomGroup[] = period
    .filter((s) => s.symptoms.length > 0)
    .map((s, i) => ({
      index: i + 1,
      date: fmt.date(s.phases.start.at),
      time: fmt.timeSec(s.phases.start.at),
      type: typeName(s),
      length: dur(parts(s).length),
      symptoms: symptomRows(s),
    }));

  const periodWellbeing = input.wellbeingEnabled
    ? [...input.wellbeing].filter((e) => e.recordedAt >= from && e.recordedAt <= to).sort((a, b) => b.recordedAt - a.recordedAt)
    : [];
  const factorName = (code: string) => input.factorDefs.find((d) => d.code === code)?.label ?? label(code);
  const moodCounts = new Map<string, number>();
  const factorCounts = new Map<string, number>();
  for (const e of periodWellbeing) {
    moodCounts.set(label(e.moodCode), (moodCounts.get(label(e.moodCode)) ?? 0) + 1);
    for (const [code, v] of Object.entries(e.factors))
      if (v === true || (typeof v === 'number' && v > 0)) factorCounts.set(factorName(code), (factorCounts.get(factorName(code)) ?? 0) + 1);
  }
  const wellbeing = input.wellbeingEnabled
    ? {
        days: new Set(periodWellbeing.map((e) => e.dayKey)).size,
        entries: periodWellbeing.length,
        moods: countedList(moodCounts, 5),
        factors: countedList(factorCounts, 5),
        recent: periodWellbeing.slice(0, 6).map((e) => ({
          when: `${fmt.date(e.recordedAt)} ${fmt.time(e.recordedAt)}`,
          mood: label(e.moodCode),
          strength: t(`wb.intensity${e.intensity}` as never),
          factors: Object.entries(e.factors)
            .slice(0, 4)
            .map(([code, v]) => `${factorName(code)}${v === true ? '' : `: ${v}`}`)
            .join(', '),
          notes: e.notes,
        })),
      }
    : null;

  // Charts: seizures per day (or week, or month for a long period), the length of each, the types, the last ten, the factors
  const bucket = days <= 45 ? 'day' : days <= 200 ? 'week' : 'month';
  const seizureDays = new Set(period.map((s) => localDateKey(s.phases.start.at)));
  const share = (group: Set<string>, code: string) => {
    const withEntry = [...new Set(periodWellbeing.map((e) => e.dayKey))].filter((d) => group.has(d));
    const present = factorDays(code);
    return { days: withEntry.length, present: withEntry.filter((d) => present.has(d)).length };
  };
  const otherDays = new Set(periodWellbeing.map((e) => e.dayKey).filter((d) => !seizureDays.has(d)));
  const factors = input.wellbeingEnabled
    ? input.factorDefs.map((def) => {
        const a = share(seizureDays, def.code);
        const b = share(otherDays, def.code);
        return {
          label: factorName(def.code),
          seizureDays: `${a.present}/${a.days}`,
          otherDays: `${b.present}/${b.days}`,
          seizureShare: a.days > 0 ? a.present / a.days : 0,
          otherShare: b.days > 0 ? b.present / b.days : 0,
        };
      })
    : [];

  return {
    generated: fmt.longDate(ctx.now),
    period: { from: fmt.date(from), to: fmt.date(to), days },
    preparedBy: (input.recordedBy === 'carer' ? input.carerName : input.patient.name) || '-',
    preparedByPhone: input.recordedBy === 'carer' ? input.carerPhone : '',
    forLines: [
      input.neurologist.name ? `${t('rep.for')}: ${input.neurologist.name}` : '',
      input.neurologist.institution,
      input.neurologist.contact,
    ].filter(Boolean),
    patient: {
      name: input.recordedBy === 'carer' ? input.patient.name || '-' : t('rep.self'),
      lines: [
        input.includeDateOfBirth && input.patient.dateOfBirth
          ? `${t('rep.dob')}: ${fmt.longDate(new Date(`${input.patient.dateOfBirth}T00:00:00`).getTime())}`
          : '',
        emergencyContactLine(input.patient) ? `${t('rep.emergency')}: ${emergencyContactLine(input.patient)}` : '',
      ].filter(Boolean),
    },
    summary: {
      value: t('rep.seizuresInPeriod', { count: period.length }),
      lines: [t('rep.daysWith', { count: daysCovered }), `${t('rep.avgDuration')}: ${average > 0 ? fmt.duration(average) : '-'}`],
    },
    stats: {
      seizures: String(period.length),
      average: average > 0 ? fmt.duration(average) : '0s',
      days: String(daysCovered),
      types: String(byType.size),
    },
    medications,
    adherenceLines,
    changes,
    recent,
    clinical: [
      {
        label: t('rep.awareness'),
        value:
          awarenessTotal > 0
            ? `${t('rep.fullyAwake')}: ${awareness.awake} | ${t('rep.confused')}: ${awareness.confused} | ${t('rep.blackout')}: ${awareness.blackout}`
            : t('rep.notRecorded'),
      },
      { label: t('rep.recoveryQuality'), value: countedList(afterCounts, 5) || t('rep.noAfter') },
      { label: t('rep.rescueUse'), value: rescueUse(input, ctx) },
      { label: t('rep.triggersAndNotes'), value: input.reportNotes || t('rep.notRecorded') },
    ],
    wellbeing,
    flags,
    planRule: t('rep.planRule', {
      minutes: plan.alertMinutes,
      count: plan.clusterMinCount,
      window: clusterWindowLabel(plan.clusterWindowMinutes),
    }),
    chart: {
      bucket,
      frequency: frequencyBuckets(period, from, to, bucket, plan).map((b) => ({
        ...b,
        axis: fmt.dayMonth(new Date(`${b.day}T00:00:00`).getTime()),
      })),
      durations: ascending
        .map((s) => ({ at: s.phases.start.at, seconds: seconds(s) }))
        .filter((d): d is { at: number; seconds: number } => d.seconds !== null),
      types: [...byType].map(([lab, count]) => ({ label: lab, count })).sort((a, b) => b.count - a.count),
      phases: [...ascending].slice(-10).map((s) => {
        const p = parts(s);
        return { label: `${fmt.date(s.phases.start.at)} ${fmt.timeSec(s.phases.start.at)}`, aura: p.aura, seizure: p.seizure ?? 0, recovery: p.recovery };
      }),
      factors,
    },
    details,
    symptomLog,
    quality: { fully, partial, untagged, autoStopped, edited, confidence, percent },
    notes: input.reportNotes,
    footer: [t('rep.disclaimerIntro', { version: ctx.appVersion }), t('rep.disclaimerMedical'), t('rep.disclaimerEdited')],
  };
}

/** Doses of rescue medicine in the period, as one line (an extra dose of a medicine marked as rescue). */
function rescueUse(input: NeurologistInput, ctx: ReportContext): string {
  const rescue = new Map(input.medications.filter((m) => m.isRescue).map((m) => [m.id, m.name]));
  const uses = input.doses.filter((d) => rescue.has(d.medicationId) && d.takenAt >= input.from && d.takenAt <= input.to);
  if (uses.length === 0) return ctx.t('rep.notRecorded');
  const per = new Map<string, number>();
  for (const u of uses) per.set(rescue.get(u.medicationId) ?? '', (per.get(rescue.get(u.medicationId) ?? '') ?? 0) + 1);
  return countedList(per, 5);
}

/** What changed, one line each: "dose 500 mg -> 750 mg", "times 08:00, 20:00 -> 08:00". */
export function changeLines(c: MedicationChange, t: ReportContext['t']): string[] {
  if (c.type === 'started' || c.type === 'stopped') {
    const r = c.to ?? c.from;
    return r ? [`${doseSummary(r)} ${r.frequency === 'PRN' ? t('rep.asNeeded') : r.frequency}`.trim()] : [];
  }
  if (!c.from || !c.to) return [];
  const lines: string[] = [];
  if (c.from.name !== c.to.name) lines.push(`${t('rep.name')}: ${c.from.name} -> ${c.to.name}`);
  const a = doseSummary(c.from);
  const b = doseSummary(c.to);
  if (a !== b) lines.push(`${t('rep.dose')}: ${a || '-'} -> ${b || '-'}`);
  if (c.from.frequency !== c.to.frequency) lines.push(`${t('rep.frequency')}: ${c.from.frequency} -> ${c.to.frequency}`);
  if (c.from.scheduledTimes.join() !== c.to.scheduledTimes.join())
    lines.push(`${t('rep.times')}: ${c.from.scheduledTimes.join(', ') || '-'} -> ${c.to.scheduledTimes.join(', ') || '-'}`);
  if (c.from.form !== c.to.form) lines.push(`${t('rep.form')}: ${c.from.form || '-'} -> ${c.to.form || '-'}`);
  return lines;
}

/** The seizure as marks and moments for the vertical timeline. A moment's time is the sum of the exact gaps before it; after an approximate or unknown gap it is not known. */
export function seizureTimeline(s: Seizure, ctx: ReportContext): SeizureTimeline {
  const p = s.phases;
  const t0 = p.start.at;
  const marks: SeizureTimeline['marks'] = [{ kind: 'start', atMs: 0, time: ctx.fmt.timeSec(t0) }];
  if (p.auraEnd) marks.push({ kind: 'auraEnd', atMs: p.auraEnd.at - t0, time: ctx.fmt.timeSec(p.auraEnd.at) });
  if (p.seizureEnd) marks.push({ kind: 'seizureEnd', atMs: p.seizureEnd.at - t0, time: ctx.fmt.timeSec(p.seizureEnd.at) });
  if (p.recoveryEnd) marks.push({ kind: 'recoveryEnd', atMs: p.recoveryEnd.at - t0, time: ctx.fmt.timeSec(p.recoveryEnd.at) });
  const ordered = [...s.symptoms].sort((a, b) => a.order - b.order);
  // Warning signs come before the start: they have no time on the seizure's clock and are never its first sign
  const firstSign = ordered.find((sym) => (sym.phase ?? 'seizure') !== 'prodrome');
  let clock: number | null = 0;
  const moments: SeizureTimeline['moments'] = ordered.map((sym) => {
    const phase = sym.phase ?? 'seizure';
    const place = areaLabel(sym.area, ctx.label);
    if (phase === 'prodrome') return { label: ctx.label(sym.code), place, phase, atMs: null, first: false };
    const gap = sym.sincePrevious;
    // The first sign's gap is counted from the start; each later one from the symptom before it
    clock = clock !== null && gap.kind === 'exact' && gap.ms !== null ? clock + gap.ms : null;
    return { label: ctx.label(sym.code), place, phase, atMs: clock, first: sym === firstSign };
  });
  return { totalMs: Math.max(0, ...marks.map((m) => m.atMs)), marks, moments };
}
