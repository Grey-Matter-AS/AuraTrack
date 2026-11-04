import { argon2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fromBase64Url, randomBytes, toBase64Url } from './bytes';
import {
  DecryptError,
  ARGON2_DEFAULT,
  DEFAULT_PIN_KDF,
  MAX_ARGON2_LANES,
  MAX_ARGON2_MEMORY_KIB,
  MAX_ARGON2_PASSES,
  MAX_PBKDF2_ITERATIONS,
  TEST_PIN_KDF,
  kdfIsCurrent,
  WrongSecretError,
  backupKey,
  exportDeviceKey,
  generateDeviceKey,
  importDeviceKey,
  open,
  seal,
  unlockWithPin,
  unlockWithSecret,
  wrapDeviceKeyWithPin,
  wrapDeviceKeyWithSecret,
} from './crypto';

// Cheap settings keep the tests fast; the app's own default is ARGON2_DEFAULT.
const FAST = TEST_PIN_KDF;
const PBKDF2_FAST = { name: 'PBKDF2', iterations: 1000 } as const;

describe('base64url', () => {
  it('round-trips any bytes', () => {
    for (const length of [0, 1, 2, 3, 4, 31, 256]) {
      const bytes = randomBytes(length);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
    expect(toBase64Url(new Uint8Array([251, 255, 254]))).toBe('-__-');
  });
});

describe('sealing records', () => {
  it('opens what it sealed', async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, '{"notes":"felt dizzy"}', 'seizure:1');
    expect(await open(key, sealed, 'seizure:1')).toBe('{"notes":"felt dizzy"}');
  });

  it('uses a new IV each time, so equal records look different', async () => {
    const key = await generateDeviceKey();
    const a = await seal(key, 'same', 'x');
    const b = await seal(key, 'same', 'x');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('refuses a wrong key, a changed ciphertext, and a record moved to another slot', async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, 'secret', 'seizure:1');
    await expect(open(await generateDeviceKey(), sealed, 'seizure:1')).rejects.toBeInstanceOf(DecryptError);
    await expect(open(key, { ...sealed, ct: `${sealed.ct.slice(0, -2)}AA` }, 'seizure:1')).rejects.toBeInstanceOf(
      DecryptError,
    );
    await expect(open(key, sealed, 'seizure:2')).rejects.toBeInstanceOf(DecryptError);
  });

  it('seals text that is not plain ASCII', async () => {
    const key = await generateDeviceKey();
    const text = 'Søvnmangel — 発作 🙂';
    expect(await open(key, await seal(key, text, 'a'), 'a')).toBe(text);
  });
});

