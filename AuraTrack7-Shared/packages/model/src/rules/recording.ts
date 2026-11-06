import { z } from 'zod';
import { IdSchema } from '../ids';
import {
  CodeSchema,
  InstantSchema,
  PhaseNameSchema,
  TimeZoneSchema,
  type PhaseName,
  type Phases,
  type QuickNote,
  type Seizure,
  type SymptomEntry,
} from '../schemas';
import { AUTO_STOP_AT_S, emergencyPlan, recordingState, type EmergencyPlan, type RecordingState } from './emergency';

// The recording engine (M3, slice 5; docs/decisions/locked-start.md). A recording is a list of events; `reduceRecording`
// turns the list into one state, the same way whether the events were saved one by one, replayed after a crash, or taken out
// of the locked drop box. `deriveRecording` turns the state and the clock into what the screen shows. Nothing here reads a
// clock, a store or the screen, so it can be tested in every order and every repeat.
//
// Rules:
//  - Time comes from the stamps on the events, never from counting ticks: a backgrounded page cannot drift.
//  - An event applied twice changes nothing (events carry an id), and a mark never lands before an earlier one.
//  - Nothing is invented: when the 12-minute auto-stop ends a recording, the seizure end stays unknown (null).

const eventBase = { id: IdSchema, at: InstantSchema };
const action = <K extends string>(kind: K) => z.strictObject({ ...eventBase, kind: z.literal(kind) });
/** A mark the user typed in afterwards (for instance after a lost recording), not timed live: `late` keeps that on the record. */
const markEvent = <K extends string>(kind: K) =>
  z.strictObject({ ...eventBase, kind: z.literal(kind), late: z.boolean().optional() });

/** Strict on purpose: the drop box is written by a locked app and must not be able to carry anything unexpected. */
export const RecordingEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...eventBase,
    kind: z.literal('start'),
    seizureId: IdSchema,
    patientId: IdSchema,
    recordedBy: z.enum(['self', 'carer']),
    timeZone: TimeZoneSchema,
  }),
  markEvent('end_aura'),
  markEvent('end_seizure'),
  markEvent('back_to_normal'),
  action('auto_stop'),
  action('finish'),
  action('cancel'),
  z.strictObject({ ...eventBase, kind: z.literal('quick_note'), label: z.string().trim().min(1).max(24) }),
  z.strictObject({ ...eventBase, kind: z.literal('symptom'), code: CodeSchema, phase: PhaseNameSchema }),
]);
export type RecordingEvent = z.infer<typeof RecordingEventSchema>;

export interface SessionSymptom {
  id: string;
  code: string;
  phase: PhaseName;
  at: number;
}

export type SessionStatus = 'running' | 'finished' | 'cancelled';

export interface RecordingSession {
  seizureId: string;
  patientId: string;
  recordedBy: 'self' | 'carer';
  timeZone: string;
  start: number;
  auraEnd: number | null;
  seizureEnd: number | null;
  recoveryEnd: number | null;
  /** Which marks were typed in afterwards instead of timed live. */
  late: { auraEnd: boolean; seizureEnd: boolean; recoveryEnd: boolean };
  symptoms: SessionSymptom[];
  quickNotes: QuickNote[];
  status: SessionStatus;
  /** Ended by the 12-minute rule, not by the user: the seizure end is unknown and stays null. */
  autoStopped: boolean;
  /** When the recording ended (finished, auto-stopped, cancelled or back to normal); null while it runs. */
  endedAt: number | null;
  /** Ids of the events already applied, so a replay changes nothing. */
  seen: string[];
}

const noLate = { auraEnd: false, seizureEnd: false, recoveryEnd: false } as const;
const MAX_ITEMS = 200;
const MAX_EVENTS = 1000;

/** The latest mark so far. A new mark never lands before it. */
const lastMark = (s: RecordingSession): number =>
  Math.max(s.start, s.auraEnd ?? 0, s.seizureEnd ?? 0, s.recoveryEnd ?? 0);

/**
 * Applies one event. `null` is "nothing recorded yet": only `start` does anything then. A finished or cancelled recording
 * accepts nothing more. Always returns a new object; the old state is never changed.
 */
