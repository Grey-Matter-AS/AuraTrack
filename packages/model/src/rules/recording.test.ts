import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { SeizureSchema } from '../schemas';
import { seizureFixture } from '../schemas/fixtures';
import { AUTO_STOP_AT_S, emergencyPlan } from './emergency';
import {
  LockedMarkerSchema,
  RecordingEventSchema,
  autoStopAt,
  clusterWarningAtStart,
  lastActivityAt,
  deriveRecording,
  markerOf,
  newSeizureValues,
  pastSeizureProblem,
  pastSeizureValues,
  reduceRecording,
  replayRecording,
  seizurePatch,
  sessionFromMarker,
  sessionFromSeizure,
  settleRecording,
  type RecordingEvent,
  type RecordingSession,
} from './recording';

const T0 = 1_760_000_000_000;
const S = 1000;
const seizureId = newId();
const patientId = newId();

const start = (at = T0, id = seizureId): RecordingEvent => ({
  kind: 'start',
  id: newId(),
  at,
  seizureId: id,
  patientId,
  recordedBy: 'carer',
  timeZone: 'Europe/Oslo',
});
const ev = (
  kind: 'end_aura' | 'end_seizure' | 'back_to_normal' | 'auto_stop' | 'finish' | 'cancel',
  at: number,
): RecordingEvent => ({
  kind,
  id: newId(),
  at,
});
const note = (label: string, at: number): RecordingEvent => ({ kind: 'quick_note', id: newId(), at, label });
const symptom = (code: string, phase: 'before' | 'during' | 'after', at: number): RecordingEvent => ({
  kind: 'symptom',
  id: newId(),
  at,
  code,
  phase,
});
const run = (...events: RecordingEvent[]): RecordingSession => {
  const session = replayRecording(events);
  if (!session) throw new Error('no session');
  return session;
};

