import { hubPushKey, hubPushSubscribe, hubPushUnsubscribe, type HubConnection } from '@auratrack/sync';
import { isIos, isInstalled } from '../app/install';

// Alerts on this device: ask the browser's permission, subscribe to the hub's push key, tell the hub who to alert for what. What
// the notification says is written here into a small store of its own (never the app's records), so the service worker can show
// it with the app closed.

export type PushSupport = 'ready' | 'needs_home_screen' | 'unsupported' | 'blocked';

export function pushSupport(): PushSupport {
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!has) return isIos() && !isInstalled() ? 'needs_home_screen' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ready';
}

export interface PushDisplay {
  title: string;
  body: string;
}
export interface PushPrefs {
  events: string[];
  patients: string[] | null;
}

const DB = 'auratrack-push';
function kv<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = work(open.result.transaction('kv', mode).objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}
export const writeDisplay = (display: PushDisplay): Promise<IDBValidKey> =>
  kv('readwrite', (s) => s.put(display, 'display'));
export const clearDisplay = (): Promise<undefined> => kv('readwrite', (s) => s.delete('display'));

const toKey = (b64: string): Uint8Array<ArrayBuffer> => {
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'failed';

/** Asks permission, subscribes, and tells the hub. Must be called from a tap (browsers require it for the permission). */
export async function enablePush(conn: HubConnection, prefs: PushPrefs, display: PushDisplay): Promise<EnableResult> {
  if (pushSupport() === 'unsupported' || pushSupport() === 'needs_home_screen') return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const registration = await navigator.serviceWorker.ready;
    const key = await hubPushKey(conn);
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'failed';
    await writeDisplay(display);
    await hubPushSubscribe(
      conn,
      { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
      prefs,
    );
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** Tells the hub of changed choices (which events, whose), keeping the same subscription. */
export async function updatePush(conn: HubConnection, prefs: PushPrefs, display: PushDisplay): Promise<boolean> {
  try {
    const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    const json = subscription?.toJSON();
    if (!json?.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
    await writeDisplay(display);
    await hubPushSubscribe(
      conn,
      { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
      prefs,
    );
    return true;
  } catch {
    return false;
  }
}

export async function disablePush(conn: HubConnection | null): Promise<void> {
  try {
    const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    /* nothing to undo */
  }
  await clearDisplay().catch(() => undefined);
  if (conn) await hubPushUnsubscribe(conn).catch(() => undefined);
}
