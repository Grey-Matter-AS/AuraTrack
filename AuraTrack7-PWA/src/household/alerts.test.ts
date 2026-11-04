import { describe, expect, it } from 'vitest';
import { alertEvents, sendAlert, type WatchedRecording } from './alerts';

const r = (over: Partial<WatchedRecording> = {}): WatchedRecording => ({
  seizureId: 's1',
  status: 'running',
  alert: 'recording',
  ...over,
});

describe('which alerts a recording gives', () => {
  it('started when a new recording runs, once', () => {
    expect(alertEvents(null, r())).toEqual(['started']);
    expect(alertEvents(r(), r())).toEqual([]);
    expect(alertEvents(r(), r({ seizureId: 's2' }))).toEqual(['started']);
  });
  it('alert when it passes the alert time, once, and also when the 12-minute rule stops it', () => {
    expect(alertEvents(r({ alert: 'warning' }), r({ alert: 'alert' }))).toEqual(['alert']);
    expect(alertEvents(r({ alert: 'alert' }), r({ alert: 'alert' }))).toEqual([]);
    expect(alertEvents(r({ alert: 'alert' }), r({ alert: 'auto_stop' }))).toEqual([]);
    expect(alertEvents(r({ alert: 'warning' }), r({ alert: 'auto_stop' }))).toEqual(['alert']);
  });
  it('recorded when it ends; nothing when it is cancelled; nothing when there is no recording', () => {
    expect(alertEvents(r({ alert: 'alert' }), r({ alert: 'alert', status: 'finished' }))).toEqual(['recorded']);
    expect(alertEvents(r(), r({ status: 'cancelled' }))).toEqual([]);
    expect(alertEvents(r(), null)).toEqual([]);
  });
  it('a recording found already past the alert time (the app was reopened) gives the alert, not "started" again for the same one', () => {
    expect(alertEvents(r({ alert: 'warning' }), r({ alert: 'alert' }))).toEqual(['alert']);
  });
});

describe('sending an alert', () => {
  const api = (local: unknown) => ({
    hubLocal: async () => local,
    saveHubLocal: async () => undefined,
    deviceKeys: async () => null,
    saveDeviceKeys: async () => undefined,
  });
  const has = { url: 'https://hub.example', token: 't', pendingRevokes: [] };
  const wait = async () => undefined;

  it('does nothing without a hub', async () => {
    expect(await sendAlert({ api: api(null), wait }, 'started', 'p1')).toBe('no_hub');
  });
  it('posts the event and the person to the hub with this device’s token', async () => {
    const calls: { url: string; body: unknown; auth: string | null }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)),
        auth: (init.headers as Record<string, string>).authorization ?? null,
      });
      return new Response(JSON.stringify({ sent: 1, failed: 0 }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    expect(await sendAlert({ api: api(has), fetch, wait }, 'alert', 'p1')).toBe('sent');
    expect(calls).toEqual([
      { url: 'https://hub.example/v1/alert', body: { event: 'alert', patientId: 'p1' }, auth: 'Bearer t' },
    ]);
  });
  it('tries again when the hub does not answer, and gives up quietly after three', async () => {
    let n = 0;
    const down = (async () => {
      n++;
      throw new TypeError('network');
    }) as unknown as typeof globalThis.fetch;
    expect(await sendAlert({ api: api(has), fetch: down, wait }, 'started', 'p1')).toBe('failed');
    expect(n).toBe(3);
  });
  it('does not keep asking when the hub refuses', async () => {
    let n = 0;
    const refuse = (async () => {
      n++;
      return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
    }) as unknown as typeof globalThis.fetch;
    expect(await sendAlert({ api: api(has), fetch: refuse, wait }, 'started', 'p1')).toBe('failed');
    expect(n).toBe(1);
  });
  it('never throws, even when the store is locked', async () => {
    const locked = {
      ...api(null),
      hubLocal: async () => {
        throw new Error('The store is locked');
      },
    };
    expect(await sendAlert({ api: locked, wait }, 'started', 'p1')).toBe('failed');
  });
});
