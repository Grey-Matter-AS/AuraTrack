import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, type Bytes } from './bytes';

// Encryption at rest (README 4.5). Every record is sealed with AES-GCM under one device key made with WebCrypto. The
// device key is never stored as it is: it is wrapped (encrypted) by a key made from the user's PIN, or by a secret from
// a passkey where the browser supports WebAuthn PRF. Once unlocked, the working key is non-extractable.
//
// PIN key derivation is Argon2id (memory-hard, so guessing a short PIN on a graphics card or a rack of machines is slow
// and costly). It runs as WebAssembly (hash-wasm), loaded only when a PIN is used. Stores made in M1 used PBKDF2-SHA256;
// those still unlock, and are re-wrapped under Argon2id on their next successful unlock (`kdfIsCurrent`).

export const AES_KEY_BITS = 256;
export const PBKDF2_ITERATIONS = 600_000;
/** A file or record asking for more would freeze the app while deriving the key. */
export const MAX_PBKDF2_ITERATIONS = 2_000_000;
/** Memory in KiB, passes and lanes. Tuned on real phones (see docs/plan/M3.md, slice 1); never lower than these limits say. */
export const ARGON2_DEFAULT = { m: 32_768, t: 3, p: 1 } as const;
/** Limits on what a stored key may ask for, so a damaged or hostile record cannot freeze or crash the app. */
export const MAX_ARGON2_MEMORY_KIB = 262_144;
export const MAX_ARGON2_PASSES = 12;
export const MAX_ARGON2_LANES = 4;
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

/** How the wrapping key is made from a PIN. PBKDF2 is read for stores made before Argon2id; new wraps use Argon2id. */
export interface Pbkdf2Params {
  readonly name: 'PBKDF2';
  readonly hash: 'SHA-256';
  readonly iterations: number;
  readonly salt: string;
}
export interface Argon2idParams {
  readonly name: 'Argon2id';
  /** Memory in KiB. */
  readonly m: number;
  /** Passes. */
  readonly t: number;
  /** Lanes. */
  readonly p: number;
  readonly salt: string;
}
export type KdfParams = Pbkdf2Params | Argon2idParams;

/** What to make a new PIN wrap with. The default is Argon2id at `ARGON2_DEFAULT`; a smaller setting is for tests only. */
export type PinKdf =
  | { readonly name: 'Argon2id'; readonly m: number; readonly t: number; readonly p: number }
  | { readonly name: 'PBKDF2'; readonly iterations: number };
export const DEFAULT_PIN_KDF: PinKdf = { name: 'Argon2id', ...ARGON2_DEFAULT };
/** Cheap settings so tests do not each spend a second deriving keys. Never used by the app. */
export const TEST_PIN_KDF: PinKdf = { name: 'Argon2id', m: 64, t: 1, p: 1 };

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

const validArgon2 = (k: Argon2idParams): boolean =>
  Number.isInteger(k.m) &&
  Number.isInteger(k.t) &&
  Number.isInteger(k.p) &&
  k.p >= 1 &&
  k.p <= MAX_ARGON2_LANES &&
  k.t >= 1 &&
  k.t <= MAX_ARGON2_PASSES &&
  k.m >= 8 * k.p &&
  k.m <= MAX_ARGON2_MEMORY_KIB;

const validPbkdf2 = (iterations: number): boolean =>
  Number.isInteger(iterations) && iterations >= 1 && iterations <= MAX_PBKDF2_ITERATIONS;

const WRAP_USAGES: KeyUsage[] = ['wrapKey', 'unwrapKey'];

async function argon2Key(pin: string, kdf: Argon2idParams): Promise<CryptoKey> {
  const { argon2Bytes } = await import('./argon2'); // loaded only when a PIN is used
  const raw = await argon2Bytes({
    password: utf8(pin.normalize('NFKC')),
    salt: fromBase64Url(kdf.salt),
    m: kdf.m,
    t: kdf.t,
    p: kdf.p,
  });
  try {
    return await subtle().importKey('raw', raw as Bytes, { name: 'AES-GCM', length: AES_KEY_BITS }, false, WRAP_USAGES);
  } finally {
    raw.fill(0);
  }
}

async function pbkdf2Key(pin: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', utf8(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    WRAP_USAGES,
  );
}

/** The wrapping key for a PIN under the stored settings. Settings outside the limits are refused before any work starts. */
async function pinKey(pin: string, kdf: KdfParams): Promise<CryptoKey> {
  if (kdf.name === 'Argon2id') {
    if (!validArgon2(kdf)) throw new WrongSecretError();
    return argon2Key(pin, kdf);
  }
  if (!validPbkdf2(kdf.iterations)) throw new WrongSecretError();
  return pbkdf2Key(pin, fromBase64Url(kdf.salt), kdf.iterations);
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
  setting: PinKdf = DEFAULT_PIN_KDF,
): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const saltText = toBase64Url(salt);
  const kdf: KdfParams =
    setting.name === 'Argon2id'
      ? { name: 'Argon2id', m: setting.m, t: setting.t, p: setting.p, salt: saltText }
      : { name: 'PBKDF2', hash: 'SHA-256', iterations: setting.iterations, salt: saltText };
  const wrapped = await wrapWith(await pinKey(pin, kdf), key, iv);
  return { version: 1, kdf, iv: toBase64Url(iv), wrapped };
}

/** Does this wrap already use the settings we would make today (or stronger)? If not, it is re-wrapped on the next unlock. */
export function kdfIsCurrent(kdf: WrappedKey['kdf'], target: PinKdf = DEFAULT_PIN_KDF): boolean {
  if (kdf.name === 'HKDF') return true; // a strong secret, not a PIN
  if (target.name === 'PBKDF2') return kdf.name === 'PBKDF2' && kdf.iterations >= target.iterations;
  return kdf.name === 'Argon2id' && kdf.m >= target.m && kdf.t >= target.t && kdf.p >= target.p;
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
  if (wrapped.kdf.name === 'HKDF') throw new WrongSecretError();
  return unwrap(await pinKey(pin, wrapped.kdf), wrapped, extractable);
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

/** Seal bytes (a video): the ciphertext stays bytes, so a large file is not made a third bigger by base64. */
export async function sealBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: string,
): Promise<{ iv: Uint8Array; data: Uint8Array }> {
  const iv = randomBytes(IV_BYTES);
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: utf8(aad) }, key, plaintext as Bytes);
  return { iv, data: new Uint8Array(data) };
}

export async function openBytes(
  key: CryptoKey,
  sealed: { iv: Uint8Array; data: Uint8Array },
  aad: string,
): Promise<Uint8Array> {
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: sealed.iv as Bytes, additionalData: utf8(aad) },
      key,
      sealed.data as Bytes,
    );
    return new Uint8Array(plain);
  } catch {
    throw new DecryptError();
  }
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
