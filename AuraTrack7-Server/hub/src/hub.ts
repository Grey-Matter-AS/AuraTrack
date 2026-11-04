import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { backup } from 'node:sqlite';
import { dayOf, digests as digestsOf } from '@auratrack/sync';
import { HubDb, type DeviceRow } from './db';
import { newVapidKeys, sendPush, type VapidKeys } from './push';

// The hub as a class, so it can be tested without a network. It stores and forwards sealed entries and knows nothing it could
// read: no key, no field of a record. Devices prove who they are with a token; a removed device's token stops working at once.

type Args = Record<string, unknown>;

export const ALERT_EVENTS = ['started', 'alert', 'recorded'] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

export class HubError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'HubError';
  }
}

export const LIMITS = {
  entriesPerPut: 500,
  sealedChars: 200_000,
  idChars: 80,
  scopesPerCall: 200,
  daysPerCall: 2000,
  idsPerGet: 500,
  stateChars: 400_000,
  deviceNameChars: 80,
  mailChars: 30_000,
  mailPerDevice: 200,
  ackIds: 500,
  alertSealedChars: 2000,
  pushEndpointChars: 600,
} as const;

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const token = () => randomBytes(32).toString('base64url');
const text = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new HubError(400, `bad_${what}`);
  return v;
};

export interface HubOptions {
  now?: () => number;
  /** Where the daily copies of the database go. */
  backupDir?: string | null;
  keepBackups?: number;
  /** The address the push services may contact the hub operator at (an email as mailto:, or an https address). */
  pushSubject?: string;
  /** For tests: where push messages are sent, and whether any host is allowed instead of the real push services. */
  pushFetch?: typeof fetch;
  anyPushHost?: boolean;
}

export interface SealedEntry {
  id: string;
  scope: string;
  stamp: string;
  sealed: string;
}

export interface HubStatus {
  name: string;
  version: string;
  devices: { id: string; name: string; addedAt: number; lastSeen: number | null; revokedAt: number | null }[];
  entries: number;
  bytes: number;
  configured: boolean;
  lastBackupAt: number | null;
}

export class Hub {
  readonly db: HubDb;
  private readonly now: () => number;
  private readonly listeners = new Set<(event: { t: 'new'; scope: string; from: string; count: number }) => void>();
  constructor(
    path: string,
    private readonly options: HubOptions = {},
  ) {
    this.db = new HubDb(path);
    this.now = options.now ?? Date.now;
    if (!this.db.getMeta('vapid')) this.db.setMeta('vapid', JSON.stringify(newVapidKeys()));
    if (!this.db.getMeta('adminCode')) this.db.setMeta('adminCode', randomBytes(5).toString('hex').toUpperCase());
  }

  close(): void {
    this.db.close();
  }

  /** The code shown on the status page and in the tray, which the first device needs to set the hub up for a household. */
  adminCode(): string {
    return this.db.getMeta('adminCode') ?? '';
  }
  configured(): boolean {
    return this.db.getMeta('joinKeyHash') !== null;
  }

  /** The first device sets the hub up for its household: it proves it has the admin code and registers the join key's hash. */
  setup(args: Args): { token: string } {
    if (typeof args.adminCode !== 'string' || !same(args.adminCode.trim().toUpperCase(), this.adminCode()))
      throw new HubError(403, 'wrong_admin_code');
    const deviceId = text(args.deviceId, LIMITS.idChars, 'device');
    const name = text(args.name, LIMITS.deviceNameChars, 'name');
    const joinKeyHash = text(args.joinKeyHash, 100, 'join_key');
    this.db.setMeta('joinKeyHash', joinKeyHash);
    return { token: this.issue(deviceId, name) };
  }

