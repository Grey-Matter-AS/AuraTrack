import { utf8 } from './bytes';

/** A UUID derived from text (SHA-256, laid out as a version-5 UUID): the same input always gives the same id, so importing the same CSV file again finds the same records. */
export async function derivedId(...parts: string[]): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', utf8(parts.join('\u0000'))));
  const b = digest.slice(0, 16);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x50;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
