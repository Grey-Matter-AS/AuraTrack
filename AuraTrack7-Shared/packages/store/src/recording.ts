import {
  RecordingEventSchema,
  newId,
  newSeizureValues,
  reduceRecording,
  seizurePatch,
  sessionFromSeizure,
  settleRecording,
  type RecordingEvent,
  type RecordingSession,
} from '@auratrack/model';
import { Store, StoreError } from './store';

// Saves a recording as it happens (M3, slice 5; docs/decisions/locked-start.md). Start writes the seizure at once as
// `in_progress`; every tap after that is one small field-level write. The recording survives a crash because the
// seizure is already on disk, and `recover()` finds it again.

export interface RecoveryReport {
  /** Recordings still within 12 minutes: the screen asks "Is it still happening, or did it end?". */
  running: RecordingSession[];
  /** Recordings found past 12 minutes with no seizure end: stopped now, marked as auto-stopped, the end left unknown. */
  autoStopped: RecordingSession[];
}

export class RecordingService {
  private readonly sessions = new Map<string, RecordingSession>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: Store,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Applies one event to a recording and saves the result. Taps are applied one at a time, in the order they arrive. If the
   * save fails the recording is as it was, and sending the same event again (same id) is safe.
   */
  apply(seizureId: string, event: unknown): Promise<RecordingSession> {
    const run = this.queue.then(() => this.run(seizureId, event));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private load(seizureId: string): RecordingSession | null {
    const known = this.sessions.get(seizureId);
    if (known) return known;
    const saved = this.store.get('seizure', seizureId);
    const session = saved ? sessionFromSeizure(saved) : null;
    if (session) this.sessions.set(seizureId, session);
    return session;
  }

  private async run(seizureId: string, input: unknown): Promise<RecordingSession> {
    const parsed = RecordingEventSchema.safeParse(input);
    if (!parsed.success) throw new StoreError('Not a recording event');
    const event: RecordingEvent = parsed.data;
    if (event.kind === 'start') {
      if (event.seizureId !== seizureId) throw new StoreError('The event is for a different recording');
      const known = this.load(seizureId);
      if (known) return known; // a repeated Start changes nothing
      const started = reduceRecording(null, event) as RecordingSession;
      if (this.store.get('seizure', seizureId)) throw new StoreError('That recording is already finished');
      await this.store.create('seizure', { id: seizureId, ...newSeizureValues(started) });
      this.sessions.set(seizureId, started);
      return started;
    }
    const before = this.load(seizureId);
    if (!before) throw new StoreError('No recording is running');
    const after = reduceRecording(before, event) as RecordingSession;
    await this.store.update('seizure', seizureId, seizurePatch(after));
    this.sessions.set(seizureId, after);
    return after;
  }

  /**
   * Finds recordings left `in_progress` (the app was closed or crashed, F-212). One that is past 12 minutes with no seizure
   * end is stopped now and marked as auto-stopped; the seizure end stays unknown (decision 3). The rest are returned, so the
   * screen can ask whether each is still happening (decision 2).
   */
  async recover(): Promise<RecoveryReport> {
    const report: RecoveryReport = { running: [], autoStopped: [] };
    const found = this.store.list('seizure', (s) => s.status === 'in_progress');
    for (const seizure of found) {
      const base = sessionFromSeizure(seizure);
      if (!base) continue;
      const settled = settleRecording(base, this.now(), newId());
      if (settled === base) {
        this.sessions.set(base.seizureId, base);
        report.running.push(base);
        continue;
      }
      await this.apply(base.seizureId, { kind: 'auto_stop', id: newId(), at: settled.endedAt ?? this.now() });
      const done = this.sessions.get(base.seizureId) ?? settled;
      report.autoStopped.push(done);
    }
    return report;
  }
}
