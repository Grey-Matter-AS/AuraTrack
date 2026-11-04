import type { ChangeLogEntry } from '@auratrack/model';
import {
  effectiveFollows,
  isActive,
  mergeKeyring,
  mergeMembership,
  type HouseholdState,
  type Keyring,
  type Membership,
} from './membership';
import { differingDays, digests, idsOnDays, missingOnTheirSide, type IndexItem } from './reconcile';
import { newestKey, openJson, randomId, sealJson, SealError, type KeyEntry } from './seal';

// One meeting between two household devices. Both sides run the same steps, so it does not matter who opened the
// connection: say hello, prove they hold the household key, swap the list of devices, swap the keys each is entitled to,
// compare day digests, list ids on the days that differ, then send the entries the other lacks. Every step is idempotent
// and merging never loses anything, so a dropped connection costs only time: the next meeting continues from the facts.

export const HOUSEHOLD_SCOPE = 'household';

/** Something that carries text both ways. A WebRTC data channel, or two ends of a test pipe. */
export interface Channel {
  send(text: string): void;
  /** Called with each text received. */
  onMessage(listener: (text: string) => void): void;
  /** Called once when the other end or the network is gone. */
  onClose(listener: () => void): void;
  close(): void;
}

/** What a session needs from this device. The app gives it the store; tests give it the same through a real store. */
export interface SyncContext {
  readonly deviceId: string;
  readonly householdId: string;
  state(): Promise<HouseholdState>;
  saveState(state: HouseholdState): Promise<void>;
  /** Entry ids and stamps of one scope: 'household' (no patient) or a patient id. */
  index(scope: string): Promise<IndexItem[]>;
  entries(ids: readonly string[]): Promise<ChangeLogEntry[]>;
  apply(entries: readonly ChangeLogEntry[]): Promise<{ applied: number; duplicates: number; rejected: number }>;
  now(): number;
}

export interface SessionOptions {
  /** How long to wait for the other side's next message. */
  timeoutMs?: number;
  /** Largest message, in characters, for a batch of entries. */
  batchChars?: number;
}

export type SessionOutcome = 'done' | 'refused' | 'removed' | 'error';
export interface SessionReport {
  outcome: SessionOutcome;
  reason?: string;
  peerDeviceId: string | null;
  /** Entries this device took in. */
  applied: number;
  duplicates: number;
  rejected: number;
  /** Entries sent to the other device. */
  sent: number;
  scopes: string[];
}

const MAX_MESSAGE = 2_000_000;
const MAX_ID_LIST = 200_000;

class Stop extends Error {
  constructor(
    readonly outcome: SessionOutcome,
    readonly reason: string,
    /** What to tell the other side before hanging up. */
    readonly tell: string | null = null,
  ) {
    super(reason);
  }
}

