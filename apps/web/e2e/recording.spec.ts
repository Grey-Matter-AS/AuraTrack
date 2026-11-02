import { expect, test, type Page } from '@playwright/test';

// M3, slice 5: the recording engine and Start from the PIN screen, through the developer page's recording check.
// Real browser, real IndexedDB, real encryption. Made-up data only.

const PIN = '2468';

async function newStoreWithPatient(page: Page) {
  await page.goto('/#/dev');
  await expect(page.getByTestId('status')).toHaveText('No store yet');
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');
  await page.getByRole('button', { name: 'Add a test patient' }).click();
  await expect(page.getByTestId('pin-screen')).toContainText('Start is available');
}

async function unlock(page: Page) {
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');
}

test('Start works from the PIN screen, records into the drop box, and is merged at unlock', async ({ page }) => {
  await newStoreWithPatient(page);
  await expect(page.getByTestId('pin-screen')).toContainText('Test contact 555 0100');

  // Lock, then start without the PIN
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Locked');
  await expect(page.getByTestId('pin-screen')).toContainText('Start is available');
  await page.getByRole('button', { name: 'Start (without the PIN)' }).click();
  await expect(page.getByTestId('recording-stage')).toContainText('aura');
  await expect(page.getByTestId('recording-stage')).toContainText('locked');
  // Start answers inside a frame or two (README: under 100 ms)
  await expect(page.getByTestId('start-ms')).toBeVisible();
  expect(Number(await page.getByTestId('start-ms').textContent())).toBeLessThan(250); // the strict 100 ms check is in app.spec.ts, on the real Start button

  await page.getByRole('button', { name: 'End aura' }).click();
  await page.getByRole('button', { name: 'Note: Calm' }).click();
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Back to normal' }).click();
  await expect(page.getByTestId('recording-done')).toContainText('finished');
  await expect(page.getByTestId('recording-state')).toContainText('Saving: saved');
  await expect(page.getByTestId('pin-screen')).toContainText('5 entries waiting');

  // Nothing readable is in the database: the entries and the note are sealed
  const clear = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('auratrack');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['dropbox', 'meta'], 'readonly');
          const rows: unknown[] = [];
          tx.objectStore('dropbox').openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!cursor) return;
            rows.push(cursor.value);
            cursor.continue();
          };
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(rows));
          };
        };
      }),
  );
  expect(clear).not.toContain('Calm');
  expect(clear).not.toContain('Europe');

  // Unlocking merges the recording into the records
  await page.reload();
  await expect(page.getByTestId('status')).toHaveText('Locked');
  await unlock(page);
  await expect(page.getByTestId('dropbox-report')).toContainText('"recordings":1');
  await expect(page.getByTestId('dropbox-report')).toContainText('"failed":0');
  await expect(page.getByTestId('seizures').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('seizures')).toContainText('recorded while locked');
  await expect(page.getByTestId('pin-screen')).toContainText('0 entries waiting');
});

test('a locked recording survives a reload and carries on, then merges while still running', async ({ page }) => {
  await newStoreWithPatient(page);
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.getByRole('button', { name: 'Start (without the PIN)' }).click();
  await page.getByRole('button', { name: 'End aura' }).click();
  await expect(page.getByTestId('recording-state')).toContainText('Saving: saved');

  await page.reload();
  await expect(page.getByTestId('status')).toHaveText('Locked');
  // The clock and the buttons are back from the marks alone
  await expect(page.getByTestId('recording-stage')).toContainText('seizure');
  await expect(page.getByRole('button', { name: 'End seizure' })).toBeVisible();

  // Unlocking mid-recording: the recording goes on, now saved by the store
  await unlock(page);
  await expect(page.getByTestId('recording-stage')).toContainText('unlocked');
  await page.getByRole('button', { name: 'End seizure' }).click();
  await expect(page.getByTestId('recording-state')).toContainText('Saving: saved');
  await expect(page.getByTestId('seizures').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('seizures')).toContainText('recorded while locked');
});

test('a recording made while unlocked is found again after a reload (crash recovery)', async ({ page }) => {
  await newStoreWithPatient(page);
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.getByRole('button', { name: 'End aura' }).click();
  await expect(page.getByTestId('recording-state')).toContainText('Saving: saved');
  await expect(page.getByTestId('seizures').locator('tbody tr')).toHaveCount(1);

  await page.reload();
  await unlock(page);
  await expect(page.getByTestId('recording-stage')).toContainText('seizure');
  await expect(page.getByTestId('recording-stage')).toContainText('unlocked');
  await page.getByRole('button', { name: 'End seizure' }).click();
  await page.getByRole('button', { name: 'Back to normal' }).click();
  await expect(page.getByTestId('recording-done')).toContainText('finished');
});

test('Start is not offered when there is no patient yet', async ({ page }) => {
  await page.goto('/#/dev');
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByTestId('status')).toHaveText('Unlocked');
  await expect(page.getByTestId('pin-screen')).toContainText('Start is not available');
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start (without the PIN)' })).toBeDisabled();
});
