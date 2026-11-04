import {
  deviceKeysOf,
  ensureEnrolled,
  finishPending,
  hubLocalOf,
  hubOf,
  httpHubApi,
  loadHousehold,
  storeContext,
  syncWithHub,
  type HubLocalApi,
  type StoreLike,
} from '@auratrack/sync';

// Keeps this device in step with the household's hub, if it has one: a round when the app opens, every minute, a moment after
// something was saved, and when the hub says something new arrived. A round that fails changes nothing; the next one tries
// again. Recording never waits for any of it: a round is not started while a recording runs.

export type HubState = 'off' | 'idle' | 'syncing' | 'unreachable' | 'not_allowed';
export interface HubSnapshot {
  state: HubState;
  url: string | null;
  lastAt: number | null;
  /** What the last round took in. */
  lastApplied: number;
  /** Changes at the hub this device cannot open yet (their key arrives when it meets another device). */
  unreadable: number;
}

export interface HubSyncDeps {
  api: StoreLike & HubLocalApi;
  who: { householdId: string; deviceId: string };
  now(): number;
  isBusy(): boolean;
  fetch?: typeof fetch;
  /** Opens the hub's "something new arrived" connection; returns how to close it. */
  openEvents?: (url: string, token: string, onEvent: () => void) => { close(): void };
  onApplied?(applied: number): void;
  onRemoved?(): void;
  onChange?(): void;
}

const EVERY_MS = 60_000;
const NUDGE_MS = 1_500;

function defaultEvents(url: string, token: string, onEvent: () => void): { close(): void } {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const open = () => {
    if (closed || typeof WebSocket === 'undefined') return;
    try {
      socket = new WebSocket(`${url.replace(/^http/, 'ws')}/v1/events?token=${encodeURIComponent(token)}`);
    } catch {
      return;
    }
    socket.onmessage = () => onEvent();
    socket.onclose = () => {
      if (!closed) retry = setTimeout(open, 20_000);
    };
    socket.onerror = () => socket?.close();
  };
  open();
  return {
    close: () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    },
  };
}

export class HubSync {
  private snap: HubSnapshot = { state: 'off', url: null, lastAt: null, lastApplied: 0, unreadable: 0 };
  private readonly subs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private events: { close(): void } | null = null;
  private eventsFor = '';
  private running = false;
  private stopped = false;

  constructor(private readonly deps: HubSyncDeps) {}

  snapshot = (): HubSnapshot => this.snap;
  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  private set(patch: Partial<HubSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.subs) fn();
    this.deps.onChange?.();
  }

  start(): void {
    this.stopped = false;
    if (!this.timer) this.timer = setInterval(() => void this.round(), EVERY_MS);
    void this.round();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.timer = null;
    this.nudgeTimer = null;
    this.events?.close();
    this.events = null;
    this.eventsFor = '';
  }

  /** Something was saved or the hub said something arrived: a round soon, not at once, so a burst is one round. */
  nudge(): void {
    if (this.stopped || this.nudgeTimer) return;
    this.nudgeTimer = setTimeout(() => {
      this.nudgeTimer = null;
      void this.round();
    }, NUDGE_MS);
  }

  async round(): Promise<void> {
    if (this.stopped || this.running || this.deps.isBusy()) return;
    this.running = true;
    try {
      const state = await loadHousehold(this.deps.api);
      const hub = state ? hubOf(state.membership) : null;
      if (!hub) {
        this.events?.close();
        this.events = null;
        this.eventsFor = '';
        if (this.snap.state !== 'off') this.set({ state: 'off', url: null });
        return;
      }
      const link = {
        api: this.deps.api,
        who: this.deps.who,
        local: hubLocalOf(this.deps.api),
        now: this.deps.now,
        ...(this.deps.fetch ? { fetch: this.deps.fetch } : {}),
      };
      this.set({ state: 'syncing', url: hub.url });
      const enrolled = await ensureEnrolled(link);
      if (enrolled === 'unreachable') return void this.set({ state: 'unreachable' });
      if (enrolled === 'not_allowed' || enrolled === 'wrong_code' || enrolled === 'not_a_hub')
        return void this.set({ state: 'not_allowed' });
      const local = await link.local.load();
      if (!local) return void this.set({ state: 'unreachable' });
      await finishPending(link).catch(() => undefined);
      const api = httpHubApi({
        url: local.url,
        token: local.token,
        ...(this.deps.fetch ? { fetch: this.deps.fetch } : {}),
      });
      const report = await syncWithHub(api, storeContext(this.deps.api, this.deps.who, this.deps.now), {
        keys: deviceKeysOf(this.deps.api),
      });
      if (report.outcome === 'removed') {
        this.deps.onRemoved?.();
        return void this.set({ state: 'off' });
      }
      if (report.outcome === 'error') {
        const unauthorised = /unauthorised/.test(report.reason ?? '');
        return void this.set({ state: unauthorised ? 'not_allowed' : 'unreachable' });
      }
      this.set({ state: 'idle', lastAt: this.deps.now(), lastApplied: report.applied, unreadable: report.unreadable });
      if (report.applied > 0) this.deps.onApplied?.(report.applied);
      this.watch(local.url, local.token);
    } catch {
      this.set({ state: 'unreachable' });
    } finally {
      this.running = false;
    }
  }

  private watch(url: string, token: string): void {
    const key = `${url}|${token}`;
    if (this.eventsFor === key || this.stopped) return;
    this.events?.close();
    this.eventsFor = key;
    this.events = (this.deps.openEvents ?? defaultEvents)(url, token, () => this.nudge());
  }
}
