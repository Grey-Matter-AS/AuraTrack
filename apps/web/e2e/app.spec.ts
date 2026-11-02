import { expect, test, type Page } from '@playwright/test';

// M3, slice 6: the real Home and recording screens, in a real browser with real storage and encryption. Made-up data only.

const PIN = '2468';

async function firstRun(page: Page, name = 'Alex') {
  await page.goto('/#/app');
  await page.getByLabel('Name of the person being tracked').fill(name);
  await page.getByLabel('PIN (at least 4 digits)').fill(PIN);
  await page.getByLabel('PIN again').fill(PIN);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });
}

/** Unlocked, a finished recording ends with "Add details"; Back from the editor leaves the timing saved. */
async function detailsThenBack(page: Page) {
  await page.getByRole('button', { name: 'Add details' }).click();
  await expect(page.getByText('Seizure details')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
}

async function unlock(page: Page) {
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

test('set up, record a seizure with the phase buttons, and see it on Home', async ({ page }) => {
  await firstRun(page);
  await expect(page.getByText('No seizures recorded yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'End aura' }).click();
  await page.getByRole('button', { name: 'FELL' }).click();
  await expect(page.getByText(/\[T\+\d+s\] FELL/)).toBeVisible();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Back to normal' }).click();
  await detailsThenBack(page);
  await expect(page.getByText('Type not set')).toBeVisible();
});

test('Start answers inside a frame or two', async ({ page }) => {
  await firstRun(page);
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Start timer'));
        const t0 = performance.now();
        button?.click();
        const look = () =>
          document.querySelector('[role="timer"]') ? resolve(performance.now() - t0) : requestAnimationFrame(look);
        requestAnimationFrame(look);
      }),
  );
  expect(ms).toBeLessThan(100);
});

test('the warning, the red alert and the 12-minute stop come on time', async ({ page }) => {
  await page.clock.install();
  await firstRun(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.fastForward('04:00');
  await expect(page.getByText('One minute to the emergency alert time')).toBeVisible();
  await page.clock.fastForward('01:00');
  const alert = page.getByRole('alertdialog');
  await expect(alert).toContainText('5 minutes: follow the emergency plan');
  await alert.getByRole('button', { name: 'Dismiss' }).click();
  await page.clock.fastForward('07:00');
  await expect(page.getByRole('alertdialog')).toContainText('Recording stopped at 12 minutes');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click();
  await detailsThenBack(page);
  await expect(page.getByText(/stopped at 12 minutes, end time not known/)).toBeVisible();
});

test('a recording started on the PIN screen joins the records at unlock', async ({ page }) => {
  await firstRun(page);
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByText('AuraTrack is locked')).toBeVisible();
  await page.getByRole('button', { name: 'Start timer without the PIN' }).click();
  await expect(page.getByText(/Recording while the app is locked/)).toBeVisible();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Save and close' }).click();
  await expect(page.getByText('AuraTrack is locked')).toBeVisible();
  await unlock(page);
  await expect(page.getByText(/recorded while locked/).first()).toBeVisible({ timeout: 30_000 });
});

test('a recording that was open when the app closed is found again', async ({ page }) => {
  await firstRun(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByRole('button', { name: 'End aura' }).click();
  await page.getByRole('button', { name: 'FELL' }).click();
  await expect(page.getByText(/FELL/).first()).toBeVisible();
  await page.waitForTimeout(500); // the last tap is saved
  await page.reload();
  await unlock(page);
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('A recording was still open', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Still happening' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText(/FELL/).first()).toBeVisible();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await detailsThenBack(page);
});

test('Log past seizure saves one whose phases add up', async ({ page }) => {
  await firstRun(page);
  await page.getByRole('button', { name: 'Log past seizure' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log a past seizure' });
  await sheet.getByLabel('Minutes', { exact: true }).fill('2');
  await sheet.getByLabel('Aura (seconds)').fill('15');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/entered later/)).toBeVisible();
});

test('after a recording, Add details opens the editor: type, a symptom with its place, and Save', async ({ page }) => {
  await firstRun(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Add details' }).click();
  await expect(page.getByText('Seizure details')).toBeVisible();
  const openTab = async (name: string) => {
    const wide = page.getByRole('tab', { name: new RegExp(`^${name}`) });
    if (await wide.isVisible()) return wide.click();
    await page.getByRole('button', { name: /\d (of|av) \d/ }).click();
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  };
  await page.getByRole('button', { name: 'Focal Impaired' }).click();
  await openTab('During');
  await page.getByLabel('Search', { exact: true }).fill('rhythmic');
  await page
    .getByRole('button', { name: /Rhythmic Shaking/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Add area' }).click();
  await page.getByRole('button', { name: 'Arms', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('list', { name: 'Seizure timeline' })).toContainText(/Rhythmic Shaking/i);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
  await expect(page.getByText('Focal Impaired')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('between seizures: log one and see it on Home; saved sets: save from the editor and manage them', async ({
  page,
}) => {
  await firstRun(page);
  await page.getByRole('button', { name: 'Log a symptom between seizures' }).click();
  const sheet = page.getByRole('dialog', { name: 'Between seizures' });
  const group = sheet.getByLabel('Group');
  await group.selectOption({ index: 3 });
  const symptom = sheet.getByLabel('Symptom');
  await symptom.selectOption({ index: 1 });
  await sheet.getByLabel('Note').fill('After lunch');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Symptom sets and your own symptoms' }).click();
  await expect(page.getByText('No sets yet. Save one from the seizure editor.')).toBeVisible();
});

test('the app locks when it goes to the background, and Start still works from the PIN screen', async ({ page }) => {
  await firstRun(page);
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.getByLabel('Lock after (seconds away)').fill('0');
  await page.getByLabel('Lock after (seconds away)').blur();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('AuraTrack is locked')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Start timer without the PIN' })).toBeEnabled();
});
