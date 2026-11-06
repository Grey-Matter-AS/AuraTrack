// @vitest-environment jsdom
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newId } from '@auratrack/model';
import { PIN, T0, backToHome, openPlace, openSettings, seed, setup } from './testSupport';

// The cards on Home that ask for something: install, backup, what's new. And the first backup screen.
configure({ asyncUtilTimeout: 8000 });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

type Ctx = ReturnType<typeof setup>;
const setting = (ctx: Ctx, patientId: string, key: string, value: unknown, scope = 'device') =>
  ctx.client.createRecord({ type: 'setting', values: { patientId, scope, key, value } });

describe('the install tip', () => {
  it('shows in a browser, can be put away, and comes back from About', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText('Put AuraTrack on the Home Screen')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Put AuraTrack on the Home Screen')).toBeNull());
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'About' }));
    await user.click(await screen.findByRole('button', { name: 'Show the install tip again' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Home' }));
    expect(await screen.findByText('Put AuraTrack on the Home Screen')).toBeTruthy();
  });

  it('is not shown when the app is installed', async () => {
    const ctx = setup();
    await seed(ctx);
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('standalone'),
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByText('Put AuraTrack on the Home Screen')).toBeNull();
  });
});

describe('the backup reminder', () => {
  it('asks when the interval has passed since the first use, and can be snoozed or turned off', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await setting(ctx, patientId, 'backupReminderIntervalDays', 1);
    await setting(ctx, patientId, 'lastBackupAt', T0 - 5 * 86_400_000);
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText('The last backup was 5 days ago.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remind me in 3 days' }));
    await waitFor(() => expect(screen.queryByText('The last backup was 5 days ago.')).toBeNull());
    const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: number }[];
    expect(rows.find((r) => r.key === 'backupSnoozedUntil')?.value).toBeGreaterThan(T0 + 2 * 86_400_000);
  });

  it('turn off switches the setting off for good', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await setting(ctx, patientId, 'backupReminderIntervalDays', 1);
    await setting(ctx, patientId, 'lastBackupAt', T0 - 3 * 86_400_000);
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText('The last backup was 3 days ago.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Turn off' }));
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'backupReminderEnabled')?.value).toBe(false);
    });
  });
});

describe("what's new", () => {
  it('is not shown on the first run, is shown after an update, and once dismissed it stays away', async () => {
    const ctx = setup();
    const user = userEvent.setup();
    ctx.mount();
    await user.type(await screen.findByLabelText('Name of the person being tracked'), 'Alex');
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), PIN);
    await user.type(screen.getByLabelText('PIN again'), PIN);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByText(/^New in version/)).toBeNull();
    const rows = () =>
      ctx.client.list({ type: 'setting' }) as unknown as Promise<{ id: string; key: string; value: unknown }[]>;
    const row = (await rows()).find((r) => r.key === 'whatsNewSeen')!;
    expect(row.value).toMatch(/^\d+\.\d+\.\d+$/);

    await ctx.client.update({ type: 'setting', id: row.id, patch: { value: '6.9.9' } });
    cleanup();
    ctx.mount();
    const card = (await screen.findByText(/^New in version/)).closest('.ui-card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText(/^New in version/)).toBeNull());
    expect((await rows()).find((r) => r.key === 'whatsNewSeen')?.value).toBe(row.value);
  });
});

describe('the backup screen', () => {
  it('needs a passphrase of 8 characters typed twice, then saves a file and remembers the day', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Backup and restore' }));
    const make = (await screen.findByRole('button', { name: 'Make the backup file' })) as HTMLButtonElement;
    expect(make.disabled).toBe(true);
    await user.type(screen.getByLabelText(/^Passphrase \(at least 8/), 'short');
    expect(await screen.findByText('At least 8 characters.')).toBeTruthy();
    await user.clear(screen.getByLabelText(/^Passphrase \(at least 8/));
    await user.type(screen.getByLabelText(/^Passphrase \(at least 8/), 'a long passphrase');
    await user.type(screen.getByLabelText('Passphrase again'), 'a different one');
    expect(await screen.findByText('The two passphrases are not the same.')).toBeTruthy();
    await user.clear(screen.getByLabelText('Passphrase again'));
    await user.type(screen.getByLabelText('Passphrase again'), 'a long passphrase');
    const saved: { name: string }[] = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      saved.push({ name: this.download });
    };
    await user.click(make);
    await waitFor(() => expect(saved).toHaveLength(1));
    HTMLAnchorElement.prototype.click = original;
    expect(saved[0]!.name).toMatch(/\.json$|\.atbak$|auratrack/i);
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: number }[];
      expect(rows.find((r) => r.key === 'lastBackupAt')?.value).toBeGreaterThan(0);
    });
    void PIN;
    void backToHome;
    void openSettings;
  });
});

describe('records this device cannot show', () => {
  it('are counted on Home instead of disappearing', async () => {
    const ctx = setup();
    await seed(ctx);
    const [entry] = await ctx.client.changesSince({ stamp: null });
    const recordId = newId();
    await ctx.client.applyChanges({
      entries: [
        { ...entry!, id: newId(), recordType: 'heartRateSnapshot', recordId, fields: { bpm: 120, dataVersion: 3 } },
      ],
    });
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(await screen.findByText(/^Records this device cannot show yet: 1\./)).toBeTruthy();
  });

  it('deletes records saved before 7.2 and says how many', async () => {
    const ctx = setup();
    await seed(ctx);
    const [entry] = await ctx.client.changesSince({ stamp: null });
    const oldFields = Object.fromEntries(Object.entries(entry!.fields ?? {}).filter(([key]) => key !== 'dataVersion'));
    await ctx.client.applyChanges({ entries: [{ ...entry!, id: newId(), recordId: newId(), fields: oldFields }] });
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(await screen.findByText(/^Records from a version before 7\.2 removed: 1\./)).toBeTruthy();
    expect(screen.queryByText(/^Records this device cannot show yet/)).toBeNull();
  });

  it('shows nothing when every record can be shown', async () => {
    const ctx = setup();
    await seed(ctx);
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByText(/^Records this device cannot show yet/)).toBeNull();
  });
});
