import type { ChangeLogEntry } from '@auratrack/model';
import {
  effectiveFollows,
  hasChanged,
  isActive,
  mergeKeyring,
  mergeMembership,
  updateDevice,
  type HouseholdState,
  type Keyring,
  type Membership,
} from './membership';
import { generateDeviceKeyPair, openWith, sealTo, type DeviceKeyPair } from './ecies';
import { differingDays, digests, idsOnDays, missingOnTheirSide } from './reconcile';
import { NoKeyError, newestKey, openJson, sealJson, sha256Hex, type KeyEntry } from './seal';
import { HOUSEHOLD_SCOPE, type SyncContext } from './session';

// The device side of sync through the hub. The hub keeps sealed entries and cannot read them: each entry is sealed here with
// the key of its scope, and opened here. The hub also keeps, for each device, a sealed note of the device list and the household
// keys (never the keys of any person), so a device that was away learns who was removed and which key replaced the old one.

export interface SealedEntry {
  id: string;
  scope: string;
  stamp: string;
  sealed: string;
}

/** What a device may ask of the hub. The app does it with `fetch`; tests do it with the hub in the same process. */
export interface HubApi {
  summary(scopes: string[]): Promise<Record<string, Record<string, string>>>;
  ids(scope: string, days: string[]): Promise<Record<string, string[]>>;
  put(entries: SealedEntry[]): Promise<{ stored: number; duplicates: number }>;
  get(ids: string[]): Promise<SealedEntry[]>;
  putState(sealed: string): Promise<void>;
  states(): Promise<{ deviceId: string; at: number; sealed: string }[]>;
  /** Mail sealed to one device's own key (a key for a person). */
  mailPut(to: string, sealed: string): Promise<void>;
  inbox(): Promise<{ id: number; from: string; at: number; sealed: string }[]>;
  ack(ids: number[]): Promise<void>;
}

export interface HubReport {
  outcome: 'done' | 'removed' | 'error';
  reason?: string;
  pushed: number;
  applied: number;
  duplicates: number;
  rejected: number;
  /** Entries sealed with a key this device does not have yet (it arrives when devices meet); they are kept at the hub. */
  unreadable: number;
  scopes: string[];
}

const STATE_AAD = 'hub:state';
const batchOf = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

interface HubNote {
  membership: Membership;
  keyring: Pick<Keyring, 'household' | 'revoked'>;
  /** The ids (not the keys) of the person keys this device holds, so others know what to send it. */
  held?: Record<string, string[]>;
}

/** What a device keeps to itself for key delivery: its key pair, and what it has already sent to whom. */
export interface DeviceKeyData {
  pair: DeviceKeyPair;
  /** `device|person` to a sum of the key ids last sent and when, so the same keys are not sent every round. */
  sent: Record<string, { h: string; at: number }>;
}
export interface DeviceKeyStore {
  load(): Promise<DeviceKeyData | null>;
  save(data: DeviceKeyData): Promise<void>;
}

const RESEND_MS = 24 * 3_600_000;
const GRANT_AAD = (from: string, to: string) => `grant:${from}>${to}`;
const validKey = (k: unknown): k is KeyEntry =>
  typeof k === 'object' &&
  k !== null &&
  typeof (k as KeyEntry).id === 'string' &&
  typeof (k as KeyEntry).raw === 'string' &&
  (k as KeyEntry).raw.length >= 40 &&
  (k as KeyEntry).raw.length <= 50 &&
  typeof (k as KeyEntry).createdAt === 'number';

/**
 * Posts this device's note and takes in the others', so the device list and household keys are as new as any device's. With
 * a key store, it also delivers person keys: a key for a person is sealed to the one device that keeps that person and left in
 * its mailbox at the hub, and keys addressed to this device are opened and kept. The hub and the other devices only carry them.
 */
