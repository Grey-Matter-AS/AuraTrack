// Small sealing helpers for what travels between devices. Every message is sealed with a key the household shares
// (or, for one patient's records, a key only the devices that follow that patient hold), on top of the channel's own
// encryption, so the signalling broker and anything on the way sees nothing readable.

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealError';
  }
}

/** The message names a key this device does not hold (as opposed to one that is damaged or forged). */
export class NoKeyError extends SealError {
  constructor() {
    super('no key for this message');
    this.name = 'NoKeyError';
  }
}

const URL_SAFE = /[+/=]/g;
export const toB64 = (bytes: Uint8Array): string => {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(URL_SAFE, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
};
export const fromB64 = (text: string): Uint8Array<ArrayBuffer> => {
  const plain = text.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
export const randomBytes = (n: number): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
};
export const randomId = (): string => toB64(randomBytes(12));

/** A shared key: an id (so a message says which key opens it), the key itself, and when it was made. */
export interface KeyEntry {
  readonly id: string;
  /** 32 bytes, base64url. Kept sealed under the device key at rest. */
  readonly raw: string;
  readonly createdAt: number;
}

export const newKey = (now: number): KeyEntry => ({ id: randomId(), raw: toB64(randomBytes(32)), createdAt: now });

const imported = new Map<string, Promise<CryptoKey>>();
const aesKey = (entry: KeyEntry): Promise<CryptoKey> => {
  let key = imported.get(entry.raw);
  if (!key) {
    key = crypto.subtle.importKey('raw', fromB64(entry.raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
    imported.set(entry.raw, key);
    if (imported.size > 500) imported.delete(imported.keys().next().value as string);
  }
  return key;
};

/** `keyId.iv.ciphertext`, all base64url. The aad ties the text to what it is for, so it cannot be moved elsewhere. */
export async function sealText(entry: KeyEntry, text: string, aad: string): Promise<string> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    await aesKey(entry),
    new TextEncoder().encode(text),
  );
  return `${entry.id}.${toB64(iv)}.${toB64(new Uint8Array(data))}`;
}

export const keyIdOf = (sealed: string): string => sealed.split('.')[0] ?? '';

/** Opens with the key the text names, if it is one of `keys`. Anything else throws SealError. */
export async function openText(keys: readonly KeyEntry[], sealed: string, aad: string): Promise<string> {
  const parts = sealed.split('.');
  if (parts.length !== 3) throw new SealError('not sealed text');
  const entry = keys.find((k) => k.id === parts[0]);
  if (!entry) throw new NoKeyError();
  try {
    const data = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(parts[1] as string), additionalData: new TextEncoder().encode(aad) },
      await aesKey(entry),
      fromB64(parts[2] as string),
    );
    return new TextDecoder().decode(data);
  } catch {
    throw new SealError('could not open this message');
  }
}

export const sealJson = (entry: KeyEntry, value: unknown, aad: string): Promise<string> =>
  sealText(entry, JSON.stringify(value), aad);
export async function openJson(keys: readonly KeyEntry[], sealed: string, aad: string): Promise<unknown> {
  try {
    return JSON.parse(await openText(keys, sealed, aad));
  } catch (error) {
    if (error instanceof SealError) throw error;
    throw new SealError('not valid');
  }
}

/** The newest key of a list: what new data is sealed with. */
export const newestKey = (keys: readonly KeyEntry[]): KeyEntry | null =>
  keys.reduce<KeyEntry | null>((best, k) => (best === null || k.createdAt > best.createdAt ? k : best), null);

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
