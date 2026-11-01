import { expect, test, type Page } from '@playwright/test';
import { auditInPage, type AuditOptions, type Violation } from './audit-checks';

// The layout audit (docs/plan/M2.md, item 4): the kitchen sink page, every component in every state, walked on each device
// of the matrix, in dark and light, with every accent colour and every text size. It fails on overlap, clipping, anything
// off the screen, a tap target under 44px, or text under 4.5:1 contrast. It is a permanent test: every later screen is
// built from the same components, so what passes here keeps passing.

interface Device {
  name: string;
  width: number;
  height: number;
}

const MATRIX: Device[] = [
  { name: 'tiny phone (320)', width: 320, height: 568 },
  { name: 'small iPhone', width: 375, height: 667 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'small Android', width: 360, height: 640 },
  { name: 'Pixel', width: 412, height: 915 },
  { name: 'iPad portrait', width: 810, height: 1080 },
  { name: 'iPad landscape', width: 1080, height: 810 },
  { name: 'Android tablet', width: 800, height: 1280 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'phone landscape', width: 852, height: 393 },
];

const THEMES = ['dark', 'light'] as const;
const ACCENTS = ['red', 'blue', 'green', 'purple', 'amber'] as const;
const SIZES = ['small', 'normal', 'large', 'xlarge'] as const;
const ALL: AuditOptions['checks'] = ['overlap', 'clipped', 'offscreen', 'tap-target', 'contrast'];

const apply = (page: Page, theme: string, accent: string, size: string) =>
  page.evaluate(
    ([t, a, s]) => {
      const root = document.documentElement;
      root.dataset.theme = t!;
      root.dataset.accent = a!;
      if (s === 'normal') delete root.dataset.fontSize;
      else root.dataset.fontSize = s!;
      return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    [theme, accent, size],
  );

// Measuring in the middle of a slide-in would read the wrong place and the wrong colour
const settled = (page: Page) =>
  page.evaluate(async () => {
    // A change of text size or theme can start new transitions (a toggle thumb sliding) a moment after the first ones end
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    for (let round = 0; round < 10; round++) {
      await frame();
      const running = document.getAnimations();
      if (running.length === 0) return;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    }
  });

const audit = async (page: Page, scope: string | null, over: Partial<AuditOptions> = {}): Promise<Violation[]> => {
  await settled(page);
  return page.evaluate(auditInPage, { scope, minTap: 44, minContrast: 4.5, vertical: false, checks: ALL, ...over });
};

const OVERLAYS = ['sheet', 'long', 'dialog', 'danger', 'stacked'] as const;

for (const device of MATRIX) {
  test(`layout audit: ${device.name} (${device.width} x ${device.height})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: true,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/#/kitchen');
    await page.locator('.ui-screen').waitFor();
    // The same problem in many combinations is reported once, with the combinations it appears in
    const found = new Map<string, string[]>();
    const note = (state: string, violations: Violation[]) => {
      for (const v of violations) {
        const key = `${v.kind}: ${v.where}: ${v.detail.replace(/[\d.]+/g, '#')}`;
        found.set(key, [...(found.get(key) ?? []), state]);
      }
    };

    // The whole page: layout and contrast in every combination of theme, accent colour and text size
    for (const theme of THEMES)
      for (const accent of ACCENTS)
        for (const size of SIZES) {
          await apply(page, theme, accent, size);
          note(`page ${theme}/${accent}/${size}`, await audit(page, null));
        }

    // Each overlay, over the two themes and every text size (the accent colour does not change placement)
    for (const theme of THEMES)
      for (const size of SIZES) {
        await apply(page, theme, 'blue', size);
        for (const name of OVERLAYS) {
          const state = `${name} ${theme}/${size}`;
          await page.locator(`[data-open="${name}"]`).scrollIntoViewIfNeeded();
          await page.locator(`[data-open="${name}"]`).click();
          await page.locator('.ui-overlay').first().waitFor();
          if (name === 'stacked') await page.locator('.ui-overlay--dialog').waitFor();
          // A message on screen at the same time: it moves to the top and must not cover the overlay's buttons
          await page.keyboard.press('Shift+Tab'); // keep focus inside the overlay (it must not escape to the page)
          note(state, await audit(page, '.ui-overlay', { vertical: true }));
          expect(
            await page.evaluate(() => document.querySelector('.ui-overlay')?.contains(document.activeElement)),
            `${state}: focus stays inside`,
          ).toBe(true);
          await page.keyboard.press('Escape');
          if (name === 'stacked') await page.keyboard.press('Escape');
          await page.locator('.ui-overlay').first().waitFor({ state: 'detached' });
        }
        // The toast, alone and over a sheet
        await page.locator('[data-open="toast"]').scrollIntoViewIfNeeded();
        await page.locator('[data-open="toast"]').click();
        await page.locator('.ui-toast').waitFor();
        note(`toast ${theme}/${size}`, await audit(page, '.ui-toast-host', { vertical: true }));
        await page.locator('[data-open="long"]').click();
        await page.locator('.ui-sheet').waitFor();
        note(
          `toast over sheet ${theme}/${size}`,
          await audit(page, '.ui-overlay, .ui-toast-host', { vertical: true, checks: ['overlap'] }),
        );
        await page.keyboard.press('Escape');
        await page.locator('.ui-toast').waitFor({ state: 'detached', timeout: 6000 });
      }

    await context.close();
    const lines = [...found].map(([key, states]) => `${key}  (${states.length}x, e.g. ${states[0]})`);
    expect(lines, `${lines.length} problems on ${device.name}:\n${lines.slice(0, 40).join('\n')}`).toEqual([]);
  });
}
