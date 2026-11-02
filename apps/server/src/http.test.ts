import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Hub } from './hub';
import { serve, type Running } from './http';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

async function start(appDir: string | null = null) {
  const dir = mkdtempSync(join(tmpdir(), 'hubhttp-'));
  const hub = new Hub(join(dir, 'hub.db'));
  const running: Running = await serve(hub, { port: 0, host: '127.0.0.1', appDir, version: 'test' });
  cleanups.push(async () => {
    await running.close();
    hub.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${running.port}`;
  const call = async (path: string, init: { method?: string; token?: string | undefined; body?: unknown } = {}) => {
    const res = await fetch(base + path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    return {
      status: res.status,
      headers: res.headers,
      json: (await res.json().catch(() => null)) as {
        token?: string;
        summary?: Record<string, Record<string, string>>;
        ids?: Record<string, string[]>;
        entries?: { sealed: string }[];
        error?: string;
        [key: string]: unknown;
      } | null,
    };
  };
  return { hub, base, call, port: running.port, dir };
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const stamp = (day: number) => `${String(day * 86_400_000).padStart(15, '0')}-00000-d`;

describe('the hub over HTTP', () => {
  it('answers health to anyone, with CORS so the app can call it from its own address', async () => {
    const { call } = await start();
    const r = await call('/v1/health');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, name: 'AuraTrack Hub', configured: false });
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('sets up, enrols a second device, syncs sealed entries between them, and cuts a removed one off', async () => {
    const { call, hub } = await start();
    const a = await call('/v1/setup', {
      body: { adminCode: hub.adminCode(), deviceId: 'A', name: 'A', joinKeyHash: sha('jk') },
    });
    expect(a.status).toBe(200);
    const b = await call('/v1/enrol', { body: { deviceId: 'B', name: 'B', joinKey: 'jk' } });
    const put = await call('/v1/sync/put', {
      token: a.json?.token,
      body: { entries: [{ id: 'e1', scope: 'p1', stamp: stamp(10), sealed: 's' }] },
    });
    expect(put.json).toEqual({ stored: 1, duplicates: 0 });
    const sum = await call('/v1/sync/summary', { token: b.json?.token, body: { scopes: ['p1'] } });
    expect(Object.keys(sum.json?.summary?.p1 ?? {})).toEqual(['10']);
    expect(
      (await call('/v1/sync/ids', { token: b.json?.token, body: { scope: 'p1', days: ['10'] } })).json?.ids,
    ).toEqual({ '10': ['e1'] });
    expect(
      (await call('/v1/sync/get', { token: b.json?.token, body: { ids: ['e1'] } })).json?.entries?.[0]?.sealed,
    ).toBe('s');
    expect((await call('/v1/revoke', { token: a.json?.token, body: { deviceId: 'B' } })).json).toEqual({
      revoked: true,
    });
    expect((await call('/v1/sync/get', { token: b.json?.token, body: { ids: ['e1'] } })).status).toBe(401);
  });

  it('refuses calls without a token, with a wrong admin code, and with a body that is not JSON', async () => {
    const { call, base } = await start();
    expect((await call('/v1/sync/get', { body: { ids: [] } })).status).toBe(401);
    expect((await call('/v1/devices')).status).toBe(401);
    expect(
      (await call('/v1/setup', { body: { adminCode: 'nope', deviceId: 'A', name: 'A', joinKeyHash: 'h' } })).status,
    ).toBe(403);
    const bad = await fetch(`${base}/v1/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  it('slows down guessing of the two codes', async () => {
    const { call } = await start();
    let last = 0;
    for (let i = 0; i < 14; i++)
      last = (await call('/v1/enrol', { body: { deviceId: 'x', name: 'x', joinKey: String(i) } })).status;
    expect(last).toBe(429);
  });

  it('serves the status page to this computer only, with the code on it', async () => {
    const { base, hub } = await start();
    const page = await fetch(`${base}/status`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(hub.adminCode());
    expect(html).not.toMatch(/<script/i);
    const json = (await (await fetch(`${base}/status.json`)).json()) as { entries: number };
    expect(json.entries).toBe(0);
  });

  it('tells a connected device when another one sends something, but not the sender', async () => {
    const { call, hub, port } = await start();
    const a = await call('/v1/setup', {
      body: { adminCode: hub.adminCode(), deviceId: 'A', name: 'A', joinKeyHash: sha('jk') },
    });
    const b = await call('/v1/enrol', { body: { deviceId: 'B', name: 'B', joinKey: 'jk' } });
    const heard = (token: string) => {
      const messages: string[] = [];
      const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/events?token=${token}`);
      cleanups.push(() => ws.terminate());
      ws.on('message', (m) => messages.push(String(m)));
      return { ws, messages };
    };
    const ear = heard(b.json?.token ?? '');
    const mouth = heard(a.json?.token ?? '');
    await Promise.all([new Promise((r) => ear.ws.once('open', r)), new Promise((r) => mouth.ws.once('open', r))]);
    await call('/v1/sync/put', {
      token: a.json?.token,
      body: { entries: [{ id: 'e1', scope: 'p1', stamp: stamp(1), sealed: 's' }] },
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(ear.messages.map((m) => JSON.parse(m))).toEqual([{ t: 'new', scope: 'p1', from: 'A', count: 1 }]);
    expect(mouth.messages).toEqual([]);
  });

  it('does not accept a socket without a valid token', async () => {
    const { port } = await start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/events?token=wrong`);
    const outcome = await new Promise<string>((resolve) => {
      ws.once('open', () => resolve('open'));
      ws.once('error', () => resolve('refused'));
      ws.once('unexpected-response', () => resolve('refused'));
    });
    expect(outcome).toBe('refused');
  });

  it('answers the signalling path (so phones can find each other through the hub)', async () => {
    const { base } = await start();
    const r = await fetch(`${base}/peer/`);
    expect(r.status).toBe(200);
  });

  it('serves the app from its own address when given the folder, falling back to the first page, and never outside the folder', async () => {
    const app = mkdtempSync(join(tmpdir(), 'hubapp-'));
    writeFileSync(join(app, 'index.html'), '<h1>app</h1>');
    writeFileSync(join(app, 'a.js'), 'console.log(1)');
    cleanups.push(() => rmSync(app, { recursive: true, force: true }));
    const { base } = await start(app);
    expect(await (await fetch(`${base}/`)).text()).toContain('<h1>app</h1>');
    const js = await fetch(`${base}/a.js`);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(await (await fetch(`${base}/not/there`)).text()).toContain('<h1>app</h1>');
    const sneaky = await fetch(`${base}/..%2F..%2Fetc%2Fpasswd`);
    expect(await sneaky.text()).not.toContain('root:');
  });
});
