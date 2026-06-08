import { expect, test } from '@playwright/test';
import { countStoreRows, seedAuraTrackState } from './support/auraTrackDb';
import { createRichCaretakerScenario } from './support/scenarios';

test.describe('AuraTrack app flows', () => {
  test('navigates seeded caretaker data across history, eeg, medications, and export', async ({ page }) => {
    await seedAuraTrackState(page, createRichCaretakerScenario());
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'START' })).toBeVisible();
    await expect(page.getByText('Focal Aware')).toBeVisible();

    await page.getByRole('button', { name: 'HISTORY' }).click();
    await expect(page.getByText('EEG Diary')).toBeVisible();
    await expect(page.getByText('2 EVENTS')).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-06-08');
    await dateInputs.nth(1).fill('2026-06-08');
    await expect(page.getByText('No events found.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('Tonic-Clonic')).toBeVisible();

    await page.getByRole('button', { name: /^Medications$/ }).click();
    await expect(page.getByText('Lamotrigine')).toBeVisible();
    await expect(page.getByText('TAKEN')).toBeVisible();

    await page.getByRole('button', { name: /^EEG Diary$/ }).click();
    await expect(page.getByText('Home EEG Session')).toBeVisible();
    await expect(page.getByText('Seizure reference')).toBeVisible();

    await page.getByRole('button', { name: /^Export$/ }).click();
    await expect(page.getByText('Neurologist Report')).toBeVisible();
    await expect(page.getByText('Seizure Diary (Monthly)')).toBeVisible();
    await expect(page.locator('input[type="month"]')).toHaveValue('2026-06');
  });

  test('adds a medication and logs a manual seizure through the UI', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '⚙ SETTINGS' }).click();
    await page.getByRole('button', { name: /^Medications$/ }).click();
    await page.getByRole('button', { name: '+ Add Medication' }).click();

    await page.getByPlaceholder('Drug name (e.g. Levetiracetam)').fill('Test Med');
    await page.getByPlaceholder('Dose').fill('50');
    await page.getByRole('button', { name: /^Add$/ }).click();

    await expect(page.getByText('Test Med')).toBeVisible();

    await page.getByRole('button', { name: '← BACK' }).click();
    await page.getByRole('button', { name: '+ Log Past Seizure' }).click();

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('1');
    await numberInputs.nth(1).fill('30');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Step 1: Seizure Type')).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page.getByText('LAST 5')).toBeVisible();
    await page.getByRole('button', { name: 'HISTORY' }).click();
    await expect(page.getByText('Uncategorized')).toBeVisible();
    await expect(page.getByText('Manual Entry')).toBeVisible();
  });

  test('removes a seizure from history immediately after delete confirmation', async ({ page }) => {
    await seedAuraTrackState(page, createRichCaretakerScenario());
    await page.goto('/');

    await page.getByRole('button', { name: 'HISTORY' }).click();
    await expect(page.getByText('Tonic-Clonic')).toBeVisible();

    await page.locator('button', { hasText: 'Delete' }).nth(0).click();
    await page.getByRole('button', { name: 'YES, DELETE PERMANENTLY' }).click();

    await expect(page.getByText('Tonic-Clonic')).not.toBeVisible();
    await expect(page.getByText('1 EVENTS')).toBeVisible();
    await expect.poll(async () => countStoreRows(page, 'events')).toBe(1);
  });
});