describe('reducing a recording', () => {
  it('starts a running recording with nothing marked', () => {
    const s = run(start());
    expect(s).toMatchObject({ start: T0, auraEnd: null, seizureEnd: null, recoveryEnd: null, status: 'running' });
    expect(s.autoStopped).toBe(false);
  });

  it('ignores every event before Start', () => {
    expect(reduceRecording(null, ev('end_seizure', T0))).toBeNull();
  });

  it('keeps the first Start when a second one arrives', () => {
    const first = start();
    const s = run(first, start(T0 + 5 * S, newId()));
    expect(s.start).toBe(T0);
    expect(s.seizureId).toBe(seizureId);
  });

  it('marks the aura end, then the seizure end, then back to normal, and finishes', () => {
    const s = run(
      start(),
      ev('end_aura', T0 + 20 * S),
      ev('end_seizure', T0 + 80 * S),
      ev('back_to_normal', T0 + 200 * S),
    );
    expect(s).toMatchObject({
      auraEnd: T0 + 20 * S,
      seizureEnd: T0 + 80 * S,
      recoveryEnd: T0 + 200 * S,
      status: 'finished',
      autoStopped: false,
    });
  });

  it('treats End seizure without an aura as an aura of zero (F-203)', () => {
    const s = run(start(), ev('end_seizure', T0 + 60 * S));
    expect(s.auraEnd).toBe(T0);
    expect(s.seizureEnd).toBe(T0 + 60 * S);
    expect(s.status).toBe('running');
  });

  it('ignores End aura once the seizure has ended, and a second End aura', () => {
    const s = run(
      start(),
      ev('end_aura', T0 + 10 * S),
      ev('end_aura', T0 + 15 * S),
      ev('end_seizure', T0 + 60 * S),
      ev('end_aura', T0 + 70 * S),
    );
    expect(s.auraEnd).toBe(T0 + 10 * S);
  });

  it('ignores a second End seizure', () => {
    const s = run(start(), ev('end_seizure', T0 + 60 * S), ev('end_seizure', T0 + 90 * S));
    expect(s.seizureEnd).toBe(T0 + 60 * S);
  });

  it('takes Back to normal as the end of the seizure too, when End seizure was missed', () => {
    const s = run(start(), ev('back_to_normal', T0 + 100 * S));
    expect(s).toMatchObject({ auraEnd: T0, seizureEnd: T0 + 100 * S, recoveryEnd: T0 + 100 * S, status: 'finished' });
  });

  it('never puts a mark before an earlier one', () => {
    const s = run(
      start(),
      ev('end_aura', T0 + 30 * S),
      ev('end_seizure', T0 + 10 * S),
      ev('back_to_normal', T0 + 5 * S),
    );
    expect(s.auraEnd).toBe(T0 + 30 * S);
    expect(s.seizureEnd).toBe(T0 + 30 * S);
    expect(s.recoveryEnd).toBe(T0 + 30 * S);
  });

  it('applies the same event only once', () => {
    const tap = ev('end_aura', T0 + 10 * S);
    const q = note('Eyes open', T0 + 12 * S);
    const s = run(start(), tap, tap, q, q);
    expect(s.seen).toHaveLength(3);
    expect(s.quickNotes).toHaveLength(1);
  });

  it('accepts nothing after finish or cancel', () => {
    const done = run(start(), ev('finish', T0 + 10 * S), ev('end_seizure', T0 + 20 * S), note('x', T0 + 21 * S));
    expect(done.status).toBe('finished');
    expect(done.seizureEnd).toBeNull();
    expect(done.quickNotes).toEqual([]);
    expect(run(start(), ev('cancel', T0 + 1 * S), ev('finish', T0 + 2 * S)).status).toBe('cancelled');
  });

  it('keeps the seizure end unknown when the auto-stop ends the recording (decision 3)', () => {
    const s = run(start(), ev('auto_stop', T0 + AUTO_STOP_AT_S * S));
    expect(s).toMatchObject({ autoStopped: true, status: 'finished', seizureEnd: null, recoveryEnd: null });
  });

  it('does not auto-stop a seizure that has already ended', () => {
    const s = run(start(), ev('end_seizure', T0 + 60 * S), ev('auto_stop', T0 + AUTO_STOP_AT_S * S));
    expect(s.autoStopped).toBe(false);
    expect(s.status).toBe('running');
  });

  it('keeps symptoms and quick notes, with times no earlier than Start', () => {
    const s = run(start(), symptom('symptom.a', 'before', T0 - 5 * S), note('Calm', T0 + 3 * S));
    expect(s.symptoms[0]).toMatchObject({ code: 'symptom.a', phase: 'before', at: T0 });
    expect(s.quickNotes[0]).toMatchObject({ label: 'Calm', at: T0 + 3 * S });
  });

  it('stops adding items past the limit, and never changes the state it was given', () => {
    let s: RecordingSession | null = run(start());
    for (let i = 0; i < 210; i++) s = reduceRecording(s, note('n', T0 + i)) as RecordingSession;
    expect(s.quickNotes).toHaveLength(200);
    const before = JSON.stringify(s);
    reduceRecording(s, ev('finish', T0 + 1000));
    expect(JSON.stringify(s)).toBe(before);
    let t: RecordingSession | null = run(start());
    for (let i = 0; i < 210; i++) t = reduceRecording(t, symptom('symptom.a', 'during', T0 + i)) as RecordingSession;
    expect(t.symptoms).toHaveLength(200);
  });

  it('stops taking events at the event limit', () => {
    let s: RecordingSession | null = run(start());
    for (let i = 0; i < 1100; i++) s = reduceRecording(s, ev('end_aura', T0 + i)) as RecordingSession;
    expect(s.seen.length).toBeLessThanOrEqual(1000);
  });
});

