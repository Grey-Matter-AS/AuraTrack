import { createDecipheriv, createECDH, createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Hub } from './hub';

// Alerts from the hub: who is told, what they are told, and what the push service is shown. Made-up everything.

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

function browser() {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = Buffer.from('0123456789abcdef');
  const hk = (salt: Buffer, ikm: Buffer, info: Buffer, n: number) =>
    createHmac('sha256', createHmac('sha256', salt).update(ikm).digest())
      .update(Buffer.concat([info, Buffer.from([1])]))
      .digest()
      .subarray(0, n);
  return {
    sub: (host = 'fcm.googleapis.com', id = 'x') => ({
      endpoint: `https://${host}/send/${id}`,
      keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    }),
    open(message: Buffer): { v: number; event: string; patientId: string; at: number; sealed?: string } {
      const salt = message.subarray(0, 16);
      const idLen = message[20] as number;
      const asPublic = message.subarray(21, 21 + idLen);
      const body = message.subarray(21 + idLen);
      const ikm = hk(
        auth,
        ua.computeSecret(asPublic),
        Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]),
        32,
      );
      const d = createDecipheriv(
        'aes-128-gcm',
        hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
        hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12),
      );
      d.setAuthTag(body.subarray(body.length - 16));
      const plain = Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]);
      return JSON.parse(plain.subarray(0, plain.length - 1).toString());
    },
  };
}

