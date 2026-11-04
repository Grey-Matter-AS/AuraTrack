import {
  autoStopAt,
  deriveRecording,
  emergencyPlan,
  newId,
  reduceRecording,
  type EmergencyPlan,
  type RecordingEvent,
  type RecordingSession,
  type RecordingState,
  type RecordingView,
} from '@auratrack/model';

// The recording controller (M3, slice 5): the browser side of a recording. It keeps the recording in memory with the same
// pure engine the store uses, so a tap shows at once, and hands each event to a transport that saves it (to the store when
// unlocked, to the drop box when locked). It owns the clock (read from timestamps, never counted), the wake lock, the
// vibration, the beep, and the 12-minute rule. It knows nothing about screens.

export interface RecordingTransport {
  /** Save one event. May be called again with the same event (events carry ids), so a retry is safe. */
  send(seizureId: string, event: RecordingEvent): Promise<unknown>;
}

/** Everything the controller takes from the browser, so tests can give it fakes. */
export interface RecordingEnv {
  now(): number;
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  /** Is the page visible? Null when the browser cannot say. */
  visible(): boolean;
  onVisibility(listener: () => void): () => void;
  wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> };
  vibrate?: (pattern: number | number[]) => boolean;
  /** Called inside the Start tap, because browsers only allow sound after a tap. */
  prepareSound?: () => void;
  beep?: () => void;
}

export interface WakeLockLike {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface RecordingSettings {
  wakeLock: boolean;
  haptics: boolean;
  sound: boolean;
  plan: EmergencyPlan;
}

export type SaveState = 'saved' | 'saving' | 'failing';
export type WakeLockState = 'off' | 'active' | 'unsupported' | 'denied';

export interface RecordingSnapshot {
  session: RecordingSession | null;
  view: RecordingView | null;
  /** 'failing' means a save did not go through: the recording carries on in memory and the save is retried. */
  save: SaveState;
  wakeLock: WakeLockState;
  /** iPhone Safari has no vibration API; the setting says so instead of doing nothing. */
  vibration: 'supported' | 'unsupported';
}

const TICK_MS = 250;
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 8000;
const TAP_BUZZ = 25;
const ALERT_BUZZ = [200, 100, 200, 100, 400];

export class RecordingController {
  private session: RecordingSession | null = null;
  private pending: { seizureId: string; event: RecordingEvent }[] = [];
  private flushing: Promise<void> | null = null;
  private retryDelay = RETRY_MIN_MS;
  private retryTimer: unknown = null;
  private ticker: unknown = null;
  private unwatch: (() => void) | null = null;
  private lastAlert: RecordingState = 'recording';
  private lock: WakeLockLike | null = null;
  private lockState: WakeLockState = 'off';
  private save: SaveState = 'saved';
  private listeners = new Set<() => void>();
  private snapshot: RecordingSnapshot;
  private readonly alertHandlers = new Set<(state: RecordingState) => void>();

  constructor(
    private transport: RecordingTransport,
    private readonly env: RecordingEnv,
    private settings: RecordingSettings,
  ) {
    this.snapshot = this.build();
  }

  // ---- reading

  /** The time the controller reads (the real clock, or a test's). */
  now = (): number => this.env.now();

  getSnapshot = (): RecordingSnapshot => this.snapshot;

  /** For `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called when the emergency state rises: 'warning' (a minute before), 'alert' (the red screen) or 'auto_stop'. */
  onAlert(handler: (state: RecordingState) => void): () => void {
    this.alertHandlers.add(handler);
    return () => this.alertHandlers.delete(handler);
  }

  // ---- changing

  setTransport(transport: RecordingTransport): void {
    this.transport = transport;
  }

  setSettings(settings: RecordingSettings): void {
    this.settings = settings;
    if (this.session?.status === 'running') {
      if (settings.wakeLock) void this.acquireWakeLock();
      else void this.releaseWakeLock();
    }
    this.publish(true);
  }

  /** Tap Start. Shows at once; saving follows. Returns the id of the new seizure. */
  start(args: { patientId: string; recordedBy: 'self' | 'carer'; timeZone: string }): string {
    const seizureId = newId();
    this.env.prepareSound?.(); // must happen inside the tap
    this.session = null;
    this.lastAlert = 'recording';
    this.dispatch({ kind: 'start', id: newId(), at: this.env.now(), seizureId, ...args });
    this.begin();
    return seizureId;
  }

