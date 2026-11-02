import { expect, test, type Page } from '@playwright/test';

// M4, video: filmed during a recording and kept with the seizure. Chromium has a fake camera for this; Firefox and Safari are
// checked on a phone (see docs/plan/M4-signoff.md). Made-up data only.

test.skip(({ browserName }) => browserName !== 'chromium', 'the fake camera is set up for Chromium');
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera', 'microphone'],
});

const PIN = '2468';

async function firstRun(page: Page, name = 'Alex') {
  await page.goto('/#/app');
  await page.getByLabel('Name of the person being tracked').fill(name);
  await page.getByLabel('PIN (at least 4 digits)').fill(PIN);
  await page.getByLabel('PIN again').fill(PIN);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });
}

const place = (page: Page, name: 'Home' | 'History' | 'Medicines' | 'More') =>
  page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name, exact: true }).click();

test('is filmed during a recording and kept with the seizure', async ({ page }) => {
  await firstRun(page);
  await place(page, 'More');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Recording and emergency plan', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Video during a seizure/ }).click();
  await expect(page.getByRole('checkbox', { name: /^Video during a seizure/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await place(page, 'Home');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByText('Filming', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  // no button was added to the recording screen
  expect(await page.getByRole('button').allTextContents()).toEqual([
    'End aura',
    'End seizure',
    'FELL',
    'BLUE',
    'VOMITED',
    'WET',
  ]);
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Back to normal' }).click();
  await page.getByRole('button', { name: 'Add details' }).click();
  await expect(page.getByText('Seizure details')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('The video is saved with the seizure.')).toBeVisible({ timeout: 20_000 });
  await place(page, 'History');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('video.app-video')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/AuraTrack-seizure-.*\.webm/)).toBeVisible();
});
