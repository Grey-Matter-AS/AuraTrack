// Generates the 6.1 report reference from MADE-UP data only (seeded random, fixed clock).
// Runs the built 6.x app read-only; nothing is written into the 6.x folder.
// Usage: node AuraTrack7-Shared/scripts/gen-6x-reference.mjs <6.x app url> <output dir>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const [url = 'http://127.0.0.1:4180', out = 'docs/plan/reports-6.1'] = process.argv.slice(2);
const SEED_FILE = '/home/user01/Projects/AuraTrack6/scripts/seed-browser-db-100.js';
const FIXED_NOW = new Date('2026-10-15T12:00:00');

// mulberry32: same sequence every run, so the reference is reproducible
const prng = `(() => { let a = 20261015; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`;
const seed = readFileSync(SEED_FILE, 'utf8')
  .replaceAll('Math.random()', '__rng()')
  .replace('Math.random().toString(36)', '__rng().toString(36)')
  .replace('const DB_VERSION = 10;', 'const DB_VERSION = 130;'); // Dexie opens 6.x at 13 x 10

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  acceptDownloads: true,
  locale: 'en-GB',
  timezoneId: 'Europe/Oslo',
});
const page = await ctx.newPage();
await page.clock.setFixedTime(FIXED_NOW);
await page.addInitScript(() => {
  delete globalThis.showSaveFilePicker;
}); // force plain downloads
await page.goto(url);
await page.waitForTimeout(2000); // let the app create its own database first
await page.evaluate(`window.__rng = ${prng}`);
await page.evaluate(seed);
await page.reload();
await page.waitForTimeout(1500);
await page.getByText('HISTORY', { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole('tab', { name: 'Export' }).click();
await page.waitForTimeout(500);
// 90-day range matching the seed
await page.locator('input[type=date]').nth(0).fill('2026-07-17');
await page.locator('input[type=date]').nth(1).fill('2026-10-15');

const btn = (name) => page.getByRole('button', { name, exact: true });
const save = async (name, i, file) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), btn(name).nth(i).click()]);
  await dl.saveAs(`${out}/${file}`);
  console.log('saved', file);
};
const preview = async (i, file) => {
  await btn(/open preview/i)
    .nth(i)
    .click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
  console.log('preview', file);
  await page.locator('button.shrink-0', { hasText: /back/i }).click();
  await page.waitForTimeout(500);
};
await save(/generate/i, 0, 'csv-export.csv');
const names = ['event-log', 'neurologist-report', 'seizure-diary', 'eeg-diary'];
for (let i = 0; i < names.length; i++) {
  await save(/download pdf/i, i, `${names[i]}.pdf`).catch((e) =>
    console.log('FAILED', names[i], e.message.split('\n')[0]),
  );
  await preview(i, `${names[i]}-preview.png`).catch((e) =>
    console.log('FAILED preview', names[i], e.message.split('\n')[0]),
  );
}
await browser.close();
