// Draws every app icon from the official logo in docs/brand, into apps/web/public/icons.
// Also writes the small copy the PDF reports carry inside them (packages/reports/src/pdf/logo.ts: a worker makes the PDF,
// offline, so the picture must be in the code). Run by hand after a logo changes: `pnpm icons`. The bird is black, so it always sits on a light tile: on the
// app's navy it would disappear. The browser does the drawing, so there is no image library to install.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/web/public/icons');

// box is the bird inside its file; fill is the share of the tile it takes; radius is the tile's corner, as a share
const mark = { file: 'logo-mark.png', box: [140, 125, 934, 931] };
const ICONS = [
  { name: 'favicon-32.png', size: 32, ...mark, fill: 0.9, radius: 0.2 },
  { name: 'apple-touch-180.png', size: 180, ...mark, fill: 0.74, radius: 0 }, // iPhones round the corners themselves
  { name: 'icon-192.png', size: 192, ...mark, fill: 0.8, radius: 0.22 },
  { name: 'icon-512.png', size: 512, ...mark, fill: 0.8, radius: 0.22 },
  { name: 'maskable-512.png', size: 512, ...mark, fill: 0.62, radius: 0 }, // Android may keep only the middle 80%
];

/* global Image, document */ // draw runs inside the browser
const draw = async ({ size, box, fill, radius, tile = '#f8fafc', url }) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.fillStyle = tile; // the light theme's page colour unless told otherwise
  c.beginPath();
  c.roundRect(0, 0, size, size, size * radius);
  c.fill();
  const [x0, y0, x1, y1] = box;
  const scale = (size * fill) / Math.max(x1 - x0, y1 - y0);
  const [w, h] = [(x1 - x0) * scale, (y1 - y0) * scale];
  c.drawImage(image, x0, y0, x1 - x0, y1 - y0, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/png');
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const { name, file, ...icon } of ICONS) {
  const bytes = await readFile(join(root, 'docs/brand', file));
  const url = await page.evaluate(draw, { ...icon, url: `data:image/png;base64,${bytes.toString('base64')}` });
  await writeFile(join(out, name), Buffer.from(url.split(',')[1], 'base64'));
}
// For paper: white like the page, 96 px is about 380 dpi at the size it prints
const bytes = await readFile(join(root, 'docs/brand', mark.file));
const report = await page.evaluate(draw, {
  ...mark,
  size: 96,
  fill: 1,
  radius: 0,
  tile: '#ffffff',
  url: `data:image/png;base64,${bytes.toString('base64')}`,
});
await writeFile(
  join(root, 'packages/reports/src/pdf/logo.ts'),
  `// Made by \`pnpm icons\` from docs/brand/logo-mark.png. Do not edit.\nexport const LOGO_PNG =\n  '${report}';\n`,
);
await browser.close();
