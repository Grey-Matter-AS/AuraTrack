import { expect, test } from '@playwright/test';

// M0: the shell opens and its offline worker installs (every later screen builds on this)
test('the app opens and becomes available offline', async ({ page }) => {
  await page.goto('/#/options');
  await expect(page.getByRole('heading', { name: 'AuraTrack' })).toBeVisible();
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker?.getRegistration()));
});

// The app is the main page; the other pages are under #/options
test('the main page is the app, and the options page leads to the rest', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('PIN (at least 4 digits)')).toBeVisible({ timeout: 30_000 });
  await page.goto('/#/options');
  await expect(page.getByRole('button', { name: 'Open the app' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try the prototype' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open the app' }).click();
  await expect(page.getByLabel('PIN (at least 4 digits)')).toBeVisible({ timeout: 30_000 });
});