  /** A device of the household enrols itself with the join key every device has in its household state. */
  enrol(args: Args): { token: string } {
    const hash = this.db.getMeta('joinKeyHash');
    if (!hash) throw new HubError(409, 'not_configured');
    if (typeof args.joinKey !== 'string' || !same(sha(args.joinKey), hash)) throw new HubError(403, 'wrong_join_key');
    const deviceId = text(args.deviceId, LIMITS.idChars, 'device');
    const existing = this.db.device(deviceId);
    if (existing?.revokedAt) throw new HubError(403, 'revoked');
    return { token: this.issue(deviceId, text(args.name, LIMITS.deviceNameChars, 'name')) };
  }

  private issue(deviceId: string, name: string): string {
    const value = token();
    this.db.addDevice({ id: deviceId, name, tokenHash: sha(value), addedAt: this.now() });
    return value;
  }

  /** Who is calling. A missing, wrong or revoked token is the same answer, so nothing is learned from it. */
  auth(tokenValue: string | null): DeviceRow {
    const device = tokenValue ? this.db.deviceByToken(sha(tokenValue)) : null;
    if (!device || device.revokedAt !== null) throw new HubError(401, 'unauthorised');
    this.db.touch(device.id, this.now());
    return device;
  }

  /** A new join key (after a device was removed), so the removed device cannot enrol again. */
  rotateJoinKey(device: DeviceRow, args: Args): void {
    this.db.setMeta('joinKeyHash', text(args.joinKeyHash, 100, 'join_key'));
    void device;
  }

  revoke(device: DeviceRow, args: Args): { revoked: boolean } {
    const id = text(args.deviceId, LIMITS.idChars, 'device');
    if (id === device.id) throw new HubError(400, 'not_yourself');
    this.db.dropState(id);
    this.db.dropMailOf(id);
    this.db.dropPush(id);
    return { revoked: this.db.revoke(id, this.now()) };
  }

  devices(): { id: string; name: string; addedAt: number; lastSeen: number | null; revoked: boolean }[] {
    return this.db.devices().map((d) => ({
      id: d.id,
      name: d.name,
      addedAt: d.addedAt,
      lastSeen: d.lastSeen,
      revoked: d.revokedAt !== null,
    }));
  }

  /** Digests of the days of each scope, the same sum a device makes, so a device sees what differs. */
  async summary(args: Args): Promise<Record<string, Record<string, string>>> {
    const scopes = this.list(args.scopes, LIMITS.scopesPerCall, 'scopes');
    const out: Record<string, Record<string, string>> = {};
    for (const scope of scopes) {
      const items = this.db
        .daysOf(scope)
        .flatMap((day) => this.db.idsOnDay(scope, day).map((id) => ({ id, stamp: stampOfDay(day) })));
      out[scope] = await digestsOf(items);
    }
    return out;
  }

  ids(args: Args): Record<string, string[]> {
    const scope = text(args.scope, LIMITS.idChars, 'scope');
    const days = this.list(args.days, LIMITS.daysPerCall, 'days');
    return Object.fromEntries(days.map((d) => [d, this.db.idsOnDay(scope, d)]));
  }

  put(device: DeviceRow, args: Args): { stored: number; duplicates: number } {
    if (!Array.isArray(args.entries) || args.entries.length > LIMITS.entriesPerPut)
      throw new HubError(400, 'bad_entries');
    let stored = 0;
    let duplicates = 0;
    const byScope = new Map<string, number>();
    for (const raw of args.entries as Record<string, unknown>[]) {
      const id = text(raw?.id, LIMITS.idChars, 'id');
      const scope = text(raw?.scope, LIMITS.idChars, 'scope');
      const stamp = text(raw?.stamp, 80, 'stamp');
      const sealed = text(raw?.sealed, LIMITS.sealedChars, 'sealed');
      if (!/^\d{15}-[0-9a-f]{5}-.+$/.test(stamp)) throw new HubError(400, 'bad_stamp');
      if (this.db.putEntry({ id, scope, stamp, day: dayOf(stamp), sealed })) {
        stored++;
        byScope.set(scope, (byScope.get(scope) ?? 0) + 1);
      } else duplicates++;
    }
    for (const [scope, count] of byScope)
      for (const fn of this.listeners) fn({ t: 'new', scope, from: device.id, count });
    return { stored, duplicates };
  }

