import { expect, test, type Page } from '@playwright/test';
import { auditInPage, type AuditOptions, type Violation } from './audit-checks';

// The layout audit for the real screens (M3, slice 6): Set-up, the PIN screen, Home, the recording screen (carer and self),
// the red alert and the Log past seizure sheet, on every device of the matrix, in dark and light, at the normal and the
// largest text size. Same checks as the kit audit: overlap, clipping, off-screen, tap targets under 44px, contrast under 4.5:1.
// Run on its own when screens change: `npx playwright test audit-screens --project=chromium` (several minutes).

const MATRIX = [
  { name: 'tiny phone (320)', width: 320, height: 568 },
  { name: 'small iPhone', width: 375, height: 667 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'small Android', width: 360, height: 640 },
  { name: 'Pixel', width: 412, height: 915 },
  { name: 'iPad portrait', width: 810, height: 1080 },
  { name: 'iPad landscape', width: 1080, height: 810 },
  { name: 'Android tablet', width: 800, height: 1280 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'phone landscape', width: 852, height: 393 },
];
const THEMES = ['dark', 'light'] as const;
const SIZES = ['normal', 'xlarge'] as const;
const ALL: AuditOptions['checks'] = ['overlap', 'clipped', 'offscreen', 'tap-target', 'contrast'];
const PIN = '2468';

