import { describe, expect, it } from 'vitest';
import { fromBase64Url, randomBytes, toBase64Url } from './bytes';
import {
  DecryptError,
  MAX_PBKDF2_ITERATIONS,
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

// A low iteration count keeps the tests fast; the real default is 600,000.
const FAST = 1000;

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
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468', FAST);
    await expect(
      unlockWithPin(
        {
          ...wrapped,
          kdf: {
            ...(wrapped.kdf as { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }),
            iterations: MAX_PBKDF2_ITERATIONS + 1,
          },
        },
        '2468',
      ),
    ).rejects.toBeInstanceOf(WrongSecretError);
    await expect(
      unlockWithPin({ ...wrapped, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 0.5, salt: 'aa' } }, '2468'),
    ).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithSecret(wrapped, randomBytes(32))).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('uses the strong default when no count is given', async () => {
    const wrapped = await wrapDeviceKeyWithPin(await generateDeviceKey(), '2468');
    expect(wrapped.kdf).toMatchObject({ name: 'PBKDF2', iterations: 600_000 });
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
    const a = await backupKey('correct horse', salt, FAST);
    const sealed = await seal(a, 'x', 'b');
    expect(await open(await backupKey('correct horse', salt, FAST), sealed, 'b')).toBe('x');
    await expect(open(await backupKey('wrong', salt, FAST), sealed, 'b')).rejects.toBeInstanceOf(DecryptError);
    await expect(backupKey('x', salt, MAX_PBKDF2_ITERATIONS + 1)).rejects.toBeInstanceOf(DecryptError);
  });
});
