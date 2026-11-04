import { WELLBEING_FACTORS } from '../codes';
import type { Seizure, WellbeingEntry } from '../schemas';
import { localDateKey } from './dates';

// The wellbeing check-in: which factors there are, today's entry, how often each mood came, and how the factors line up with
// the days that had a seizure. Pure functions; the screens and (in M5) the report read the same numbers.

export type FactorType = 'boolean' | 'scale' | 'number';
export interface FactorDef {
  code: string;
  type: FactorType;
  unit: string;
  /** The person's own words, for a factor they added. */
  label?: string | undefined;
}

/** The ten usual factors. */
export const DEFAULT_FACTORS: readonly FactorDef[] = WELLBEING_FACTORS.map((f) => ({
  code: f.code,
  type: f.type,
  unit: f.unit,
}));

/** The factors to ask: the person's own list when they made one, otherwise the usual ten. */
export const effectiveFactors = (own: readonly FactorDef[]): readonly FactorDef[] =>
  own.length > 0 ? own : DEFAULT_FACTORS;

/** The scale steps, 0 to 3. */
export const SCALE_STEPS = [0, 1, 2, 3] as const;

/** A value kept as a check-in answer: a yes/no, a step 0 to 3, or an amount; anything else is left out. */
export function cleanFactors(
  defs: readonly FactorDef[],
  raw: Readonly<Record<string, unknown>>,
): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const def of defs) {
    const value = raw[def.code];
    if (def.type === 'boolean') {
      if (value === true) out[def.code] = true; // only what is present is kept
    } else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      if (def.type === 'scale') {
        const step = Math.round(value);
        if (step >= 1 && step <= 3) out[def.code] = step; // 0 means "none", the same as not answering
      } else out[def.code] = value;
    }
  }
  return out;
}

/** The entries of one local day, newest first. */
export const entriesOn = (entries: readonly WellbeingEntry[], day: string): WellbeingEntry[] =>
  entries.filter((e) => e.dayKey === day).sort((a, b) => b.recordedAt - a.recordedAt);

/** The check-in reminder is due when its time has come today and there is no entry for today yet. */
export function reminderDue(input: { now: number; time: string; entries: readonly WellbeingEntry[] }): boolean {
  const [h = 0, m = 0] = input.time.split(':').map(Number);
  const d = new Date(input.now);
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
  return input.now >= at && entriesOn(input.entries, localDateKey(input.now)).length === 0;
}

/** How many entries had each mood, the commonest first. */
export function moodCounts(entries: readonly WellbeingEntry[]): { code: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const e of entries) tally.set(e.moodCode, (tally.get(e.moodCode) ?? 0) + 1);
  return [...tally]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export interface FactorStat {
  code: string;
  type: FactorType;
  /** Days with an entry, split by whether the day had a seizure. */
  seizureDays: { days: number; present: number; average: number | null };
  otherDays: { days: number; present: number; average: number | null };
}

const present = (def: FactorDef, value: number | boolean | undefined): boolean =>
  def.type === 'boolean'
    ? value === true
    : typeof value === 'number' && (def.type === 'scale' ? value >= 2 : value > 0);

/**
 * For each factor: on the days that had an entry, how often it was present (a yes, or a scale of 2 or more) and, for
 * numbers, the average, on days with a seizure and on days without. One entry per day counts: the latest of the day.
 * This shows what lined up. It does not say what caused what.
 */
export function factorStats(input: {
  defs: readonly FactorDef[];
  entries: readonly WellbeingEntry[];
  seizures: readonly Pick<Seizure, 'phases'>[];
}): FactorStat[] {
  const seizureDays = new Set(input.seizures.map((s) => localDateKey(s.phases.start.at)));
  const latest = new Map<string, WellbeingEntry>();
  for (const e of input.entries) {
    const have = latest.get(e.dayKey);
    if (!have || e.recordedAt > have.recordedAt) latest.set(e.dayKey, e);
  }
  const days = [...latest.values()];
  return input.defs.map((def) => {
    const group = (wantSeizure: boolean) => {
      const inGroup = days.filter((e) => seizureDays.has(e.dayKey) === wantSeizure);
      const values = inGroup.map((e) => e.factors[def.code]);
      const nums = values.filter((v): v is number => typeof v === 'number');
      return {
        days: inGroup.length,
        present: values.filter((v) => present(def, v)).length,
        average: def.type === 'number' && nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
      };
    };
    return { code: def.code, type: def.type, seizureDays: group(true), otherDays: group(false) };
  });
}
