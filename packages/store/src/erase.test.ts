import 'fake-indexeddb/auto';
import { seizureFixture, stripBase, ids } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { createStoreApi } from './api';
import { TEST_PIN_KDF, WrongSecretError } from './crypto';
import { Store } from './store';

let counter = 0;
const dbName = () => `erase-${Date.now()}-${counter++}`;

describe('erasing everything on this device (F-805)', () => {
  it('needs the PIN, then leaves no store at all, so the app starts from set-up', async () => {
    const name = dbName();
    const { api } = createStoreApi({ name, options: { pinKdf: TEST_PIN_KDF } });
    await api.create({ credential: { pin: '2468' } });
    await api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: ids.patient })) });
    await expect(api.erase({ credential: { pin: '0000' } })).rejects.toBeInstanceOf(WrongSecretError);
    expect(await Store.exists(name)).toBe(true);
    expect(api.list({ type: 'seizure' })).toHaveLength(1);

    await api.erase({ credential: { pin: '2468' } });
    expect(await Store.exists(name)).toBe(false);
    expect((await api.status()).exists).toBe(false);
    expect(() => api.list({ type: 'seizure' })).toThrow();
  });

  it('can set up again afterwards, empty', async () => {
    const name = dbName();
    const { api } = createStoreApi({ name, options: { pinKdf: TEST_PIN_KDF } });
    await api.create({ credential: { pin: '2468' } });
    await api.erase({ credential: { pin: '2468' } });
    await api.create({ credential: { pin: '1357' } });
    expect(api.list({ type: 'seizure' })).toHaveLength(0);
  });
});
