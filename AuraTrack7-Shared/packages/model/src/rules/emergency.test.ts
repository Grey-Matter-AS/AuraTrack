import { describe, expect, it } from 'vitest';
import type { Phases } from '../schemas';
import {
  auraSeconds,
  AUTO_STOP_AT_S,
  buildDangerMap,
  clusterCounts,
  clusterWindowLabel,
  computeDangerFlags,
  emergencyPlan,
  isLongRecord,
  isLongSeizure,
  recordingState,
  recoverySeconds,
  seizureLengthSeconds,
  seizurePhaseSeconds,
  totalSeconds,
} from './emergency';

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const mark = (at: number) => ({ at, source: 'timed' as const });
/** A seizure that starts at `minute` and lasts `seconds` (no aura, no recovery marked). */
const phases = (startMs: number, seconds: number): Phases => ({
  start: mark(startMs),
  auraEnd: null,
  seizureEnd: mark(startMs + seconds * 1000),
  recoveryEnd: null,
});
const at = (minutes: number, seconds = 60) => ({ id: String(minutes), phases: phases(T0 + minutes * MIN, seconds) });

describe('emergency plan settings', () => {
  it('defaults to a 5-minute alert and 3 seizures within 8 minutes', () => {
    expect(emergencyPlan()).toMatchObject({
      alertSec: 300,
      warnSec: 240,
      clusterMinCount: 3,
      clusterWindowMs: 8 * MIN,
    });
  });

  it('keeps the alert below the 12-minute auto-stop and rejects nonsense', () => {
    expect(emergencyPlan({ emergencyAlertMinutes: 30 }).alertMinutes).toBe(11);
    expect(emergencyPlan({ emergencyAlertMinutes: 0 }).alertMinutes).toBe(1);
    expect(emergencyPlan({ clusterMinCount: 'x' }).clusterMinCount).toBe(3);
    expect(emergencyPlan({ clusterMinCount: 99 }).clusterMinCount).toBe(20);
    expect(emergencyPlan({ clusterWindowMinutes: 0 }).clusterWindowMinutes).toBe(1);
  });

  it('never warns before the start of the recording', () => {
    expect(emergencyPlan({ emergencyAlertMinutes: 1 }).warnSec).toBe(0);
  });

  it('labels the window in minutes, or whole hours', () => {
    expect(clusterWindowLabel(8)).toBe('8 min');
    expect(clusterWindowLabel(90)).toBe('90 min');
    expect(clusterWindowLabel(120)).toBe('2 h');
  });
});

describe('12-minute auto-stop and the live alert', () => {
  it('stops at exactly 12 minutes', () => {
    expect(AUTO_STOP_AT_S).toBe(720);
    expect(recordingState(719)).toBe('alert');
    expect(recordingState(720)).toBe('auto_stop');
  });

  it('warns a minute before the alert, alerts at the alert time', () => {
    expect(recordingState(239)).toBe('recording');
    expect(recordingState(240)).toBe('warning');
    expect(recordingState(299)).toBe('warning');
    expect(recordingState(300)).toBe('alert');
    expect(recordingState(420, emergencyPlan({ emergencyAlertMinutes: 7 }))).toBe('alert');
    expect(recordingState(419, emergencyPlan({ emergencyAlertMinutes: 7 }))).toBe('warning');
  });
});

