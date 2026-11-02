import { expect, test, type Page } from '@playwright/test';
import { auditInPage, type AuditOptions, type Violation } from './audit-checks';

// The layout audit for what M4 added: the new kit parts on their own page, and every new screen with something on it, on every
// device of the matrix. Same checks as the other audits: overlap, clipping, off-screen, tap targets under 44px, contrast
// under 4.5:1. Each screen is looked at twice: dark at the largest text (the tightest layout) and light at the normal size.
// Run on its own: `npx playwright test audit-m4 --project=chromium` (several minutes).

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
const LOOKS = [
  ['dark', 'xlarge'],
  ['light', 'normal'],
] as const;
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

function collector(page: Page) {
  const found = new Map<string, string[]>();
  return {
    found,
    look: async (state: string, scope: string | null = null, vertical = false) => {
      for (const [theme, size] of LOOKS) {
        await apply(page, theme, size);
        for (const v of await audit(page, scope, vertical)) {
          const key = `${v.kind}: ${v.where}: ${v.detail.replace(/[\d.]+/g, '#')}`;
          found.set(key, [...(found.get(key) ?? []), `${state} ${theme}/${size}`]);
        }
      }
    },
    report: (name: string) => {
      const lines = [...found].map(([key, states]) => `${key}  (${states.length}x, e.g. ${states[0]})`);
      expect(lines, `${lines.length} problems on ${name}:\n${lines.slice(0, 40).join('\n')}`).toEqual([]);
    },
  };
}

for (const device of MATRIX) {
  test(`M4 audit, kit parts: ${device.name} (${device.width} x ${device.height})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: true,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/#/kitchen/m4');
    await page.locator('.ui-screen').waitFor();
    const c = collector(page);
    for (const accent of ['blue', 'red', 'green', 'purple', 'amber']) {
      await page.evaluate((a) => (document.documentElement.dataset.accent = a), accent);
      await c.look(`kit page ${accent}`);
    }
    await context.close();
    c.report(device.name);
  });

  test(`M4 audit, screens: ${device.name} (${device.width} x ${device.height})`, async ({ browser }) => {
    test.setTimeout(420_000);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      hasTouch: true,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const c = collector(page);
    const look = c.look;
    const nav = (name: string) =>
      page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name, exact: true }).click();
    const back = () => page.getByRole('button', { name: 'Back', exact: true }).click();
    const sheet = async (state: string, open: () => Promise<unknown>, role: 'dialog' | 'alertdialog' = 'dialog') => {
      await open();
      await page.getByRole(role).waitFor();
      await look(state, '.ui-overlay', true);
      await page.keyboard.press('Escape');
      await page.locator('.ui-overlay').first().waitFor({ state: 'detached' });
    };

    // Set-up, then the modules switched on
    await page.goto('/#/app');
    await page.getByLabel('Name of the person being tracked').fill('Alex');
    await page.getByLabel('PIN (at least 4 digits)').fill(PIN);
    await page.getByLabel('PIN again').fill(PIN);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Start timer' }).waitFor({ timeout: 30_000 });
    await nav('More');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await look('settings list');
    for (const group of [
      'About the person',
      'Appearance',
      'Dates and numbers',
      'Medicines',
      'Doctor and reports',
      'Data and backup',
      'Lock',
    ]) {
      await page.getByRole('button', { name: group, exact: true }).click();
      await look(`settings: ${group}`);
      await back();
    }
    await page.getByRole('button', { name: 'Recording and emergency plan', exact: true }).click();
    for (const box of [/^Wellbeing/, /^EEG diary/, /^Video during a seizure/]) {
      await page.getByRole('checkbox', { name: box }).click();
      await expect(page.getByRole('checkbox', { name: box })).toBeChecked();
    }
    await look('settings: recording, modules on');
    await back();
    await back();

    // A medicine, expected from yesterday, and a seizure
    await nav('Medicines');
    await look('medicines, empty');
    await page.getByRole('button', { name: 'Add a medicine' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Lamotrigine');
    await page.getByLabel('Active ingredient').selectOption('Lamotrigine');
    await page.getByLabel('Dose', { exact: true }).fill('100');
    await look('medicine form');
    const yesterday = new Date(Date.now() - 86_400_000);
    const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    await page.getByLabel('Started on').fill(day);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText(/100 mg · BD/).waitFor();
    await look('medicines, with doses');
    await sheet('extra dose', () => page.getByRole('button', { name: 'Extra dose', exact: true }).click());
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await look('medicine detail');
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await look('medicine change form');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Lamotrigine XR');
    await page.getByRole('button', { name: 'Review the change' }).click();
    await page.getByRole('dialog', { name: 'Why is the name changing?' }).waitFor();
    await look('rename reason', '.ui-overlay', true);
    await page.getByRole('button', { name: /It was spelled wrongly/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirm the change' }).waitFor();
    await look('confirm the change', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    await back();
    await back();
    await page.getByRole('button', { name: 'Dose history' }).click();
    await look('dose history');
    await page
      .getByRole('button', { name: /Lamotrigine/ })
      .first()
      .click();
    await page.getByRole('dialog').waitFor();
    await look('edit a dose', '.ui-overlay', true);
    await page.keyboard.press('Escape');
    await back();

    await nav('Home');
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.getByRole('timer').waitFor();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'End seizure' }).click();
    await look('recording with video notes');
    await page.getByRole('button', { name: 'Back to normal' }).click();
    await page.getByRole('button', { name: 'Add details' }).click();
    await page.getByText('Seizure details').waitFor();
    await back();
    await page.getByRole('button', { name: 'Start timer' }).waitFor();
    await look('home, everything on');

    // Home cards: check-in sheet, EEG sheets
    await sheet('wellbeing check-in', () => page.getByRole('button', { name: 'Check in', exact: true }).click());
    await sheet('EEG session sheet', () => page.getByRole('button', { name: 'Start an EEG session' }).click());
    await page.getByRole('button', { name: 'Start an EEG session' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start an EEG session' }).click();
    await page.getByRole('timer').waitFor();
    await look('home, EEG running');
    await sheet('EEG activity sheet', () => page.getByRole('button', { name: 'Start an activity' }).click());

    // History
    await nav('History');
    await look('history list');
    await page.getByRole('button', { name: 'Chart' }).click();
    await look('history chart');
    await page.getByRole('button', { name: 'Timeline' }).click();
    await look('history timeline');
    await page.getByRole('button', { name: 'List' }).click();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByText('History of changes').waitFor();
    await look('seizure in full');
    await back();

    // More: people, EEG, wellbeing, backup, help, about
    await nav('More');
    await look('more');
    await page.getByRole('button', { name: 'People', exact: true }).click();
    await look('people');
    await sheet('add a person', () => page.getByRole('button', { name: 'Add a person' }).click());
    await back();
    await page.getByRole('button', { name: 'EEG diary', exact: true }).click();
    await look('EEG diary');
    await page.getByRole('button', { name: 'EEG diary', exact: true }).click();
    await look('EEG session');
    await back();
    await back();
    await page.getByRole('button', { name: 'Wellbeing', exact: true }).click();
    await look('wellbeing');
    for (const view of ['Overview', 'Factors']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await look(`wellbeing: ${view}`);
    }
    await sheet('add a factor', () => page.getByRole('button', { name: 'Add a factor' }).click());
    await back();
    await page.getByRole('button', { name: 'Backup and restore' }).click();
    await look('backup');
    await back();
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.getByRole('button', { name: 'Recording a seizure' }).click();
    await look('help');
    await back();
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await look('about');

    await context.close();
    c.report(device.name);
  });
}
