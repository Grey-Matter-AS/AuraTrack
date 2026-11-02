// @vitest-environment jsdom
import type { WellbeingEntry } from '@auratrack/model';
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { T0, backToHome, makeSeizure, openPlace, openSettings, seed, setup } from './testSupport';

// Wellbeing: nothing of it shows until it is switched on; then the card, a check-in, the overview and the factors.
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);

type Ctx = ReturnType<typeof setup>;
const list = async (ctx: Ctx) => (await ctx.client.list({ type: 'wellbeingEntry' })) as unknown as WellbeingEntry[];
async function withWellbeing(ctx: Ctx, extra: { key: string; value: unknown; scope?: string }[] = []) {
  const { patientId } = await seed(ctx);
  await ctx.client.createRecord({
    type: 'setting',
    values: { patientId, scope: 'patient', key: 'wellbeingEnabled', value: true },
  });
  for (const s of extra)
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: s.scope ?? 'device', key: s.key, value: s.value },
    });
  return patientId;
}
const entryValues = (
  patientId: string,
  hoursAgo: number,
  factors: Record<string, number | boolean>,
  mood = 'mood.calm',
) => ({
  patientId,
  recordedAt: T0 - hoursAgo * 3_600_000,
  dayKey: localDay(T0 - hoursAgo * 3_600_000),
  moodCode: mood,
  intensity: 2,
  factors,
  notes: '',
});
const localDay = (ms: number) => {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

describe('switched off', () => {
  it('shows nothing of wellbeing anywhere: no card on Home, no entry under More', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.queryByText(/wellbeing/i)).toBeNull();
    await openPlace(user, 'More');
    expect(screen.queryByRole('button', { name: 'Wellbeing' })).toBeNull();
  });

  it('is switched on in Settings, and then there is a card and an entry under More', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Recording and emergency plan');
    await user.click(await screen.findByRole('checkbox', { name: /^Wellbeing/ }));
    await backToHome(user);
    expect(await screen.findByText('No wellbeing check-in today.')).toBeTruthy();
    await openPlace(user, 'More');
    expect(await screen.findByRole('button', { name: 'Wellbeing' })).toBeTruthy();
  });
});

describe('a check-in', () => {
  it('needs a mood, saves the factors that are present, and the card then says how today is', async () => {
    const ctx = setup();
    await withWellbeing(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Check in' }));
    const sheet = await screen.findByRole('dialog', { name: 'Check in' });
    const save = within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(within(sheet).getByRole('button', { name: 'Calm' }));
    await user.click(within(sheet).getByRole('button', { name: 'Strong' }));
    await user.click(within(sheet).getByRole('button', { name: 'Some' })); // Stress: some
    await user.click(within(sheet).getByRole('checkbox', { name: 'Sleeplessness' }));
    await user.type(within(sheet).getByLabelText(/Sleep hours/), '6,5');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx)).toHaveLength(1));
    const [saved] = await list(ctx);
    expect(saved).toMatchObject({ moodCode: 'mood.calm', intensity: 3, dayKey: localDay(T0) });
    expect(saved!.factors).toMatchObject({
      'factor.sleeplessness': true,
      'factor.sleep_hours': 6.5,
      'factor.stress': 2,
    });
    expect(Object.keys(saved!.factors)).not.toContain('factor.illness_fever');
    expect(await screen.findByText('Wellbeing today: Calm')).toBeTruthy();
  });

  it('can be changed and deleted from the list', async () => {
    const ctx = setup();
    const patientId = await withWellbeing(ctx);
    await ctx.client.createRecord({
      type: 'wellbeingEntry',
      values: entryValues(patientId, 1, { 'factor.stress': 3 }),
    });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Wellbeing' }));
    await screen.findByText(/Calm · Moderate/);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change the check-in' });
    await user.click(within(sheet).getByRole('button', { name: /anxious/i }));
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await list(ctx))[0]?.moodCode).toBe('mood.anxious_worried'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await list(ctx)).toHaveLength(0));
    expect(await screen.findByText('No check-ins yet.')).toBeTruthy();
  });
});

describe('the overview', () => {
  it('counts the moods and sets the days with a seizure beside the other days', async () => {
    const ctx = setup();
    const patientId = await withWellbeing(ctx);
    await ctx.client.createRecord({
      type: 'wellbeingEntry',
      values: entryValues(patientId, 1, { 'factor.sleeplessness': true }, 'mood.calm'),
    });
    await ctx.client.createRecord({ type: 'wellbeingEntry', values: entryValues(patientId, 30, {}, 'mood.calm') });
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 30, 40) }); // 30 minutes ago: the same day as the first entry
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Wellbeing' }));
    await user.click(await screen.findByRole('button', { name: 'Overview' }));
    expect(await screen.findByText('Days with a check-in: 2')).toBeTruthy();
    expect(screen.getByText('Calm: 2')).toBeTruthy();
    expect(screen.getByText(/does not show what caused what/)).toBeTruthy();
    const card = screen.getByText('Sleeplessness', { selector: '.app-banner' }).closest('.ui-card') as HTMLElement;
    expect(within(card).getByText(/Days with a seizure \(1\): present on 1\/1/)).toBeTruthy();
    expect(within(card).getByText(/Other days \(1\): present on 0\/1/)).toBeTruthy();
  });
});

describe('the factors', () => {
  it('start as the usual ten, can lose one, gain one of your own, and go back to the ten', async () => {
    const ctx = setup();
    await withWellbeing(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Wellbeing' }));
    await user.click(await screen.findByRole('button', { name: 'Factors' }));
    expect(await screen.findAllByRole('button', { name: 'Remove' })).toHaveLength(10);
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(9));
    await user.click(screen.getByRole('button', { name: 'Add a factor' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add a factor' });
    await user.type(within(sheet).getByLabelText('Name'), 'Headache');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Headache')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Back to the usual ten' }));
    await waitFor(() => expect(screen.queryByText('Headache')).toBeNull());
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(10);
  });
});

describe('the daily reminder', () => {
  it('shows on Home once its time has come and there is no check-in today, and can be dismissed', async () => {
    const ctx = setup();
    await withWellbeing(ctx, [
      { key: 'wellbeingDailyReminderEnabled', value: true },
      { key: 'wellbeingReminderTime', value: '00:00' },
    ]);
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText('Time for the daily check-in')).toBeTruthy();
    const card = screen.getByText('Time for the daily check-in').closest('.ui-card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Time for the daily check-in')).toBeNull());
  });

  it('is not shown when today already has a check-in', async () => {
    const ctx = setup();
    const patientId = await withWellbeing(ctx, [
      { key: 'wellbeingDailyReminderEnabled', value: true },
      { key: 'wellbeingReminderTime', value: '00:00' },
    ]);
    await ctx.client.createRecord({ type: 'wellbeingEntry', values: entryValues(patientId, 0, {}) });
    ctx.mount();
    expect(await screen.findByText('Wellbeing today: Calm')).toBeTruthy();
    expect(screen.queryByText('Time for the daily check-in')).toBeNull();
  });
});
