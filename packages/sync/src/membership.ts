import { randomId, newKey, newestKey, type KeyEntry } from './seal';

// Who is in the household, and which keys they hold. Both merge the same way whatever order devices meet in:
// a union, where a removal is final, and the newest edit of a name or a list of followed patients wins.

export interface DeviceInfo {
  readonly id: string;
  readonly name: string;
  readonly addedAt: number;
  /** The device that invited it (null for the first). */
  readonly addedBy: string | null;
  /** When it was removed. Final. */
  readonly removedAt: number | null;
  /** Patients this device keeps a copy of, when it does not follow everyone. */
  readonly follows: readonly string[];
  /** Follows every patient in the household, including ones added later. */
  readonly followAll: boolean;
  /** When `name` and `follows` were last set (ms), the newest wins. */
  readonly infoAt: number;
}

export interface Membership {
  readonly householdId: string;
  readonly name: string;
  readonly devices: Readonly<Record<string, DeviceInfo>>;
  /** The patients of the household (random ids only, nothing about them), so a device can learn of a new one. */
  readonly patients: Readonly<Record<string, number>>;
}

export interface Keyring {
  /** Every household key ever held: old ones still open old messages. */
  readonly household: readonly KeyEntry[];
  /** Household keys that no longer prove membership (replaced after a device was removed). */
  readonly revoked: readonly string[];
  readonly patients: Readonly<Record<string, readonly KeyEntry[]>>;
}

