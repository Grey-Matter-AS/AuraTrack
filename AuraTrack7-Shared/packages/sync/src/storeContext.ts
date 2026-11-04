import type { ChangeLogEntry } from '@auratrack/model';
import { addPatient, createHousehold, type HouseholdState } from './membership';
import type { SyncContext } from './session';

// The meeting protocol on top of a device's store. `StoreLike` is the part of the store's API that sync needs; the app
// passes the worker client, the tests pass the real store directly.

export interface StoreLike {
  syncIndex(arg: { scope: string }): Promise<{ id: string; stamp: string }[]>;
  syncEntries(arg: { ids: string[] }): Promise<ChangeLogEntry[]>;
  applySynced(arg: { entries: ChangeLogEntry[] }): Promise<{ applied: number; duplicates: number; rejected: number }>;
  householdState(): Promise<unknown>;
  saveHouseholdState(arg: { state: unknown }): Promise<void>;
}

export interface DeviceIdentity {
  householdId: string;
  deviceId: string;
}

export async function loadHousehold(api: StoreLike): Promise<HouseholdState | null> {
  const state = (await api.householdState()) as HouseholdState | null;
  return state && state.membership && state.keyring ? state : null;
}

export function storeContext(api: StoreLike, who: DeviceIdentity, now: () => number = Date.now): SyncContext {
  return {
    deviceId: who.deviceId,
    householdId: who.householdId,
    state: async () => {
      const state = await loadHousehold(api);
      if (!state) throw new Error('This device is not in a household');
      return state;
    },
    saveState: (state) => api.saveHouseholdState({ state }),
    index: (scope) => api.syncIndex({ scope }),
    entries: (ids) => api.syncEntries({ ids: [...ids] }),
    apply: (entries) => api.applySynced({ entries: [...entries] }),
    now,
  };
}

/** The first device makes the household, with the patients it has now. */
export async function startHousehold(
  api: StoreLike,
  who: DeviceIdentity,
  args: { name: string; deviceName: string; patientIds: readonly string[]; now: number },
): Promise<HouseholdState> {
  const existing = await loadHousehold(api);
  if (existing) return existing;
  const state = createHousehold({ householdId: who.householdId, deviceId: who.deviceId, ...args });
  await api.saveHouseholdState({ state });
  return state;
}

/** After a patient is made on this device: list them in the household and make their key. Does nothing without a household. */
export async function registerPatient(api: StoreLike, patientId: string, now: number): Promise<boolean> {
  const state = await loadHousehold(api);
  if (!state || state.membership.patients[patientId] !== undefined) return false;
  await api.saveHouseholdState({ state: addPatient(state, patientId, now) });
  return true;
}
