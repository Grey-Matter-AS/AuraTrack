import type { Phases } from '../schemas';

// Emergency plan (settled clinical rules: alert 5 min, cluster 3 in 8 min, both settings; 12-minute auto-stop).
// The alert time and the cluster rule come from settings, so the live alert, History, the detail view and every
// report use the same values.

/** 12 minutes: the recording ends by itself (status epilepticus). */
export const AUTO_STOP_AT_S = 720;

export const EMERGENCY_PLAN_DEFAULTS = {
  emergencyAlertMinutes: 5,
  clusterMinCount: 3,
  clusterWindowMinutes: 8,
} as const;

/** [min, max]. The alert must stay below the 12-minute auto-stop. */
export const EMERGENCY_PLAN_LIMITS = {
  emergencyAlertMinutes: [1, 11],
  clusterMinCount: [2, 20],
  clusterWindowMinutes: [1, 7 * 24 * 60],
} as const;

type PlanKey = keyof typeof EMERGENCY_PLAN_DEFAULTS;
export type EmergencySettings = Partial<Record<PlanKey, unknown>>;

export interface EmergencyPlan {
  alertMinutes: number;
  alertSec: number;
  /** The one-minute-earlier warning. */
  warnSec: number;
  clusterMinCount: number;
  clusterWindowMinutes: number;
  clusterWindowMs: number;
}

function clampSetting(key: PlanKey, value: unknown): number {
  const [min, max] = EMERGENCY_PLAN_LIMITS[key];
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : EMERGENCY_PLAN_DEFAULTS[key];
}

export function emergencyPlan(settings: EmergencySettings = {}): EmergencyPlan {
  const alertMinutes = clampSetting(
    'emergencyAlertMinutes',
    settings.emergencyAlertMinutes ?? EMERGENCY_PLAN_DEFAULTS.emergencyAlertMinutes,
  );
  const clusterMinCount = clampSetting(
    'clusterMinCount',
    settings.clusterMinCount ?? EMERGENCY_PLAN_DEFAULTS.clusterMinCount,
  );
  const clusterWindowMinutes = clampSetting(
    'clusterWindowMinutes',
    settings.clusterWindowMinutes ?? EMERGENCY_PLAN_DEFAULTS.clusterWindowMinutes,
  );
  const alertSec = alertMinutes * 60;
  return {
    alertMinutes,
    alertSec,
    warnSec: Math.max(0, alertSec - 60),
    clusterMinCount,
    clusterWindowMinutes,
    clusterWindowMs: clusterWindowMinutes * 60_000,
  };
}

/** "8 min" or "24 h": short units read correctly inside every translated sentence. */
export const clusterWindowLabel = (minutes: number): string =>
  minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;

export type RecordingState = 'recording' | 'warning' | 'alert' | 'auto_stop';

/** What the recording screen shows after `elapsedSec` seconds. */
export function recordingState(elapsedSec: number, plan: EmergencyPlan = emergencyPlan()): RecordingState {
  if (elapsedSec >= AUTO_STOP_AT_S) return 'auto_stop';
  if (elapsedSec >= plan.alertSec) return 'alert';
  if (elapsedSec >= plan.warnSec) return 'warning';
  return 'recording';
}

const seconds = (from: number, to: number): number => Math.max(0, Math.round((to - from) / 1000));

/**
 * The length of the seizure, as neurologists time it: from the start (an aura is part of the seizure) to the end of the
 * seizure. Recovery is never counted. This is the number shown on every screen and report, and the one the alert, the
 * "long" badge and the report flags compare with the emergency plan. Null while the seizure has no end yet.
 */
export function seizureLengthSeconds(phases: Phases): number | null {
  const end = phases.seizureEnd ?? phases.recoveryEnd;
  return end ? seconds(phases.start.at, end.at) : null;
}

/** The aura on its own: the start to the end of the aura. Null when no aura was marked. */
export function auraSeconds(phases: Phases): number | null {
  return phases.auraEnd ? seconds(phases.start.at, phases.auraEnd.at) : null;
}

/** Recovery on its own: the end of the seizure until back to usual self. Null when either end is missing. */
export function recoverySeconds(phases: Phases): number | null {
  return phases.seizureEnd && phases.recoveryEnd ? seconds(phases.seizureEnd.at, phases.recoveryEnd.at) : null;
}

/**
 * The seizure phase on its own: from the end of any aura to the end of the seizure (the aura and the recovery do not count).
 * A breakdown next to the seizure length in the neurologist report. It is never called the seizure's length: that is
 * `seizureLengthSeconds`.
 */
