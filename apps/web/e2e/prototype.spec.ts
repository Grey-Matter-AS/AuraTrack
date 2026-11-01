import { expect, test, type Page } from '@playwright/test';

// M3 slice 4: the clickable prototype of recording and logging (made-up data, nothing saved).
// A smoke test of the whole flow, so a later change cannot quietly break what the user is trying on their phone.

// Wide screens show a row of tabs; narrow ones show one control that opens the list of tabs
async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name });
  if (await tab.isVisible()) return tab.click();
  await page.getByRole('button', { name: /\d of \d/ }).click();
  await page.getByRole('button', { name }).click();
}
const tabNames = async (page: Page): Promise<string[]> => {
  const wide = page.getByRole('tab');
  if (await wide.first().isVisible()) return (await wide.allInnerTexts()).map((t) => t.split('\n')[0] ?? '');
  await page.getByRole('button', { name: /\d of \d/ }).click();
  const names = await page.getByRole('dialog').getByRole('button').allInnerTexts();
  await page.keyboard.press('Escape');
  return names.map((t) => t.split('\n')[0] ?? '').filter((t) => t.trim() !== ''); // the close button has no text
};

test.describe('prototype', () => {
  test('record: end aura, warning at 4 minutes, alert at 5, end seizure, then the editor and Review', async ({
    page,
  }) => {
    await page.goto('/#/prototype');
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.getByRole('button', { name: 'End aura' }).click();

    await page.getByRole('button', { name: 'To 3:50' }).click();
    await page.getByRole('button', { name: '+30 s' }).click(); // 4:20: past the warning, before the alert
    await expect(page.getByText('One minute to the emergency alert time')).toBeVisible();

    await page.getByRole('button', { name: '+30 s' }).click(); // 4:50 to 5:20
    await page.getByRole('button', { name: '+30 s' }).click();
    const alert = page.getByRole('alertdialog');
    // The alert is the whole screen in red with white text
    expect(await alert.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor)).toBe('rgb(220, 38, 38)');
    expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
    await expect(alert).toContainText('Rescue medication');
    await expect(alert).toContainText('Emergency contact');
    await alert.getByRole('button', { name: 'Dismiss' }).click();
    await expect(alert).toBeHidden();

    await page.getByRole('button', { name: 'Total blackout' }).click(); // the symptom strip, timed automatically
    await page.getByRole('button', { name: 'End seizure' }).click();
    await page.getByRole('button', { name: 'Add details' }).click();

    // The editor opens on Classification; Save works from any tab
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByText('What kind of seizure was it?')).toBeVisible();
    await expect(page.getByText('Seizure 5:')).toBeVisible();

    // A feeling such as déjà vu has no place on the body: no area button. A movement does.
    await openTab(page, 'Before');
    await page
      .getByRole('button', { name: /Deja Vu/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Add area' })).toHaveCount(0);
    await openTab(page, 'During');
    await page
      .getByRole('button', { name: /Rhythmic Shaking/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'Add area' }).click();
    await page.getByRole('button', { name: 'Arms', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(/During · /)).toBeVisible();

    await page.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    const review = page.locator('[data-screen="review"]'); // the screens below stay mounted but hidden
    await expect(review.getByText('★ Deja Vu (Been here before)')).toBeVisible();
    await expect(review.getByText('Total Blackout')).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
  });

  test('the recording stops by itself at 12 minutes and keeps the quick notes', async ({ page }) => {
    await page.goto('/#/prototype');
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.getByRole('button', { name: 'FELL' }).click();
    await page.getByRole('button', { name: 'To 11:50' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click(); // the 5-minute alert comes first
    await page.getByRole('button', { name: '+30 s' }).click();
    const stopped = page.getByRole('alertdialog', { name: 'Recording stopped at 12 minutes' });
    await expect(stopped).toBeVisible();
    await stopped.getByRole('button', { name: 'Add details' }).click();
    await openTab(page, 'Notes');
    await expect(page.getByText(/\[T\+\d+s\] FELL/)).toBeVisible();
  });

  test('Classification comes first; the suggestions and the tabs follow the type; a fixed-place symptom asks for no area', async ({
    page,
  }) => {
    await page.goto('/#/prototype');
    await page.getByRole('button', { name: 'Log past seizure' }).click();
    expect((await tabNames(page))[0]).toBe('Classification');

    await openTab(page, 'During');
    await expect(page.getByText('Often for this patient')).toBeVisible(); // no type yet
    await openTab(page, 'Classification');
    await page.getByRole('button', { name: 'Absence' }).click();
    await openTab(page, 'During');
    await expect(page.getByText('Often for Absence')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tongue Biting/i })).toHaveCount(0); // not usual for an absence

    await openTab(page, 'Classification');
    await page.getByRole('button', { name: 'Tonic-Clonic' }).click();
    await openTab(page, 'During');
    await page
      .getByRole('button', { name: /Tongue Biting/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Add area' })).toHaveCount(0); // always the mouth: nothing to ask

    // An aura-only seizure has no "during" part, so that tab is not shown
    await openTab(page, 'Classification');
    await page.getByRole('button', { name: 'Aura only' }).click();
    expect(await tabNames(page)).not.toContain('During');
    await page.getByRole('button', { name: 'Tonic-Clonic' }).click();
    expect(await tabNames(page)).toContain('During');
  });

  test('the time before the seizure that the first warning sign came is in seconds, minutes or hours', async ({
    page,
  }) => {
    await page.goto('/#/prototype');
    await page.getByRole('button', { name: 'Log past seizure' }).click();
    await openTab(page, 'Before');
    await page.getByLabel('How long before the seizure did the first warning sign start?').fill('30');
    await page.getByRole('button', { name: 'Seconds' }).click();
    await page.getByRole('button', { name: 'Review' }).click();
    await expect(
      page.locator('[data-screen="review"]').getByText('Warning signs began about 30 s before'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to editing' }).click();
    await page.getByRole('button', { name: 'Hours' }).click();
    await page.getByRole('button', { name: 'Review' }).click();
    await expect(
      page.locator('[data-screen="review"]').getByText('Warning signs began about 30 h before'),
    ).toBeVisible();
  });

  test('log a past seizure, between seizures, and the lock screen with Start', async ({ page }) => {
    await page.goto('/#/prototype');
    await page.getByRole('button', { name: 'Log past seizure' }).click();
    await expect(page.getByRole('heading', { name: 'Past seizure' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Log a symptom between seizures' }).click();
    const sheet = page.getByRole('dialog', { name: 'Between seizures' });
    await sheet.getByLabel('Group').selectOption({ index: 1 });
    await sheet.getByLabel('Symptom', { exact: true }).selectOption({ index: 1 });
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'AuraTrack is locked' })).toBeVisible();
    await page.getByRole('button', { name: 'Start timer' }).click(); // Start never needs the PIN
    await expect(page.getByText(/Recording while the app is locked/)).toBeVisible();
  });

  test('the symptom and body labels follow the chosen language', async ({ page }) => {
    await page.goto('/#/prototype');
    await page.getByLabel('Language of the symptom and body labels').selectOption('nb');
    await page.getByRole('button', { name: 'Log past seizure' }).click();
    await openTab(page, 'Before');
    await page
      .getByRole('button', { name: /Deja Vu|Déjà vu/i })
      .first()
      .click();
    await expect(page.getByText('★ Déjà vu (har vært her før)')).toBeVisible();
  });
});
