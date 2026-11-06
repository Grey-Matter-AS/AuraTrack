import { createStoreApi, TEST_PIN_KDF, type StoreApi } from '@auratrack/store';
import { memoryPipe } from './memory';
import { newInvite, runInviter, runJoiner } from './pairing';
import { runSession, type SessionReport } from './session';
import { loadHousehold, startHousehold, storeContext } from './storeContext';

// Real stores (encrypted, in memory) made into household devices, for tests of this package and of the app. Needs
// `fake-indexeddb/auto` imported by the test. Made-up data only.

let counter = 0;
export interface Device {
  api: StoreApi;
  who: { householdId: string; deviceId: string };
}

export async function newDevice(now?: () => number): Promise<Device> {
  const { api } = createStoreApi({
    name: `household-${Date.now()}-${counter++}`,
    options: { pinKdf: TEST_PIN_KDF, ...(now ? { now } : {}) },
  });
  const info = await api.create({ credential: { pin: '2468' } });
  return { api, who: { householdId: info.householdId, deviceId: info.deviceId } };
}

export async function firstDevice(patientId: string, now?: () => number): Promise<Device> {
  const d = await newDevice(now);
  await d.api.createRecord({
    type: 'patient',
    values: {
      id: patientId,
      patientId,
      name: 'Alex',
      dateOfBirth: null,
      emergencyContact: '',
      emergencyPhone: '',
      color: '#336699',
    },
  });
  await startHousehold(d.api, d.who, { name: 'Home', deviceName: 'Kitchen', patientIds: [patientId], now: Date.now() });
  return d;
}

/** The real pairing between an existing device and a new, empty one. */
export async function join(inviter: Device, name: string, follows?: string[], now?: () => number): Promise<Device> {
  const joiner = await newDevice(now);
  const invite = newInvite(Date.now());
  const [x, y] = memoryPipe();
  const state = await loadHousehold(inviter.api);
  if (!state) throw new Error('the inviting device is not in a household');
  const [a, b] = await Promise.all([
    runInviter(x, {
      secret: invite.secret,
      expiresAt: invite.expiresAt,
      state,
      inviterId: inviter.who.deviceId,
      ...(follows ? { follows } : {}),
      now: Date.now,
      confirm: async () => true,
      save: (s) => inviter.api.saveHouseholdState({ state: s }),
      timeoutMs: 3000,
    }),
    runJoiner(y, {
      secret: invite.secret,
      deviceId: joiner.who.deviceId,
      deviceName: name,
      now: Date.now,
      confirm: async () => true,
      timeoutMs: 3000,
    }),
  ]);
  if (a.outcome !== 'joined' || b.outcome !== 'joined' || !b.state)
    throw new Error(`pairing failed: ${a.outcome} ${b.outcome}`);
  const info = await joiner.api.adoptHousehold({ householdId: b.state.membership.householdId });
  joiner.who.householdId = info.householdId;
  await joiner.api.saveHouseholdState({ state: b.state });
  return joiner;
}

export async function meet(a: Device, b: Device): Promise<[SessionReport, SessionReport]> {
  const [x, y] = memoryPipe();
  return Promise.all([
    runSession(x, storeContext(a.api, a.who), { timeoutMs: 3000 }),
    runSession(y, storeContext(b.api, b.who), { timeoutMs: 3000 }),
  ]);
}