  get(args: Args): { entries: SealedEntry[] } {
    const ids = this.list(args.ids, LIMITS.idsPerGet, 'ids');
    return { entries: this.db.entries(ids).map(({ id, scope, stamp, sealed }) => ({ id, scope, stamp, sealed })) };
  }

  /** What a device says about the household (its device list and household keys), sealed by that device. Latest per device. */
  putState(device: DeviceRow, args: Args): void {
    this.db.putState(device.id, this.now(), text(args.sealed, LIMITS.stateChars, 'state'));
  }
  states(): { deviceId: string; at: number; sealed: string }[] {
    return this.db.states();
  }

  /**
   * Leaves sealed mail for another device of the household (a key for a person, sealed to that device's own key). The hub cannot
   * open it and hands it only to the device it is addressed to.
   */
  mailPut(device: DeviceRow, args: Args): { ok: true } {
    const to = text(args.to, LIMITS.idChars, 'to');
    const sealed = text(args.sealed, LIMITS.mailChars, 'sealed');
    if (to === device.id) throw new HubError(400, 'not_yourself');
    const target = this.db.device(to);
    if (target?.revokedAt) throw new HubError(403, 'revoked');
    if (this.db.countMail(to) >= LIMITS.mailPerDevice) throw new HubError(429, 'mailbox_full');
    this.db.putMail(to, device.id, this.now(), sealed);
    return { ok: true };
  }
  inbox(device: DeviceRow): { mail: { id: number; from: string; at: number; sealed: string }[] } {
    return { mail: this.db.mailFor(device.id) };
  }
  ack(device: DeviceRow, args: Args): { removed: number } {
    if (!Array.isArray(args.ids) || args.ids.length > LIMITS.ackIds || !args.ids.every((x) => Number.isInteger(x)))
      throw new HubError(400, 'bad_ids');
    return { removed: this.db.dropMail(device.id, args.ids as number[]) };
  }

  // ---- Alerts (Web Push) ----

  private vapid(): VapidKeys {
    return JSON.parse(this.db.getMeta('vapid') ?? '{}') as VapidKeys;
  }
  /** The public key a browser subscribes with. */
  vapidKey(): { publicKey: string } {
    return { publicKey: this.vapid().publicKey };
  }

  /** Push services the hub will send to: the browser makers' own. A subscription anywhere else is refused (it could point the hub at this computer's network). */
  private pushHostAllowed(endpoint: URL): boolean {
    if (this.options.anyPushHost) return true;
    if (endpoint.protocol !== 'https:') return false;
    const h = endpoint.hostname;
    return (
      h === 'fcm.googleapis.com' ||
      h === 'android.googleapis.com' ||
      h === 'updates.push.services.mozilla.com' ||
      h.endsWith('.push.services.mozilla.com') ||
      h === 'web.push.apple.com' ||
      h.endsWith('.push.apple.com') ||
      h.endsWith('.notify.windows.com') ||
      (process.env.HUB_PUSH_HOSTS ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .includes(h)
    );
  }

  pushSubscribe(device: DeviceRow, args: Args): { ok: true } {
    const sub = args.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = text(sub?.endpoint, LIMITS.pushEndpointChars, 'endpoint');
    const p256dh = text(sub?.keys?.p256dh, 200, 'key');
    const auth = text(sub?.keys?.auth, 100, 'key');
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new HubError(400, 'bad_endpoint');
    }
    if (!this.pushHostAllowed(url)) throw new HubError(400, 'unknown_push_service');
    const prefs = (args.prefs ?? {}) as { events?: unknown; patients?: unknown };
    const events = Array.isArray(prefs.events)
      ? prefs.events.filter((e): e is AlertEvent => ALERT_EVENTS.includes(e as AlertEvent))
      : [...ALERT_EVENTS];
    const patients = Array.isArray(prefs.patients) ? this.list(prefs.patients, LIMITS.scopesPerCall, 'patients') : null;
    this.db.putPush(device.id, endpoint, p256dh, auth, JSON.stringify({ events, patients }), this.now());
    return { ok: true };
  }
  pushUnsubscribe(device: DeviceRow): { ok: true } {
    this.db.dropPush(device.id);
    return { ok: true };
  }

