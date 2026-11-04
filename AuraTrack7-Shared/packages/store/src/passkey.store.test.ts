import 'fake-indexeddb/auto';
import { seizureFixture, stripBase, ids } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { createStoreApi } from './api';
import { TEST_PIN_KDF, WrongSecretError } from './crypto';
import { Store } from './store';

// A store opened with a PIN can also be opened with a passkey's secret (Face ID, fingerprint). The WebAuthn part runs on the
// page; the store only sees the secret.

const FAST = { pinKdf: TEST_PIN_KDF };
let counter = 0;
const dbName = () => `passkey-${Date.now()}-${counter++}`;
const secret = () => crypto.getRandomValues(new Uint8Array(32));
const handle = { credentialId: 'Y3JlZA', prfSalt: 'c2FsdA' };

describe('unlocking with a passkey as well as a PIN', () => {
  it('opens with the secret after it was added with the PIN, with all the data', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const made = await store.create('seizure', stripBase(seizureFixture({ patientId: ids.patient, notes: 'kept' })));
    const s = secret();
    await store.addPasskey({ pin: '2468' }, s, handle);
    store.close();
    const again = await Store.unlock(name, { secret: s }, FAST);
    expect(again.get('seizure', made.id)?.notes).toBe('kept');
  });

  it('still opens with the PIN, and a wrong secret or PIN is refused', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    await store.addPasskey({ pin: '2468' }, secret(), handle);
    store.close();
    (await Store.unlock(name, { pin: '2468' }, FAST)).close();
    await expect(Store.unlock(name, { secret: secret() }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
    await expect(Store.unlock(name, { pin: '0000' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('needs the right PIN to add one', async () => {
    const store = await Store.create(dbName(), { pin: '2468' }, FAST);
    await expect(store.addPasskey({ pin: '1111' }, secret(), handle)).rejects.toBeInstanceOf(WrongSecretError);
    expect(await Store.passkeyOf((store as unknown as { db: { name: string } }).db.name)).toBeNull();
  });

  it('refuses the secret when no passkey was added', async () => {
    const name = dbName();
    (await Store.create(name, { pin: '2468' }, FAST)).close();
    await expect(Store.unlock(name, { secret: secret() }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('tells the PIN screen which passkey to ask for, before the store is open, and forgets it when removed', async () => {
    const name = dbName();
    const { api } = createStoreApi({ name, options: FAST });
    expect((await api.status()).passkey).toBeNull();
    await api.create({ credential: { pin: '2468' } });
    await api.addPasskey({ credential: { pin: '2468' }, secret: secret(), handle });
    api.lock();
    expect(await api.status()).toMatchObject({ exists: true, unlocked: false, passkey: handle });
    await api.unlock({ credential: { pin: '2468' } });
    await api.removePasskey();
    expect((await api.status()).passkey).toBeNull();
  });

  it('changing the PIN keeps the passkey working', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const s = secret();
    await store.addPasskey({ pin: '2468' }, s, handle);
    await store.changePin({ pin: '2468' }, '1357');
    store.close();
    (await Store.unlock(name, { secret: s }, FAST)).close();
    (await Store.unlock(name, { pin: '1357' }, FAST)).close();
  });

  it('answers for a name that has no store', async () => {
    expect(await Store.passkeyOf(dbName())).toBeNull();
  });
});
