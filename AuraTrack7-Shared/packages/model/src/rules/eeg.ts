import type { EegActivity, EegSession, Seizure } from '../schemas';
import { seizureLengthSeconds } from './emergency';

// The EEG diary: how long a session is planned for, and how a seizure that happens during a session is tied to it.

export const EEG_PRESETS = ['2h', '4h', '24h', '48h', '72h', 'custom'] as const;
export type EegPreset = (typeof EEG_PRESETS)[number];
const PRESET_HOURS: Record<Exclude<EegPreset, 'custom'>, number> = {
  '2h': 2,
  '4h': 4,
  '24h': 24,
  '48h': 48,
  '72h': 72,
};

/** When a session is planned to end, or null when no length was chosen. */
export function plannedEnd(startTime: number, preset: string, customHours: number | null): number | null {
  const hours = preset === 'custom' ? customHours : (PRESET_HOURS as Record<string, number | undefined>)[preset];
  return hours === null || hours === undefined || !(hours > 0) ? null : startTime + Math.round(hours * 3_600_000);
}

/** The session that is running for this person, if any (one at a time). */
export const activeSession = (sessions: readonly EegSession[], patientId: string): EegSession | null =>
  sessions.find((s) => s.patientId === patientId && s.status === 'active') ?? null;

/** An activity that was started and not stopped. */
export const runningActivity = (activities: readonly EegActivity[], sessionId: string): EegActivity | null =>
  activities.find((a) => a.sessionId === sessionId && a.kind === 'activity' && a.endTime === null) ?? null;

export type ActivityValues = Omit<EegActivity, 'id' | 'householdId' | 'deviceId' | 'createdAt'>;

export interface EegLink {
  seizureId: string;
  sessionId: string;
  /** The reference to add to the diary. */
  reference: ActivityValues;
}
/** A reference whose seizure has since ended or got a type: the diary entry catches up. */
export interface EegRefresh {
  activityId: string;
  endTime: number | null;
  durationSec: number | null;
  activityCode: string | null;
}
export interface EegStop {
  activityId: string;
  endTime: number;
  durationSec: number;
}

/**
 * Seizures that began during a session but are not tied to it yet (F-214, F-583): each gets a reference in the diary, and an
 * activity that was running at that moment is stopped when the seizure began. Safe to run again: a seizure already tied to a
 * session, or already referenced, is left alone.
 */
export function planEegLinks(input: {
  sessions: readonly EegSession[];
  activities: readonly EegActivity[];
  seizures: readonly Seizure[];
  now: number;
}): { links: EegLink[]; stops: EegStop[]; refreshes: EegRefresh[] } {
  const links: EegLink[] = [];
  const refreshes: EegRefresh[] = [];
  const stops = new Map<string, EegStop>();
  for (const seizure of input.seizures) {
    const reference = input.activities.find((a) => a.kind === 'seizure_reference' && a.linkedSeizureId === seizure.id);
    if (reference) {
      const endTime = seizure.phases.seizureEnd?.at ?? null;
      const durationSec = seizureLengthSeconds(seizure.phases);
      if (
        reference.endTime !== endTime ||
        reference.durationSec !== durationSec ||
        reference.activityCode !== seizure.typeCode
      )
        refreshes.push({ activityId: reference.id, endTime, durationSec, activityCode: seizure.typeCode });
      continue;
    }
    if (seizure.eegSessionId !== null || seizure.cancelled === true) continue;
    const at = seizure.phases.start.at;
    const session = input.sessions.find(
      (s) =>
        s.patientId === seizure.patientId &&
        s.startTime <= at &&
        at <= (s.status === 'active' ? input.now : (s.actualEndTime ?? s.startTime)),
    );
    if (!session) continue;
    const seconds = seizureLengthSeconds(seizure.phases);
    links.push({
      seizureId: seizure.id,
      sessionId: session.id,
      reference: {
        patientId: seizure.patientId,
        sessionId: session.id,
        kind: 'seizure_reference',
        activityCode: seizure.typeCode,
        customText: '',
        moodCode: null,
        notes: '',
        startTime: at,
        endTime: seizure.phases.seizureEnd?.at ?? null,
        durationSec: seconds,
        linkedSeizureId: seizure.id,
      },
    });
    for (const a of input.activities) {
      if (
        a.sessionId === session.id &&
        a.kind === 'activity' &&
        a.endTime === null &&
        a.startTime <= at &&
        !stops.has(a.id)
      )
        stops.set(a.id, {
          activityId: a.id,
          endTime: at,
          durationSec: Math.max(0, Math.round((at - a.startTime) / 1000)),
        });
    }
  }
  return { links, stops: [...stops.values()], refreshes };
}

/** Time since the session or activity began, as whole seconds (never negative). */
export const elapsedSeconds = (startTime: number, now: number): number =>
  Math.max(0, Math.floor((now - startTime) / 1000));
