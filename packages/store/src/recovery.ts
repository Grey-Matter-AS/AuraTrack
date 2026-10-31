import QRCode from 'qrcode';
import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, type Bytes } from './bytes';

// The recovery kit: a secret that can unlock this device's data if the PIN is forgotten, printed as text and as a QR code
// to keep somewhere safe. It holds the household id and a recovery secret. Keys for sharing between devices join it in M6;
// the format is versioned for that.

const PREFIX = 'AT7KIT1';

export class InvalidKitError extends Error {
  constructor() {
    super('This is not a valid recovery kit');
    this.name = 'InvalidKitError';
  }
}

export const newRecoverySecret = (): Bytes => randomBytes(32);

async function checksum(payload: string): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', utf8(payload)));
  return toBase64Url(digest.slice(0, 6));
}

export async function buildRecoveryKit(householdId: string, secret: Uint8Array): Promise<string> {
  const payload = toBase64Url(utf8(JSON.stringify({ v: 1, h: householdId, k: toBase64Url(secret) })));
  return `${PREFIX}.${payload}.${await checksum(payload)}`;
}

/** Reads a kit from its text (typed or scanned). Throws InvalidKitError for anything damaged or foreign. */
export async function parseRecoveryKit(text: string): Promise<{ householdId: string; secret: Bytes }> {
  const [prefix, payload, check, ...rest] = text.trim().split('.');
  if (prefix !== PREFIX || !payload || !check || rest.length > 0 || (await checksum(payload)) !== check)
    throw new InvalidKitError();
  try {
    const body = JSON.parse(fromUtf8(fromBase64Url(payload))) as { v?: unknown; h?: unknown; k?: unknown };
    if (body.v !== 1 || typeof body.h !== 'string' || typeof body.k !== 'string') throw new InvalidKitError();
    const secret = fromBase64Url(body.k);
    if (secret.length !== 32) throw new InvalidKitError();
    return { householdId: body.h, secret };
  } catch {
    throw new InvalidKitError();
  }
}

/** The kit as an SVG QR code, for printing. */
export const recoveryKitQr = (kit: string): Promise<string> =>
  QRCode.toString(kit, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
