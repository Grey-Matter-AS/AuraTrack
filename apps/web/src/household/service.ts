import {
  activeDevices,
  hubOf,
  isActive,
  loadHousehold,
  newestKey,
  runSession,
  storeContext,
  type HouseholdState,
  type HubConfig,
  type HubLocalApi,
  type SessionReport,
  type StoreLike,
} from '@auratrack/sync';
import { HubSync, type HubSnapshot } from './hubSync';
import { dayNumber, peerIdFor, peerIdsToTry, type Listener, type PeerTransport } from './transport';

// Keeps this device reachable while the app is open, and looks for the household's other devices when it opens (for about
// a minute), when asked, and for a few minutes after something was saved. One meeting at a time. Never while a recording
// runs: the recording screen does no network work, and a device that connects then is turned away and tries again later.

export const LOOK_MS = 60_000;
export const LINGER_MS = 5 * 60_000;
const TICK_MS = 8_000;
const CONNECT_MS = 6_000;
const RETRY_MS = 20_000;

export type ServiceStatus = 'off' | 'idle' | 'looking' | 'syncing';
export interface MeetingNote {
  at: number;
  peerId: string | null;
  peerName: string;
  outcome: SessionReport['outcome'];
  /** Came through the hub, not from a device. */
  via?: 'hub';
  applied: number;
  sent: number;
  rejected: number;
  reason: string | null;
}
export interface ServiceSnapshot {
  status: ServiceStatus;
  household: HouseholdState | null;
  last: MeetingNote | null;
  /** This device was removed from the household. */
  removed: boolean;
  /** This device is reachable by the others (the broker answered). */
  listening: boolean;
  /** The household's hub, if it has one. */
  hub: HubSnapshot;
}

export interface ServiceDeps {
  api: StoreLike & HubLocalApi;
  who: { householdId: string; deviceId: string };
  /** How devices find each other: one transport, or one for each hub setting (the hub runs the signalling when there is one). */
  transport: PeerTransport | ((hub: HubConfig | null) => PeerTransport);
  fetch?: typeof fetch;
  openEvents?: (url: string, token: string, onEvent: () => void) => { close(): void };
  now(): number;
  /** True while a recording runs. */
  isBusy(): boolean;
  /** A meeting took in changes. */
  onApplied?(note: MeetingNote): void;
  setTimer?: typeof setInterval;
}

export class HouseholdService {
  private snap: ServiceSnapshot = {
    status: 'off',
    household: null,
    last: null,
    removed: false,
    listening: false,
    hub: { state: 'off', url: null, lastAt: null, lastApplied: 0, unreadable: 0 },
  };
  private readonly hubSync: HubSync;
  private listenKey = '';
  private readonly subs = new Set<() => void>();
  private listener: Listener | null = null;
  private listenDay = -1;
  private started = false;
  private running = false;
  private lookUntil = 0;
  private met = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private retryAt = 0;
  /** When each device was last tried, so one that is away is not asked every few seconds. */
  private tried = new Map<string, number>();

  constructor(private readonly deps: ServiceDeps) {
    this.hubSync = new HubSync({
      api: deps.api,
      who: deps.who,
      now: deps.now,
      isBusy: deps.isBusy,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      ...(deps.openEvents ? { openEvents: deps.openEvents } : {}),
      onApplied: (applied) =>
        deps.onApplied?.({
          at: deps.now(),
          peerId: null,
          peerName: '',
          via: 'hub',
          outcome: 'done',
          applied,
          sent: 0,
          rejected: 0,
          reason: null,
        }),
      onRemoved: () => {
        this.set({ removed: true });
        this.stop();
      },
    });
    this.hubSync.subscribe(() => this.set({ hub: this.hubSync.snapshot() }));
  }

  private transportFor(household: HouseholdState): PeerTransport {
    const t = this.deps.transport;
    return typeof t === 'function' ? t(hubOf(household.membership)) : t;
  }

