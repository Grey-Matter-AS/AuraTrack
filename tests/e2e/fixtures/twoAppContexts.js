import { test as base } from '@playwright/test';

async function prepareAppPage(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
}

export const test = base.extend({
  appPair: async ({ browser }, use) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await prepareAppPage(pageA);
    await prepareAppPage(pageB);

    await use({ contextA, contextB, pageA, pageB });

    await contextA.close();
    await contextB.close();
  },
});

export { expect } from '@playwright/test';
