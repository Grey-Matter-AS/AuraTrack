import { expect, test } from '@playwright/test';

// Visual baselines of the kitchen sink (docs/plan/M2.md, item 5): a few devices, dark and light. They are what you look at
// on your own phone, and they catch a change nobody meant to make. Run `pnpm visual`; update with `pnpm visual -- --update-snapshots`.
// Fonts differ between machines, so the comparison is skipped in CI until the baselines are made on the CI image.

test.skip(!!process.env.CI, 'baselines are made on a local machine; see docs/plan/STATUS.md');

const DEVICES = [
  { name: 'iphone-15', width: 393, height: 852 },
  { name: 'ipad-portrait', width: 810, height: 1080 },
  { name: 'laptop', width: 1366, height: 768 },
];

for (const device of DEVICES)
  for (const theme of ['dark', 'light'] as const)
    test(`kitchen sink: ${device.name}, ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      await page.goto('/#/kitchen');
      await page.locator('.ui-screen').waitFor();
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`kitchen-${device.name}-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
      await context.close();
    });
