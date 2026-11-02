import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TLSSocket } from 'node:tls';
import { afterEach, describe, expect, it } from 'vitest';
import { Hub } from './hub';
import { serve } from './http';

// https with a certificate that is replaced while the hub runs. The certificates are made here, in the test.
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

async function makeCert(dir: string, name: string, cn: string) {
  const { generate } = await import('selfsigned');
  const pems = await generate([{ name: 'commonName', value: cn }], { keySize: 2048 });
  writeFileSync(join(dir, `${name}.crt`), pems.cert);
  writeFileSync(join(dir, `${name}.key`), pems.private);
}

const commonName = (port: number) =>
  new Promise<string>((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/v1/health', rejectUnauthorized: false, agent: false },
      (res) => {
        const cert = (res.socket as TLSSocket).getPeerCertificate();
        res.resume();
        resolve(String((cert.subject as { CN?: string }).CN));
      },
    );
    req.on('error', reject);
    req.end();
  });

describe('https', () => {
  it('serves over https, and picks up a renewed certificate without a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hubtls-'));
    await makeCert(dir, 'one', 'first.example');
    await makeCert(dir, 'two', 'second.example');
    const hub = new Hub(join(dir, 'hub.db'));
    const running = await serve(hub, {
      port: 0,
      host: '127.0.0.1',
      version: 't',
      tls: { cert: join(dir, 'one.crt'), key: join(dir, 'one.key') },
    });
    cleanups.push(async () => {
      await running.close();
      hub.close();
      rmSync(dir, { recursive: true, force: true });
    });
    expect(await commonName(running.port)).toBe('first.example');
    // the renewed certificate replaces the files, and the hub is told (SIGHUP does exactly this)
    copyFileSync(join(dir, 'two.crt'), join(dir, 'one.crt'));
    copyFileSync(join(dir, 'two.key'), join(dir, 'one.key'));
    expect(running.reloadTls()).toBe(true);
    expect(await commonName(running.port)).toBe('second.example');
  });

  it('keeps serving with the old certificate when the new files are not usable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hubtls-'));
    await makeCert(dir, 'one', 'first.example');
    const hub = new Hub(join(dir, 'hub.db'));
    const running = await serve(hub, {
      port: 0,
      host: '127.0.0.1',
      version: 't',
      tls: { cert: join(dir, 'one.crt'), key: join(dir, 'one.key') },
    });
    cleanups.push(async () => {
      await running.close();
      hub.close();
      rmSync(dir, { recursive: true, force: true });
    });
    writeFileSync(join(dir, 'one.crt'), 'broken');
    expect(running.reloadTls()).toBe(false);
    expect(await commonName(running.port)).toBe('first.example');
  });

  it('says there is nothing to reload on a plain http hub', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hubtls-'));
    const hub = new Hub(join(dir, 'hub.db'));
    const running = await serve(hub, { port: 0, host: '127.0.0.1', version: 't' });
    cleanups.push(async () => {
      await running.close();
      hub.close();
      rmSync(dir, { recursive: true, force: true });
    });
    expect(running.reloadTls()).toBe(false);
  });
});
