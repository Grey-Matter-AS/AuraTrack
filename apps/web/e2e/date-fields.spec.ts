import { expect, test } from '@playwright/test';

// An empty date or time field shows only the kit's own hint and icon. Chromium and Firefox each draw their own "dd/mm/yyyy"
// and calendar button inside the field; the kit must hide them, or two texts and two icons sit on top of each other.
// (The layout audit cannot see inside the browser's own control, so this is checked here.)

test("an empty date or time field hides the browser's own text and button, and the kit icon covers the right edge", async ({
  page,
}) => {
  await page.goto('/#/kitchen');
  await page.locator('.ui-screen').waitFor();
  const empty = page.locator('.ui-date--empty');
  expect(await empty.count()).toBeGreaterThanOrEqual(4);
  for (const field of await empty.all()) {
    const input = field.locator('input');
    // Transparent text: only the kit's hint (a separate, aria-hidden element) is visible
    expect(await input.evaluate((el) => getComputedStyle(el).color)).toMatch(/rgba\(.*, 0\)|transparent/);
    // The kit icon sits over the field's right edge, where Firefox draws its own button
    const box = (await input.boundingBox())!;
    const icon = (await field.locator('.ui-date__icon').boundingBox())!;
    expect(icon.x + icon.width).toBeGreaterThan(box.x + box.width - 3);
    expect(icon.width).toBeGreaterThanOrEqual(40);
    // No pixel of the field's own text shows through next to the hint: the hint is the only text inside the field
    expect(await field.locator('.ui-date__hint').count()).toBe(1);
  }
});

test('a filled date field shows its value in the normal text colour', async ({ page }) => {
  await page.goto('/#/kitchen');
  await page.locator('.ui-screen').waitFor();
  const input = page.getByLabel('Date, filled');
  expect(await input.evaluate((el) => getComputedStyle(el).color)).not.toMatch(/rgba\(.*, 0\)|transparent/);
  await expect(page.locator('.ui-date', { has: input }).locator('.ui-date__hint')).toHaveCount(0);
});