describe('marks typed in afterwards', () => {
  const late = (kind: 'end_aura' | 'end_seizure' | 'back_to_normal', at: number): RecordingEvent => ({
    kind,
    id: newId(),
    at,
    late: true,
  });

  it('are saved as "entered later", and live marks as "timed"', () => {
    const s = run(start(), ev('end_aura', T0 + 5 * S), late('end_seizure', T0 + 60 * S));
    expect(seizurePatch(s).phases).toMatchObject({
      auraEnd: { source: 'timed' },
      seizureEnd: { at: T0 + 60 * S, source: 'entered-later' },
      recoveryEnd: null,
    });
  });

  it('mark both the seizure end and the recovery end as late when Back to normal is typed in', () => {
    const s = run(start(), late('back_to_normal', T0 + 90 * S));
    expect(s.late).toEqual({ auraEnd: false, seizureEnd: true, recoveryEnd: true });
    const live = run(start(), ev('end_seizure', T0 + 30 * S), late('back_to_normal', T0 + 90 * S));
    expect(live.late).toEqual({ auraEnd: false, seizureEnd: false, recoveryEnd: true });
  });

  it('survive a save and a recovery', () => {
    const s = run(start(), late('end_aura', T0 + 5 * S));
    const back = sessionFromSeizure(seizureFixture({ id: s.seizureId, ...newSeizureValues(s) }));
    expect(back?.late.auraEnd).toBe(true);
  });

  it('give the last thing that happened, for a lost recording', () => {
    const s = run(
      start(),
      ev('end_aura', T0 + 5 * S),
      symptom('symptom.a', 'during', T0 + 40 * S),
      note('Calm', T0 + 30 * S),
    );
    expect(lastActivityAt(s)).toBe(T0 + 40 * S);
    expect(lastActivityAt(run(start()))).toBe(T0);
  });

  it('are refused when late is not a boolean', () => {
    expect(RecordingEventSchema.safeParse({ ...ev('end_aura', T0), late: 'yes' }).success).toBe(false);
    expect(RecordingEventSchema.safeParse({ ...ev('finish', T0), late: true }).success).toBe(false);
  });
});

describe('what the screen shows', () => {
  const plan = emergencyPlan();

  it('counts from Start through the aura (decision 1)', () => {
    const s = run(start());
    expect(deriveRecording(s, T0 + 30 * S, plan)).toMatchObject({
      stage: 'aura',
      elapsedSec: 30,
      stageSec: 30,
      alert: 'recording',
    });
    expect(deriveRecording(s, T0 + 240 * S, plan).alert).toBe('warning');
    expect(deriveRecording(s, T0 + 300 * S, plan).alert).toBe('alert');
  });

  it('keeps counting from Start after the aura ends, and times the seizure stage from the aura end', () => {
    const s = run(start(), ev('end_aura', T0 + 100 * S));
    expect(deriveRecording(s, T0 + 250 * S, plan)).toMatchObject({
      stage: 'seizure',
      elapsedSec: 250,
      stageSec: 150,
      alert: 'warning',
    });
  });

  it('says when the 12-minute rule is due, only while the seizure has no end', () => {
    const s = run(start());
    expect(deriveRecording(s, T0 + 719 * S, plan).autoStopDue).toBe(false);
    expect(deriveRecording(s, T0 + 720 * S, plan)).toMatchObject({ autoStopDue: true, alert: 'auto_stop' });
    const ended = run(start(), ev('end_seizure', T0 + 100 * S));
    expect(deriveRecording(ended, T0 + 900 * S, plan)).toMatchObject({
      stage: 'recovery',
      stageSec: 800,
      alert: 'recording',
      autoStopDue: false,
    });
  });

  it('shows no alert for a finished or cancelled recording, and a fixed length for an auto-stopped one', () => {
    const stopped = run(start(), ev('auto_stop', autoStopAt(run(start()))));
    expect(deriveRecording(stopped, T0 + 5000 * S)).toMatchObject({
      stage: 'done',
      elapsedSec: AUTO_STOP_AT_S,
      alert: 'recording',
    });
    const done = run(start(), ev('end_seizure', T0 + 60 * S), ev('back_to_normal', T0 + 120 * S));
    expect(deriveRecording(done, T0 + 9999 * S)).toMatchObject({ stage: 'done', elapsedSec: 120 });
    expect(deriveRecording(run(start(), ev('cancel', T0 + 1)), T0 + 9999 * S).stage).toBe('cancelled');
    expect(deriveRecording(run(start(), ev('finish', T0 + 7 * S)), T0 + 9999 * S).elapsedSec).toBe(7);
  });

  it('never shows a negative time if the clock is earlier than Start', () => {
    expect(deriveRecording(run(start()), T0 - 5000).elapsedSec).toBe(0);
  });

  it("uses the user's own alert time", () => {
    const s = run(start());
    expect(deriveRecording(s, T0 + 100 * S, emergencyPlan({ emergencyAlertMinutes: 2 })).alert).toBe('warning');
  });
});

