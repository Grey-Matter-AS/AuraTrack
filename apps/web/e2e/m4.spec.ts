import { expect, test, type Page } from '@playwright/test';

// M4: people, medicines and the day's doses, History, wellbeing, the EEG diary, backup and video, in a real browser with real
// storage and encryption. Made-up data only.

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

async function settingsGroup(page: Page, group: string) {
  await place(page, 'More');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: group, exact: true }).click();
}

async function recordOne(page: Page) {
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Back to normal' }).click();
  await page.getByRole('button', { name: 'Add details' }).click();
  await expect(page.getByText('Seizure details')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
}

test('a person is added, and the app records for them', async ({ page }) => {
  await firstRun(page);
  await place(page, 'More');
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add a person' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a person' });
  await sheet.getByLabel('Name', { exact: true }).fill('Sam');
  await sheet.getByRole('button', { name: 'Purple' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Recording for this person now')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await place(page, 'Home');
  await expect(page.getByRole('button', { name: /Switch person: Sam|Sam/ }).first()).toBeVisible();
});

test('a medicine is added, its dose marked, and the change kept in its history', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0, 0) });
  await firstRun(page);
  await place(page, 'Medicines');
  await page.getByRole('button', { name: 'Add a medicine' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Keppra');
  await page.getByLabel('Active ingredient').selectOption('Levetiracetam');
  await page.getByLabel('Dose', { exact: true }).fill('500');
  await page.getByLabel('Started on').fill('2026-11-01'); // yesterday: today's 08:00 dose is expected
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/500 mg · BD 08:00, 20:00/)).toBeVisible();
  // 08:00 has passed by more than 90 minutes: marked missed, and marking it now makes it late
  await expect(page.getByText('Missed', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /08:00 · Keppra/ }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Late · /)).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('started', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('dialog', { name: 'Stop Keppra?' }).getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Take up again' })).toBeVisible();
});

test('History lists a seizure, filters it, and opens it in full', async ({ page }) => {
  await firstRun(page);
  await recordOne(page);
  await place(page, 'History');
  await expect(page.getByText('Seizures: 1')).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('seizure_type.tonic_clonic');
  await expect(page.getByText('No seizures match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Chart' }).click();
  await expect(page.getByText(/Seizures in this period: 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Timeline' }).click();
  await expect(page.getByRole('img', { name: /Timeline\. Events: 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'List' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('History of changes')).toBeVisible();
});

test('wellbeing and the EEG diary stay away until switched on, then work', async ({ page }) => {
  await firstRun(page);
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0);
  await settingsGroup(page, 'Recording and emergency plan');
  await page.getByRole('checkbox', { name: /^Wellbeing/ }).click();
  await expect(page.getByRole('checkbox', { name: /^Wellbeing/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^EEG diary/ }).click();
  await expect(page.getByRole('checkbox', { name: /^EEG diary/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await place(page, 'Home');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Check in' });
  await sheet.getByRole('button', { name: 'Calm' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Wellbeing today: Calm')).toBeVisible();

  await page.getByRole('button', { name: 'Start an EEG session' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start an EEG session' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await recordOne(page);
  await page.getByRole('button', { name: 'EEG diary', exact: true }).click();
  await page.getByRole('button', { name: 'EEG diary', exact: true }).click();
  await expect(page.getByText(/^Seizure/).first()).toBeVisible();
});

test('a backup file is made with a passphrase and saved to the phone', async ({ page }) => {
  // Chromium would open a native save dialog; drop it so the app uses its download fallback
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
  await firstRun(page);
  await place(page, 'More');
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  await page.getByLabel(/^Passphrase \(at least 8/).fill('a long passphrase');
  await page.getByLabel('Passphrase again').fill('a long passphrase');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Make the backup file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/auratrack/i);
  await expect(page.getByText('Backup saved')).toBeVisible();
});

test('the neurologist report is made in the worker and saved as a real PDF', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
  await firstRun(page);
  await recordOne(page);
  await place(page, 'More');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  const path = await file.path();
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(5_000);
});