describe('seizure time', () => {
  it('is judged at exactly the alert time, the same as the live alert', () => {
    expect(isLongSeizure(phases(T0, 299))).toBe(false);
    expect(isLongSeizure(phases(T0, 300))).toBe(true);
    expect(isLongSeizure(phases(T0, 420), emergencyPlan({ emergencyAlertMinutes: 7 }))).toBe(true);
  });

  it('times the seizure as neurologists do: the aura counts, a long recovery never does', () => {
    const p: Phases = {
      start: mark(T0),
      auraEnd: mark(T0 + 180_000),
      seizureEnd: mark(T0 + 300_000),
      recoveryEnd: mark(T0 + 600_000),
    };
    // 3 min aura + 2 min seizure = 5 min: long, as the live alert says at 5 minutes from Start
    expect(seizureLengthSeconds(p)).toBe(300);
    expect(isLongSeizure(p)).toBe(true);
    // The CSV columns keep their meaning: the seizure phase alone, and everything to the end of recovery
    expect(seizurePhaseSeconds(p)).toBe(120);
    expect(totalSeconds(p)).toBe(600);
    expect(auraSeconds(p)).toBe(180);
    expect(recoverySeconds(p)).toBe(300);
    // A 4 min recovery after a 2 min seizure is not long
    const short: Phases = { ...p, auraEnd: mark(T0), seizureEnd: mark(T0 + 120_000), recoveryEnd: mark(T0 + 360_000) };
    expect(isLongSeizure(short)).toBe(false);
  });

  it('counts a seizure stopped by the timer at 12 minutes as long, though its end is not known', () => {
    const open: Phases = { start: mark(T0), auraEnd: null, seizureEnd: null, recoveryEnd: null };
    expect(isLongSeizure(open)).toBe(false);
    expect(isLongRecord({ phases: open, isEmergencyStop: true })).toBe(true);
    expect(isLongRecord({ phases: open })).toBe(false);
  });

  it('counts to the end of recovery when the seizure end was never marked', () => {
    const p: Phases = {
      start: mark(T0),
      auraEnd: mark(T0 + 60_000),
      seizureEnd: null,
      recoveryEnd: mark(T0 + 400_000),
    };
    expect(seizurePhaseSeconds(p)).toBe(340);
  });

  it('is unknown while nothing has ended, and never negative', () => {
    const open: Phases = { start: mark(T0), auraEnd: null, seizureEnd: null, recoveryEnd: null };
    expect(seizurePhaseSeconds(open)).toBeNull();
    expect(totalSeconds(open)).toBeNull();
    expect(isLongSeizure(open)).toBe(false);
    expect(seizurePhaseSeconds({ ...open, seizureEnd: mark(T0 - 5000) })).toBe(0);
  });

  it('a seizure with only a total counts the whole of it', () => {
    expect(seizurePhaseSeconds(phases(T0, 90))).toBe(90);
    expect(totalSeconds(phases(T0, 90))).toBe(90);
  });
});

describe('clusters', () => {
  it('flags 3 seizures within 8 minutes, not 2', () => {
    expect(buildDangerMap([at(0), at(4), at(8)])['0']?.flags).toContain('cluster');
    expect(buildDangerMap([at(0), at(4)])['0']?.flags).not.toContain('cluster');
  });

  it('is exact at the window edge', () => {
    const edge = buildDangerMap([at(0), at(4), at(8)]);
    expect([edge['0'], edge['4'], edge['8']].map((f) => f?.clusterCount)).toEqual([3, 3, 3]);
    const late = { id: 'late', phases: phases(T0 + 8 * MIN + 1000, 60) };
    expect(buildDangerMap([at(0), late, at(20)])['0']?.flags).not.toContain('cluster');
  });

  it('needs every seizure of the cluster inside one window, not the window on either side', () => {
    for (const list of [
      [at(0), at(7), at(14)],
      [at(0), at(8), at(16)],
    ]) {
      const map = buildDangerMap(list);
      for (const s of list) expect(map[s.id]?.flags).not.toContain('cluster');
    }
    // 0, 5, 7 is a cluster; 14 joins 7 but only 2 seizures share a window with it
    const map = buildDangerMap([at(0), at(5), at(7), at(14)]);
    expect(['0', '5', '7', '14'].map((id) => map[id]?.clusterCount)).toEqual([3, 3, 3, 0]);
    expect([...clusterCounts([at(0), at(5), at(7), at(14)]).values()]).toEqual([3, 3, 3, 2]);
  });

  it("follows the user's rule", () => {
    const plan = emergencyPlan({ clusterMinCount: 2, clusterWindowMinutes: 24 * 60 });
    expect(buildDangerMap([at(0), at(600)], plan)['0']?.flags).toContain('cluster');
  });

  it('gives the same answer for one seizure as for the whole list', () => {
    const all = [at(0), at(3), at(6), at(30)];
    for (const seizure of all) {
      expect(computeDangerFlags(seizure, all)).toEqual(buildDangerMap(all)[seizure.id]);
      expect(
        computeDangerFlags(
          seizure,
          all.filter((s) => s !== seizure),
        ),
      ).toEqual(buildDangerMap(all)[seizure.id]);
    }
    expect(computeDangerFlags(at(0)).clusterCount).toBe(0);
  });

  it('flags a long seizure and states the rule that was used', () => {
    const flags = computeDangerFlags(at(0, 400));
    expect(flags).toMatchObject({ flags: ['long_duration'], alertMinutes: 5, clusterWindow: '8 min' });
  });

  it('counts every seizure including itself', () => {
    const list = [at(0), at(1)];
    expect([...clusterCounts(list).values()]).toEqual([2, 2]);
  });
});
