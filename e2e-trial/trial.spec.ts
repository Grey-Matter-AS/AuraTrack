import { test, expect } from '@playwright/test';

// A real 6.1 flow: start, stop, choose a type, save; the seizure then shows on the home screen
test('record and tag a seizure', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'START TIMER' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /STOP TIMER/i }).click();
  await page.getByRole('button', { name: 'Absence' }).click();
  await page.getByRole('button', { name: /Continue to Summary/i }).click();
  await page.getByRole('button', { name: /FINISH & SAVE/i }).click();
  await expect(page.getByRole('button', { name: 'START TIMER' })).toBeVisible();
  await expect(page.getByText('Absence').first()).toBeVisible();
});

// Two independent "devices" in one test (what household sync tests need)
test('two devices in one test stay separate', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await pa.goto('/');
  await pb.goto('/');
  await pa.getByRole('button', { name: 'START TIMER' }).click();
  await expect(pa.getByRole('button', { name: /STOP TIMER/i })).toBeVisible();
  await expect(pb.getByRole('button', { name: 'START TIMER' })).toBeVisible();
  await a.close();
  await b.close();
});
