import { randomBytes, utf8, type Bytes } from './bytes';

// Unlock with Face ID or a fingerprint through a passkey, where the browser supports the WebAuthn PRF extension. The
// passkey itself never leaves the authenticator. PRF gives a secret that only this passkey can reproduce; that secret
// wraps the device key (wrapDeviceKeyWithSecret). If PRF is not supported the app uses the PIN alone.

/** The part of navigator.credentials that is used, so tests can stand in for a real authenticator. */
export interface CredentialsLike {
  create(options: { publicKey: Record<string, unknown> }): Promise<CredentialResult | null>;
  get(options: { publicKey: Record<string, unknown> }): Promise<CredentialResult | null>;
}
export interface CredentialResult {
  rawId: ArrayBuffer;
  getClientExtensionResults(): { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
}

export interface PasskeyEnv {
  credentials: CredentialsLike;
  rpId: string;
  rpName: string;
}

export interface PasskeyHandle {
  /** The credential id, stored beside the wrapped key so the right passkey is asked for. */
  readonly credentialId: Bytes;
  /** The salt given to PRF; the same salt always gives the same secret. */
  readonly prfSalt: Bytes;
}

export class PasskeyUnsupportedError extends Error {
  constructor() {
    super('This device or browser cannot unlock with a passkey');
    this.name = 'PasskeyUnsupportedError';
  }
}

/** Makes a passkey for this device and its first secret. Throws PasskeyUnsupportedError when PRF is not available. */
export async function createPasskey(
  env: PasskeyEnv,
  userId: string,
  userName: string,
): Promise<{ handle: PasskeyHandle; secret: Bytes }> {
  const prfSalt = randomBytes(32);
  const created = await env.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { id: env.rpId, name: env.rpName },
      user: { id: utf8(userId), name: userName, displayName: userName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  if (!created || created.getClientExtensionResults().prf?.enabled !== true) throw new PasskeyUnsupportedError();
  const handle: PasskeyHandle = { credentialId: new Uint8Array(created.rawId), prfSalt };
  // Some authenticators only return the secret on a later request
  return { handle, secret: await passkeySecret(env, handle) };
}

/** Asks the user to verify (Face ID, fingerprint) and returns the secret that unwraps the device key. */
export async function passkeySecret(env: PasskeyEnv, handle: PasskeyHandle): Promise<Bytes> {
  const got = await env.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: env.rpId,
      allowCredentials: [{ type: 'public-key', id: handle.credentialId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: handle.prfSalt } } },
    },
  });
  const first = got?.getClientExtensionResults().prf?.results?.first;
  if (!first) throw new PasskeyUnsupportedError();
  return new Uint8Array(first);
}
