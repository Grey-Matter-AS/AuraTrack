import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ids, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import {
  HubCallError,
  deviceKeysOf,
  effectiveFollows,
  httpHubApi,
  loadHousehold,
  removeDevice,
  storeContext,
  syncWithHub,
  type HubApi,
  type HubReport,
} from '@auratrack/sync';
import { firstDevice, join as joinHousehold, type Device } from '@auratrack/sync/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Hub, HubError } from './hub';
import { serve } from './http';

// Real encrypted stores syncing through a real hub, never meeting each other. The hub is only ever shown sealed text.

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function newHub() {
  const dir = mkdtempSync(join(tmpdir(), 'hubsync-'));
  const hub = new Hub(join(dir, 'hub.db'));
  cleanups.push(() => {
    hub.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return hub;
}

/** The hub in the same process, called as a device would call it over the network. */
function inProcess(hub: Hub, token: string): HubApi {
  const device = () => hub.auth(token);
  return {
    summary: (scopes) => hub.summary({ scopes: (device(), scopes) }),
    ids: async (scope, days) => (device(), hub.ids({ scope, days })),
    put: async (entries) => hub.put(device(), { entries }),
    get: async (idList) => (device(), hub.get({ ids: idList }).entries),
    putState: async (sealed) => hub.putState(device(), { sealed }),
    states: async () => (device(), hub.states()),
    mailPut: async (to, sealed) => void hub.mailPut(device(), { to, sealed }),
    inbox: async () => hub.inbox(device()).mail,
    ack: async (ids) => void hub.ack(device(), { ids }),
  };
}

const tokens = new Map<string, string>();
async function enrol(hub: Hub, d: Device, first: boolean): Promise<HubApi> {
  const { token } = first
    ? hub.setup({ adminCode: hub.adminCode(), deviceId: d.who.deviceId, name: 'dev', joinKeyHash: sha('jk') })
    : hub.enrol({ deviceId: d.who.deviceId, name: 'dev', joinKey: 'jk' });
  tokens.set(d.who.deviceId, token);
  return inProcess(hub, token);
}

const round = (api: HubApi, d: Device): Promise<HubReport> =>
  syncWithHub(api, storeContext(d.api, d.who), { keys: deviceKeysOf(d.api) });
const seizures = (d: Device) => d.api.list({ type: 'seizure' }) as { id: string; notes?: string }[];
const make = (d: Device, patch: Record<string, unknown> = {}) =>
  d.api.createRecord({
    type: 'seizure',
    values: { ...stripBase(seizureFixture({ patientId: ids.patient })), ...patch },
  });

describe('devices syncing through the hub, without ever meeting', () => {
  it('a seizure saved on one device reaches another through the hub alone', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    await make(a, { notes: 'on A' });
    const b = await joinHousehold(a, 'B');
    const apiA = await enrol(hub, a, true);
    const apiB = await enrol(hub, b, false);
    expect((await round(apiA, a)).outcome).toBe('done');
    const r = await round(apiB, b);
    expect(r.outcome).toBe('done');
    expect(seizures(b).map((s) => s.notes)).toEqual(['on A']);
    expect((b.api.list({ type: 'patient' }) as unknown[]).length).toBe(1);
    expect(hub.db.countEntries()).toBeGreaterThan(1);
  });

  it('does nothing the second time, and after a new save only that save moves', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const apiA = await enrol(hub, a, true);
    const apiB = await enrol(hub, b, false);
    await round(apiA, a);
    await round(apiB, b);
    const idle = await round(apiA, a);
    expect([idle.pushed, idle.applied]).toEqual([0, 0]);
    await make(a);
    expect((await round(apiA, a)).pushed).toBe(1);
    expect((await round(apiB, b)).applied).toBe(1);
  });

  it('three devices converge through the hub, in any order, with edits to different fields on each', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const created = (await make(a, { notes: 'first' })) as { id: string };
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    const [apiA, apiB, apiC] = [await enrol(hub, a, true), await enrol(hub, b, false), await enrol(hub, c, false)] as [
      HubApi,
      HubApi,
      HubApi,
    ];
    await round(apiA, a);
    await round(apiB, b);
    await round(apiC, c);
    await a.api.update({ type: 'seizure', id: created.id, patch: { notes: 'from A' } });
    await b.api.update({ type: 'seizure', id: created.id, patch: { cancelled: true } });
    await round(apiC, c);
    await round(apiB, b);
    await round(apiA, a);
    await round(apiC, c);
    await round(apiB, b);
    for (const d of [a, b, c]) {
      const s = d.api.get({ type: 'seizure', id: created.id }) as { notes?: string; cancelled?: boolean };
      expect([s.notes, s.cancelled]).toEqual(['from A', true]);
    }
  });

  it('a deletion goes through the hub and an older edit does not bring the record back', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const s = (await make(a)) as { id: string };
    const b = await joinHousehold(a, 'B');
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    await round(apiA, a);
    await round(apiB, b);
    await b.api.update({ type: 'seizure', id: s.id, patch: { notes: 'offline edit' } });
    await a.api.remove({ type: 'seizure', id: s.id });
    await round(apiA, a);
    await round(apiB, b);
    await round(apiA, a);
    expect(seizures(a)).toHaveLength(0);
    expect(seizures(b)).toHaveLength(0);
  });

  it('the hub holds nothing readable: not a name, a note or a time inside a record', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    await make(a, { notes: 'SECRET-NOTE-TEXT' });
    const apiA = await enrol(hub, a, true);
    await round(apiA, a);
    const dump = JSON.stringify(hub.db.sql.prepare('SELECT * FROM entries').all()) + JSON.stringify(hub.states());
    expect(dump).not.toContain('SECRET-NOTE-TEXT');
    expect(dump).not.toContain('Alex');
    expect(dump).not.toContain('seizure_type');
  });

  it('a device that keeps one person never gets the other from the hub', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const second = crypto.randomUUID();
    await a.api.createRecord({
      type: 'patient',
      values: { id: second, patientId: second, name: 'Sam', dateOfBirth: null, emergencyContact: '', color: '#aa3366' },
    });
    const { registerPatient } = await import('@auratrack/sync');
    await registerPatient(a.api, second, Date.now());
    await a.api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: second })) });
    await make(a);
    const b = await joinHousehold(a, 'B', [ids.patient]);
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    await round(apiA, a);
    await round(apiB, b);
    expect(effectiveFollows((await loadHousehold(b.api))!.membership, b.who.deviceId)).toEqual([ids.patient]);
    expect((b.api.list({ type: 'patient' }) as { id: string }[]).map((p) => p.id)).toEqual([ids.patient]);
    expect(b.api.list({ type: 'seizure', patientId: second })).toHaveLength(0);
  });

  it('a removed device is cut off, and the others learn of the removal and the new household key from the hub alone', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    const [apiA, apiB, apiC] = [await enrol(hub, a, true), await enrol(hub, b, false), await enrol(hub, c, false)] as [
      HubApi,
      HubApi,
      HubApi,
    ];
    await round(apiA, a);
    await round(apiB, b);
    await round(apiC, c);
    // A removes C: the household changes keys, and the hub cuts C's token
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice(state, c.who.deviceId, Date.now()) });
    hub.revoke(hub.auth(tokens.get(a.who.deviceId) ?? null), { deviceId: c.who.deviceId });
    await make(a, { notes: 'after the removal' });
    expect((await round(apiA, a)).outcome).toBe('done'); // posts the new device list and household key
    // B never met A, yet learns both from the hub
    const rb = await round(apiB, b);
    expect(rb.outcome).toBe('done');
    const stateB = (await loadHousehold(b.api))!;
    expect(stateB.membership.devices[c.who.deviceId]?.removedAt).not.toBeNull();
    expect(stateB.keyring.household.length).toBe(2);
    // C is cut off: it gets nothing, and the call says it is not allowed
    const rc = await round(apiC, c);
    expect(rc.outcome).toBe('error');
    expect(rc.reason).toMatch(/unauthorised/);
    expect(seizures(c).some((s) => s.notes === 'after the removal')).toBe(false);
    // and cannot enrol again, with the join key it knows or the old one
    expect(() => hub.enrol({ deviceId: c.who.deviceId, name: 'C', joinKey: 'jk' })).toThrow(HubError);
  });

  it('after a removal the new person key reaches the others through the hub alone, sealed to each device', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    await enrol(hub, c, false);
    await round(apiA, a);
    await round(apiB, b); // B says which keys it holds
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice(state, c.who.deviceId, Date.now()) });
    await make(a, { notes: 'sealed with the new key' });
    await round(apiA, a); // A posts the new device list and sends B the new person key
    const first = await round(apiB, b);
    expect(first.rejected).toBe(0);
    await round(apiA, a);
    await round(apiB, b); // whatever was unreadable in the first round opens now
    expect(seizures(b).some((s) => s.notes === 'sealed with the new key')).toBe(true);
    expect(((await loadHousehold(b.api))!.keyring.patients[ids.patient] ?? []).length).toBe(2);
    // the hub only ever saw it sealed to B's own key: nobody else can open it
    expect(hub.db.sql.prepare('SELECT COUNT(*) AS n FROM mailbox').get()).toMatchObject({ n: 0 }); // B has taken it
  });

  it('a key is sealed to one device: another device of the household, and the hub, cannot open it', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    const [apiA, apiB, apiC] = [await enrol(hub, a, true), await enrol(hub, b, false), await enrol(hub, c, false)] as [
      HubApi,
      HubApi,
      HubApi,
    ];
    await round(apiA, a);
    await round(apiB, b);
    await round(apiC, c);
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice({ ...state }, 'nobody', Date.now()) });
    // A rotates the person key by removing a device that is not there, then B and C both want the new key
    const { newKey } = await import('@auratrack/sync');
    const s2 = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({
      state: {
        ...s2,
        keyring: {
          ...s2.keyring,
          patients: {
            ...s2.keyring.patients,
            [ids.patient]: [...(s2.keyring.patients[ids.patient] ?? []), newKey(Date.now() + 5)],
          },
        },
      },
    });
    await round(apiA, a);
    const mailForB = hub.db.mailFor(b.who.deviceId);
    const mailForC = hub.db.mailFor(c.who.deviceId);
    expect(mailForB).toHaveLength(1);
    expect(mailForC).toHaveLength(1);
    expect(mailForB[0]?.sealed).not.toBe(mailForC[0]?.sealed);
    // C cannot open B's mail even with the household key, and B's own state shows it never held C's
    const { openWith } = await import('@auratrack/sync');
    const cKeys = (await deviceKeysOf(c.api).load())!;
    await expect(
      openWith(cKeys.pair, mailForB[0]!.sealed, `grant:${a.who.deviceId}>${b.who.deviceId}`),
    ).rejects.toBeTruthy();
    expect(JSON.stringify(mailForB)).not.toContain('"raw"');
    // the hub gives mail only to the device it is for
    expect(hub.inbox(hub.auth(tokens.get(c.who.deviceId) ?? null)).mail.map((m) => m.id)).toEqual(
      mailForC.map((m) => m.id),
    );
  });

  it('a device is not given a key for a person it does not keep, whoever asks', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const second = crypto.randomUUID();
    await a.api.createRecord({
      type: 'patient',
      values: { id: second, patientId: second, name: 'Sam', dateOfBirth: null, emergencyContact: '', color: '#aa3366' },
    });
    const { registerPatient } = await import('@auratrack/sync');
    await registerPatient(a.api, second, Date.now());
    const b = await joinHousehold(a, 'B', [ids.patient]);
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    await round(apiA, a);
    await round(apiB, b);
    await round(apiA, a);
    await round(apiB, b);
    expect(Object.keys((await loadHousehold(b.api))!.keyring.patients)).toEqual([ids.patient]);
    // a grant for a person B does not keep, even sealed to B by a member, is dropped
    const { sealTo } = await import('@auratrack/sync');
    const bKeys = (await deviceKeysOf(b.api).load())!;
    const stateA = (await loadHousehold(a.api))!;
    const forged = await sealTo(
      bKeys.pair.pub,
      JSON.stringify({ patientId: second, keys: stateA.keyring.patients[second] }),
      `grant:${a.who.deviceId}>${b.who.deviceId}`,
    );
    hub.mailPut(hub.auth(tokens.get(a.who.deviceId) ?? null), { to: b.who.deviceId, sealed: forged });
    await round(apiB, b);
    expect(Object.keys((await loadHousehold(b.api))!.keyring.patients)).toEqual([ids.patient]);
    expect(hub.db.mailFor(b.who.deviceId)).toHaveLength(0); // read and dropped
  });

  it('a grant from a device that was removed is ignored', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    const apiC = await enrol(hub, c, false);
    await round(apiA, a);
    await round(apiB, b);
    await round(apiC, c);
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice(state, c.who.deviceId, Date.now()) });
    await round(apiA, a);
    await round(apiB, b); // B learns C was removed
    const { sealTo, newKey } = await import('@auratrack/sync');
    const bKeys = (await deviceKeysOf(b.api).load())!;
    const evil = newKey(Date.now() + 999_999);
    hub.db.putMail(
      b.who.deviceId,
      c.who.deviceId,
      Date.now(),
      await sealTo(
        bKeys.pair.pub,
        JSON.stringify({ patientId: ids.patient, keys: [evil] }),
        `grant:${c.who.deviceId}>${b.who.deviceId}`,
      ),
    );
    await round(apiB, b);
    const keys = (await loadHousehold(b.api))!.keyring.patients[ids.patient] ?? [];
    expect(keys.some((k) => k.id === evil.id)).toBe(false);
  });

  it('turns away what the hub changed: a tampered entry is rejected and nothing is merged from it', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    await make(a, { notes: 'honest' });
    const b = await joinHousehold(a, 'B');
    const [apiA, apiB] = [await enrol(hub, a, true), await enrol(hub, b, false)] as [HubApi, HubApi];
    await round(apiA, a);
    hub.db.sql.prepare("UPDATE entries SET sealed = substr(sealed, 1, length(sealed) - 4) || 'AAAA'").run();
    const r = await round(apiB, b);
    expect(r.rejected).toBeGreaterThan(0);
    expect(seizures(b)).toHaveLength(0);
  });

  it('a hub that is not there is an error for that round only: nothing breaks, and the next round catches up', async () => {
    const hub = newHub();
    const a = await firstDevice(ids.patient);
    await make(a);
    const b = await joinHousehold(a, 'B');
    const apiA = await enrol(hub, a, true);
    const apiB = await enrol(hub, b, false);
    const down: HubApi = {
      ...apiB,
      summary: async () => {
        throw new HubCallError(0, 'unreachable');
      },
    };
    await round(apiA, a);
    const bad = await round(down, b);
    expect(bad.outcome).toBe('error');
    expect(seizures(b)).toHaveLength(0);
    expect((await round(apiB, b)).outcome).toBe('done');
    expect(seizures(b)).toHaveLength(1);
  });
});