describe('PIN wrapping', () => {
  it('unlocks with the right PIN and gives a key that opens the same records', async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, 'data', 'a');
    const wrapped = await wrapDeviceKeyWithPin(key, '2468', FAST);
    const unlocked = await unlockWithPin(wrapped, '2468');
    expect(await open(unlocked, sealed, 'a')).toBe('data');
  });

  it('the unlocked key cannot be taken out of WebCrypto', async () => {
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468', FAST);
    const unlocked = await unlockWithPin(wrapped, '2468');
    expect(unlocked.extractable).toBe(false);
    await expect(exportDeviceKey(unlocked)).rejects.toThrow();
  });

  it('refuses a wrong PIN', async () => {
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468', FAST);
    await expect(unlockWithPin(wrapped, '1357')).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('treats equal-looking PINs the same (Unicode normalisation) and different ones apart', async () => {
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), 'ﬁx', FAST); // "ﬁ" ligature normalises to "fi"
    expect(await unlockWithPin(wrapped, 'fix')).toBeTruthy();
  });

  it('refuses a wrapped key asking for absurd work, or the wrong kind of secret', async () => {
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468', PBKDF2_FAST);
    const salt = (wrapped.kdf as { salt: string }).salt;
    const refused = (kdf: Parameters<typeof unlockWithPin>[0]['kdf']) =>
      expect(unlockWithPin({ ...wrapped, kdf }, '2468')).rejects.toBeInstanceOf(WrongSecretError);
    await refused({ name: 'PBKDF2', hash: 'SHA-256', iterations: MAX_PBKDF2_ITERATIONS + 1, salt });
    await refused({ name: 'PBKDF2', hash: 'SHA-256', iterations: 0.5, salt });
    // Argon2id: too much memory, too many passes or lanes, too little memory for the lanes, or not whole numbers
    await refused({ name: 'Argon2id', m: MAX_ARGON2_MEMORY_KIB + 1, t: 1, p: 1, salt });
    await refused({ name: 'Argon2id', m: 64, t: MAX_ARGON2_PASSES + 1, p: 1, salt });
    await refused({ name: 'Argon2id', m: 64, t: 1, p: MAX_ARGON2_LANES + 1, salt });
    await refused({ name: 'Argon2id', m: 8 * 2 - 1, t: 1, p: 2, salt });
    await refused({ name: 'Argon2id', m: 64, t: 0, p: 1, salt });
    await refused({ name: 'Argon2id', m: 64.5, t: 1, p: 1, salt });
    await expect(unlockWithSecret(wrapped, randomBytes(32))).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('uses Argon2id at the app default when no setting is given', async () => {
    expect(DEFAULT_PIN_KDF).toEqual({ name: 'Argon2id', ...ARGON2_DEFAULT });
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468');
    expect(wrapped.kdf).toMatchObject({ name: 'Argon2id', ...ARGON2_DEFAULT });
    expect(await unlockWithPin(wrapped, '2468')).toBeTruthy();
  });

  it('accepts the smallest PBKDF2 count and refuses none', async () => {
    const key = await generateDeviceKey();
    const one = await wrapDeviceKeyWithPin(key, '2468', { name: 'PBKDF2', iterations: 1 });
    expect(await unlockWithPin(one, '2468')).toBeTruthy();
    await expect(wrapDeviceKeyWithPin(key, '2468', { name: 'PBKDF2', iterations: 0 })).rejects.toBeInstanceOf(
      WrongSecretError,
    );
  });

  it('still opens a wrap made with PBKDF2 (stores from M1)', async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, 'old', 'a');
    const wrapped = await wrapDeviceKeyWithPin(key, '2468', PBKDF2_FAST);
    expect(wrapped.kdf).toMatchObject({ name: 'PBKDF2', iterations: 1000 });
    expect(await open(await unlockWithPin(wrapped, '2468'), sealed, 'a')).toBe('old');
    await expect(unlockWithPin(wrapped, '1357')).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('makes a different wrapping key for a different salt, memory or PIN', async () => {
    const key = await generateDeviceKey();
    const a = await wrapDeviceKeyWithPin(key, '2468', FAST);
    const b = await wrapDeviceKeyWithPin(key, '2468', FAST);
    expect((a.kdf as { salt: string }).salt).not.toBe((b.kdf as { salt: string }).salt);
    expect(a.wrapped).not.toBe(b.wrapped);
    // the settings are part of the key: the same salt with other memory gives a key that does not open it
    await expect(
      unlockWithPin(
        { ...a, kdf: { ...(a.kdf as { name: 'Argon2id'; m: number; t: number; p: number; salt: string }), m: 72 } },
        '2468',
      ),
    ).rejects.toBeInstanceOf(WrongSecretError);
    await expect(
      unlockWithPin(
        { ...a, kdf: { ...(a.kdf as { name: 'Argon2id'; m: number; t: number; p: number; salt: string }), t: 2 } },
        '2468',
      ),
    ).rejects.toBeInstanceOf(WrongSecretError);
  });

  it("derives the same key as an independent Argon2id (Node's OpenSSL), so a library change cannot silently change PIN keys", async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, 'data', 'a');
    const salt = Buffer.from('0123456789abcdef');
    const iv = Buffer.from('0123456789ab');
    const kdf = { name: 'Argon2id', m: 64, t: 2, p: 1, salt: toBase64Url(salt) } as const;
    const raw = argon2Sync('argon2id', {
      message: Buffer.from('2468'),
      nonce: salt,
      parallelism: 1,
      tagLength: 32,
      memory: 64,
      passes: 2,
    });
    const wrapper = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
      'wrapKey',
      'unwrapKey',
    ]);
    const wrapped = new Uint8Array(await crypto.subtle.wrapKey('raw', key, wrapper, { name: 'AES-GCM', iv }));
    const unlocked = await unlockWithPin(
      { version: 1, kdf, iv: toBase64Url(iv), wrapped: toBase64Url(wrapped) },
      '2468',
    );
    expect(await open(unlocked, sealed, 'a')).toBe('data');
  });
});

