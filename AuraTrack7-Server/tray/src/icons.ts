import { deflateSync } from 'node:zlib';
import type { TrayLight } from './model';

// The tray icons, drawn here as small PNGs (and wrapped as ICO for Windows), so there is no image file to ship.

const COLOURS: Record<TrayLight, [number, number, number]> = {
  ok: [0x1f, 0x9d, 0x55],
  waiting: [0xe0, 0x9b, 0x1a],
  down: [0xd0, 0x3b, 0x3b],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array): Buffer => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

/** A round dot of the light's colour on a transparent square. */
export function png(light: TrayLight, size = 32): Buffer {
  const [r, g, b] = COLOURS[light];
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - mid, y - mid);
      const alpha = Math.max(0, Math.min(1, size / 2 - 1 - d + 1)) * 255;
      const at = y * (size * 4 + 1) + 1 + x * 4;
      rows[at] = r;
      rows[at + 1] = g;
      rows[at + 2] = b;
      rows[at + 3] = Math.round(alpha);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** The same dot as an ICO holding one PNG (Windows reads that). */
export function ico(light: TrayLight, size = 32): Buffer {
  const image = png(light, size);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2); // icon
  head.writeUInt16LE(1, 4); // one image
  head[6] = size;
  head[7] = size;
  head.writeUInt16LE(1, 12); // planes
  head.writeUInt16LE(32, 14); // bits
  head.writeUInt32LE(image.length, 14 + 4);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, image]);
}

export const iconFor = (light: TrayLight, platform: NodeJS.Platform): string =>
  (platform === 'win32' ? ico(light) : png(light)).toString('base64');
