// Small byte helpers shared by the crypto, the backup and the importer.
export type Bytes = Uint8Array<ArrayBuffer>;

export const randomBytes = (length: number): Bytes => globalThis.crypto.getRandomValues(new Uint8Array(length));
export const utf8 = (text: string): Bytes => new TextEncoder().encode(text);
export const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Bytes {
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