export function reduceRecording(state: RecordingSession | null, event: RecordingEvent): RecordingSession | null {
  if (event.kind === 'start') {
    if (state) return state; // a second Start for the same recording changes nothing
    return {
      seizureId: event.seizureId,
      patientId: event.patientId,
      recordedBy: event.recordedBy,
      timeZone: event.timeZone,
      start: event.at,
      auraEnd: null,
      seizureEnd: null,
      recoveryEnd: null,
      late: noLate,
      symptoms: [],
      quickNotes: [],
      status: 'running',
      autoStopped: false,
      endedAt: null,
      seen: [event.id],
    };
  }
  if (!state || state.status !== 'running' || state.seen.includes(event.id) || state.seen.length >= MAX_EVENTS)
    return state;
  const next: RecordingSession = { ...state, seen: [...state.seen, event.id] };
  const mark = Math.max(event.at, lastMark(state));
  const late = 'late' in event && event.late === true;
  switch (event.kind) {
    case 'end_aura':
      if (state.auraEnd === null && state.seizureEnd === null) {
        next.auraEnd = mark;
        next.late = { ...state.late, auraEnd: late };
      }
      break;
    case 'end_seizure':
      if (state.seizureEnd === null) {
        next.auraEnd = state.auraEnd ?? state.start; // no aura: the seizure began at Start (F-203)
        next.seizureEnd = mark;
        next.late = { ...state.late, seizureEnd: late };
      }
      break;
    case 'back_to_normal':
      if (state.recoveryEnd === null) {
        // Back to normal means the seizure is over, even if End seizure was missed
        next.auraEnd = state.auraEnd ?? state.start;
        next.seizureEnd = state.seizureEnd ?? mark;
        next.recoveryEnd = mark;
        next.late = {
          auraEnd: state.late.auraEnd,
          seizureEnd: state.seizureEnd === null ? late : state.late.seizureEnd,
          recoveryEnd: late,
        };
        next.status = 'finished';
        next.endedAt = mark;
      }
      break;
    case 'auto_stop':
      if (state.seizureEnd === null) {
        next.autoStopped = true;
        next.status = 'finished';
        next.endedAt = Math.max(mark, autoStopAt(state));
      }
      break;
    case 'finish':
      next.status = 'finished';
      next.endedAt = mark;
      break;
    case 'cancel':
      next.status = 'cancelled';
      next.endedAt = mark;
      break;
    case 'quick_note':
      if (state.quickNotes.length < MAX_ITEMS && !state.quickNotes.some((n) => n.id === event.id))
        next.quickNotes = [
          ...state.quickNotes,
          { id: event.id, at: Math.max(event.at, state.start), label: event.label },
        ];
      break;
    case 'symptom':
      if (state.symptoms.length < MAX_ITEMS && !state.symptoms.some((n) => n.id === event.id))
        next.symptoms = [
          ...state.symptoms,
          { id: event.id, code: event.code, phase: event.phase, at: Math.max(event.at, state.start) },
        ];
      break;
  }
  return next;
}

/** Applies a list of events in order. */
export const replayRecording = (events: readonly RecordingEvent[]): RecordingSession | null =>
  events.reduce<RecordingSession | null>(reduceRecording, null);

export type RecordingStage = 'aura' | 'seizure' | 'recovery' | 'done' | 'cancelled';

export interface RecordingView {
  stage: RecordingStage;
  /** Seconds since Start. */
  elapsedSec: number;
  /** Seconds in the current stage (the aura, the seizure or the recovery). */
  stageSec: number;
  /** What the screen shows about the emergency plan. Counted from Start while the seizure has no end (decision 1). */
  alert: RecordingState;
  /** The 12-minute rule applies now: the caller sends an `auto_stop` event. */
  autoStopDue: boolean;
}

const secondsBetween = (from: number, to: number): number => Math.max(0, Math.floor((to - from) / 1000));

/** What to show at `now`. */
export function deriveRecording(
  state: RecordingSession,
  now: number,
  plan: EmergencyPlan = emergencyPlan(),
): RecordingView {
  const elapsedSec = secondsBetween(state.start, now);
  if (state.status === 'cancelled')
    return { stage: 'cancelled', elapsedSec, stageSec: 0, alert: 'recording', autoStopDue: false };
  if (state.status === 'finished') {
    const end = state.autoStopped ? autoStopAt(state) : (state.endedAt ?? state.start);
    return {
      stage: 'done',
      elapsedSec: secondsBetween(state.start, end),
      stageSec: 0,
      alert: 'recording',
      autoStopDue: false,
    };
  }
  if (state.seizureEnd !== null)
    return {
      stage: 'recovery',
      elapsedSec,
      stageSec: secondsBetween(state.seizureEnd, now),
      alert: 'recording',
      autoStopDue: false,
    };
  const alert = recordingState(elapsedSec, plan);
  const autoStopDue = alert === 'auto_stop';
  return state.auraEnd !== null
    ? { stage: 'seizure', elapsedSec, stageSec: secondsBetween(state.auraEnd, now), alert, autoStopDue }
    : { stage: 'aura', elapsedSec, stageSec: elapsedSec, alert, autoStopDue };
}

/** The last thing that happened in a recording: the default for "when did it end?" after a lost recording (decision 2). */
export const lastActivityAt = (s: RecordingSession): number =>
  Math.max(lastMark(s), ...s.symptoms.map((x) => x.at), ...s.quickNotes.map((x) => x.at));

