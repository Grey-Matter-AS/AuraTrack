import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, type Bytes } from './bytes';

// Encryption at rest (README 4.5). Every record is sealed with AES-GCM under one device key made with WebCrypto. The
// device key is never stored as it is: it is wrapped (encrypted) by a key made from the user's PIN, or by a secret from
// a passkey where the browser supports WebAuthn PRF. Once unlocked, the working key is non-extractable.
//
// PIN key derivation is PBKDF2-SHA256 with many iterations. Argon2id is the better choice and has a place in `KdfParams`;
// it needs a WebAssembly library and arrives with the lock screen (M2), so PBKDF2 is the fallback the plan allows.

export const AES_KEY_BITS = 256;
export const PBKDF2_ITERATIONS = 600_000;
/** A file or record asking for more would freeze the app while deriving the key. */
export const MAX_PBKDF2_ITERATIONS = 2_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser does not support encryption.');
  return s;
};

export class WrongSecretError extends Error {
  constructor() {
    super('Incorrect PIN or damaged key');
    this.name = 'WrongSecretError';
  }
}

export class DecryptError extends Error {
  constructor() {
    super('Could not decrypt: wrong key, or the data was changed');
    this.name = 'DecryptError';
  }
}

/** How the wrapping key is made from a secret. Only PBKDF2 is implemented; the name leaves room for Argon2id. */
export interface KdfParams {
  readonly name: 'PBKDF2';
  readonly hash: 'SHA-256';
  readonly iterations: number;
  readonly salt: string;
}

export interface WrappedKey {
  readonly version: 1;
  /** How the secret becomes a key: from a PIN, or already strong (a passkey secret, a recovery key). */
  readonly kdf: KdfParams | { readonly name: 'HKDF'; readonly salt: string };
  readonly iv: string;
  readonly wrapped: string;
}

/** A fresh device key. Extractable only so it can be wrapped once; unwrapping gives a non-extractable key. */
export const generateDeviceKey = (): Promise<CryptoKey> =>
  subtle().generateKey({ name: 'AES-GCM', length: AES_KEY_BITS }, true, ['encrypt', 'decrypt']);

async function pinKey(pin: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', utf8(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function secretKey(secret: Uint8Array, salt: Bytes): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', secret as Bytes, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8('auratrack device key') },
    base,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function wrapWith(wrapper: CryptoKey, key: CryptoKey, iv: Bytes): Promise<string> {
  return toBase64Url(new Uint8Array(await subtle().wrapKey('raw', key, wrapper, { name: 'AES-GCM', iv })));
}

export async function wrapDeviceKeyWithPin(
  key: CryptoKey,
  pin: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrapped = await wrapWith(await pinKey(pin, salt, iterations), key, iv);
  return {
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64Url(salt) },
    iv: toBase64Url(iv),
    wrapped,
  };
}

/** Wrap with a secret that is already strong (a passkey's PRF output, or a recovery key). */
export async function wrapDeviceKeyWithSecret(key: CryptoKey, secret: Uint8Array): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrapped = await wrapWith(await secretKey(secret, salt), key, iv);
  return { version: 1, kdf: { name: 'HKDF', salt: toBase64Url(salt) }, iv: toBase64Url(iv), wrapped };
}

async function unwrap(wrapper: CryptoKey, wrapped: WrappedKey, extractable: boolean): Promise<CryptoKey> {
  try {
    return await subtle().unwrapKey(
      'raw',
      fromBase64Url(wrapped.wrapped),
      wrapper,
      { name: 'AES-GCM', iv: fromBase64Url(wrapped.iv) },
      { name: 'AES-GCM', length: AES_KEY_BITS },
      extractable,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new WrongSecretError();
  }
}

/** `extractable` is only for the moments the key must be wrapped again (a new PIN, a recovery kit); the working key never is. */
export async function unlockWithPin(wrapped: WrappedKey, pin: string, extractable = false): Promise<CryptoKey> {
  if (wrapped.kdf.name !== 'PBKDF2') throw new WrongSecretError();
  const { iterations, salt } = wrapped.kdf;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS)
    throw new WrongSecretError();
  return unwrap(await pinKey(pin, fromBase64Url(salt), iterations), wrapped, extractable);
}

export async function unlockWithSecret(
  wrapped: WrappedKey,
  secret: Uint8Array,
  extractable = false,
): Promise<CryptoKey> {
  if (wrapped.kdf.name !== 'HKDF') throw new WrongSecretError();
  return unwrap(await secretKey(secret, fromBase64Url(wrapped.kdf.salt)), wrapped, extractable);
}

/** The raw bytes of a device key, for the recovery kit only. */
export async function exportDeviceKey(key: CryptoKey): Promise<Bytes> {
  return new Uint8Array(await subtle().exportKey('raw', key));
}

export const importDeviceKey = (raw: Uint8Array): Promise<CryptoKey> =>
  subtle().importKey('raw', raw as Bytes, { name: 'AES-GCM', length: AES_KEY_BITS }, false, ['encrypt', 'decrypt']);

export interface Sealed {
  readonly iv: string;
  readonly ct: string;
}

/** Seal text. `aad` is authenticated but not stored: it ties a ciphertext to its place, so records cannot be swapped. */
export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: utf8(aad) }, key, utf8(plaintext));
  return { iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(ct)) };
}

export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<string> {
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(sealed.iv), additionalData: utf8(aad) },
      key,
      fromBase64Url(sealed.ct),
    );
    return fromUtf8(new Uint8Array(plain));
  } catch {
    throw new DecryptError();
  }
}

/** A passphrase-based key for a backup file: derived each time, never stored. */
export async function backupKey(passphrase: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) throw new DecryptError();
  const base = await subtle().importKey('raw', utf8(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}