  /** A recording found again after the app was closed, or one started on the PIN screen: carry on with it. */
  adopt(session: RecordingSession): void {
    this.session = session;
    this.lastAlert = deriveRecording(session, this.env.now(), this.settings.plan).alert;
    this.begin();
    this.publish(true);
  }

  /** One tap on a recording button. `late` marks a time typed in afterwards. */
  tap(kind: 'end_aura' | 'end_seizure' | 'back_to_normal', options: { late?: boolean; at?: number } = {}): void {
    this.dispatch({
      kind,
      id: newId(),
      at: options.at ?? this.env.now(),
      ...(options.late ? { late: true } : {}),
    });
  }

  finish(): void {
    this.dispatch({ kind: 'finish', id: newId(), at: this.env.now() });
  }

  cancel(): void {
    this.dispatch({ kind: 'cancel', id: newId(), at: this.env.now() });
  }

  quickNote(label: string): void {
    this.dispatch({ kind: 'quick_note', id: newId(), at: this.env.now(), label });
  }

  symptom(code: string, phase: 'before' | 'during' | 'after'): void {
    this.dispatch({ kind: 'symptom', id: newId(), at: this.env.now(), code, phase });
  }

  /** After a recording has ended and been saved: forget it, ready for the next. A recording still running is left alone. */
  clear(): void {
    if (this.session?.status === 'running') return;
    this.session = null;
    this.lastAlert = 'recording';
    this.publish(true);
  }

  /** Stops the clock and the wake lock. Anything not yet saved keeps being retried until it is. */
  dispose(): void {
    this.stopTicker();
    void this.releaseWakeLock();
    if (this.retryTimer !== null) this.env.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.listeners.clear();
    this.alertHandlers.clear();
  }

  // ---- inside

  private dispatch(event: RecordingEvent): void {
    const next = reduceRecording(this.session, event);
    if (!next || next === this.session) return;
    this.session = next;
    this.pending.push({ seizureId: next.seizureId, event });
    this.buzz(TAP_BUZZ);
    void this.flush();
    if (next.status !== 'running') this.end();
    this.tick();
    this.publish(true);
  }

  private begin(): void {
    if (this.session?.status !== 'running') return;
    if (this.ticker === null) this.ticker = this.env.setInterval(() => this.tick(), TICK_MS);
    this.unwatch ??= this.env.onVisibility(() => {
      this.tick();
      if (this.env.visible() && this.session?.status === 'running' && this.settings.wakeLock)
        void this.acquireWakeLock(); // the browser lets go of the wake lock when the page is hidden
    });
    if (this.settings.wakeLock) void this.acquireWakeLock();
    this.tick();
  }

  private end(): void {
    this.stopTicker();
    void this.releaseWakeLock();
  }

  private stopTicker(): void {
    if (this.ticker !== null) this.env.clearInterval(this.ticker);
    this.ticker = null;
    this.unwatch?.();
    this.unwatch = null;
  }

  /** The clock. Everything shown comes from `now - start`, so a slow or hidden page cannot drift. */
  private tick(): void {
    const session = this.session;
    if (!session || session.status !== 'running') return;
    const view = deriveRecording(session, this.env.now(), this.settings.plan);
    if (view.alert !== this.lastAlert) {
      this.lastAlert = view.alert;
      if (view.alert !== 'recording') this.raise(view.alert);
    }
    if (view.autoStopDue) {
      // The 12-minute rule: stop at the minute it was due, not at the minute the page noticed
      this.dispatch({ kind: 'auto_stop', id: newId(), at: autoStopAt(session) });
      return;
    }
    this.publish(false);
  }

  private raise(state: RecordingState): void {
    if (state === 'alert' || state === 'auto_stop') {
      this.buzz(ALERT_BUZZ);
      if (this.settings.sound) this.env.beep?.();
    } else this.buzz(TAP_BUZZ * 2);
    for (const handler of this.alertHandlers) handler(state);
  }