const apply = (page: Page, theme: string, size: string) =>
  page.evaluate(
    ([t, s]) => {
      const root = document.documentElement;
      root.dataset.theme = t!;
      if (s === 'normal') delete root.dataset.fontSize;
      else root.dataset.fontSize = s!;
      return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    [theme, size],
  );

const audit = async (page: Page, scope: string | null, vertical = false): Promise<Violation[]> => {
  await page.evaluate(async () => {
    for (let round = 0; round < 10; round++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const running = document.getAnimations();
      if (running.length === 0) return;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    }
  });
  return page.evaluate(auditInPage, { scope, minTap: 44, minContrast: 4.5, vertical, checks: ALL });
};

for (const device of MATRIX) {
  test(`screens audit: ${device.name} (${device.width} x ${device.height})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: true,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.clock.install();
    const found = new Map<string, string[]>();
    const note = (state: string, violations: Violation[]) => {
      for (const v of violations) {
        const key = `${v.kind}: ${v.where}: ${v.detail}`;
        found.set(key, [...(found.get(key) ?? []), state]);
      }
    };
    const everyLook = async (state: string, scope: string | null = null, vertical = false) => {
      for (const theme of THEMES)
        for (const size of SIZES) {
          await apply(page, theme, size);
          note(`${state} ${theme}/${size}`, await audit(page, scope, vertical));
        }
    };

    await page.goto('/#/app');
    await page.getByLabel('Name of the person being tracked').fill('Alex');
    await everyLook('set-up');
    await page.getByLabel('PIN (at least 4 digits)').fill(PIN);
    await page.getByLabel('PIN again').fill(PIN);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Start timer' }).waitFor({ timeout: 30_000 });
    await everyLook('home');

    await page.getByRole('button', { name: 'Log past seizure' }).click();
    await page.getByRole('dialog', { name: 'Log a past seizure' }).waitFor();
    await everyLook('log past', '.ui-overlay', true);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.getByRole('timer').waitFor();
    await everyLook('recording');
    await page.clock.fastForward('04:00');
    await page.getByText('One minute to the emergency alert time').waitFor();
    await everyLook('recording, warning');
    await page.clock.fastForward('01:00');
    await page.getByRole('alertdialog').waitFor();
    await everyLook('emergency alert', '.ui-overlay', true);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss' }).click();
    await page.getByRole('button', { name: 'End seizure' }).click();
    await everyLook('recording after seizure');

    // The editor, every tab, with something in each, then Review and the sheets
    await page.getByRole('button', { name: 'Add details' }).click();
    await page.getByText('Seizure details').waitFor();
    const openTab = async (name: string) => {
      const wide = page.getByRole('tab', { name: new RegExp(`^${name}`) });
      if (await wide.isVisible()) return wide.click();
      await page.getByRole('button', { name: /\d (of|av) \d/ }).click();
      await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    };
    await everyLook('editor: classification');
    await page
      .getByRole('group', { name: 'Where did it start?' })
      .getByRole('button', { name: 'Focal', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Could the person remember it afterwards?' })
      .getByRole('button', { name: 'No', exact: true })
      .click();
    await everyLook('editor: classification, focal');
    const start = page.getByRole('group', { name: 'Where did it start?' });
    await start.getByRole('button', { name: 'Generalized', exact: true }).click();
    await everyLook('editor: classification, generalized kinds');
    await start.getByRole('button', { name: 'Focal', exact: true }).click();
    await page.getByRole('button', { name: 'Keep these answers as a profile' }).click();
    await page.getByRole('dialog', { name: 'Keep as a profile' }).waitFor();
    await everyLook('keep as a profile', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    // The timeline: every band, symptom cards, a delay card with its own time, the folded rows open, and its sheets
    await openTab('Timeline');
    await everyLook('editor: timeline, empty');
    const add = async (phase: string, search: string, pick: RegExp) => {
      await page
        .getByRole('listitem', { name: phase, exact: true })
        .getByRole('button', { name: '+ Add symptom' })
        .click();
      const sheet = page.getByRole('dialog', { name: /^Add a symptom/ });
      await sheet.getByLabel('Search', { exact: true }).fill(search);
      await sheet.getByRole('button', { name: pick }).first().click();
      const where = page.getByRole('dialog', { name: /^Where:/ });
      if (await where.isVisible().catch(() => false)) await where.getByRole('button', { name: 'Done' }).click();
    };
    await page
      .getByRole('listitem', { name: 'Aura', exact: true })
      .getByRole('button', { name: '+ Add symptom' })
      .click();
    await page.getByRole('dialog', { name: /^Add a symptom/ }).waitFor();
    await everyLook('add a symptom sheet', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    await add('Aura', 'deja', /Deja Vu/i);
    await add('Seizure', 'staring', /Staring/i);
    await page
      .getByRole('listitem', { name: 'Seizure', exact: true })
      .getByRole('button', { name: '+ Add symptom' })
      .click();
    const sheet = page.getByRole('dialog', { name: /^Add a symptom/ });
    await sheet.getByLabel('Search', { exact: true }).fill('rhythmic');
    await sheet
      .getByRole('button', { name: /Rhythmic/i })
      .first()
      .click();
    await page.getByRole('dialog', { name: /^Where:/ }).waitFor();
    await page
      .getByRole('dialog', { name: /^Where:/ })
      .getByRole('button', { name: 'Arms', exact: true })
      .click();
    await everyLook('body map sheet', '.ui-overlay', true);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('combobox', { name: 'Time since the symptom before' }).last().selectOption('custom');
    await page.getByRole('button', { name: /Possible triggers/ }).click();
    await page.getByRole('button', { name: /How the person was afterwards/ }).click();
    await everyLook('editor: timeline, filled');
    await page.getByRole('button', { name: /More for Rhythmic/i }).click();
    await everyLook('symptom card menu', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    await openTab('Notes');
    await everyLook('editor: notes');
    await page.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('heading', { name: 'Review' }).waitFor();
    await everyLook('review');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Start timer' }).waitFor();
    await page.clock.fastForward('00:06'); // the "Saved" message goes away by itself
    await page.locator('.ui-toast').waitFor({ state: 'detached' });
    await everyLook('home with a seizure');

    await page.getByRole('button', { name: 'Log a symptom between seizures' }).click();
    await page.getByRole('dialog', { name: 'Between seizures' }).waitFor();
    await everyLook('between seizures', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    const main = page.getByRole('navigation', { name: 'Main menu' });
    await main.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Symptom sets and your own symptoms' }).click();
    await page.getByRole('heading', { name: 'Symptom sets and your own symptoms' }).waitFor();
    await everyLook('saved sets');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Seizure profiles' }).click();
    await page.getByRole('heading', { name: 'Seizure profiles' }).first().waitFor();
    await everyLook('seizure profiles');
    await page.getByRole('button', { name: 'Add a profile' }).click();
    await page.getByRole('dialog', { name: 'Add a profile' }).waitFor();
    await page.getByRole('group', { name: 'Where did it start?' }).getByRole('button', { name: 'Not known' }).click();
    await everyLook('profile sheet', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await main.getByRole('button', { name: 'Home', exact: true }).click();

    await page.getByRole('button', { name: 'Lock the app', exact: true }).click();
    await page.getByText('AuraTrack is locked').waitFor();
    await everyLook('PIN screen');

    await context.close();
    const lines = [...found].map(([key, states]) => `${key}  (${states.length}x, e.g. ${states[0]})`);
    expect(lines, `${lines.length} problems on ${device.name}:\n${lines.slice(0, 40).join('\n')}`).toEqual([]);
  });
}