/** The moment the 12-minute rule ends a recording that has no seizure end. */
export const autoStopAt = (state: RecordingSession): number => state.start + AUTO_STOP_AT_S * 1000;

/**
 * A recording found after the app was closed or locked for a long time: if 12 minutes have passed with no seizure end,
 * the auto-stop applies now and is marked as such (decision 3). Otherwise the state is returned as it is.
 */
export function settleRecording(state: RecordingSession, now: number, eventId: string): RecordingSession {
  if (state.status !== 'running' || state.seizureEnd !== null || now < autoStopAt(state)) return state;
  return reduceRecording(state, { kind: 'auto_stop', id: eventId, at: autoStopAt(state) }) ?? state;
}

/**
 * Tapping Start when the last seizures were close: how many fall in the cluster window including this one, and whether the
 * recording screen should warn at once (decision 6). `previousStarts` are the start instants of the seizures already saved.
 */
export function clusterWarningAtStart(
  previousStarts: readonly number[],
  now: number,
  plan: EmergencyPlan = emergencyPlan(),
): { count: number; warn: boolean } {
  const count = 1 + previousStarts.filter((at) => at <= now && now - at <= plan.clusterWindowMs).length;
  return { count, warn: count >= plan.clusterMinCount };
}

// ---- the saved seizure

/** Symptoms in the order tapped, each with its time since the one before (the first: since Start). */
function symptomEntries(session: RecordingSession): SymptomEntry[] {
  const sorted = [...session.symptoms].sort((a, b) => a.at - b.at);
  return sorted.map((symptom, index) => ({
    id: symptom.id,
    code: symptom.code,
    area: null,
    moment: index,
    order: index,
    sincePrevious: { kind: 'exact', ms: Math.max(0, symptom.at - (sorted[index - 1]?.at ?? session.start)) },
    isFirst: index === 0,
    phase: symptom.phase,
  }));
}

export function sessionPhases(session: RecordingSession): Phases {
  const marked = (at: number | null, late: boolean) =>
    at === null ? null : { at, source: late ? ('entered-later' as const) : ('timed' as const) };
  return {
    start: { at: session.start, source: 'timed' },
    auraEnd: marked(session.auraEnd, session.late.auraEnd),
    seizureEnd: marked(session.seizureEnd, session.late.seizureEnd),
    recoveryEnd: marked(session.recoveryEnd, session.late.recoveryEnd),
  };
}

/** The fields that change while recording. `Store.update` stamps only the ones that really changed. */
export function seizurePatch(session: RecordingSession): Partial<Seizure> {
  return {
    phases: sessionPhases(session),
    status: session.status === 'running' ? 'in_progress' : 'recorded',
    symptoms: symptomEntries(session),
    isEmergencyStop: session.autoStopped,
    ...(session.quickNotes.length > 0 ? { quickNotes: session.quickNotes } : {}),
    ...(session.status === 'cancelled' ? { cancelled: true } : {}),
  };
}

/** Everything a new seizure record needs, for the moment Start is tapped. */
export function newSeizureValues(
  session: RecordingSession,
): Omit<Seizure, 'id' | 'householdId' | 'deviceId' | 'createdAt'> {
  return {
    patientId: session.patientId,
    timeZone: session.timeZone,
    typeCode: null,
    ilae: null,
    afterFindings: [],
    recoveryMinutes: null,
    recoveryOngoing: false,
    triggerCodes: [],
    notes: '',
    video: null,
    isManualEntry: false,
    recordedBy: session.recordedBy,
    eegSessionId: null,
    ...(seizurePatch(session) as Pick<Seizure, 'phases' | 'status' | 'symptoms' | 'isEmergencyStop'>),
  };
}

export interface PastSeizureInput {
  patientId: string;
  recordedBy: 'self' | 'carer';
  timeZone: string;
  /** When the seizure began (its first sign, an aura included), as an instant. */
  start: number;
  /** Optional: how long before the start the first warning signs came (prodrome), in seconds. Not part of the seizure. */
  prodromeSec?: number | null;
  /** Optional: the aura, in seconds. Part of the seizure. */
  auraSec?: number | null;
  /** The seizure after any aura, in seconds. */
  seizureSec: number | null;
  /** Optional: the recovery after the seizure, until back to usual self, in seconds. Never part of the seizure length. */
  recoverySec?: number | null;
}

export type PastSeizureProblem = 'zero' | 'future';

const whole = (n: number | null | undefined): number => Math.max(0, Math.round(n ?? 0));

/** Checks what was typed for a past seizure: the seizure (aura and seizure together) must last at least one second. */
export function pastSeizureProblem(input: PastSeizureInput, now: number): PastSeizureProblem | null {
  if (input.start > now) return 'future';
  if (whole(input.auraSec) + whole(input.seizureSec) < 1) return 'zero';
  return null;
}

