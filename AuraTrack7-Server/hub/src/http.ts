import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer as createHttp, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createHttps, type Server as HttpsServer } from 'node:https';
import { extname, join, normalize } from 'node:path';
import { ExpressPeerServer } from 'peer';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { Hub, HubError } from './hub';
import { statusPage } from './status';

// The hub's network side: a small JSON API for the devices (with a bearer token), a WebSocket that says "something new
// arrived", the signalling server phones use to find each other, the status page (this computer only) and, if asked, the app
// itself, so a household can open the app from the hub's own address.

export interface ServeOptions {
  port: number;
  host?: string;
  /** Paths to a certificate and key, for https. Browsers only let an https page talk to an https hub. */
  tls?: { cert: string; key: string } | null;
  /** A folder with the built app to serve at `/`. */
  appDir?: string | null;
  version: string;
  now?: () => number;
}

const MAX_BODY = 6_000_000;
const loopback = (req: IncomingMessage) => {
  const a = req.socket.remoteAddress ?? '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
};
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

/** At most `limit` calls per minute from one place, for the two calls that take a secret. */
function limiter(limit: number, now: () => number) {
  const seen = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (seen.get(key) ?? []).filter((x) => t - x < 60_000);
    recent.push(t);
    seen.set(key, recent);
    if (seen.size > 5000) seen.clear();
    return recent.length <= limit;
  };
}

export interface Running {
  server: Server;
  port: number;
  /** Reads the certificate and key again (after a renewal) without stopping the hub. Returns false if there is no https. */
  reloadTls(): boolean;
  close(): Promise<void>;
}

