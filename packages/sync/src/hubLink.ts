import { clearHub, hubOf, removeDevice, setHub, type HouseholdState } from './membership';
import { HubCallError, hubEnrol, hubRevoke, hubRotate, hubSetup } from './hubClient';
import { randomBytes, sha256Hex, toB64 } from './seal';
import { loadHousehold, type DeviceIdentity, type StoreLike } from './storeContext';

// Connecting a household to its hub. The address and the join key are part of the household (every device learns them the
// way it learns of a new device); the token is this device's own and stays on it. A removed device is cut off at the hub, and
// the join key is changed so it cannot enrol again.

/** What this device keeps about the hub: its token, where it is from, and removals the hub has not heard of yet. */
export interface HubLocal {
  url: string;
  token: string;
  pendingRevokes: string[];
}
export interface HubLocalStore {
  load(): Promise<HubLocal | null>;
  save(value: HubLocal | null): Promise<void>;
}
export interface HubLinkDeps {
  api: StoreLike;
  who: DeviceIdentity;
  local: HubLocalStore;
  now(): number;
  fetch?: typeof fetch;
}

export type HubLinkResult = 'ok' | 'unreachable' | 'wrong_code' | 'not_a_hub' | 'no_household' | 'not_allowed';

const newJoinKey = () => toB64(randomBytes(32));
const fail = (e: unknown): HubLinkResult => {
  if (e instanceof HubCallError) {
    if (e.status === 0) return 'unreachable';
    if (e.code === 'wrong_admin_code') return 'wrong_code';
    if (e.status === 401 || e.status === 403) return 'not_allowed';
  }
  return 'not_a_hub';
};
const deviceName = (state: HouseholdState, id: string) => state.membership.devices[id]?.name ?? 'Device';

/** The first device sets the hub up for the household with the code the hub shows, and the household learns where it is. */
export async function connectHub(deps: HubLinkDeps, args: { url: string; adminCode: string }): Promise<HubLinkResult> {
  const state = await loadHousehold(deps.api);
  if (!state) return 'no_household';
  const url = args.url.trim().replace(/\/+$/, '');
  const joinKey = newJoinKey();
  try {
    const { token } = await hubSetup(
      url,
      {
        adminCode: args.adminCode,
        deviceId: deps.who.deviceId,
        name: deviceName(state, deps.who.deviceId),
        joinKeyHash: await sha256Hex(joinKey),
      },
      deps.fetch,
    );
    await deps.local.save({ url, token, pendingRevokes: [] });
    await deps.api.saveHouseholdState({ state: setHub(state, { url, joinKey }, deps.now()) });
    return 'ok';
  } catch (e) {
    return fail(e);
  }
}

/** A device that learned of the hub from the household enrols itself with the join key. Does nothing if it has a token already. */
export async function ensureEnrolled(deps: HubLinkDeps): Promise<'enrolled' | 'ready' | 'none' | HubLinkResult> {
  const state = await loadHousehold(deps.api);
  const hub = state ? hubOf(state.membership) : null;
  if (!state || !hub) return 'none';
  const have = await deps.local.load();
  if (have && have.url === hub.url) return 'ready';
  try {
    const { token } = await hubEnrol(
      hub.url,
      { deviceId: deps.who.deviceId, name: deviceName(state, deps.who.deviceId), joinKey: hub.joinKey },
      deps.fetch,
    );
    await deps.local.save({ url: hub.url, token, pendingRevokes: [] });
    return 'enrolled';
  } catch (e) {
    return fail(e);
  }
}

/** Switches the hub off for the household. Devices keep meeting each other as before. */
export async function disconnectHub(deps: HubLinkDeps): Promise<void> {
  const state = await loadHousehold(deps.api);
  if (state) await deps.api.saveHouseholdState({ state: clearHub(state, deps.now()) });
  await deps.local.save(null);
}

/** Removes a device from the household and queues cutting it off at the hub (done now if the hub answers, else next time). */
export async function removeDeviceWithHub(deps: HubLinkDeps, deviceId: string): Promise<HubLinkResult> {
  const state = await loadHousehold(deps.api);
  if (!state) return 'no_household';
  await deps.api.saveHouseholdState({ state: removeDevice(state, deviceId, deps.now()) });
  const local = await deps.local.load();
  if (!local) return 'ok';
  await deps.local.save({ ...local, pendingRevokes: [...new Set([...local.pendingRevokes, deviceId])] });
  return finishPending(deps);
}

/** Cuts off the devices queued for removal and changes the join key so none of them can enrol again. */
export async function finishPending(deps: HubLinkDeps): Promise<HubLinkResult> {
  const local = await deps.local.load();
  const state = await loadHousehold(deps.api);
  const hub = state ? hubOf(state.membership) : null;
  if (!local || !state || !hub || local.pendingRevokes.length === 0) return 'ok';
  const conn = { url: local.url, token: local.token, ...(deps.fetch ? { fetch: deps.fetch } : {}) };
  try {
    for (const id of local.pendingRevokes) await hubRevoke(conn, id);
    const joinKey = newJoinKey();
    await hubRotate(conn, await sha256Hex(joinKey));
    await deps.api.saveHouseholdState({ state: setHub(state, { url: hub.url, joinKey }, deps.now()) });
    await deps.local.save({ ...local, pendingRevokes: [] });
    return 'ok';
  } catch (e) {
    return fail(e);
  }
}

/** The two store calls the token store needs. */
export interface HubLocalApi {
  hubLocal(): Promise<unknown>;
  saveHubLocal(arg: { value: unknown }): Promise<void>;
  deviceKeys(): Promise<unknown>;
  saveDeviceKeys(arg: { value: unknown }): Promise<void>;
}

/** The token store on top of a device's store. */
export const hubLocalOf = (api: {
  hubLocal(): Promise<unknown>;
  saveHubLocal(arg: { value: unknown }): Promise<void>;
}): HubLocalStore => ({
  load: async () => {
    const v = (await api.hubLocal()) as HubLocal | null;
    return v && typeof v.url === 'string' && typeof v.token === 'string'
      ? { ...v, pendingRevokes: v.pendingRevokes ?? [] }
      : null;
  },
  save: (value) => api.saveHubLocal({ value }),
});

/** The key store on top of a device's store. */
export const deviceKeysOf = (api: {
  deviceKeys(): Promise<unknown>;
  saveDeviceKeys(arg: { value: unknown }): Promise<void>;
}): import('./hub').DeviceKeyStore => ({
  load: async () => {
    const v = (await api.deviceKeys()) as import('./hub').DeviceKeyData | null;
    return v && v.pair && typeof v.pair.pub === 'string' ? { pair: v.pair, sent: v.sent ?? {} } : null;
  },
  save: (value) => api.saveDeviceKeys({ value }),
});