  private buzz(pattern: number | number[]): void {
    if (this.settings.haptics) this.env.vibrate?.(pattern);
  }

  // ---- saving

  private flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    const run = this.saveAll().finally(() => {
      this.flushing = null;
    });
    this.flushing = run;
    return run;
  }

  private async saveAll(): Promise<void> {
    this.save = 'saving';
    for (let next = this.pending[0]; next; next = this.pending[0]) {
      try {
        await this.transport.send(next.seizureId, next.event);
      } catch {
        this.save = 'failing';
        this.publish(true);
        this.scheduleRetry();
        return;
      }
      this.pending.shift();
      this.retryDelay = RETRY_MIN_MS;
    }
    this.save = 'saved';
    this.publish(true);
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    this.retryTimer = this.env.setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
  }

  /** Resolves when everything tapped so far has been saved (or has failed and is waiting to retry). */
  async settled(): Promise<void> {
    while (this.flushing) await this.flushing;
  }

  // ---- wake lock

  private async acquireWakeLock(): Promise<void> {
    if (!this.env.wakeLock) {
      this.lockState = 'unsupported';
      return this.publish(true);
    }
    if (this.lock) return;
    try {
      const lock = await this.env.wakeLock.request('screen');
      this.lock = lock;
      this.lockState = 'active';
      lock.addEventListener('release', () => {
        if (this.lock === lock) {
          this.lock = null;
          this.lockState = 'off';
          this.publish(true);
        }
      });
    } catch {
      this.lockState = 'denied';
    }
    this.publish(true);
  }

  private async releaseWakeLock(): Promise<void> {
    const lock = this.lock;
    this.lock = null;
    if (this.lockState === 'active' || this.lockState === 'off') this.lockState = 'off';
    await lock?.release().catch(() => undefined);
    this.publish(true);
  }

  // ---- publishing

  private build(): RecordingSnapshot {
    const session = this.session;
    return {
      session,
      view: session ? deriveRecording(session, this.env.now(), this.settings.plan) : null,
      save: this.save,
      wakeLock: this.lockState,
      vibration: this.env.vibrate ? 'supported' : 'unsupported',
    };
  }

  /** Tells the screen. A tick that changes nothing visible (the same second) does not. */
  private publish(force: boolean): void {
    const next = this.build();
    const before = this.snapshot;
    const same =
      !force &&
      before.session === next.session &&
      before.view?.elapsedSec === next.view?.elapsedSec &&
      before.view?.stageSec === next.view?.stageSec &&
      before.view?.alert === next.view?.alert;
    if (same) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

/** The real browser. Each part is left out when the browser does not have it. */
export function browserRecordingEnv(): RecordingEnv {
  const nav = globalThis.navigator as Navigator & { wakeLock?: RecordingEnv['wakeLock'] };
  let audio: AudioContext | null = null;
  return {
    now: () => Date.now(),
    setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
    clearInterval: (handle) => globalThis.clearInterval(handle as number),
    setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
    visible: () => globalThis.document?.visibilityState !== 'hidden',
    onVisibility: (listener) => {
      globalThis.document?.addEventListener('visibilitychange', listener);
      return () => globalThis.document?.removeEventListener('visibilitychange', listener);
    },
    ...(nav?.wakeLock ? { wakeLock: nav.wakeLock } : {}),
    ...(typeof nav?.vibrate === 'function' ? { vibrate: (pattern: number | number[]) => nav.vibrate(pattern) } : {}),
    prepareSound: () => {
      try {
        audio ??= new AudioContext();
        void audio.resume();
      } catch {
        audio = null; // no sound on this browser
      }
    },
    beep: () => {
      if (!audio) return;
      const start = audio.currentTime;
      for (let i = 0; i < 3; i++) {
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, start + i * 0.35);
        gain.gain.setValueAtTime(0, start + i * 0.35 + 0.2);
        tone.connect(gain).connect(audio.destination);
        tone.start(start + i * 0.35);
        tone.stop(start + i * 0.35 + 0.25);
      }
    },
  };
}

export const defaultRecordingSettings = (): RecordingSettings => ({
  wakeLock: true,
  haptics: true,
  sound: false,
  plan: emergencyPlan(),
});
