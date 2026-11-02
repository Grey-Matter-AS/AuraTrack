import { expect, test, type Browser, type Page } from '@playwright/test';

// M6: two real browsers (two phones) make a household through the pairing, and records pass between them over WebRTC. The
// signalling server is our own, on this computer (playwright.config.ts); the public one is never used. Made-up data only.

const PIN = '2468';
const BROKER = { host: '127.0.0.1', port: 9199, path: '/', secure: false };

async function phone(browser: Browser, page: Page | null = null): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' });
  const p = page ?? (await context.newPage());
  await p.addInitScript((broker) => localStorage.setItem('auratrack.broker', JSON.stringify(broker)), BROKER);
  return p;
}

const place = (page: Page, name: 'Home' | 'History' | 'Medicines' | 'More') =>
  page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name, exact: true }).click();

async function setUp(page: Page, name = 'Alex') {
  await page.goto('/#/app');
  await page.getByLabel('Name of the person being tracked').fill(name);
  await page.getByLabel('PIN (at least 4 digits)').fill(PIN);
  await page.getByLabel('PIN again').fill(PIN);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });
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

test('two phones become a household, and a seizure recorded on one reaches the other', async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await phone(browser);
  const b = await phone(browser);
  await setUp(a);
  await recordOne(a);

  // A starts the household and shows a code
  await place(a, 'More');
  await a.getByRole('button', { name: 'Household', exact: true }).click();
  await a.getByRole('button', { name: 'Start a household' }).click();
  const sheet = a.getByRole('dialog', { name: 'Start a household' });
  await sheet.getByLabel('Name of the household').fill('Home');
  await sheet.getByLabel('Name of this device').fill('Kitchen tablet');
  await sheet.getByRole('button', { name: 'Start' }).click();
  await expect(a.getByText('Kitchen tablet · This device')).toBeVisible();
  await expect(a.getByText(/Reachable by the household/)).toBeVisible({ timeout: 20_000 });
  await a.getByRole('button', { name: 'Add a device' }).click();
  await a.getByRole('button', { name: 'Add a device' }).click();
  const code = (await a.getByLabel('Code', { exact: true }).textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

  // B joins from set-up with the code
  await b.goto('/#/app');
  await b.getByLabel('PIN (at least 4 digits)').fill(PIN);
  await b.getByLabel('PIN again').fill(PIN);
  await b.getByRole('button', { name: 'Join a household instead' }).click();
  await b.getByLabel('Code from the other device').fill(code);
  await b.getByLabel('Name of this device').fill('Mum’s phone');
  await b.getByRole('button', { name: 'Join', exact: true }).click();

  // Both phones show the same six digits
  const dialogA = a.getByRole('alertdialog');
  const dialogB = b.getByRole('alertdialog');
  await expect(dialogA).toBeVisible({ timeout: 30_000 });
  await expect(dialogB).toBeVisible({ timeout: 30_000 });
  const digitsA = (await dialogA.textContent())?.match(/\d{3} \d{3}/)?.[0];
  const digitsB = (await dialogB.textContent())?.match(/\d{3} \d{3}/)?.[0];
  expect(digitsA).toBeTruthy();
  expect(digitsA).toBe(digitsB);
  await dialogA.getByRole('button', { name: 'The same' }).click();
  await dialogB.getByRole('button', { name: 'The same' }).click();
  await expect(a.getByText(/“Mum’s phone” has joined/)).toBeVisible({ timeout: 30_000 });
  await expect(b.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });

  // The person and the seizure arrive on B
  await expect(b.getByText('Alex').first()).toBeVisible({ timeout: 60_000 });
  await place(b, 'History');
  await expect(b.getByText(/Seizures: 1/)).toBeVisible({ timeout: 60_000 });

  // B records one too; it reaches A, which says so quietly
  await place(b, 'Home');
  await recordOne(b);
  await a.getByRole('button', { name: 'Back', exact: true }).click();
  await a.getByRole('button', { name: 'Back', exact: true }).click();
  await place(a, 'Home');
  await expect(a.getByText(/Changes from Mum’s phone/)).toBeVisible({ timeout: 90_000 });
  await place(a, 'History');
  await expect(a.getByText(/Seizures: 2/)).toBeVisible();
});