type Msg = { t: string; [key: string]: unknown };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export async function runSession(
  channel: Channel,
  ctx: SyncContext,
  options: SessionOptions = {},
): Promise<SessionReport> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const batchChars = options.batchChars ?? 48_000;
  const report: SessionReport = {
    outcome: 'done',
    peerDeviceId: null,
    applied: 0,
    duplicates: 0,
    rejected: 0,
    sent: 0,
    scopes: [],
  };

  const queue: Msg[] = [];
  let waiting: {
    type: string | string[];
    resolve: (m: Msg) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  let closed = false;
  const settle = () => {
    if (!waiting) return;
    const types = Array.isArray(waiting.type) ? waiting.type : [waiting.type];
    const index = queue.findIndex((m) => types.includes(m.t) || m.t === 'bye');
    if (index === -1) return;
    const [message] = queue.splice(index, 1) as [Msg];
    const w = waiting;
    waiting = null;
    clearTimeout(w.timer);
    if (message.t === 'bye')
      w.reject(new Stop(message.reason === 'removed' ? 'removed' : 'refused', String(message.reason ?? 'refused')));
    else w.resolve(message);
  };
  channel.onMessage((text) => {
    if (text.length > MAX_MESSAGE) return;
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed) && typeof parsed.t === 'string') queue.push(parsed as Msg);
    } catch {
      return; // not for us
    }
    settle();
  });
  channel.onClose(() => {
    closed = true;
    if (waiting) {
      const w = waiting;
      waiting = null;
      clearTimeout(w.timer);
      w.reject(new Stop('error', 'the connection closed'));
    }
  });
  const send = (message: Msg) => {
    if (closed) {
      // The other side may have said why it hung up just before it did
      const said = queue.find((m) => m.t === 'bye');
      if (said) throw new Stop(said.reason === 'removed' ? 'removed' : 'refused', String(said.reason ?? 'refused'));
      throw new Stop('error', 'the connection closed');
    }
    channel.send(JSON.stringify(message));
  };
  const next = (type: string | string[]): Promise<Msg> =>
    new Promise((resolve, reject) => {
      const types = Array.isArray(type) ? type : [type];
      if (closed && !queue.some((m) => types.includes(m.t) || m.t === 'bye'))
        return reject(new Stop('error', 'the connection closed'));
      const timer = setTimeout(() => {
        waiting = null;
        reject(new Stop('error', `no answer to ${types.join(' or ')}`));
      }, timeoutMs);
      waiting = { type, resolve, reject, timer };
      settle();
    });

  const bye = (reason: string) => {
    try {
      channel.send(JSON.stringify({ t: 'bye', reason }));
    } catch {
      /* already gone */
    }
  };

  try {
    let state = await ctx.state();
    if (state.membership.householdId !== ctx.householdId) throw new Stop('refused', 'no household');
    if (!isActive(state.membership, ctx.deviceId)) throw new Stop('removed', 'removed');

    // 1. hello: who, and which household keys each holds (ids only)
    const nonce = randomId();
    send({
      t: 'hello',
      v: 1,
      hid: ctx.householdId,
      did: ctx.deviceId,
      nonce,
      held: state.keyring.household.map((k) => k.id),
    });
    const hello = await next('hello');
    if (hello.v !== 1) throw new Stop('refused', 'a different version of the protocol');
    if (hello.hid !== ctx.householdId) throw new Stop('refused', 'another household');
    const peerId = typeof hello.did === 'string' ? hello.did : '';
    if (peerId === '' || peerId === ctx.deviceId) throw new Stop('refused', 'not another device');
    report.peerDeviceId = peerId;
    const peerNonce = typeof hello.nonce === 'string' ? hello.nonce : '';
    const peerHeld = new Set(strings(hello.held));

    // 2. the key both can open: the newest household key in both lists
    const common = state.keyring.household.filter((k) => peerHeld.has(k.id));
    const session = newestKey(common);
    if (!session) throw new Stop('refused', 'no common key');
    const dir = (from: string, to: string) => `${from}>${to}`;

    // 3. proof: the other side must show it holds the key, answering this very meeting (the nonces)
    send({
      t: 'auth',
      p: await sealJson(
        session,
        { did: ctx.deviceId, mine: nonce, yours: peerNonce, key: session.id },
        `auth:${dir(ctx.deviceId, peerId)}`,
      ),
    });
    const auth = await next('auth');
    let proof: unknown;
    try {
      proof = await openJson([session], String(auth.p), `auth:${dir(peerId, ctx.deviceId)}`);
    } catch {
      throw new Stop('refused', 'could not prove it is in this household');
    }
    if (!isRecord(proof) || proof.did !== peerId || proof.mine !== peerNonce || proof.yours !== nonce)
      throw new Stop('refused', 'could not prove it is in this household');
    // A removed device is refused. A key that was replaced still counts for a device that is a member of record: it may not
    // have heard about the new key yet, and this meeting is how it hears.
    const known = state.membership.devices[peerId];
    if (known && known.removedAt !== null) throw new Stop('refused', 'removed device', 'removed');
    if (state.keyring.revoked.includes(session.id) && !known) throw new Stop('refused', 'an old key');

    // 4. the lists of devices
    send({ t: 'members', p: await sealJson(session, state.membership, 'members') });
    const members = await next('members');
    const theirMembership = (await openJson([session], String(members.p), 'members')) as Membership;
    if (!isRecord(theirMembership) || theirMembership.householdId !== ctx.householdId)
      throw new Stop('refused', 'not the same household');
    state = { ...state, membership: mergeMembership(state.membership, theirMembership) };
    if (!isActive(state.membership, ctx.deviceId)) {
      await ctx.saveState(state);
      bye('removed');
      throw new Stop('removed', 'removed');
    }
    const peer = state.membership.devices[peerId];
    if (!peer || peer.removedAt !== null) {
      await ctx.saveState(state);
      throw new Stop('refused', 'removed device', 'removed');
    }

    // 5. the keys each is entitled to: all household keys, and the key of each patient the other follows
    const myFollows = effectiveFollows(state.membership, ctx.deviceId);
    const peerFollows = effectiveFollows(state.membership, peerId);
    const grant: Keyring = {
      household: state.keyring.household,
      revoked: state.keyring.revoked,
      patients: Object.fromEntries(
        peerFollows
          .filter((p) => (state.keyring.patients[p] ?? []).length > 0)
          .map((p) => [p, state.keyring.patients[p] as KeyEntry[]]),
      ),
    };
    send({ t: 'keys', p: await sealJson(session, grant, 'keys') });
    const keysMsg = await next('keys');
    const theirGrant = (await openJson([session], String(keysMsg.p), 'keys')) as Keyring;
    if (isRecord(theirGrant)) {
      const received: Keyring = {
        household: Array.isArray(theirGrant.household) ? theirGrant.household : [],
        revoked: strings(theirGrant.revoked),
        patients: isRecord(theirGrant.patients) ? (theirGrant.patients as Record<string, KeyEntry[]>) : {},
      };
      // Only keys for patients this device follows are kept
      const wanted = new Set(myFollows);
      const patients = Object.fromEntries(Object.entries(received.patients).filter(([id]) => wanted.has(id)));
      state = { ...state, keyring: mergeKeyring(state.keyring, { ...received, patients }) };
    }
    state = { ...state, lastMet: { ...state.lastMet, [peerId]: ctx.now() } };
    await ctx.saveState(state);

    // 6. what to compare: the household's own records, and each patient both follow (and this device has a key for)
    const shared = myFollows.filter((p) => peerFollows.includes(p) && (state.keyring.patients[p] ?? []).length > 0);
    const scopes = [HOUSEHOLD_SCOPE, ...shared];
    report.scopes = scopes;
    const keyFor = (scope: string): KeyEntry => {
      const keys = scope === HOUSEHOLD_SCOPE ? state.keyring.household : (state.keyring.patients[scope] ?? []);
      const key = newestKey(keys);
      if (!key) throw new Stop('error', 'no key for a patient');
      return key;
    };
    const keysOf = (scope: string): KeyEntry[] =>
      scope === HOUSEHOLD_SCOPE ? [...state.keyring.household] : [...(state.keyring.patients[scope] ?? [])];

    const index = new Map<string, IndexItem[]>();
    const summary: Record<string, Record<string, string>> = {};
    for (const scope of scopes) {
      const items = await ctx.index(scope);
      index.set(scope, items);
      summary[scope] = await digests(items);
    }
    send({ t: 'summary', p: await sealJson(session, { scopes, summary }, 'summary') });
    const theirSummaryMsg = await next('summary');
    const their = (await openJson([session], String(theirSummaryMsg.p), 'summary')) as {
      summary?: Record<string, Record<string, string>>;
    };
    const theirSummary =
      isRecord(their) && isRecord(their.summary) ? (their.summary as Record<string, Record<string, string>>) : {};

    // 7. the ids on the days that differ
    const days: Record<string, string[]> = {};
    const idsOut: Record<string, Record<string, string[]>> = {};
    for (const scope of scopes) {
      const theirs = theirSummary[scope];
      if (!theirs) continue;
      days[scope] = differingDays(summary[scope] ?? {}, theirs);
      idsOut[scope] = idsOnDays(index.get(scope) ?? [], days[scope]);
    }
    send({ t: 'ids', p: await sealJson(session, idsOut, 'ids') });
    const idsMsg = await next('ids');
    const theirIds = (await openJson([session], String(idsMsg.p), 'ids')) as Record<string, Record<string, string[]>>;

    // 8. send what the other side lacks
    const toSend: { scope: string; ids: string[] }[] = [];
    for (const scope of scopes) {
      const theirList =
        isRecord(theirIds) && isRecord(theirIds[scope]) ? (theirIds[scope] as Record<string, string[]>) : null;
      if (!theirList || !idsOut[scope]) continue;
      const total = Object.values(theirList).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
      if (total > MAX_ID_LIST) throw new Stop('refused', 'too many ids');
      const clean: Record<string, string[]> = {};
      for (const [day, list] of Object.entries(theirList)) clean[day] = strings(list);
      const missing = missingOnTheirSide(idsOut[scope] as Record<string, string[]>, clean);
      if (missing.length > 0) toSend.push({ scope, ids: missing });
    }
    for (const { scope, ids } of toSend) {
      for (let at = 0; at < ids.length;) {
        const batch: ChangeLogEntry[] = [];
        let chars = 0;
        while (at < ids.length && (batch.length === 0 || chars < batchChars)) {
          const chunk = await ctx.entries(ids.slice(at, at + 25));
          at += 25;
          for (const entry of chunk) {
            batch.push(entry);
            chars += JSON.stringify(entry).length;
          }
        }
        send({ t: 'entries', scope, p: await sealJson(keyFor(scope), batch, `entries:${scope}`) });
        report.sent += batch.length;
      }
    }
    send({ t: 'done' });

    // 9. take in what the other side sends, until it says it is done
    for (;;) {
      const message = await next(['entries', 'done']);
      if (message.t === 'done') break;
      const scope = typeof message.scope === 'string' ? message.scope : '';
      if (!scopes.includes(scope)) {
        report.rejected++;
        continue;
      }
      let batch: unknown;
      try {
        batch = await openJson(keysOf(scope), String(message.p), `entries:${scope}`);
      } catch (error) {
        if (error instanceof SealError) {
          report.rejected++;
          continue;
        }
        throw error;
      }
      const wanted: ChangeLogEntry[] = [];
      for (const entry of Array.isArray(batch) ? (batch as ChangeLogEntry[]) : []) {
        const belongs =
          isRecord(entry) &&
          entry.householdId === ctx.householdId &&
          (scope === HOUSEHOLD_SCOPE ? entry.patientId === null : entry.patientId === scope);
        if (belongs) wanted.push(entry);
        else report.rejected++;
      }
      const result = await ctx.apply(wanted);
      report.applied += result.applied;
      report.duplicates += result.duplicates;
      report.rejected += result.rejected;
    }
    return report;
  } catch (error) {
    if (error instanceof Stop) {
      if (error.tell) bye(error.tell);
      return { ...report, outcome: error.outcome, reason: error.reason };
    }
    return { ...report, outcome: 'error', reason: error instanceof Error ? error.message : 'unknown' };
  } finally {
    channel.close();
  }
}
