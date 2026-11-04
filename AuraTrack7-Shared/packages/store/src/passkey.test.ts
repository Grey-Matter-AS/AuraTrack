import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { randomBytes } from './bytes';
import {
  PasskeyUnsupportedError,
  createPasskey,
  passkeySecret,
  type CredentialResult,
  type CredentialsLike,
} from './passkey';
import { Store } from './store';
import { WrongSecretError } from './crypto';

// A stand-in authenticator: same salt in, same secret out (that is what PRF promises).
function fakeAuthenticator(options: { prf?: boolean } = {}): CredentialsLike {
  const secretFor = (salt: ArrayBuffer) => new Uint8Array([...new Uint8Array(salt)].map((b) => b ^ 0x5a)).buffer;
  const result = (salt: ArrayBuffer | null, enabled: boolean): CredentialResult => ({
    rawId: new Uint8Array([1, 2, 3]).buffer,
    getClientExtensionResults: () =>
      enabled ? { prf: { enabled: true, ...(salt ? { results: { first: secretFor(salt) } } : {}) } } : {},
  });
  const saltOf = (o: { publicKey: Record<string, unknown> }) =>
    (o.publicKey.extensions as { prf: { eval: { first: Uint8Array } } }).prf.eval.first.buffer as ArrayBuffer;
  return {
    create: async (o) => result(saltOf(o), options.prf !== false),
    get: async (o) => result(options.prf === false ? null : saltOf(o), options.prf !== false),
  };
}
const env = (credentials: CredentialsLike) => ({ credentials, rpId: 'auratrack.example', rpName: 'AuraTrack' });

describe('passkey (WebAuthn PRF)', () => {
  it('gives the same secret each time for the same passkey, so the device key can be unwrapped', async () => {
    const e = env(fakeAuthenticator());
    const { handle, secret } = await createPasskey(e, 'device-1', 'This phone');
    expect(await passkeySecret(e, handle)).toEqual(secret);
    expect(secret).toHaveLength(32);
  });

  it('unlocks a store that was created with the passkey secret, and nothing else does', async () => {
    const e = env(fakeAuthenticator());
    const { handle, secret } = await createPasskey(e, 'device-1', 'This phone');
    const name = `passkey-${Date.now()}`;
    (await Store.create(name, { secret })).close();
    expect(await Store.unlock(name, { secret: await passkeySecret(e, handle) })).toBeTruthy();
    await expect(Store.unlock(name, { secret: randomBytes(32) })).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('says so when the device cannot do PRF', async () => {
    const e = env(fakeAuthenticator({ prf: false }));
    await expect(createPasskey(e, 'device-1', 'This phone')).rejects.toBeInstanceOf(PasskeyUnsupportedError);
  });

  it('says so when the user cancels', async () => {
    const e = env({ create: async () => null, get: async () => null });
    await expect(createPasskey(e, 'd', 'n')).rejects.toBeInstanceOf(PasskeyUnsupportedError);
    await expect(passkeySecret(e, { credentialId: randomBytes(4), prfSalt: randomBytes(32) })).rejects.toBeInstanceOf(
      PasskeyUnsupportedError,
    );
  });
});
