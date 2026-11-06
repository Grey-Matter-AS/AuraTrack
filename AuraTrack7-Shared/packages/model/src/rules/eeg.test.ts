import { describe, expect, it } from 'vitest';
import type { EegActivity, EegSession, Phases, Seizure } from '../schemas';
import { seizureFixture } from '../schemas/fixtures';
import { activeSession, elapsedSeconds, planEegLinks, plannedEnd, runningActivity } from './eeg';

const H = 3_600_000;
const T = 1_760_000_000_000;
const session = (over: Partial<EegSession> = {}): EegSession => ({
  id: 's1',
  householdId: 'h',
  deviceId: 'd',
  createdAt: 0,
  dataVersion: 2,
  patientId: 'p1',
  startTime: T,
  plannedEndTime: null,
  actualEndTime: null,
  durationPreset: '24h',
  customHours: null,
  title: '',
  notes: '',
  status: 'active',
  ...over,
});
const activity = (over: Partial<EegActivity> = {}): EegActivity => ({
  id: 'a1',
  householdId: 'h',
  deviceId: 'd',
  createdAt: 0,
  dataVersion: 2,
  patientId: 'p1',
  sessionId: 's1',
  kind: 'activity',
  activityCode: 'activity.sleeping',
  customText: '',
  moodCode: null,
  notes: '',
  startTime: T + H,
  endTime: null,
  durationSec: null,
  linkedSeizureId: null,
  ...over,
});
const phases = (start: number, seconds: number): Phases => ({
  start: { at: start, source: 'timed' },
  auraEnd: null,
  seizureEnd: { at: start + seconds * 1000, source: 'timed' },
  recoveryEnd: null,
});
const seizure = (id: string, start: number, over: Partial<Seizure> = {}): Seizure => ({
  ...seizureFixture({
    id,
    patientId: 'p1',
    phases: phases(start, 60),
    eegSessionId: null,
    prodromeSecondsBefore: null,
    quickNotes: [],
    recordedWhileLocked: false,
    cancelled: false,
  }),
  ...over,
});

describe('planned end', () => {
  it('adds the preset hours, or the custom hours, and is null when no length is known', () => {
    expect(plannedEnd(T, '24h', null)).toBe(T + 24 * H);
    expect(plannedEnd(T, '2h', 99)).toBe(T + 2 * H);
    expect(plannedEnd(T, 'custom', 1.5)).toBe(T + 1.5 * H);
    expect(plannedEnd(T, 'custom', null)).toBeNull();
    expect(plannedEnd(T, 'custom', 0)).toBeNull();
    expect(plannedEnd(T, 'unknown', null)).toBeNull();
  });
});

describe('finding the running session and activity', () => {
  it('finds the active session of the right person, and the activity not yet stopped', () => {
    expect(activeSession([session()], 'p1')?.id).toBe('s1');
    expect(activeSession([session()], 'p2')).toBeNull();
    expect(activeSession([session({ status: 'completed' })], 'p1')).toBeNull();
    expect(runningActivity([activity(), activity({ id: 'a2', endTime: T + 2 * H })], 's1')?.id).toBe('a1');
    expect(runningActivity([activity({ kind: 'seizure_reference' })], 's1')).toBeNull();
  });
  it('counts elapsed whole seconds, never below zero', () => {
    expect(elapsedSeconds(T, T + 61_900)).toBe(61);
    expect(elapsedSeconds(T, T - 5)).toBe(0);
  });
});

describe('tying seizures to a session', () => {
  const base = { sessions: [session()], activities: [] as EegActivity[], now: T + 10 * H };

  it('adds a reference for a seizure that began during the session, with its length (the diary names it from the seizure)', () => {
    const { links } = planEegLinks({ ...base, seizures: [seizure('z1', T + 2 * H)] });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      seizureId: 'z1',
      sessionId: 's1',
      reference: {
        kind: 'seizure_reference',
        linkedSeizureId: 'z1',
        activityCode: null,
        durationSec: 60,
        startTime: T + 2 * H,
      },
    });
  });

  it('leaves out a seizure before the session, one after it ended, one of another person, a cancelled one, and one already tied', () => {
    const ended = session({ status: 'completed', actualEndTime: T + 3 * H });
    const out = planEegLinks({
      sessions: [ended],
      activities: [],
      now: T + 10 * H,
      seizures: [
        seizure('before', T - 1),
        seizure('after', T + 3 * H + 1),
        seizure('other', T + H, { patientId: 'p2' }),
        seizure('cancelled', T + H, { cancelled: true }),
        seizure('tied', T + H, { eegSessionId: 's1' }),
        seizure('inside', T + 3 * H),
      ],
    });
    expect(out.links.map((l) => l.seizureId)).toEqual(['inside']);
  });

  it('does not add a second reference when one exists already', () => {
    const ref = activity({
      id: 'r',
      kind: 'seizure_reference',
      linkedSeizureId: 'z1',
      activityCode: null,
      endTime: T + 2 * H + 60_000,
      durationSec: 60,
    });
    const out = planEegLinks({ ...base, activities: [ref], seizures: [seizure('z1', T + 2 * H)] });
    expect(out.links).toEqual([]);
    expect(out.refreshes).toEqual([]);
  });

  it('brings a reference up to date when its seizure has ended', () => {
    const ref = activity({
      id: 'r',
      kind: 'seizure_reference',
      linkedSeizureId: 'z1',
      activityCode: null,
      endTime: null,
      durationSec: null,
    });
    const out = planEegLinks({ ...base, activities: [ref], seizures: [seizure('z1', T + 2 * H)] });
    expect(out.refreshes).toEqual([{ activityId: 'r', endTime: T + 2 * H + 60_000, durationSec: 60 }]);
  });

  it('stops the activity that was running when the seizure began, at that moment', () => {
    const { stops } = planEegLinks({ ...base, activities: [activity()], seizures: [seizure('z1', T + 2 * H)] });
    expect(stops).toEqual([{ activityId: 'a1', endTime: T + 2 * H, durationSec: 3600 }]);
  });

  it('does not stop an activity that started after the seizure, or has already stopped, and stops one only once for two seizures', () => {
    const late = activity({ startTime: T + 5 * H });
    const done = activity({ id: 'a2', endTime: T + 1.5 * H });
    expect(planEegLinks({ ...base, activities: [late, done], seizures: [seizure('z1', T + 2 * H)] }).stops).toEqual([]);
    const twice = planEegLinks({
      ...base,
      activities: [activity()],
      seizures: [seizure('z1', T + 2 * H), seizure('z2', T + 3 * H)],
    });
    expect(twice.stops).toHaveLength(1);
    expect(twice.links).toHaveLength(2);
  });
});