export function seizurePhaseSeconds(phases: Phases): number | null {
  const end = phases.seizureEnd ?? phases.recoveryEnd;
  if (!end) return null;
  return seconds((phases.auraEnd ?? phases.start).at, end.at);
}

/** Seconds from the start to the last mark (aura, seizure and recovery together): the whole recorded event. */
export function totalSeconds(phases: Phases): number | null {
  const end = phases.recoveryEnd ?? phases.seizureEnd;
  return end ? seconds(phases.start.at, end.at) : null;
}

export const isLongSeizure = (phases: Phases, plan: EmergencyPlan = emergencyPlan()): boolean =>
  (seizureLengthSeconds(phases) ?? 0) >= plan.alertSec;

/**
 * A long seizure on record: its length reached the alert time, or the timer stopped itself at 12 minutes (the end is not
 * known then, but it ran far past the alert).
 */
export const isLongRecord = (
  s: { readonly phases: Phases; readonly isEmergencyStop?: boolean },
  plan: EmergencyPlan = emergencyPlan(),
): boolean => isLongSeizure(s.phases, plan) || s.isEmergencyStop === true;

export interface TimedSeizure {
  readonly id: string;
  readonly phases: Phases;
  readonly isEmergencyStop?: boolean;
}
const startOf = (s: TimedSeizure): number => s.phases.start.at;

/**
 * For each seizure: the most seizures (itself included) that one window of the plan's length holds while also holding this
 * seizure. "3 in 8 min" means three starts no more than 8 minutes apart from first to last, so seizures at 0, 7 and 14
 * minutes are not a cluster (14 minutes from first to last), while 0, 4 and 8 are. Starts exactly a window apart count.
 */
export function clusterCounts<T extends TimedSeizure>(
  seizures: readonly T[],
  plan: EmergencyPlan = emergencyPlan(),
): Map<T, number> {
  const sorted = [...seizures].sort((a, b) => startOf(a) - startOf(b));
  const best = sorted.map(() => 1);
  // Every window that matters starts at a seizure: from seizure k, it holds k..last (within the window length).
  let last = 0;
  for (let k = 0; k < sorted.length; k++) {
    if (last < k) last = k;
    const from = startOf(sorted[k] as T);
    while (last + 1 < sorted.length && startOf(sorted[last + 1] as T) - from <= plan.clusterWindowMs) last++;
    const count = last - k + 1;
    for (let j = k; j <= last; j++) if ((best[j] as number) < count) best[j] = count;
  }
  const counts = new Map<T, number>();
  sorted.forEach((seizure, i) => counts.set(seizure, best[i] as number));
  return counts;
}

export type DangerFlag = 'long_duration' | 'cluster';
export interface DangerFlags {
  flags: DangerFlag[];
  clusterCount: number;
  /** The rule used travels with the flags, so every message states the user's own thresholds. */
  alertMinutes: number;
  clusterWindow: string;
}

function flagsFor(seizure: TimedSeizure, count: number, plan: EmergencyPlan): DangerFlags {
  const flags: DangerFlag[] = [];
  if (isLongRecord(seizure, plan)) flags.push('long_duration');
  const isCluster = count >= plan.clusterMinCount;
  if (isCluster) flags.push('cluster');
  return {
    flags,
    clusterCount: isCluster ? count : 0,
    alertMinutes: plan.alertMinutes,
    clusterWindow: clusterWindowLabel(plan.clusterWindowMinutes),
  };
}

/** Flags for one seizure, judged against those around it. The seizure itself always counts, whether or not `all` includes it. */
export function computeDangerFlags(
  seizure: TimedSeizure,
  all: readonly TimedSeizure[] = [],
  plan: EmergencyPlan = emergencyPlan(),
): DangerFlags {
  const others = all.filter((other) => other !== seizure && other.id !== seizure.id);
  const counts = clusterCounts([seizure, ...others], plan);
  return flagsFor(seizure, counts.get(seizure) ?? 1, plan);
}

/** Flags for a whole list, by seizure id. */
export function buildDangerMap(
  all: readonly TimedSeizure[],
  plan: EmergencyPlan = emergencyPlan(),
): Record<string, DangerFlags> {
  const map: Record<string, DangerFlags> = {};
  for (const [seizure, count] of clusterCounts(all, plan)) map[seizure.id] = flagsFor(seizure, count, plan);
  return map;
}