export interface HouseholdState {
  readonly membership: Membership;
  readonly keyring: Keyring;
  /** When each device was last met: a device id to the time of the last finished exchange. */
  readonly lastMet: Readonly<Record<string, number>>;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeDevice(a: DeviceInfo, b: DeviceInfo): DeviceInfo {
  const info = a.infoAt !== b.infoAt ? (a.infoAt > b.infoAt ? a : b) : JSON.stringify(a) >= JSON.stringify(b) ? a : b;
  const removedAt =
    a.removedAt === null ? b.removedAt : b.removedAt === null ? a.removedAt : Math.min(a.removedAt, b.removedAt);
  const older = a.addedAt <= b.addedAt ? a : b;
  return { ...info, addedAt: older.addedAt, addedBy: older.addedBy, removedAt };
}

export function mergeMembership(a: Membership, b: Membership): Membership {
  if (a.householdId !== b.householdId) return a;
  const devices: Record<string, DeviceInfo> = { ...a.devices };
  for (const [id, info] of Object.entries(b.devices)) {
    const mine = devices[id];
    devices[id] = mine ? mergeDevice(mine, info) : info;
  }
  return { householdId: a.householdId, name: a.name, devices, patients: { ...b.patients, ...a.patients } };
}

/** The patients a device keeps a copy of. */
export function effectiveFollows(m: Membership, deviceId: string): string[] {
  const d = m.devices[deviceId];
  if (!d) return [];
  return d.followAll ? Object.keys(m.patients).sort() : [...d.follows].filter((p) => p in m.patients).sort();
}

const mergeKeys = (a: readonly KeyEntry[], b: readonly KeyEntry[]): KeyEntry[] => {
  const byId = new Map<string, KeyEntry>();
  for (const k of [...a, ...b]) byId.set(k.id, k);
  return [...byId.values()].sort((x, y) => x.createdAt - y.createdAt || (x.id < y.id ? -1 : 1));
};

export function mergeKeyring(a: Keyring, b: Keyring): Keyring {
  const patients: Record<string, KeyEntry[]> = {};
  for (const id of new Set([...Object.keys(a.patients), ...Object.keys(b.patients)]))
    patients[id] = mergeKeys(a.patients[id] ?? [], b.patients[id] ?? []);
  return {
    household: mergeKeys(a.household, b.household),
    revoked: [...new Set([...a.revoked, ...b.revoked])].sort(),
    patients,
  };
}

export const hasChanged = (a: HouseholdState, b: HouseholdState): boolean => !sameJson(a, b);

/** A device in the household that has not been removed. */
export const isActive = (m: Membership, deviceId: string): boolean => {
  const d = m.devices[deviceId];
  return d !== undefined && d.removedAt === null;
};

export const activeDevices = (m: Membership): DeviceInfo[] =>
  Object.values(m.devices)
    .filter((d) => d.removedAt === null)
    .sort((x, y) => x.addedAt - y.addedAt || (x.id < y.id ? -1 : 1));

/** Household keys that may still prove membership. */
export const liveHouseholdKeys = (k: Keyring): KeyEntry[] => k.household.filter((e) => !k.revoked.includes(e.id));

/** The first device makes the household: its key, and a key for each patient it holds. */
export function createHousehold(args: {
  householdId: string;
  name: string;
  deviceId: string;
  deviceName: string;
  patientIds: readonly string[];
  now: number;
}): HouseholdState {
  const device: DeviceInfo = {
    id: args.deviceId,
    name: args.deviceName,
    addedAt: args.now,
    addedBy: null,
    removedAt: null,
    follows: [],
    followAll: true,
    infoAt: args.now,
  };
  const patients: Record<string, KeyEntry[]> = {};
  for (const id of args.patientIds) patients[id] = [newKey(args.now)];
  return {
    membership: {
      householdId: args.householdId,
      name: args.name,
      devices: { [args.deviceId]: device },
      patients: Object.fromEntries(args.patientIds.map((id) => [id, args.now])),
    },
    keyring: { household: [newKey(args.now)], revoked: [], patients },
    lastMet: {},
  };
}

/** A new patient: listed in the household, with a key. */
export function addPatient(state: HouseholdState, patientId: string, now: number): HouseholdState {
  const listed: HouseholdState =
    state.membership.patients[patientId] !== undefined
      ? state
      : { ...state, membership: { ...state.membership, patients: { ...state.membership.patients, [patientId]: now } } };
  return ensurePatientKey(listed, patientId, now);
}

/** Makes sure a key exists for a patient this device follows. */
export function ensurePatientKey(state: HouseholdState, patientId: string, now: number): HouseholdState {
  if ((state.keyring.patients[patientId] ?? []).length > 0) return state;
  return {
    ...state,
    keyring: { ...state.keyring, patients: { ...state.keyring.patients, [patientId]: [newKey(now)] } },
  };
}

export function addDevice(
  state: HouseholdState,
  args: { deviceId: string; name: string; addedBy: string; now: number },
): HouseholdState {
  const device: DeviceInfo = {
    id: args.deviceId,
    name: args.name,
    addedAt: args.now,
    addedBy: args.addedBy,
    removedAt: null,
    follows: [],
    followAll: true,
    infoAt: args.now,
  };
  return {
    ...state,
    membership: { ...state.membership, devices: { ...state.membership.devices, [args.deviceId]: device } },
  };
}

export function updateDevice(
  state: HouseholdState,
  deviceId: string,
  patch: { name?: string; follows?: readonly string[]; followAll?: boolean },
  now: number,
): HouseholdState {
  const d = state.membership.devices[deviceId];
  if (!d) return state;
  const next: DeviceInfo = {
    ...d,
    name: patch.name ?? d.name,
    follows: patch.follows ?? d.follows,
    followAll: patch.followAll ?? d.followAll,
    infoAt: Math.max(now, d.infoAt + 1),
  };
  return { ...state, membership: { ...state.membership, devices: { ...state.membership.devices, [deviceId]: next } } };
}

/**
 * Removes a device and replaces the keys it held for what comes next: a new household key, the old ones no longer prove
 * membership, and a new key for every patient. What the removed device already has, it keeps; the screen says so.
 */
export function removeDevice(state: HouseholdState, deviceId: string, now: number): HouseholdState {
  const d = state.membership.devices[deviceId];
  if (!d || d.removedAt !== null) return state;
  const oldIds = state.keyring.household.map((k) => k.id);
  const patients: Record<string, KeyEntry[]> = {};
  for (const [id, keys] of Object.entries(state.keyring.patients))
    patients[id] = [...keys, newKey(Math.max(now, (newestKey(keys)?.createdAt ?? 0) + 1))];
  const fresh = newKey(Math.max(now, (newestKey(state.keyring.household)?.createdAt ?? 0) + 1));
  return {
    ...state,
    membership: {
      ...state.membership,
      devices: { ...state.membership.devices, [deviceId]: { ...d, removedAt: now } },
    },
    keyring: {
      household: [...state.keyring.household, fresh],
      revoked: [...new Set([...state.keyring.revoked, ...oldIds])].sort(),
      patients,
    },
  };
}

export const newDeviceId = randomId;
