import { describe, expect, it } from 'vitest';
import {
  activeDevices,
  addPatient,
  clearHub,
  effectiveFollows,
  hasChanged,
  hubOf,
  isActive,
  liveHouseholdKeys,
  mergeKeyring,
  mergeMembership,
  removeDevice,
  setHub,
  updateDevice,
  type DeviceInfo,
  type Membership,
} from './membership';
import { newKey } from './seal';
import { TestNode } from './testNode';

const node = () => TestNode.first('h', 'A', ['p1']);
const device = (over: Partial<DeviceInfo> = {}): DeviceInfo => ({
  id: 'D',
  name: 'Phone',
  addedAt: 10,
  addedBy: 'A',
  removedAt: null,
  follows: [],
  followAll: true,
  infoAt: 10,
  ...over,
});
const membership = (over: Partial<Membership> = {}): Membership => ({
  householdId: 'h',
  name: 'Home',
  devices: {},
  patients: {},
  ...over,
});

describe('merging two lists of devices', () => {
  it('keeps its own when the other is from another household', () => {
    const a = membership({ devices: { D: device() } });
    expect(mergeMembership(a, membership({ householdId: 'other' }))).toBe(a);
  });

  it('takes the newer details of a device, the earlier adding, and the earlier removal', () => {
    const a = membership({ devices: { D: device({ name: 'Old', infoAt: 5, addedAt: 3, addedBy: 'X' }) } });
    const b = membership({ devices: { D: device({ name: 'New', infoAt: 9, addedAt: 8, removedAt: 50 }) } });
    for (const merged of [mergeMembership(a, b), mergeMembership(b, a)]) {
      expect(merged.devices.D).toMatchObject({ name: 'New', addedAt: 3, addedBy: 'X', removedAt: 50 });
    }
    const both = mergeMembership(
      membership({ devices: { D: device({ removedAt: 70 }) } }),
      membership({ devices: { D: device({ removedAt: 60 }) } }),
    );
    expect(both.devices.D?.removedAt).toBe(60);
  });

  it('settles on the same details whichever way round when both changed at the same moment', () => {
    const a = membership({ devices: { D: device({ name: 'Alpha' }) } });
    const b = membership({ devices: { D: device({ name: 'Beta' }) } });
    expect(mergeMembership(a, b).devices.D?.name).toBe(mergeMembership(b, a).devices.D?.name);
  });

  it('adds a device it had not heard of, and keeps the patients of both', () => {
    const merged = mergeMembership(
      membership({ patients: { p1: 1 } }),
      membership({ devices: { D: device() }, patients: { p2: 2 } }),
    );
    expect(Object.keys(merged.devices)).toEqual(['D']);
    expect(Object.keys(merged.patients).sort()).toEqual(['p1', 'p2']);
  });

  it('takes the hub setting that was made last, whichever side it is on', () => {
    const none = membership();
    const old = membership({ hub: { url: 'https://a', joinKey: 'k', at: 5 } });
    const recent = membership({ hub: { url: '', joinKey: '', at: 9 } });
    expect(mergeMembership(none, old).hub).toEqual(old.hub);
    expect(mergeMembership(old, none).hub).toEqual(old.hub);
    expect(mergeMembership(none, none).hub).toBeUndefined();
    expect(mergeMembership(old, recent).hub).toEqual(recent.hub);
    expect(mergeMembership(recent, old).hub).toEqual(recent.hub);
    const x = membership({ hub: { url: 'https://a', joinKey: 'k', at: 5 } });
    const y = membership({ hub: { url: 'https://b', joinKey: 'k', at: 5 } });
    expect(mergeMembership(x, y).hub).toEqual(mergeMembership(y, x).hub);
  });
});

describe('who keeps which patients', () => {
  it('is nobody for a device that is not listed, everyone for one that keeps all, and only listed patients otherwise', () => {
    const m = membership({
      patients: { p2: 1, p1: 1 },
      devices: { all: device({ id: 'all' }), some: device({ id: 'some', followAll: false, follows: ['p2', 'gone'] }) },
    });
    expect(effectiveFollows(m, 'nobody')).toEqual([]);
    expect(effectiveFollows(m, 'all')).toEqual(['p1', 'p2']);
    expect(effectiveFollows(m, 'some')).toEqual(['p2']);
  });
});

