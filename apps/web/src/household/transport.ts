import { sha256Hex, type Channel, type KeyEntry } from '@auratrack/sync';

// How two household devices find each other and talk. Over the internet, the public PeerJS signalling broker only passes
// connection details between them: both ends are named by ids nobody outside the household can work out, and everything
// said after that is sealed with the household key as well. The library is loaded only when a household has a device to
// meet (or one is being added), so people who never use it never load it.

export interface Listener {
  close(): void;
}
export interface PeerTransport {
  /** Be reachable under `id`. `onChannel` gets each device that connects. */
  listen(id: string, onChannel: (channel: Channel) => void): Promise<Listener>;
  /** Reach the device listening under `id`; rejects if there is none. */
  connect(id: string, timeoutMs: number): Promise<Channel>;
}

const DAY_MS = 86_400_000;
export const dayNumber = (now: number): number => Math.floor(now / DAY_MS);

/** The id a device listens under on a given day: derived from the household key, so only members can compute it. */
export async function peerIdFor(key: KeyEntry, deviceId: string, day: number): Promise<string> {
  return `at-${(await sha256Hex(`peer|${key.raw}|${deviceId}|${day}`)).slice(0, 32)}`;
}

/** Today's id and the day either side of it, so a clock a little off still finds the device. */
export async function peerIdsToTry(key: KeyEntry, deviceId: string, now: number): Promise<string[]> {
  const day = dayNumber(now);
  return Promise.all([day, day - 1, day + 1].map((d) => peerIdFor(key, deviceId, d)));
}

export interface PeerJsConfig {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  config?: { iceServers: { urls: string }[] };
}

interface ConnLike {
  send(data: unknown): void;
  close(): void;
  on(event: string, cb: (...args: never[]) => void): void;
  open: boolean;
}

function channelOf(conn: ConnLike): Channel {
  return {
    send: (text) => conn.send(text),
    onMessage: (listener) => conn.on('data', ((data: unknown) => typeof data === 'string' && listener(data)) as never),
    onClose: (listener) => {
      conn.on('close', listener as never);
      conn.on('error', listener as never);
    },
    close: () => conn.close(),
  };
}

/** The PeerJS transport. `config` points at another broker (the hub, in M7); the default is PeerJS's public one. */
// One STUN server, to learn this device's public address, and no relay: a relay would be a server that carries the traffic.
// (PeerJS's own defaults would add relay servers.) On the same Wi-Fi no server is needed for the connection itself.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export function peerJsTransport(given: PeerJsConfig = {}): PeerTransport {
  const config: PeerJsConfig = { config: ICE, ...given };
  const load = async () => (await import('peerjs')).default;
  return {
    async listen(id, onChannel) {
      const Peer = await load();
      const peer = new Peer(id, { ...config, debug: 0 });
      await new Promise<void>((resolve, reject) => {
        peer.on('open', () => resolve());
        peer.on('error', (e) => reject(e));
      });
      peer.on('error', () => undefined); // later trouble (a lost broker) is retried by the service
      peer.on('connection', (conn) => {
        conn.on('open', () => onChannel(channelOf(conn as unknown as ConnLike)));
      });
      return { close: () => peer.destroy() };
    },
    async connect(id, timeoutMs) {
      const Peer = await load();
      const peer = new Peer({ ...config, debug: 0 });
      return new Promise<Channel>((resolve, reject) => {
        const fail = (e: unknown) => {
          clearTimeout(timer);
          peer.destroy();
          reject(e instanceof Error ? e : new Error('could not connect'));
        };
        const timer = setTimeout(() => fail(new Error('no answer')), timeoutMs);
        peer.on('error', fail);
        peer.on('open', () => {
          try {
            const conn = peer.connect(id, { reliable: true, serialization: 'raw' });
            conn.on('error', fail);
            conn.on('open', () => {
              clearTimeout(timer);
              const channel = channelOf(conn as unknown as ConnLike);
              resolve({
                ...channel,
                close: () => {
                  channel.close();
                  peer.destroy();
                },
              });
            });
          } catch (e) {
            fail(e);
          }
        });
      });
    },
  };
}

/**
 * Where the signalling broker is. Normally PeerJS's public one; a household hub (M7) and the end-to-end tests point it
 * elsewhere through the `auratrack.broker` setting of this browser (JSON: host, port, path, secure).
 */
export function brokerConfig(): PeerJsConfig {
  try {
    const raw = globalThis.localStorage?.getItem('auratrack.broker');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const p = parsed as Record<string, unknown>;
    return {
      ...(typeof p.host === 'string' ? { host: p.host } : {}),
      ...(typeof p.port === 'number' ? { port: p.port } : {}),
      ...(typeof p.path === 'string' ? { path: p.path } : {}),
      ...(typeof p.secure === 'boolean' ? { secure: p.secure } : {}),
    };
  } catch {
    return {};
  }
}

/** What the app uses; tests replace it with an in-memory one. */
export const householdEnv: { transport: () => PeerTransport } = {
  transport: () => peerJsTransport(brokerConfig()),
};