function setup(status: (url: string) => number = () => 201) {
  const dir = mkdtempSync(join(tmpdir(), 'hubalert-'));
  const sent: { url: string; body: Buffer }[] = [];
  const pushFetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: Buffer.from(init.body as Uint8Array) });
    return new Response(null, { status: status(url) });
  }) as unknown as typeof fetch;
  const hub = new Hub(join(dir, 'hub.db'), { pushFetch, pushSubject: 'mailto:op@example.org' });
  cleanups.push(() => {
    hub.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const joinKey = 'jk';
  const hash = createHash('sha256').update(joinKey).digest('hex');
  const dev = (id: string, first = false) =>
    hub.auth(
      (first
        ? hub.setup({ adminCode: hub.adminCode(), deviceId: id, name: id, joinKeyHash: hash })
        : hub.enrol({ deviceId: id, name: id, joinKey })
      ).token,
    );
  return { hub, sent, dev };
}

describe('alerts', () => {
  it('gives a browser the hub’s public key, the same every time', () => {
    const { hub, dev } = setup();
    dev('A', true);
    expect(hub.vapidKey().publicKey).toHaveLength(87);
    expect(hub.vapidKey()).toEqual(hub.vapidKey());
  });

  it('tells every other subscribed device, not the one that sent it, and each push opens only for its own browser', async () => {
    const { hub, sent, dev } = setup();
    const a = dev('A', true);
    const b = dev('B');
    const c = dev('C');
    const [bb, cb] = [browser(), browser()];
    hub.pushSubscribe(a, { subscription: browser().sub('fcm.googleapis.com', 'a') });
    hub.pushSubscribe(b, { subscription: bb.sub('web.push.apple.com', 'b') });
    hub.pushSubscribe(c, { subscription: cb.sub('updates.push.services.mozilla.com', 'c') });
    expect(await hub.alert(a, { event: 'started', patientId: 'p1' })).toEqual({ sent: 2, failed: 0 });
    expect(sent.map((s) => new URL(s.url).hostname).sort()).toEqual([
      'updates.push.services.mozilla.com',
      'web.push.apple.com',
    ]);
    const toB = sent.find((s) => s.url.includes('apple'))!;
    expect(bb.open(toB.body)).toMatchObject({ v: 1, event: 'started', patientId: 'p1' });
    expect(() => cb.open(toB.body)).toThrow();
  });

  it('the push service is shown nothing readable: the message is encrypted for the browser', async () => {
    const { hub, sent, dev } = setup();
    const a = dev('A', true);
    const b = dev('B');
    hub.pushSubscribe(b, { subscription: browser().sub() });
    await hub.alert(a, { event: 'alert', patientId: 'patient-one', sealed: 'sealedtext' });
    const raw = sent[0]!.body.toString('latin1');
    expect(raw).not.toContain('alert');
    expect(raw).not.toContain('patient-one');
    expect(raw).not.toContain('sealedtext');
  });

  it('honours what each device asked to hear: events, and which people', async () => {
    const { hub, sent, dev } = setup();
    const a = dev('A', true);
    const b = dev('B');
    const c = dev('C');
    hub.pushSubscribe(b, {
      subscription: browser().sub('fcm.googleapis.com', 'b'),
      prefs: { events: ['alert'], patients: null },
    });
    hub.pushSubscribe(c, {
      subscription: browser().sub('fcm.googleapis.com', 'c'),
      prefs: { events: ['started', 'alert', 'recorded'], patients: ['p2'] },
    });
    await hub.alert(a, { event: 'started', patientId: 'p1' });
    expect(sent).toHaveLength(0); // B wants only alerts; C only person p2
    await hub.alert(a, { event: 'alert', patientId: 'p1' });
    expect(sent.map((s) => s.url)).toEqual(['https://fcm.googleapis.com/send/b']);
    await hub.alert(a, { event: 'recorded', patientId: 'p2' });
    expect(sent.map((s) => s.url).slice(1)).toEqual(['https://fcm.googleapis.com/send/c']);
  });

  it('drops a subscription the push service says is gone, and counts failures without throwing', async () => {
    const { hub, dev } = setup((url) => (url.includes('gone') ? 410 : url.includes('bad') ? 500 : 201));
    const a = dev('A', true);
    const b = dev('B');
    const c = dev('C');
    const d = dev('D');
    hub.pushSubscribe(b, { subscription: browser().sub('fcm.googleapis.com', 'gone') });
    hub.pushSubscribe(c, { subscription: browser().sub('fcm.googleapis.com', 'bad') });
    hub.pushSubscribe(d, { subscription: browser().sub('fcm.googleapis.com', 'fine') });
    expect(await hub.alert(a, { event: 'started', patientId: 'p1' })).toEqual({ sent: 1, failed: 2 });
    expect(hub.db.pushes().map((s) => s.deviceId)).toEqual(['C', 'D']);
  });

  it('refuses a subscription to anything but the browser makers’ push services, and anything not https', () => {
    const { hub, dev } = setup();
    const a = dev('A', true);
    for (const endpoint of [
      'http://fcm.googleapis.com/x',
      'https://192.168.1.5/x',
      'https://evil.example/x',
      'https://localhost:9/x',
      'not a url',
    ])
      expect(
        () => hub.pushSubscribe(a, { subscription: { endpoint, keys: { p256dh: 'k', auth: 'a' } } }),
        endpoint,
      ).toThrow();
    expect(hub.db.pushes()).toHaveLength(0);
    expect(() =>
      hub.pushSubscribe(a, {
        subscription: { endpoint: 'https://wns2-par02p.notify.windows.com/w/x', keys: { p256dh: 'k', auth: 'a' } },
      }),
    ).not.toThrow();
  });

  it('forgets a device’s subscription when it unsubscribes or is removed', () => {
    const { hub, dev } = setup();
    const a = dev('A', true);
    const b = dev('B');
    hub.pushSubscribe(b, { subscription: browser().sub() });
    hub.pushUnsubscribe(b);
    expect(hub.db.pushes()).toHaveLength(0);
    hub.pushSubscribe(b, { subscription: browser().sub() });
    hub.revoke(a, { deviceId: 'B' });
    expect(hub.db.pushes()).toHaveLength(0);
  });

  it('refuses an unknown event and an oversized sealed note', async () => {
    const { hub, dev } = setup();
    const a = dev('A', true);
    await expect(hub.alert(a, { event: 'boom', patientId: 'p' })).rejects.toThrow(/bad_event/);
    await expect(hub.alert(a, { event: 'started', patientId: 'p', sealed: 'x'.repeat(5000) })).rejects.toThrow(
      /bad_sealed/,
    );
  });
});

describe('alerts over HTTP to a push service of our own', () => {
  it('a device subscribes, another sends an alert, and the stand-in push service receives a message only the subscribed browser can open', async () => {
    const { createServer } = await import('node:http');
    const { serve } = await import('./http');
    const received: { headers: Record<string, string | string[] | undefined>; body: Buffer }[] = [];
    const pushService = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks) });
        res.statusCode = 201;
        res.end();
      });
    });
    await new Promise<void>((r) => pushService.listen(0, '127.0.0.1', () => r()));
    const pushPort = (pushService.address() as { port: number }).port;
    const dir = mkdtempSync(join(tmpdir(), 'hubalert2-'));
    const hub = new Hub(join(dir, 'hub.db'), { anyPushHost: true, pushSubject: 'mailto:op@example.org' });
    const running = await serve(hub, { port: 0, host: '127.0.0.1', version: 't' });
    cleanups.push(() => {
      void running.close();
      hub.close();
      pushService.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${running.port}`;
    const hash = createHash('sha256').update('jk').digest('hex');
    const post = async (path: string, token: string | null, body: unknown) =>
      (
        await fetch(base + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        })
      ).json() as Promise<{ token: string }>;
    const a = await post('/v1/setup', null, {
      adminCode: hub.adminCode(),
      deviceId: 'A',
      name: 'A',
      joinKeyHash: hash,
    });
    const b = await post('/v1/enrol', null, { deviceId: 'B', name: 'B', joinKey: 'jk' });
    const key = (await (
      await fetch(`${base}/v1/push/key`, { headers: { authorization: `Bearer ${b.token}` } })
    ).json()) as { publicKey: string };
    expect(key.publicKey).toBe(hub.vapidKey().publicKey);

    const phone = browser();
    await post('/v1/push/subscribe', b.token, {
      subscription:
        phone.sub(`127.0.0.1:${pushPort}`, 'one').endpoint === ''
          ? null
          : { endpoint: `http://127.0.0.1:${pushPort}/push/one`, keys: phone.sub().keys },
      prefs: { events: ['alert'], patients: null },
    });
    const sent = await post('/v1/alert', a.token, { event: 'alert', patientId: 'p1' });
    expect(sent).toEqual({ sent: 1, failed: 0 });
    expect(received).toHaveLength(1);
    expect(received[0]?.headers['content-encoding']).toBe('aes128gcm');
    expect(String(received[0]?.headers.authorization)).toContain(`k=${key.publicKey}`);
    expect(phone.open(received[0]?.body as Buffer)).toMatchObject({ v: 1, event: 'alert', patientId: 'p1' });
    // a device that is not subscribed (or sent it) gets nothing
    expect(await post('/v1/alert', b.token, { event: 'alert', patientId: 'p1' })).toEqual({ sent: 0, failed: 0 });
  });
});
