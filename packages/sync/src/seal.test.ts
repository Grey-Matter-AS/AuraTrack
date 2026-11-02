import { describe, expect, it } from 'vitest';
import {
  fromB64,
  keyIdOf,
  newestKey,
  newKey,
  NoKeyError,
  openJson,
  openText,
  SealError,
  sealJson,
  sealText,
  sha256Hex,
  toB64,
} from './seal';

describe('base64url', () => {
  it('round-trips every byte value, with no padding and no characters that need escaping in a URL', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    const text = toB64(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect([...fromB64(text)]).toEqual([...bytes]);
  });
  it('round-trips lengths that need one, two and no padding characters', () => {
    for (const n of [1, 2, 3, 4]) {
      const bytes = new Uint8Array(n).fill(251);
      expect([...fromB64(toB64(bytes))]).toEqual([...bytes]);
    }
  });
});

describe('sealed text', () => {
  const key = newKey(1);

  it('opens with the key it names, and says which key that is', async () => {
    const sealed = await sealText(key, 'hello', 'a');
    expect(keyIdOf(sealed)).toBe(key.id);
    expect(await openText([newKey(2), key], sealed, 'a')).toBe('hello');
  });
  it('does not open for another purpose, after damage, or when it is not sealed text at all', async () => {
    const sealed = await sealText(key, 'hello', 'a');
    await expect(openText([key], sealed, 'b')).rejects.toBeInstanceOf(SealError);
    const parts = sealed.split('.');
    await expect(
      openText([key], `${parts[0]}.${parts[1]}.${'A'.repeat((parts[2] as string).length)}`, 'a'),
    ).rejects.toBeInstanceOf(SealError);
    await expect(openText([key], 'one.two', 'a')).rejects.toThrow('not sealed text');
  });
  it('tells a key this device does not hold apart from a damaged message', async () => {
    const sealed = await sealText(newKey(3), 'hello', 'a');
    await expect(openText([key], sealed, 'a')).rejects.toBeInstanceOf(NoKeyError);
    await expect(openText([], sealed, 'a')).rejects.toBeInstanceOf(NoKeyError);
  });
  it('gives JSON back, and a SealError for text that was sealed but is not JSON', async () => {
    expect(await openJson([key], await sealJson(key, { a: [1, 2] }, 'j'), 'j')).toEqual({ a: [1, 2] });
    await expect(openJson([key], await sealText(key, '{not json', 'j'), 'j')).rejects.toThrow('not valid');
    await expect(openJson([key], 'x.y.z', 'j')).rejects.toBeInstanceOf(SealError);
  });
  it('keeps working past the number of keys it remembers', async () => {
    for (let i = 0; i < 520; i++) await sealText(newKey(i), 'x', 'a');
    expect(await openText([key], await sealText(key, 'still fine', 'a'), 'a')).toBe('still fine');
  });
});

describe('newestKey', () => {
  it('is nothing for no keys, and the latest made otherwise, whatever the order', () => {
    const [a, b, c] = [newKey(10), newKey(30), newKey(20)];
    expect(newestKey([])).toBeNull();
    expect(newestKey([a, b, c])?.id).toBe(b.id);
    expect(newestKey([b, a, c])?.id).toBe(b.id);
  });
});

describe('sha256Hex', () => {
  it('is the standard digest, in lower-case hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