describe('the cluster warning at Start', () => {
  const MIN = 60_000;
  it('warns when the last seizures plus this one reach the limit inside the window', () => {
    expect(clusterWarningAtStart([T0 - 2 * MIN, T0 - 5 * MIN], T0)).toEqual({ count: 3, warn: true });
    expect(clusterWarningAtStart([T0 - 8 * MIN, T0 - 1 * MIN], T0)).toEqual({ count: 3, warn: true });
  });
  it('does not warn for older seizures, future stamps, or too few', () => {
    expect(clusterWarningAtStart([T0 - 9 * MIN, T0 - 1 * MIN], T0)).toEqual({ count: 2, warn: false });
    expect(clusterWarningAtStart([T0 + MIN, T0 - MIN], T0).count).toBe(2);
    expect(clusterWarningAtStart([], T0)).toEqual({ count: 1, warn: false });
  });
  it("uses the user's own limits", () => {
    const plan = emergencyPlan({ clusterMinCount: 2, clusterWindowMinutes: 60 });
    expect(clusterWarningAtStart([T0 - 50 * MIN], T0, plan).warn).toBe(true);
  });
});

describe('settling a recording found later', () => {
  it('auto-stops a recording that is past 12 minutes and has no seizure end', () => {
    const s = run(start());
    const settled = settleRecording(s, T0 + 3600 * S, newId());
    expect(settled).toMatchObject({ autoStopped: true, status: 'finished', seizureEnd: null });
  });

  it('leaves a recording alone before 12 minutes, after the seizure ended, or once finished', () => {
    const s = run(start());
    expect(settleRecording(s, T0 + 719 * S, newId())).toBe(s);
    const ended = run(start(), ev('end_seizure', T0 + 10 * S));
    expect(settleRecording(ended, T0 + 9999 * S, newId())).toBe(ended);
    const done = run(start(), ev('finish', T0 + 10 * S));
    expect(settleRecording(done, T0 + 9999 * S, newId())).toBe(done);
  });
});