export async function serve(hub: Hub, options: ServeOptions): Promise<Running> {
  const now = options.now ?? Date.now;
  const app = express();
  app.disable('x-powered-by');
  const secretCalls = limiter(10, now);

  // Devices may be on another origin (the app on its own address): the token is a bearer token, not a cookie
  app.use('/v1', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return void res.status(204).end();
    next();
  });
  app.use('/v1', express.json({ limit: MAX_BODY }));

  const bearer = (req: IncomingMessage) => {
    const h = req.headers.authorization ?? '';
    return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  };
  const route = (
    method: 'get' | 'post',
    path: string,
    handler: (req: express.Request) => unknown | Promise<unknown>,
    guarded = false,
  ) => {
    app[method](path, async (req, res) => {
      try {
        if (guarded && !secretCalls(req.socket.remoteAddress ?? '?')) throw new HubError(429, 'slow_down');
        res.json((await handler(req)) ?? { ok: true });
      } catch (error) {
        if (error instanceof HubError) res.status(error.status).json({ error: error.code });
        else res.status(500).json({ error: 'server_error' });
      }
    });
  };
  const body = (req: express.Request): Record<string, unknown> =>
    typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};

  route('get', '/v1/health', () => ({
    ok: true,
    name: 'AuraTrack Hub',
    version: options.version,
    configured: hub.configured(),
  }));
  route('post', '/v1/setup', (req) => hub.setup(body(req)), true);
  route('post', '/v1/enrol', (req) => hub.enrol(body(req)), true);
  route('post', '/v1/rotate', (req) => hub.rotateJoinKey(hub.auth(bearer(req)), body(req)));
  route('post', '/v1/revoke', (req) => hub.revoke(hub.auth(bearer(req)), body(req)));
  route('get', '/v1/devices', (req) => (hub.auth(bearer(req)), { devices: hub.devices() }));
  route('post', '/v1/sync/summary', async (req) => (hub.auth(bearer(req)), { summary: await hub.summary(body(req)) }));
  route('post', '/v1/sync/ids', (req) => (hub.auth(bearer(req)), { ids: hub.ids(body(req)) }));
  route('post', '/v1/sync/put', (req) => hub.put(hub.auth(bearer(req)), body(req)));
  route('post', '/v1/sync/get', (req) => (hub.auth(bearer(req)), hub.get(body(req))));
  route('post', '/v1/mail', (req) => hub.mailPut(hub.auth(bearer(req)), body(req)));
  route('get', '/v1/mail', (req) => hub.inbox(hub.auth(bearer(req))));
  route('post', '/v1/mail/ack', (req) => hub.ack(hub.auth(bearer(req)), body(req)));
  route('get', '/v1/push/key', (req) => (hub.auth(bearer(req)), hub.vapidKey()));
  route('post', '/v1/push/subscribe', (req) => hub.pushSubscribe(hub.auth(bearer(req)), body(req)));
  route('post', '/v1/push/unsubscribe', (req) => hub.pushUnsubscribe(hub.auth(bearer(req))));
  route('post', '/v1/alert', (req) => hub.alert(hub.auth(bearer(req)), body(req)));
  route('post', '/v1/state', (req) => hub.putState(hub.auth(bearer(req)), body(req)));
  route('get', '/v1/state', (req) => (hub.auth(bearer(req)), { states: hub.states() }));

  // The status page: only from this computer
  app.get('/status', (req, res) => {
    if (!loopback(req))
      return void res.status(403).type('text').send('The status page is only for the computer the hub runs on.');
    res.type('html').send(statusPage(hub, options.version, { port: options.port, tls: Boolean(options.tls) }));
  });
  app.get('/status.json', (req, res) => {
    if (!loopback(req)) return void res.status(403).json({ error: 'local_only' });
    res.json({
      ...hub.status(options.version),
      adminCode: hub.adminCode(),
      port: options.port,
      tls: Boolean(options.tls),
    });
  });

  // The app itself, if a folder was given
  const appDir = options.appDir && existsSync(options.appDir) ? options.appDir : null;
  if (appDir) {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const clean = normalize(decodeURIComponent(req.path)).replace(/^(\.\.[/\\])+/, '');
      let file = join(appDir, clean);
      if (!file.startsWith(appDir)) return next();
      if (!existsSync(file) || !statSync(file).isFile()) file = join(appDir, 'index.html');
      if (!existsSync(file)) return next();
      res.type(MIME[extname(file)] ?? 'application/octet-stream');
      if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
      res.send(readFileSync(file));
    });
  }

  const server: Server = options.tls
    ? createHttps({ cert: readFileSync(options.tls.cert), key: readFileSync(options.tls.key) }, app as never)
    : createHttp(app as never);

  // The signalling server phones use to find each other (a PeerJS server), at /peer
  app.use('/peer', ExpressPeerServer(server as never, { path: '/', allow_discovery: false }));

  // "Something new arrived" for devices that keep a connection
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Set<WebSocket>();
  // The signalling server hooks every upgrade of the server and turns away the paths it does not know, so one listener
  // sends each upgrade to whoever owns its path
  const peerUpgrades = server.listeners('upgrade') as ((req: IncomingMessage, socket: never, head: Buffer) => void)[];
  server.removeAllListeners('upgrade');
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://hub');
    if (url.pathname !== '/v1/events') return void peerUpgrades.forEach((fn) => fn(req, socket as never, head));
    try {
      const device = hub.auth(url.searchParams.get('token'));
      wss.handleUpgrade(req, socket, head, (ws) => {
        sockets.add(ws);
        (ws as WebSocket & { deviceId?: string }).deviceId = device.id;
        ws.on('close', () => sockets.delete(ws));
        ws.on('error', () => sockets.delete(ws));
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });
  const stop = hub.onNew((event) => {
    for (const ws of sockets) {
      if ((ws as WebSocket & { deviceId?: string }).deviceId === event.from) continue; // not back to the one that sent it
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host ?? '0.0.0.0', () => resolve());
  });
  // A renewed certificate is picked up by itself (checked every hour) or at once on SIGHUP, with no restart
  const tlsFiles = options.tls ? [options.tls.cert, options.tls.key] : [];
  const stamp = () => tlsFiles.map((f) => (existsSync(f) ? statSync(f).mtimeMs : 0)).join('|');
  let tlsStamp = stamp();
  const reloadTls = (): boolean => {
    if (!options.tls) return false;
    try {
      (server as HttpsServer).setSecureContext({
        cert: readFileSync(options.tls.cert),
        key: readFileSync(options.tls.key),
      });
      tlsStamp = stamp();
      return true;
    } catch {
      return false; // keep serving with the old certificate; the next check tries again
    }
  };
  const tlsTimer = options.tls
    ? setInterval(() => {
        if (stamp() !== tlsStamp) reloadTls();
      }, 3_600_000)
    : null;
  tlsTimer?.unref();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  return {
    server,
    port,
    reloadTls,
    close: () =>
      new Promise<void>((resolve) => {
        stop();
        if (tlsTimer) clearInterval(tlsTimer);
        for (const ws of sockets) ws.terminate();
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

export type { IncomingMessage, ServerResponse };
