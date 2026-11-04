import { createDecipheriv, createECDH, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptPayload, newVapidKeys, pkcs8FromRaw, sendPush, vapidHeader, type Subscription } from './push';

const unb64 = (s: string) => Buffer.from(s, 'base64url');
const hkdf = async (salt: Buffer, ikm: Buffer, info: Buffer, n: number) => {
  const { createHmac } = await import('node:crypto');
  const prk = createHmac('sha256', salt).update(ikm).digest();
  return createHmac('sha256', prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest()
    .subarray(0, n);
};

/** What a browser does with a push message (RFC 8291), written separately from the encryption so the two check each other. */
async function browserDecrypt(message: Buffer, uaPrivate: Buffer, uaPublic: Buffer, auth: Buffer): Promise<Buffer> {
  const salt = message.subarray(0, 16);
  const idLen = message[20] as number;
  const asPublic = message.subarray(21, 21 + idLen);
  const ciphertext = message.subarray(21 + idLen);
  const ua = createECDH('prime256v1');
  ua.setPrivateKey(uaPrivate);
  const shared = ua.computeSecret(asPublic);
  const ikm = await hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = await hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  expect(plain[plain.length - 1]).toBe(2); // the padding delimiter of the last record
  return plain.subarray(0, plain.length - 1);
}

function browser() {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = Buffer.from(Array.from({ length: 16 }, (_, i) => i * 7 + 1));
  const sub = (endpoint = 'https://push.example/send/abc'): Subscription => ({
    endpoint,
    keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
  });
  return { sub, decrypt: (m: Buffer) => browserDecrypt(m, ua.getPrivateKey(), ua.getPublicKey(), auth) };
}

describe('Web Push encryption (RFC 8291)', () => {
  it('matches the example in the RFC, byte for byte', () => {
    const sub: Subscription = {
      endpoint: 'https://push.example/x',
      keys: {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
    };
    const out = encryptPayload(sub, unb64('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), {
      serverPrivate: unb64('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
      salt: unb64('DGv6ra1nlYgDCS1FRnbzlw'),
    });
    expect(out.toString('base64url')).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('is opened by the browser side, whatever the message, and differs each time', async () => {
    const b = browser();
    const one = encryptPayload(b.sub(), Buffer.from('{"v":1,"event":"started"}'));
    const two = encryptPayload(b.sub(), Buffer.from('{"v":1,"event":"started"}'));
    expect(one.equals(two)).toBe(false);
    expect((await b.decrypt(one)).toString()).toBe('{"v":1,"event":"started"}');
    const long = Buffer.from('x'.repeat(3000));
    expect((await b.decrypt(encryptPayload(b.sub(), long))).equals(long)).toBe(true);
  });

  it('cannot be opened by another browser', async () => {
    const mine = browser();
    const other = browser();
    await expect(other.decrypt(encryptPayload(mine.sub(), Buffer.from('secret')))).rejects.toBeTruthy();
  });
});

describe('VAPID', () => {
  it('makes a signed token for the push service that its public key checks, for that service only', () => {
    const keys = newVapidKeys();
    expect(unb64(keys.publicKey)).toHaveLength(65);
    const header = vapidHeader(keys, 'https://push.example', 'mailto:me@example.org', 1_800_000_000_000);
    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, head, body, sig, k] = m as string[];
    expect(JSON.parse(unb64(head as string).toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(unb64(body as string).toString())).toEqual({
      aud: 'https://push.example',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'mailto:me@example.org',
    });
    expect(k).toBe(keys.publicKey);
    const raw = unb64(k as string);
    const pub = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: raw.subarray(1, 33).toString('base64url'),
        y: raw.subarray(33).toString('base64url'),
      },
      format: 'jwk',
    });
    expect(
      verify('sha256', Buffer.from(`${head}.${body}`), { key: pub, dsaEncoding: 'ieee-p1363' }, unb64(sig as string)),
    ).toBe(true);
    expect(
      verify('sha256', Buffer.from(`${head}.${body}x`), { key: pub, dsaEncoding: 'ieee-p1363' }, unb64(sig as string)),
    ).toBe(false);
  });
});

describe('sending', () => {
  it('posts the encrypted message with the headers a push service needs, and reports a subscription that is gone', async () => {
    const keys = newVapidKeys();
    const b = browser();
    const seen: { url: string; headers: Record<string, string>; body: Uint8Array }[] = [];
    const respond = (status: number) =>
      (async (url: string, init: RequestInit) => {
        seen.push({ url, headers: init.headers as Record<string, string>, body: init.body as Uint8Array });
        return new Response(null, { status });
      }) as unknown as typeof fetch;
    const ok = await sendPush(b.sub(), Buffer.from('hello'), keys, 'mailto:me@example.org', { fetch: respond(201) });
    expect(ok).toEqual({ ok: true, gone: false, status: 201 });
    expect(seen[0]?.url).toBe('https://push.example/send/abc');
    expect(seen[0]?.headers['Content-Encoding']).toBe('aes128gcm');
    expect(seen[0]?.headers.Authorization).toMatch(/^vapid t=/);
    expect(seen[0]?.headers.Urgency).toBe('high');
    expect((await b.decrypt(Buffer.from(seen[0]?.body as Uint8Array))).toString()).toBe('hello');
    expect((await sendPush(b.sub(), Buffer.from('x'), keys, 'mailto:a@b.c', { fetch: respond(410) })).gone).toBe(true);
    expect((await sendPush(b.sub(), Buffer.from('x'), keys, 'mailto:a@b.c', { fetch: respond(404) })).gone).toBe(true);
    const down = (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await sendPush(b.sub(), Buffer.from('x'), keys, 'mailto:a@b.c', { fetch: down })).toEqual({
      ok: false,
      gone: false,
      status: 0,
    });
  });
});

describe('VAPID key making', () => {
  it('works when the private number is shorter than 32 bytes (leading zeros dropped, about 1 in 256 keys), and signs with it', () => {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const full = ecdh.getPrivateKey();
    const short = Buffer.from(full.subarray(1)); // pretend the first byte was zero and dropped
    const padded = Buffer.concat([Buffer.alloc(1), short]);
    ecdh.setPrivateKey(padded);
    const pem = pkcs8FromRaw(short, ecdh.getPublicKey());
    const header = vapidHeader(
      { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: pem },
      'https://push.example',
      'mailto:a@b.c',
    );
    expect(header).toMatch(/^vapid t=/);
  });
  it('makes keys every time', () => {
    for (let i = 0; i < 300; i++) expect(unb64(newVapidKeys().publicKey)).toHaveLength(65);
  });
});