describe('the saved seizure', () => {
  it('builds a valid new seizure at Start', () => {
    const values = newSeizureValues(run(start()));
    const parsed = SeizureSchema.safeParse({
      ...values,
      id: newId(),
      householdId: newId(),
      deviceId: newId(),
      createdAt: T0,
    });
    expect(parsed.success).toBe(true);
    expect(values.status).toBe('in_progress');
    expect(values.phases).toEqual({
      start: { at: T0, source: 'timed' },
      auraEnd: null,
      seizureEnd: null,
      recoveryEnd: null,
    });
  });

  it('writes symptoms in order with the gap since the one before', () => {
    const s = run(start(), symptom('symptom.b', 'during', T0 + 30 * S), symptom('symptom.a', 'before', T0 + 10 * S));
    const patch = seizurePatch(s);
    expect(patch.symptoms).toMatchObject([
      { code: 'symptom.a', order: 0, isFirst: true, phase: 'before', sincePrevious: { kind: 'exact', ms: 10 * S } },
      { code: 'symptom.b', order: 1, isFirst: false, phase: 'during', sincePrevious: { kind: 'exact', ms: 20 * S } },
    ]);
  });

  it('records the status, the auto-stop and the cancel flag, and leaves out quick notes when there are none', () => {
    expect(seizurePatch(run(start(), ev('finish', T0 + 5 * S)))).toMatchObject({
      status: 'recorded',
      isEmergencyStop: false,
    });
    expect('quickNotes' in seizurePatch(run(start()))).toBe(false);
    expect('cancelled' in seizurePatch(run(start()))).toBe(false);
    expect(seizurePatch(run(start(), note('Calm', T0 + S))).quickNotes).toHaveLength(1);
    expect(seizurePatch(run(start(), ev('auto_stop', T0 + 720 * S)))).toMatchObject({
      isEmergencyStop: true,
      status: 'recorded',
    });
    expect(seizurePatch(run(start(), ev('cancel', T0 + 5 * S)))).toMatchObject({ cancelled: true, status: 'recorded' });
  });

  it('rebuilds a running recording from a saved in-progress seizure (crash recovery)', () => {
    const s = run(
      start(),
      ev('end_aura', T0 + 10 * S),
      symptom('symptom.a', 'during', T0 + 20 * S),
      note('Calm', T0 + 25 * S),
    );
    const saved = seizureFixture({ id: s.seizureId, ...newSeizureValues(s) });
    const back = sessionFromSeizure(saved);
    expect(back).toMatchObject({
      seizureId: s.seizureId,
      start: T0,
      auraEnd: T0 + 10 * S,
      seizureEnd: null,
      status: 'running',
    });
    expect(back?.symptoms[0]).toMatchObject({ code: 'symptom.a', at: T0 + 20 * S });
    expect(back?.quickNotes).toHaveLength(1);
  });

  it('gives nothing back for a seizure that is not in progress', () => {
    expect(sessionFromSeizure(seizureFixture({ status: 'recorded' }))).toBeNull();
  });

  it('falls back to "during" for a saved symptom with no phase, and to zero for an unknown gap', () => {
    const saved = seizureFixture({
      status: 'in_progress',
      symptoms: [
        {
          id: newId(),
          code: 'symptom.a',
          area: null,
          moment: 0,
          order: 0,
          sincePrevious: { kind: 'unknown', ms: null },
          isFirst: true,
        },
      ],
    });
    expect(sessionFromSeizure(saved)?.symptoms[0]).toMatchObject({ phase: 'during', at: saved.phases.start.at });
  });
});

describe('what a locked page keeps in the clear', () => {
  it('is only the id and the marks', () => {
    const s = run(
      start(),
      symptom('symptom.a', 'during', T0 + S),
      note('Calm', T0 + 2 * S),
      ev('end_aura', T0 + 4 * S),
    );
    const marker = markerOf(s);
    expect(LockedMarkerSchema.safeParse(marker).success).toBe(true);
    expect(Object.keys(marker).sort()).toEqual([
      'auraEnd',
      'autoStopped',
      'recoveryEnd',
      'seizureEnd',
      'seizureId',
      'start',
      'status',
    ]);
    expect(JSON.stringify(marker)).not.toContain('Calm');
    expect(JSON.stringify(marker)).not.toContain(patientId);
  });

  it('lets a reloaded locked page carry on from the marks', () => {
    const s = run(start(), ev('end_aura', T0 + 4 * S));
    const back = sessionFromMarker(markerOf(s), patientId, 'carer', 'Europe/Oslo');
    expect(back).toMatchObject({ start: T0, auraEnd: T0 + 4 * S, status: 'running', quickNotes: [], symptoms: [] });
    expect(reduceRecording(back, ev('end_seizure', T0 + 9 * S))?.seizureEnd).toBe(T0 + 9 * S);
  });
});