describe('over HTTP', () => {
  it("two devices set up, enrol and sync through the real server, with the app's own client", async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hubhttp2-'));
    const hub = new Hub(join(dir, 'hub.db'));
    const running = await serve(hub, { port: 0, host: '127.0.0.1', version: 't' });
    cleanups.push(async () => {
      await running.close();
      hub.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const url = `http://127.0.0.1:${running.port}`;
    const { hubSetup, hubEnrol } = await import('@auratrack/sync');
    const a = await firstDevice(ids.patient);
    await make(a, { notes: 'over the wire' });
    const b = await joinHousehold(a, 'B');
    const ta = await hubSetup(url, {
      adminCode: hub.adminCode(),
      deviceId: a.who.deviceId,
      name: 'A',
      joinKeyHash: sha('jk'),
    });
    const tb = await hubEnrol(url, { deviceId: b.who.deviceId, name: 'B', joinKey: 'jk' });
    expect((await round(httpHubApi({ url, token: ta.token }), a)).outcome).toBe('done');
    expect((await round(httpHubApi({ url, token: tb.token }), b)).outcome).toBe('done');
    expect(seizures(b).map((s) => s.notes)).toEqual(['over the wire']);
    // a wrong token is "unauthorised", an address with nothing there is "unreachable"
    await expect(httpHubApi({ url, token: 'wrong' }).summary([])).rejects.toMatchObject({ status: 401 });
    await expect(
      httpHubApi({ url: 'http://127.0.0.1:1', token: 'x', timeoutMs: 2000 }).summary([]),
    ).rejects.toMatchObject({ code: 'unreachable' });
  });
});
