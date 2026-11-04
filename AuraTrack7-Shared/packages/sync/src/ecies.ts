import { fromB64, randomBytes, toB64 } from './seal';

// Sealing something to one device: the device has a key pair (the public half is in the household's device list); whoever
// seals makes a one-time key pair, agrees a key with the device's public half, and seals with that. Only the device's private
// half opens it, so the hub (and every other device) can carry it but not read it.

export interface DeviceKeyPair {
  /** The public half, 65 bytes, base64url. Published in the household's device list. */
  pub: string;
  /** The private half (PKCS#8), base64url. Never leaves this device. */
  priv: string;
}

const CURVE = { name: 'ECDH', namedCurve: 'P-256' } as const;
const INFO = new TextEncoder().encode('auratrack-key-grant');

export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  return {
    pub: toB64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    priv: toB64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))),
  };
}

async function aesFrom(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** `onetimePublic.iv.ciphertext`. The aad ties the text to who sent it and who it is for. */
export async function sealTo(devicePub: string, text: string, aad: string): Promise<string> {
  const ephemeral = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const their = await crypto.subtle.importKey('raw', fromB64(devicePub), CURVE, false, []);
  const key = await aesFrom(ephemeral.privateKey, their);
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    key,
    new TextEncoder().encode(text),
  );
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  return `${toB64(pub)}.${toB64(iv)}.${toB64(new Uint8Array(data))}`;
}

/** Opens what `sealTo` made for this device. Throws if it was not for this device, was changed, or has another aad. */
export async function openWith(pair: DeviceKeyPair, sealed: string, aad: string): Promise<string> {
  const parts = sealed.split('.');
  if (parts.length !== 3) throw new Error('not sealed to a device');
  const mine = await crypto.subtle.importKey('pkcs8', fromB64(pair.priv), CURVE, false, ['deriveBits']);
  const their = await crypto.subtle.importKey('raw', fromB64(parts[0] as string), CURVE, false, []);
  const key = await aesFrom(mine, their);
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(parts[1] as string), additionalData: new TextEncoder().encode(aad) },
    key,
    fromB64(parts[2] as string),
  );
  return new TextDecoder().decode(data);
}