describe('the event schema', () => {
  it('accepts each action by name, and nothing else by that name', () => {
    for (const kind of ['end_aura', 'end_seizure', 'back_to_normal', 'auto_stop', 'finish', 'cancel'] as const) {
      expect(RecordingEventSchema.safeParse({ kind, id: newId(), at: T0 }).success).toBe(true);
      expect(RecordingEventSchema.safeParse({ kind: `${kind}_x`, id: newId(), at: T0 }).success).toBe(false);
    }
    expect(RecordingEventSchema.safeParse({ kind: '', id: newId(), at: T0 }).success).toBe(false);
  });

  it('trims a note label and refuses one that is only spaces', () => {
    expect(RecordingEventSchema.safeParse(note('   ', T0)).success).toBe(false);
    expect(RecordingEventSchema.parse(note('  Calm  ', T0))).toMatchObject({ label: 'Calm' });
  });

  it('accepts a marker in every state', () => {
    for (const status of ['running', 'finished', 'cancelled'] as const)
      expect(LockedMarkerSchema.safeParse({ ...markerOf(run(start())), status }).success).toBe(true);
    expect(LockedMarkerSchema.safeParse({ ...markerOf(run(start())), status: '' }).success).toBe(false);
  });

  it('accepts every kind of event', () => {
    for (const event of [
      start(),
      ev('end_aura', T0),
      ev('cancel', T0),
      note('x', T0),
      symptom('symptom.a', 'after', T0),
    ])
      expect(RecordingEventSchema.safeParse(event).success).toBe(true);
  });

  it('refuses extra fields, unknown kinds, bad ids, empty or long labels', () => {
    const bad: unknown[] = [
      { ...ev('end_aura', T0), extra: 1 },
      { kind: 'delete_everything', id: newId(), at: T0 },
      { ...ev('end_aura', T0), id: 'not-an-id' },
      note('', T0),
      note('x'.repeat(25), T0),
      { ...symptom('symptom.a', 'during', T0), phase: 'sometime' },
      { ...ev('end_aura', T0), at: -1 },
      null,
    ];
    for (const event of bad) expect(RecordingEventSchema.safeParse(event).success).toBe(false);
  });
});

// ---- properties

const arbEvent: fc.Arbitrary<RecordingEvent> = fc.oneof(
  fc.integer({ min: 0, max: 900 }).map((s) => ev('end_aura', T0 + s * S)),
  fc.integer({ min: 0, max: 900 }).map((s) => ev('end_seizure', T0 + s * S)),
  fc.integer({ min: 0, max: 900 }).map((s) => ev('back_to_normal', T0 + s * S)),
  fc.integer({ min: 0, max: 900 }).map((s) => ev('auto_stop', T0 + s * S)),
  fc.integer({ min: 0, max: 900 }).map((s) => ev('finish', T0 + s * S)),
  fc.integer({ min: 0, max: 900 }).map((s) => ev('cancel', T0 + s * S)),
  fc.tuple(fc.integer({ min: 0, max: 900 }), fc.constantFrom('a', 'b', 'c')).map(([s, l]) => note(l, T0 + s * S)),
  fc
    .tuple(fc.integer({ min: 0, max: 900 }), fc.constantFrom('before', 'during', 'after' as const))
    .map(([s, p]) => symptom('symptom.x', p as 'before' | 'during' | 'after', T0 + s * S)),
);

const arbRun = fc.array(arbEvent, { maxLength: 30 }).map((events) => [start(), ...events]);

