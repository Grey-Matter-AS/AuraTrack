import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  type KeyObject,
} from 'node:crypto';

// Web Push (RFC 8030 delivery, RFC 8291 content encryption, RFC 8292 VAPID), written out here so there is no library to trust and
// every step can be checked in a test. The message is encrypted for the subscribing browser; the push service that carries it
// (Google, Apple, Mozilla) sees only that a message went to that subscription.

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  /** 65 bytes, base64url: what the browser is given to subscribe with. */
  publicKey: string;
  /** PKCS#8 PEM. */
  privateKey: string;
}

/** A P-256 private key as PKCS#8 PEM, from the raw number (any length up to 32 bytes: leading zeros may have been dropped) and the public point. */
export function pkcs8FromRaw(privateNumber: Buffer, publicPoint: Buffer): string {
  const scalar = Buffer.concat([Buffer.alloc(32 - privateNumber.length), privateNumber]);
  return createPrivateKey({
    key: Buffer.concat([
      // PKCS#8 wrapper for a P-256 private key (RFC 5915 inside)
      Buffer.from('308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420', 'hex'),
      scalar,
      Buffer.from('a144034200', 'hex'),
      publicPoint,
    ]),
    format: 'der',
    type: 'pkcs8',
  }).export({ format: 'pem', type: 'pkcs8' }) as string;
}

export function newVapidKeys(): VapidKeys {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: pkcs8FromRaw(ecdh.getPrivateKey(), ecdh.getPublicKey()) };
}

/** The `Authorization` header value for a push service at `audience` (its origin). */
export function vapidHeader(keys: VapidKeys, audience: string, subject: string, now = Date.now()): string {
  const head = b64(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64(
    Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })),
  );
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(keys.privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${head}.${body}.${b64(signature)}, k=${keys.publicKey}`;
}

const hmac = (key: Uint8Array, data: Uint8Array) => createHmac('sha256', key).update(data).digest();
const hkdf = (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) =>
  hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length);

/** Encrypts `payload` for a subscription (aes128gcm, one record). */
export function encryptPayload(
  sub: Subscription,
  payload: Uint8Array,
  fixed?: { serverPrivate: Buffer; salt: Buffer },
): Buffer {
  const uaPublic = unb64(sub.keys.p256dh);
  const auth = unb64(sub.keys.auth);
  const server = createECDH('prime256v1');
  if (fixed) server.setPrivateKey(fixed.serverPrivate);
  else server.generateKeys();
  const shared = server.computeSecret(uaPublic);
  const asPublic = server.getPublicKey();
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const salt = fixed?.salt ?? randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

export interface PushResult {
  /** The push service no longer knows this subscription (404 or 410): drop it. */
  gone: boolean;
  ok: boolean;
  status: number;
}

export async function sendPush(
  sub: Subscription,
  payload: Uint8Array,
  vapid: VapidKeys,
  subject: string,
  options: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; fetch?: typeof fetch; now?: number } = {},
): Promise<PushResult> {
  const f = options.fetch ?? fetch;
  try {
    const res = await f(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidHeader(vapid, new URL(sub.endpoint).origin, subject, options.now),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttl ?? 3600),
        Urgency: options.urgency ?? 'high',
      },
      body: new Uint8Array(encryptPayload(sub, payload)),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch {
    return { ok: false, gone: false, status: 0 };
  }
}

export type { KeyObject };
export { createPublicKey };