  /** One device says something happened to a person; every other device that asked to hear of it gets a push. Never blocks the sender. */
  async alert(device: DeviceRow, args: Args): Promise<{ sent: number; failed: number }> {
    const event = args.event as AlertEvent;
    if (!ALERT_EVENTS.includes(event)) throw new HubError(400, 'bad_event');
    const patientId = text(args.patientId, LIMITS.idChars, 'patient');
    const sealed = args.sealed === undefined ? null : text(args.sealed, LIMITS.alertSealedChars, 'sealed');
    const payload = Buffer.from(
      JSON.stringify({ v: 1, event, patientId, at: this.now(), ...(sealed ? { sealed } : {}) }),
    );
    const subject = this.options.pushSubject ?? process.env.HUB_PUSH_SUBJECT ?? 'mailto:hub@auratrack.invalid';
    const vapid = this.vapid();
    let sent = 0;
    let failed = 0;
    await Promise.all(
      this.db
        .pushes()
        .filter((s) => s.deviceId !== device.id)
        .filter((s) => {
          const prefs = JSON.parse(s.prefs) as { events: AlertEvent[]; patients: string[] | null };
          return prefs.events.includes(event) && (prefs.patients === null || prefs.patients.includes(patientId));
        })
        .map(async (s) => {
          const r = await sendPush(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            vapid,
            subject,
            {
              ttl: event === 'recorded' ? 3600 : 600,
              urgency: 'high',
              ...(this.options.pushFetch ? { fetch: this.options.pushFetch } : {}),
            },
          );
          if (r.gone) this.db.dropPush(s.deviceId);
          if (r.ok) sent++;
          else failed++;
        }),
    );
    return { sent, failed };
  }

  /** Tells whoever listens (the WebSocket layer) that entries arrived. */
  onNew(fn: (event: { t: 'new'; scope: string; from: string; count: number }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  status(version: string): HubStatus {
    return {
      name: 'AuraTrack Hub',
      version,
      devices: this.db
        .devices()
        .map((d) => ({ id: d.id, name: d.name, addedAt: d.addedAt, lastSeen: d.lastSeen, revokedAt: d.revokedAt })),
      entries: this.db.countEntries(),
      bytes: this.db.bytesStored(),
      configured: this.configured(),
      lastBackupAt: Number(this.db.getMeta('lastBackupAt')) || null,
    };
  }

  /** A copy of the database into the backup folder, named by day; the oldest are removed beyond `keepBackups`. The copy holds only sealed bytes. */
  async backupNow(): Promise<string | null> {
    const dir = this.options.backupDir;
    if (!dir) return null;
    mkdirSync(dir, { recursive: true });
    const d = new Date(this.now());
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const file = join(dir, `auratrack-hub-${day}.db`);
    await backup(this.db.sql, file);
    this.db.setMeta('lastBackupAt', String(this.now()));
    const keep = this.options.keepBackups ?? 14;
    const old = readdirSync(dir)
      .filter((f) => /^auratrack-hub-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort();
    for (const f of old.slice(0, Math.max(0, old.length - keep))) rmSync(join(dir, f), { force: true });
    return file;
  }

  private list(v: unknown, max: number, what: string): string[] {
    if (!Array.isArray(v) || v.length > max) throw new HubError(400, `bad_${what}`);
    return v.map((x) => text(x, LIMITS.idChars, what));
  }
}

/** A stamp on a given day, to make the digest group an id on that day. */
const stampOfDay = (day: string): string =>
  day === 'bad' ? 'x' : `${String(Number(day) * 86_400_000).padStart(15, '0')}-00000-hub`;