/**
 * A seizure logged after the fact (Log Past Seizure), from the lengths of its phases in the order they happen: the aura,
 * the seizure, then the recovery. The seizure length (start to end of seizure) is the aura and the seizure together; the
 * recovery comes after it. Every mark is saved as "entered later", and the record says it was entered by hand.
 */
export function pastSeizureValues(
  input: PastSeizureInput,
): Omit<Seizure, 'id' | 'householdId' | 'deviceId' | 'createdAt'> {
  const aura = whole(input.auraSec);
  const recovery = whole(input.recoverySec);
  const prodrome = whole(input.prodromeSec);
  const auraEnd = input.start + aura * 1000;
  const seizureEnd = auraEnd + whole(input.seizureSec) * 1000;
  const later = (at: number) => ({ at, source: 'entered-later' as const });
  return {
    patientId: input.patientId,
    timeZone: input.timeZone,
    phases: {
      start: later(input.start),
      auraEnd: later(auraEnd),
      seizureEnd: later(seizureEnd),
      recoveryEnd: recovery > 0 ? later(seizureEnd + recovery * 1000) : null,
    },
    status: 'recorded',
    typeCode: null,
    ilae: null,
    symptoms: [],
    afterFindings: [],
    recoveryMinutes: null,
    ...(prodrome > 0 ? { prodromeSecondsBefore: Math.min(prodrome, 604_800) } : {}),
    recoveryOngoing: false,
    triggerCodes: [],
    notes: '',
    video: null,
    isManualEntry: true,
    isEmergencyStop: false,
    recordedBy: input.recordedBy,
    eegSessionId: null,
  };
}

/**
 * The recording in a saved seizure that is still `in_progress`, for crash recovery (F-212). Symptom times are rebuilt from
 * the gaps between them. Returns null for anything that is not an unfinished recording.
 */
export function sessionFromSeizure(seizure: Seizure): RecordingSession | null {
  if (seizure.status !== 'in_progress') return null;
  let at = seizure.phases.start.at;
  const symptoms = seizure.symptoms.map((entry) => {
    at += entry.sincePrevious.ms ?? 0;
    return { id: entry.id, code: entry.code, phase: entry.phase ?? 'seizure', at };
  });
  return {
    seizureId: seizure.id,
    patientId: seizure.patientId,
    recordedBy: seizure.recordedBy,
    timeZone: seizure.timeZone,
    start: seizure.phases.start.at,
    auraEnd: seizure.phases.auraEnd?.at ?? null,
    seizureEnd: seizure.phases.seizureEnd?.at ?? null,
    recoveryEnd: seizure.phases.recoveryEnd?.at ?? null,
    late: {
      auraEnd: seizure.phases.auraEnd?.source === 'entered-later',
      seizureEnd: seizure.phases.seizureEnd?.source === 'entered-later',
      recoveryEnd: seizure.phases.recoveryEnd?.source === 'entered-later',
    },
    symptoms,
    quickNotes: seizure.quickNotes ?? [],
    status: 'running',
    autoStopped: false,
    endedAt: null,
    seen: [],
  };
}

// ---- what a locked app can see

/**
 * The only part of a locked recording that is stored in the clear: the id and the marks, so a locked page that reloads
 * keeps the right clock. Notes, symptoms and the patient are not in it.
 */
export const LockedMarkerSchema = z.strictObject({
  seizureId: IdSchema,
  start: InstantSchema,
  auraEnd: InstantSchema.nullable(),
  seizureEnd: InstantSchema.nullable(),
  recoveryEnd: InstantSchema.nullable(),
  status: z.enum(['running', 'finished', 'cancelled']),
  autoStopped: z.boolean(),
});
export type LockedMarker = z.infer<typeof LockedMarkerSchema>;

export const markerOf = (s: RecordingSession): LockedMarker => ({
  seizureId: s.seizureId,
  start: s.start,
  auraEnd: s.auraEnd,
  seizureEnd: s.seizureEnd,
  recoveryEnd: s.recoveryEnd,
  status: s.status,
  autoStopped: s.autoStopped,
});

/** A page that reloads while locked can show the clock and the buttons again, but not the notes it cannot read. */
export const sessionFromMarker = (
  marker: LockedMarker,
  patientId: string,
  recordedBy: 'self' | 'carer',
  timeZone: string,
): RecordingSession => ({
  ...marker,
  patientId,
  recordedBy,
  timeZone,
  late: noLate,
  symptoms: [],
  quickNotes: [],
  endedAt: marker.status === 'running' ? null : (marker.recoveryEnd ?? marker.seizureEnd ?? marker.start),
  seen: [],
});