describe('properties', () => {
  it('any order of taps gives marks that never go backwards', () => {
    fc.assert(
      fc.property(arbRun, (events) => {
        const s = replayRecording(events) as RecordingSession;
        const marks = [s.start, s.auraEnd, s.seizureEnd, s.recoveryEnd].filter((m): m is number => m !== null);
        expect(marks).toEqual([...marks].sort((a, b) => a - b));
        if (s.seizureEnd !== null) expect(s.auraEnd).not.toBeNull();
        if (s.recoveryEnd !== null) expect(s.seizureEnd).not.toBeNull();
      }),
    );
  });

  it('any order of taps gives a seizure the store accepts', () => {
    fc.assert(
      fc.property(arbRun, (events) => {
        const s = replayRecording(events) as RecordingSession;
        const parsed = SeizureSchema.safeParse({
          ...newSeizureValues(s),
          ...seizurePatch(s),
          id: s.seizureId,
          householdId: newId(),
          deviceId: newId(),
          createdAt: T0,
        });
        expect(parsed.success).toBe(true);
      }),
    );
  });

  it('replaying the same events again, or twice over, gives the same recording', () => {
    fc.assert(
      fc.property(arbRun, (events) => {
        const once = replayRecording(events);
        expect(replayRecording([...events, ...events])).toEqual(once);
        expect(replayRecording(events)).toEqual(once);
      }),
    );
  });

  it('the live state equals the state rebuilt from the saved seizure, for what is saved', () => {
    fc.assert(
      fc.property(arbRun, (events) => {
        const live = replayRecording(events) as RecordingSession;
        if (live.status !== 'running') return;
        const back = sessionFromSeizure(
          seizureFixture({ id: live.seizureId, ...newSeizureValues(live) }),
        ) as RecordingSession;
        expect({ ...back, seen: [] }).toEqual({
          ...live,
          seen: [],
          symptoms: [...live.symptoms].sort((a, b) => a.at - b.at),
        });
      }),
    );
  });

  it('the screen never shows a negative time, and the alert only ever rises', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 2, maxLength: 12 }), (secs) => {
        const s = run(start());
        const order = ['recording', 'warning', 'alert', 'auto_stop'];
        let last = 0;
        for (const sec of [...secs].sort((a, b) => a - b)) {
          const view = deriveRecording(s, T0 + sec * S);
          expect(view.elapsedSec).toBeGreaterThanOrEqual(0);
          const rank = order.indexOf(view.alert);
          expect(rank).toBeGreaterThanOrEqual(last);
          last = rank;
        }
      }),
    );
  });
});

describe('logging a past seizure', () => {
  const input = { patientId, recordedBy: 'self' as const, timeZone: 'Europe/Oslo', start: T0, totalSec: 300 };

  it('makes a valid seizure whose phases add up to the total, all marked as entered later', () => {
    const values = pastSeizureValues({ ...input, auraSec: 20, recoverySec: 120 });
    expect(
      SeizureSchema.safeParse({ ...values, id: newId(), householdId: newId(), deviceId: newId(), createdAt: T0 })
        .success,
    ).toBe(true);
    expect(values).toMatchObject({
      isManualEntry: true,
      status: 'recorded',
      recordedBy: 'self',
      phases: {
        start: { at: T0, source: 'entered-later' },
        auraEnd: { at: T0 + 20 * S, source: 'entered-later' },
        seizureEnd: { at: T0 + 180 * S },
        recoveryEnd: { at: T0 + 300 * S },
      },
    });
  });

  it('takes the whole total as seizure time when no phase is given', () => {
    const values = pastSeizureValues(input);
    expect(values.phases).toMatchObject({ auraEnd: { at: T0 }, seizureEnd: { at: T0 + 300 * S }, recoveryEnd: null });
  });

  it('refuses a zero length, a time in the future, and phases as long as the total or longer', () => {
    expect(pastSeizureProblem({ ...input, totalSec: 0 }, T0 + S)).toBe('zero');
    expect(pastSeizureProblem(input, T0 - S)).toBe('future');
    expect(pastSeizureProblem({ ...input, auraSec: 100, recoverySec: 200 }, T0 + S)).toBe('phases_too_long');
    expect(pastSeizureProblem({ ...input, auraSec: 100, recoverySec: 199 }, T0 + S)).toBeNull();
    expect(pastSeizureProblem(input, T0)).toBeNull();
  });

  it('rounds, and ignores negative phases', () => {
    const values = pastSeizureValues({ ...input, totalSec: 90.4, auraSec: -5 });
    expect(values.phases.seizureEnd?.at).toBe(T0 + 90 * S);
    expect(values.phases.auraEnd?.at).toBe(T0);
  });
});
