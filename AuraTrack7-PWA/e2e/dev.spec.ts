import { expect, test } from '@playwright/test';
import { makeBackup, plainFile } from '../../../packages/store/src/import6x/legacy.fixture';

// M1: the data core in a real browser, through the developer page. Made-up 6.1 data only.
test('creates an encrypted store, imports a 6.1 backup, checks it against 6.1, backs up, restores and survives a reload', async ({
  page,
}) => {
  await page.goto('/#/dev');
  await expect(page.getByTestId('status')).toHaveText('No store yet');

  await page.getByLabel('PIN', { exact: true }).fill('2468');
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');

  // Import a 6.1 backup: every row accounted for, and the numbers agree with 6.1
  await page
    .getByLabel('6.1 backup file')
    .setInputFiles({ name: 'auratrack-backup.json', mimeType: 'application/json', buffer: Buffer.from(plainFile()) });
  await expect(page.getByTestId('import-summary')).toContainText('0 unaccounted for', { timeout: 30_000 });
  await expect(page.getByTestId('comparison-title')).toContainText('everything matches');
  await expect(page.getByTestId('counts')).toContainText('seizure: 24');
  await expect(page.getByTestId('review')).toContainText('Poor sleep');
  await expect(page.getByTestId('seizures').locator('tbody tr')).toHaveCount(24);

  // Importing the same file again adds nothing
  await page
    .getByLabel('6.1 backup file')
    .setInputFiles({ name: 'again.json', mimeType: 'application/json', buffer: Buffer.from(plainFile()) });
  await expect(page.getByTestId('import-summary')).toContainText('0 new', { timeout: 30_000 });

  // A v7 backup downloads, and restores cleanly onto the same store
  await page.getByLabel('Backup passphrase', { exact: true }).fill('a good passphrase');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Make backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^auratrack-backup-\d{4}-\d{2}-\d{2}\.atbak$/);
  const path = await download.path();
  await page.getByLabel('v7 backup file').setInputFiles(path);
  await expect(page.getByTestId('restore-result')).toContainText('Restore verified', { timeout: 30_000 });

  // Recovery kit
  await page.getByRole('button', { name: /Make recovery kit/ }).click();
  await expect(page.getByTestId('kit')).toContainText('AT7KIT1.');

  // After a reload the store is locked, a wrong PIN is refused, and the right one brings everything back
  await page.reload();
  await expect(page.getByTestId('status')).toHaveText('Locked');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByTestId('error')).toContainText('WrongSecretError');
  await page.getByLabel('PIN', { exact: true }).fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');
  await expect(page.getByTestId('counts')).toContainText('seizure: 24');
});

test('nothing readable is stored: the database holds only sealed bytes', async ({ page }) => {
  await page.goto('/#/dev');
  await page.getByLabel('PIN', { exact: true }).fill('2468');
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');
  const file = JSON.stringify(makeBackup({ events: 3, name: 'Distinctive Name Zq' }));
  await page
    .getByLabel('6.1 backup file')
    .setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expect(page.getByTestId('import-summary')).toContainText('0 unaccounted for', { timeout: 30_000 });
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('auratrack');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const out: unknown[] = [];
          const names = ['records', 'changeLog'];
          let left = names.length;
          for (const name of names) {
            const req = db.transaction(name).objectStore(name).getAll();
            req.onsuccess = () => {
              out.push(req.result);
              if (--left === 0) resolve(JSON.stringify(out));
            };
          }
        };
      }),
  );
  expect(stored.length).toBeGreaterThan(1000);
  expect(stored).not.toContain('Distinctive Name Zq');
  expect(stored).not.toContain('Levetiracetam');
  expect(stored).not.toContain('Focal Aware');
});