describe('kdfIsCurrent', () => {
  const salt = 'AAAAAAAAAAAAAAAAAAAAAA';
  it('says what needs re-wrapping', () => {
    expect(kdfIsCurrent({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt })).toBe(false);
    expect(kdfIsCurrent({ name: 'Argon2id', ...ARGON2_DEFAULT, salt })).toBe(true);
    expect(kdfIsCurrent({ name: 'Argon2id', m: ARGON2_DEFAULT.m * 2, t: ARGON2_DEFAULT.t, p: 1, salt })).toBe(true);
    expect(kdfIsCurrent({ name: 'Argon2id', m: ARGON2_DEFAULT.m / 2, t: ARGON2_DEFAULT.t, p: 1, salt })).toBe(false);
    expect(kdfIsCurrent({ name: 'Argon2id', m: ARGON2_DEFAULT.m, t: ARGON2_DEFAULT.t - 1, p: 1, salt })).toBe(false);
    expect(kdfIsCurrent({ name: 'HKDF', salt })).toBe(true);
    expect(kdfIsCurrent({ name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt }, PBKDF2_FAST)).toBe(true);
    expect(kdfIsCurrent({ name: 'Argon2id', m: 64, t: 1, p: 1, salt }, PBKDF2_FAST)).toBe(false);
    expect(kdfIsCurrent({ name: 'PBKDF2', hash: 'SHA-256', iterations: 999, salt }, PBKDF2_FAST)).toBe(false);
    expect(kdfIsCurrent({ name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt }, TEST_PIN_KDF)).toBe(false);
    expect(kdfIsCurrent({ name: 'Argon2id', m: 64, t: 1, p: 1, salt }, { name: 'Argon2id', m: 64, t: 1, p: 2 })).toBe(
      false,
    );
    expect(kdfIsCurrent({ name: 'Argon2id', m: 64, t: 1, p: 2, salt }, { name: 'Argon2id', m: 64, t: 1, p: 2 })).toBe(
      true,
    );
  });
});

describe('secret wrapping (passkey or recovery key)', () => {
  it('unlocks with the same secret only', async () => {
    const key = await generateDeviceKey();
    const secret = randomBytes(32);
    const wrapped = await wrapDeviceKeyWithSecret(key, secret);
    const sealed = await seal(key, 'data', 'a');
    expect(await open(await unlockWithSecret(wrapped, secret), sealed, 'a')).toBe('data');
    await expect(unlockWithSecret(wrapped, randomBytes(32))).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithPin(wrapped, '1234')).rejects.toBeInstanceOf(WrongSecretError);
  });
});

describe('recovery export', () => {
  it('exports and re-imports a device key', async () => {
    const key = await generateDeviceKey();
    const sealed = await seal(key, 'data', 'a');
    const again = await importDeviceKey(await exportDeviceKey(key));
    expect(await open(again, sealed, 'a')).toBe('data');
  });
});

describe('backup keys', () => {
  it('derives the same key from the same passphrase and salt only', async () => {
    const salt = randomBytes(16);
    const a = await backupKey('correct horse', salt, 1000);
    const sealed = await seal(a, 'x', 'b');
    expect(await open(await backupKey('correct horse', salt, 1000), sealed, 'b')).toBe('x');
    await expect(open(await backupKey('wrong', salt, 1000), sealed, 'b')).rejects.toBeInstanceOf(DecryptError);
    await expect(backupKey('x', salt, MAX_PBKDF2_ITERATIONS + 1)).rejects.toBeInstanceOf(DecryptError);
  });
});