describe('keys', () => {
  it('merges keyrings without losing a key, in the same order from either side', () => {
    const [k1, k2, k3] = [newKey(1), newKey(2), newKey(2)];
    const a = { household: [k1, k2], revoked: ['x'], patients: { p1: [k1] } };
    const b = { household: [k3, k1], revoked: ['y', 'x'], patients: { p2: [k2] } };
    const ab = mergeKeyring(a, b);
    expect(ab.household).toHaveLength(3);
    expect(ab.revoked).toEqual(['x', 'y']);
    expect(Object.keys(ab.patients).sort()).toEqual(['p1', 'p2']);
    expect(mergeKeyring(b, a).household.map((k) => k.id)).toEqual(ab.household.map((k) => k.id));
  });

  it('counts only keys that were not replaced as able to prove membership', () => {
    const [k1, k2] = [newKey(1), newKey(2)];
    expect(liveHouseholdKeys({ household: [k1, k2], revoked: [k1.id], patients: {} })).toEqual([k2]);
  });
});

describe('changing a household', () => {
  it('changes only a device that exists, keeps its key of its own, and moves the time on even if the clock is behind', () => {
    const n = node();
    expect(updateDevice(n.state, 'nobody', { name: 'x' }, 5)).toBe(n.state);
    const first = updateDevice(n.state, 'A', { name: 'Kitchen', pub: 'PUB' }, 5);
    const second = updateDevice(first, 'A', { follows: ['p1'], followAll: false }, 0);
    const d = second.membership.devices.A as DeviceInfo;
    expect(d).toMatchObject({ name: 'Kitchen', pub: 'PUB', follows: ['p1'], followAll: false });
    expect(d.infoAt).toBeGreaterThan((first.membership.devices.A as DeviceInfo).infoAt);
  });

  it('removes a device once, and ignores a device that is not there or is already removed', () => {
    const n = node();
    const b = n.invite('B', []);
    expect(removeDevice(n.state, 'nobody', 9)).toBe(n.state);
    const removed = removeDevice(n.state, 'B', 9);
    expect(isActive(removed.membership, 'B')).toBe(false);
    expect(isActive(removed.membership, 'A')).toBe(true);
    expect(removeDevice(removed, 'B', 10)).toBe(removed);
    expect(removed.keyring.household).toHaveLength(2);
    expect(removed.keyring.revoked).toHaveLength(1);
    expect(b.state.keyring.household).toHaveLength(1);
    expect(activeDevices(removed.membership).map((d) => d.id)).toEqual(['A']);
  });

  it('lists a patient once, and gives a patient that is already there no second key', () => {
    const n = node();
    const again = addPatient(n.state, 'p1', 99);
    expect(again.membership.patients.p1).toBe(n.state.membership.patients.p1);
    expect(again.keyring.patients.p1).toBe(n.state.keyring.patients.p1);
    const fresh = addPatient(n.state, 'p9', 99);
    expect(fresh.keyring.patients.p9).toHaveLength(1);
  });

  it('knows whether a state changed', () => {
    const n = node();
    expect(hasChanged(n.state, n.state)).toBe(false);
    expect(hasChanged(n.state, addPatient(n.state, 'p9', 1))).toBe(true);
  });
});

describe('the hub setting', () => {
  it('is off until set, set without a trailing slash, and off again once cleared, each newer than the last', () => {
    const n = node();
    expect(hubOf(n.state.membership)).toBeNull();
    const on = setHub(n.state, { url: ' https://hub.example/// ', joinKey: 'k' }, 5);
    expect(hubOf(on.membership)).toMatchObject({ url: 'https://hub.example', joinKey: 'k' });
    const off = clearHub(on, 0);
    expect(hubOf(off.membership)).toBeNull();
    expect(off.membership.hub?.at).toBeGreaterThan(on.membership.hub?.at ?? 0);
    expect(clearHub(n.state, 7).membership.hub?.at).toBe(7);
  });
});