export async function syncState(
  hub: HubApi,
  ctx: SyncContext,
  keys?: DeviceKeyStore,
): Promise<{ state: HouseholdState; changed: boolean }> {
  let state = await ctx.state();
  const before = state;
  let data = keys ? await keys.load() : null;
  if (keys && !data) {
    data = { pair: await generateDeviceKeyPair(), sent: {} };
    await keys.save(data);
  }
  // Publish this device's public key in the device list
  if (data && state.membership.devices[ctx.deviceId]?.pub !== data.pair.pub)
    state = updateDevice(state, ctx.deviceId, { pub: data.pair.pub }, ctx.now());

  const first = state.keyring.household[0];
  if (first) {
    const held = Object.fromEntries(
      Object.entries(state.keyring.patients).map(([p, list]) => [p, list.map((k) => k.id)]),
    );
    const note: HubNote = {
      membership: state.membership,
      keyring: { household: state.keyring.household, revoked: state.keyring.revoked },
      held,
    };
    await hub.putState(await sealJson(first, note, STATE_AAD));
  }
  const heldBy = new Map<string, Record<string, string[]>>();
  for (const { deviceId, sealed } of await hub.states()) {
    if (deviceId === ctx.deviceId) continue;
    let note: unknown;
    try {
      note = await openJson(state.keyring.household, sealed, STATE_AAD);
    } catch {
      continue; // sealed with a key this device does not hold
    }
    const n = note as Partial<HubNote>;
    if (!n.membership || n.membership.householdId !== ctx.householdId || !n.keyring) continue;
    if (n.held) heldBy.set(deviceId, n.held);
    state = {
      ...state,
      membership: mergeMembership(state.membership, n.membership),
      keyring: mergeKeyring(state.keyring, {
        household: n.keyring.household ?? [],
        revoked: n.keyring.revoked ?? [],
        patients: {},
      }),
    };
  }

  if (data && keys && isActive(state.membership, ctx.deviceId)) {
    // Keys addressed to this device
    const mail = await hub.inbox();
    const done: number[] = [];
    for (const item of mail) {
      done.push(item.id);
      const sender = state.membership.devices[item.from];
      if (!sender || sender.removedAt !== null) continue;
      try {
        const grant = JSON.parse(await openWith(data.pair, item.sealed, GRANT_AAD(item.from, ctx.deviceId))) as {
          patientId?: unknown;
          keys?: unknown;
        };
        const mine = effectiveFollows(state.membership, ctx.deviceId);
        if (typeof grant.patientId !== 'string' || !mine.includes(grant.patientId) || !Array.isArray(grant.keys))
          continue;
        const good = grant.keys.filter(validKey);
        if (good.length === 0) continue;
        state = {
          ...state,
          keyring: mergeKeyring(state.keyring, { household: [], revoked: [], patients: { [grant.patientId]: good } }),
        };
      } catch {
        // not for this device, damaged, or not what it should be: dropped
      }
    }
    // Keys this device holds that another device keeps and lacks
    for (const device of Object.values(state.membership.devices)) {
      if (device.id === ctx.deviceId || device.removedAt !== null || !device.pub) continue;
      const theirHeld = heldBy.get(device.id);
      if (!theirHeld) continue; // has not said what it holds yet
      for (const person of effectiveFollows(state.membership, device.id)) {
        const mine = state.keyring.patients[person] ?? [];
        const missing = mine.filter((k) => !(theirHeld[person] ?? []).includes(k.id));
        if (missing.length === 0) continue;
        const label = `${device.id}|${person}`;
        const sum = await sha256Hex(
          missing
            .map((k) => k.id)
            .sort()
            .join(','),
        );
        const was = data.sent[label];
        if (was && was.h === sum && ctx.now() - was.at < RESEND_MS) continue;
        const sealed = await sealTo(
          device.pub,
          JSON.stringify({ patientId: person, keys: missing }),
          GRANT_AAD(ctx.deviceId, device.id),
        );
        await hub.mailPut(device.id, sealed);
        data.sent[label] = { h: sum, at: ctx.now() };
      }
    }
    await keys.save(data);
    const changedNow = hasChanged(before, state);
    if (changedNow) await ctx.saveState(state);
    if (done.length > 0) await hub.ack(done); // after the keys are kept
    return { state, changed: changedNow };
  }

  const changed = hasChanged(before, state);
  if (changed) await ctx.saveState(state);
  return { state, changed };
}

/** One round with the hub: the household's note, then what each side lacks of the household's entries and of each person kept. */
export async function syncWithHub(
  hub: HubApi,
  ctx: SyncContext,
  options: { batch?: number; keys?: DeviceKeyStore } = {},
): Promise<HubReport> {
  const report: HubReport = {
    outcome: 'done',
    pushed: 0,
    applied: 0,
    duplicates: 0,
    rejected: 0,
    unreadable: 0,
    scopes: [],
  };
  try {
    const { state } = await syncState(hub, ctx, options.keys);
    if (!isActive(state.membership, ctx.deviceId)) return { ...report, outcome: 'removed' };
    const follows = effectiveFollows(state.membership, ctx.deviceId).filter(
      (p) => (state.keyring.patients[p] ?? []).length > 0,
    );
    const scopes = [HOUSEHOLD_SCOPE, ...follows];
    report.scopes = scopes;
    const keysOf = (scope: string): KeyEntry[] =>
      scope === HOUSEHOLD_SCOPE ? [...state.keyring.household] : [...(state.keyring.patients[scope] ?? [])];
    const theirSummary = await hub.summary(scopes);
    const batch = options.batch ?? 100;

    for (const scope of scopes) {
      const mine = await ctx.index(scope);
      const days = differingDays(await digests(mine), theirSummary[scope] ?? {});
      if (days.length === 0) continue;
      const myIds = idsOnDays(mine, days);
      const theirIds = await hub.ids(scope, days);

      // What the hub lacks: seal and send
      const toPush = missingOnTheirSide(myIds, theirIds);
      const key = newestKey(keysOf(scope));
      if (key)
        for (const ids of batchOf(toPush, batch)) {
          const entries = await ctx.entries(ids);
          const sealed: SealedEntry[] = [];
          for (const e of entries)
            sealed.push({ id: e.id, scope, stamp: e.stamp, sealed: await sealJson(key, e, `hub:${e.id}`) });
          const r = await hub.put(sealed);
          report.pushed += r.stored;
        }

      // What this device lacks: fetch, open and merge
      const toPull = missingOnTheirSide(theirIds, myIds);
      for (const ids of batchOf(toPull, batch)) {
        const wanted: ChangeLogEntry[] = [];
        for (const item of await hub.get(ids)) {
          try {
            const entry = (await openJson(keysOf(scope), item.sealed, `hub:${item.id}`)) as ChangeLogEntry;
            const belongs =
              entry &&
              entry.id === item.id &&
              entry.householdId === ctx.householdId &&
              (scope === HOUSEHOLD_SCOPE ? entry.patientId === null : entry.patientId === scope);
            if (belongs) wanted.push(entry);
            else report.rejected++;
          } catch (error) {
            if (error instanceof NoKeyError) report.unreadable++;
            else report.rejected++;
          }
        }
        const r = await ctx.apply(wanted);
        report.applied += r.applied;
        report.duplicates += r.duplicates;
        report.rejected += r.rejected;
      }
    }
    return report;
  } catch (error) {
    return { ...report, outcome: 'error', reason: error instanceof Error ? error.message : 'unknown' };
  }
}
