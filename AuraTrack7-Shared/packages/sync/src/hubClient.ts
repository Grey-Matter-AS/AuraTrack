import type { HubApi, SealedEntry } from './hub';

// Talking to a hub over HTTP: the token goes in a header, everything else is JSON. Failures are thrown as HubCallError, with
// the hub's own word for what went wrong, so the app can tell "not allowed" (the device was removed) from "not reachable".

export class HubCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'HubCallError';
  }
}

export interface HubConnection {
  url: string;
  token: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const clean = (url: string) => url.replace(/\/+$/, '');

async function call<T>(c: HubConnection, path: string, body?: unknown, token: string | null = c.token): Promise<T> {
  const f = c.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs ?? 20_000);
  try {
    const res = await f(`${clean(c.url)}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new HubCallError(res.status, json.error ?? 'error');
    return json as T;
  } catch (error) {
    if (error instanceof HubCallError) throw error;
    throw new HubCallError(0, 'unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export function httpHubApi(c: HubConnection): HubApi {
  return {
    summary: async (scopes) =>
      (await call<{ summary: Record<string, Record<string, string>> }>(c, '/v1/sync/summary', { scopes })).summary,
    ids: async (scope, days) => (await call<{ ids: Record<string, string[]> }>(c, '/v1/sync/ids', { scope, days })).ids,
    put: (entries: SealedEntry[]) => call(c, '/v1/sync/put', { entries }),
    get: async (ids) => (await call<{ entries: SealedEntry[] }>(c, '/v1/sync/get', { ids })).entries,
    putState: async (sealed) => void (await call(c, '/v1/state', { sealed })),
    mailPut: async (to, sealed) => void (await call(c, '/v1/mail', { to, sealed })),
    inbox: async () =>
      (await call<{ mail: { id: number; from: string; at: number; sealed: string }[] }>(c, '/v1/mail')).mail,
    ack: async (ids) => void (await call(c, '/v1/mail/ack', { ids })),
    states: async () =>
      (await call<{ states: { deviceId: string; at: number; sealed: string }[] }>(c, '/v1/state')).states,
  };
}

export const hubHealth = (url: string, f?: typeof fetch) =>
  call<{ ok: boolean; name: string; version: string; configured: boolean }>(
    { url, token: '', ...(f ? { fetch: f } : {}) },
    '/v1/health',
    undefined,
    null,
  );

export const hubSetup = (
  url: string,
  body: { adminCode: string; deviceId: string; name: string; joinKeyHash: string },
  f?: typeof fetch,
) => call<{ token: string }>({ url, token: '', ...(f ? { fetch: f } : {}) }, '/v1/setup', body, null);

export const hubEnrol = (url: string, body: { deviceId: string; name: string; joinKey: string }, f?: typeof fetch) =>
  call<{ token: string }>({ url, token: '', ...(f ? { fetch: f } : {}) }, '/v1/enrol', body, null);

export const hubRotate = (c: HubConnection, joinKeyHash: string) => call(c, '/v1/rotate', { joinKeyHash });
export const hubRevoke = (c: HubConnection, deviceId: string) =>
  call<{ revoked: boolean }>(c, '/v1/revoke', { deviceId });

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export const hubPushKey = async (c: HubConnection) => (await call<{ publicKey: string }>(c, '/v1/push/key')).publicKey;
export const hubPushSubscribe = (
  c: HubConnection,
  subscription: PushSubscriptionJson,
  prefs: { events: string[]; patients: string[] | null },
) => call(c, '/v1/push/subscribe', { subscription, prefs });
export const hubPushUnsubscribe = (c: HubConnection) => call(c, '/v1/push/unsubscribe', {});
/** One device says something happened: the hub tells the others who asked to hear of it. */
export const hubAlert = (
  c: HubConnection,
  body: { event: 'started' | 'alert' | 'recorded'; patientId: string; sealed?: string },
) => call<{ sent: number; failed: number }>(c, '/v1/alert', body);