  snapshot = (): ServiceSnapshot => this.snap;
  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  private set(patch: Partial<ServiceSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.subs) fn();
  }

  /** Reads the household from the store (after it changed) and makes sure the service follows it. */
  async refresh(): Promise<void> {
    const household = await loadHousehold(this.deps.api);
    this.set({
      household,
      status: household ? (this.running ? 'syncing' : this.snap.status === 'off' ? 'idle' : this.snap.status) : 'off',
    });
    if (household && this.started) void this.hubSync.round();
    if (household && !this.started && !this.snap.removed) await this.start();
    if (!household && this.started) this.stop();
  }

  async start(): Promise<void> {
    if (this.started) return;
    const household = await loadHousehold(this.deps.api);
    this.set({ household });
    if (!household || this.snap.removed) return;
    this.started = true;
    this.set({ status: 'idle' });
    this.lookUntil = this.deps.now() + LOOK_MS;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.hubSync.start();
    void this.tick();
  }

  stop(): void {
    this.started = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.hubSync.stop();
    this.listener?.close();
    this.listener = null;
    this.listenDay = -1;
    this.set({ status: 'off', listening: false });
  }

  /** Look for the other devices now, for a minute. */
  searchNow(): void {
    void this.hubSync.round();
    this.met = new Set();
    this.tried = new Map();
    this.lookUntil = this.deps.now() + LOOK_MS;
    void this.tick();
  }

  /** After something was saved: stay reachable and look again for a few minutes, so the others get it soon. */
  extend(): void {
    this.hubSync.nudge();
    this.met = new Set();
    this.tried = new Map();
    this.lookUntil = Math.max(this.lookUntil, this.deps.now() + LINGER_MS);
  }

  private async ensureListening(household: HouseholdState): Promise<void> {
    const key = household.keyring.household[0];
    if (!key) return;
    const day = dayNumber(this.deps.now());
    const where = `${day}|${hubOf(household.membership)?.url ?? ''}`;
    if (this.listener && this.listenKey === where) return;
    if (!this.listener && this.deps.now() < this.retryAt) return;
    this.listener?.close();
    this.listener = null;
    try {
      const id = await peerIdFor(key, this.deps.who.deviceId, day);
      this.listener = await this.transportFor(household).listen(id, (channel) => void this.incoming(channel));
      this.listenDay = day;
      this.listenKey = where;
      this.set({ listening: true });
    } catch {
      this.set({ listening: false });
      this.retryAt = this.deps.now() + 20_000;
    }
  }

  private async incoming(
    channel: Parameters<PeerTransport['listen']>[1] extends (c: infer C) => void ? C : never,
  ): Promise<void> {
    if (this.running || this.deps.isBusy() || !this.started) {
      try {
        channel.send(JSON.stringify({ t: 'bye', reason: 'busy' }));
      } catch {
        /* gone */
      }
      channel.close();
      return;
    }
    await this.meet(channel);
  }

  private async meet(
    channel: Parameters<PeerTransport['listen']>[1] extends (c: infer C) => void ? C : never,
  ): Promise<void> {
    this.running = true;
    this.set({ status: 'syncing' });
    try {
      const report = await runSession(channel, storeContext(this.deps.api, this.deps.who, this.deps.now), {
        timeoutMs: 30_000,
      });
      await this.finish(report);
    } finally {
      this.running = false;
      const household = await loadHousehold(this.deps.api).catch(() => null);
      this.set({ household, status: this.started ? (this.deps.now() < this.lookUntil ? 'looking' : 'idle') : 'off' });
    }
  }

  private async finish(report: SessionReport): Promise<void> {
    const household = await loadHousehold(this.deps.api);
    const peer = report.peerDeviceId ? household?.membership.devices[report.peerDeviceId] : undefined;
    const note: MeetingNote = {
      at: this.deps.now(),
      peerId: report.peerDeviceId,
      peerName: peer?.name ?? '',
      outcome: report.outcome,
      applied: report.applied,
      sent: report.sent,
      rejected: report.rejected,
      reason: report.reason ?? null,
    };
    if (report.outcome === 'done' && report.peerDeviceId) this.met.add(report.peerDeviceId);
    if (report.outcome === 'removed' || (household && !isActive(household.membership, this.deps.who.deviceId))) {
      this.set({ last: note, removed: true });
      this.stop();
      return;
    }
    this.set({ last: note });
    this.hubSync.nudge(); // what was learned may include the hub, or news for it
    if (report.applied > 0) this.deps.onApplied?.(note);
  }

  private async tick(): Promise<void> {
    if (!this.started) return;
    const household = await loadHousehold(this.deps.api).catch(() => null);
    if (!household) return;
    this.set({ household });
    await this.ensureListening(household);
    if (this.running || this.deps.isBusy()) return;
    const now = this.deps.now();
    if (now >= this.lookUntil) {
      if (this.snap.status === 'looking') this.set({ status: 'idle' });
      return;
    }
    const others = activeDevices(household.membership).filter((d) => d.id !== this.deps.who.deviceId);
    const todo = others.filter((d) => !this.met.has(d.id) && now - (this.tried.get(d.id) ?? 0) >= RETRY_MS);
    if (todo.length === 0) {
      if (this.snap.status === 'looking') this.set({ status: 'idle' });
      return;
    }
    this.set({ status: 'looking' });
    const key = newestKey(household.keyring.household.slice(0, 1));
    if (!key) return;
    for (const device of todo) {
      if (this.running || !this.started) return;
      this.tried.set(device.id, now);
      for (const id of await peerIdsToTry(key, device.id, now)) {
        let channel;
        try {
          channel = await this.transportFor(household).connect(id, CONNECT_MS);
        } catch {
          continue;
        }
        await this.meet(channel);
        break;
      }
    }
  }
}
