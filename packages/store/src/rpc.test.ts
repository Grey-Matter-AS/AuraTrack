import 'fake-indexeddb/auto';
import { ids, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { createStoreApi, type StoreApi } from './api';
import { encryptedFile, makeBackup, plainFile } from './import6x/legacy.fixture';
import { RemoteError, connect, serve, type PortLike } from './rpc';
import { TEST_PIN_KDF } from './crypto';

const channel = () => {
  const { port1, port2 } = new MessageChannel();
  return {
    page: port1 as unknown as PortLike,
    worker: port2 as unknown as PortLike,
    close: () => (port1.close(), port2.close()),
  };
};

describe('rpc', () => {
  it('calls a handler and returns its answer, sync or async', async () => {
    const { page, worker, close } = channel();
    serve(worker, { add: (a: { x: number; y: number }) => a.x + a.y, later: async (n: number) => n * 2 });
    const client = connect<{ add: (a: { x: number; y: number }) => number; later: (n: number) => Promise<number> }>(
      page,
    );
    expect(await client.add({ x: 2, y: 3 })).toBe(5);
    expect(await client.later(4)).toBe(8);
    client.close();
    close();
  });

  it('runs several requests at once and matches each answer to its question', async () => {
    const { page, worker, close } = channel();
    serve(worker, { slow: (ms: number) => new Promise((r) => setTimeout(() => r(ms), ms)) });
    const client = connect<{ slow: (ms: number) => Promise<number> }>(page);
    expect(await Promise.all([client.slow(30), client.slow(5), client.slow(15)])).toEqual([30, 5, 15]);
    client.close();
    close();
  });

  it('carries an error across with its name and message', async () => {
    const { page, worker, close } = channel();
    class Boom extends Error {
      override name = 'Boom';
    }
    serve(worker, {
      fail: () => {
        throw new Boom('it broke');
      },
      reject: () => Promise.reject('plain text'),
    });
    const client = connect<{ fail: () => void; reject: () => void }>(page);
    await expect(client.fail()).rejects.toMatchObject({ name: 'Boom', message: 'it broke' });
    await expect(client.fail()).rejects.toBeInstanceOf(RemoteError);
    await expect(client.reject()).rejects.toMatchObject({ message: 'plain text' });
    client.close();
    close();
  });

  it('answers an unknown method with an error, and never runs inherited ones', async () => {
    const { page, worker, close } = channel();
    serve(worker, { ok: () => 1 });
    const client = connect<Record<string, (a: unknown) => unknown>>(page);
    await expect(client.nope?.(1)).rejects.toMatchObject({ name: 'UnknownMethod' });
    await expect(client.constructor?.(1)).rejects.toMatchObject({ name: 'UnknownMethod' });
    client.close();
    close();
  });

  it('ignores messages that are not requests or responses, and is not mistaken for a thenable', async () => {
    const { page, worker, close } = channel();
    serve(worker, { ok: () => 1 });
    const client = connect<{ ok: () => number }>(page);
    worker.postMessage('hello');
    page.postMessage({ kind: 'response', id: 999, ok: true, result: 1 });
    page.postMessage(null);
    expect(await client.ok()).toBe(1);
    expect((client as unknown as { then?: unknown }).then).toBeUndefined();
    client.close();
    close();
  });

  it('stops answering after serve is stopped, and fails what is pending when the client closes', async () => {
    const { page, worker, close } = channel();
    const stop = serve(worker, { hang: () => new Promise(() => undefined) });
    const client = connect<{ hang: () => Promise<void> }>(page);
    const waiting = client.hang();
    client.close();
    await expect(waiting).rejects.toMatchObject({ name: 'Closed' });
    stop();
    close();
  });
});

describe('import and backup through the worker interface', () => {
  it('imports a 6.1 backup, compares it, backs up and restores it', async () => {
    const { page, worker, close } = channel();
    const { api } = createStoreApi({ name: `rpc-imp-${Date.now()}`, options: { pinKdf: TEST_PIN_KDF } });
    serve(worker, api);
    const client = connect<StoreApi>(page);
    await client.create({ credential: { pin: '2468' } });
    const { report, comparison } = await client.importLegacy({ text: plainFile(), timeZone: 'Europe/Oslo' });
    expect(report.unaccounted).toBe(0);
    expect(comparison.allMatch).toBe(true);
    expect((await client.counts()).seizure).toBe(24);
    const file = await client.backup({ passphrase: 'a good passphrase' });
    expect(file.fileName).toMatch(/^auratrack-backup-\d{4}-\d{2}-\d{2}\.atbak$/);
    const restored = await client.restore({ text: file.text, passphrase: 'a good passphrase' });
    expect(restored.ok).toBe(true);
    const { kit, qrSvg } = await client.recoveryKit({ credential: { pin: '2468' } });
    expect(kit).toMatch(/^AT7KIT1\./);
    expect(qrSvg).toMatch(/^<svg/);
    await client.changePin({ current: { recoveryKit: kit }, newPin: '1357' });
    await client.lock();
    await expect(client.unlock({ credential: { pin: '2468' } })).rejects.toMatchObject({ name: 'WrongSecretError' });
    await client.unlock({ credential: { pin: '1357' } });
    expect((await client.counts()).seizure).toBe(24);
    client.close();
    close();
  }, 60_000);
});

describe('importing an encrypted 6.1 backup through the worker interface', () => {
  it('passes the passphrase along', async () => {
    const { page, worker, close } = channel();
    const { api } = createStoreApi({ name: `rpc-enc-${Date.now()}`, options: { pinKdf: TEST_PIN_KDF } });
    serve(worker, api);
    const client = connect<StoreApi>(page);
    await client.create({ credential: { pin: '2468' } });
    const text = await encryptedFile(makeBackup({ events: 3 }), 'secret words');
    await expect(client.importLegacy({ text })).rejects.toMatchObject({ name: 'PassphraseNeededError' });
    const { report } = await client.importLegacy({ text, passphrase: 'secret words' });
    expect(report.file.encrypted).toBe(true);
    expect((await client.counts()).seizure).toBe(3);
    client.close();
    close();
  });
});

describe('the store through the worker interface', () => {
  const setup = () => {
    const { page, worker, close } = channel();
    const { api } = createStoreApi({ name: `rpc-${Date.now()}-${Math.random()}`, options: { pinKdf: TEST_PIN_KDF } });
    serve(worker, api);
    return { client: connect<StoreApi>(page), close };
  };

  it('is locked until a PIN is given, and then reads and writes records', async () => {
    const { client, close } = setup();
    expect(await client.status()).toEqual({ exists: false, unlocked: false, info: null });
    await expect(client.list({ type: 'seizure' })).rejects.toMatchObject({ name: 'StoreError' });
    const info = await client.create({ credential: { pin: '2468' } });
    expect(await client.status()).toMatchObject({ exists: true, unlocked: true, info });
    const made = await client.createRecord({
      type: 'seizure',
      values: stripBase(seizureFixture({ patientId: ids.patient })),
    });
    expect(await client.get({ type: 'seizure', id: made.id as string })).toEqual(made);
    expect(await client.list({ type: 'seizure', patientId: ids.patient })).toHaveLength(1);
    expect(await client.list({ type: 'seizure', patientId: 'someone-else' })).toHaveLength(0);
    await client.update({ type: 'seizure', id: made.id as string, patch: { notes: 'hi' } });
    expect((await client.changesSince({ stamp: null })).map((e) => e.kind)).toEqual(['create', 'update']);
    expect(await client.counts()).toEqual({ seizure: 1 });
    expect(await client.incomplete()).toEqual([]);
    await client.remove({ type: 'seizure', id: made.id as string });
    expect(await client.counts()).toEqual({});
    client.close();
    close();
  });

  it('locks again, and a wrong PIN is refused with its own error name', async () => {
    const { client, close } = setup();
    await client.create({ credential: { pin: '2468' } });
    await client.lock();
    expect((await client.status()).unlocked).toBe(false);
    await expect(client.unlock({ credential: { pin: '0000' } })).rejects.toMatchObject({ name: 'WrongSecretError' });
    await client.unlock({ credential: { pin: '2468' } });
    expect((await client.status()).unlocked).toBe(true);
    expect(await client.applyChanges({ entries: [] })).toMatchObject({ applied: 0 });
    client.close();
    close();
  });
});
