import { expect, test } from '@playwright/test';

// M0: the shell opens and its offline worker installs (every later screen builds on this)
test('the app opens and becomes available offline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AuraTrack' })).toBeVisible();
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker?.getRegistration()));
});
