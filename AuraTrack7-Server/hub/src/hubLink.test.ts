import 'fake-indexeddb/auto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ids } from '@auratrack/model/fixtures';
import {
  connectHub,
  disconnectHub,
  ensureEnrolled,
  finishPending,
  hubLocalOf,
  hubOf,
  httpHubApi,
  loadHousehold,
  removeDeviceWithHub,
  storeContext,
  syncWithHub,
  type HubLinkDeps,
} from '@auratrack/sync';
import { firstDevice, join as joinHousehold, meet, type Device } from '@auratrack/sync/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Hub } from './hub';
import { serve } from './http';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

async function startHub() {
  const dir = mkdtempSync(join(tmpdir(), 'hublink-'));
  const hub = new Hub(join(dir, 'hub.db'));
  let running = await serve(hub, { port: 0, host: '127.0.0.1', version: 't' });
  const port = running.port;
  cleanups.push(async () => {
    await running.close().catch(() => undefined);
    hub.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    hub,
    url: `http://127.0.0.1:${port}`,
    stop: () => running.close(),
    restart: async () => {
      running = await serve(hub, { port, host: '127.0.0.1', version: 't' });
    },
  };
}
const deps = (d: Device): HubLinkDeps => ({ api: d.api, who: d.who, local: hubLocalOf(d.api), now: Date.now });
const state = async (d: Device) => (await loadHousehold(d.api))!;

describe('connecting the household to a hub', () => {
  it('the first device sets it up with the code; the others learn where it is by meeting and enrol themselves; all sync through it', async () => {
    const h = await startHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    expect(await connectHub(deps(a), { url: h.url, adminCode: h.hub.adminCode() })).toBe('ok');
    expect(hubOf((await state(a)).membership)?.url).toBe(h.url);
    expect(await ensureEnrolled(deps(b))).toBe('none'); // has not heard of the hub yet
    await meet(a, b); // the household's note reaches B
    expect(await ensureEnrolled(deps(b))).toBe('enrolled');
    expect(await ensureEnrolled(deps(b))).toBe('ready');
    const conn = async (d: Device) => ({ url: h.url, token: (await hubLocalOf(d.api).load())!.token });
    expect((await syncWithHub(httpHubApi(await conn(a)), storeContext(a.api, a.who))).outcome).toBe('done');
    expect((await syncWithHub(httpHubApi(await conn(b)), storeContext(b.api, b.who))).outcome).toBe('done');
    expect(
      h.hub
        .devices()
        .map((x) => x.id)
        .sort(),
    ).toEqual([a.who.deviceId, b.who.deviceId].sort());
  });

  it('says plainly what went wrong: wrong code, nothing there, not a hub', async () => {
    const h = await startHub();
    const a = await firstDevice(ids.patient);
    expect(await connectHub(deps(a), { url: h.url, adminCode: 'WRONG' })).toBe('wrong_code');
    expect(await connectHub(deps(a), { url: 'http://127.0.0.1:1', adminCode: 'X' })).toBe('unreachable');
    expect(hubOf((await state(a)).membership)).toBeNull();
    expect(await hubLocalOf(a.api).load()).toBeNull();
  });

  it('a phone that is not in a household cannot connect a hub', async () => {
    const h = await startHub();
    const { newDevice } = await import('@auratrack/sync/testing');
    const lone = await newDevice();
    expect(await connectHub(deps(lone), { url: h.url, adminCode: h.hub.adminCode() })).toBe('no_household');
  });

  it('switching it off keeps the household as it was, and the old setting does not come back from a device that has not heard', async () => {
    const h = await startHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    await connectHub(deps(a), { url: h.url, adminCode: h.hub.adminCode() });
    await meet(a, b);
    expect(hubOf((await state(b)).membership)).not.toBeNull();
    await disconnectHub(deps(a));
    expect(hubOf((await state(a)).membership)).toBeNull();
    await meet(a, b); // B still has the old setting; the newer "off" wins on both
    expect(hubOf((await state(a)).membership)).toBeNull();
    expect(hubOf((await state(b)).membership)).toBeNull();
    expect(await hubLocalOf(a.api).load()).toBeNull();
  });
});

describe('removing a device that was enrolled at the hub', () => {
  it('cuts it off at the hub and changes the join key, so it cannot come back', async () => {
    const h = await startHub();
    const a = await firstDevice(ids.patient);
    const b = await joinHousehold(a, 'B');
    const c = await joinHousehold(a, 'C');
    await connectHub(deps(a), { url: h.url, adminCode: h.hub.adminCode() });
    await meet(a, b);
    await meet(a, c);
    await ensureEnrolled(deps(b));
    await ensureEnrolled(deps(c));
    const oldKey = hubOf((await state(c)).membership)!.joinKey;
    expect(await removeDeviceWithHub(deps(a), c.who.deviceId)).toBe('ok');
    const token = (await hubLocalOf(c.api).load())!.token;
    await expect(httpHubApi({ url: h.url, token }).summary([])).rejects.toMatchObject({ status: 401 });
    expect(hubOf((await state(a)).membership)!.joinKey).not.toBe(oldKey);
    // C holds the old join key, which no longer works; B (not removed) still has a working token
    expect(await ensureEnrolled({ ...deps(c), local: { load: async () => null, save: async () => undefined } })).toBe(
      'not_allowed',
    );
    const tokenB = (await hubLocalOf(b.api).load())!.token;
    await expect(httpHubApi({ url: h.url, token: tokenB }).summary([])).resolves.toBeDefined();
  });

  it('when the hub is not there it is removed from the household at once and cut off at the hub as soon as it answers', async () => {
    const h = await startHub();
    const a = await firstDevice(ids.patient);
    const c = await joinHousehold(a, 'C');
    await connectHub(deps(a), { url: h.url, adminCode: h.hub.adminCode() });
    await meet(a, c);
    await ensureEnrolled(deps(c));
    await h.stop();
    expect(
      await removeDeviceWithHub(
        { ...deps(a), fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(500) }) },
        c.who.deviceId,
      ),
    ).toBe('unreachable');
    expect((await hubLocalOf(a.api).load())!.pendingRevokes).toEqual([c.who.deviceId]);
    expect((await state(a)).membership.devices[c.who.deviceId]?.removedAt).not.toBeNull();
    await h.restart();
    expect(await finishPending(deps(a))).toBe('ok');
    expect((await hubLocalOf(a.api).load())!.pendingRevokes).toEqual([]);
    const token = (await hubLocalOf(c.api).load())!.token;
    await expect(httpHubApi({ url: h.url, token }).summary([])).rejects.toMatchObject({ status: 401 });
  });
});
