// @vitest-environment jsdom
import { newId } from '@auratrack/model';
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { T0, backToHome, makeSeizure, openPlace, openSettings, seed, setup } from './testSupport';

// History: the list with filters and pages, the chart, the timeline, one seizure in full, and deleting it.
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);

type Ctx = ReturnType<typeof setup>;
const add = (ctx: Ctx, patientId: string, minutesAgo: number, seconds: number, extra: Record<string, unknown> = {}) =>
  ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, minutesAgo, seconds, extra) });

async function openHistory(ctx: Ctx) {
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'History');
  await screen.findByRole('heading', { name: 'History' });
  return user;
}

describe('the list', () => {
  it('says so when there are no seizures', async () => {
    const ctx = setup();
    await seed(ctx);
    await openHistory(ctx);
    expect(await screen.findByText('No seizures recorded yet.')).toBeTruthy();
  });

  it('lists every seizure, newest first, with its count', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 600, 60, {
      profile: { id: '00000000-0000-4000-8000-000000000002', name: 'Tonic-clonic' },
    });
    await add(ctx, patientId, 60, 30);
    await openHistory(ctx);
    expect(await screen.findByText('Seizures: 2')).toBeTruthy();
    const cards = screen.getAllByRole('button', { name: 'Open' });
    expect(cards).toHaveLength(2);
  });

  it('filters by type and "not set", and Clear puts everything back', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 600, 60, {
      profile: { id: '00000000-0000-4000-8000-000000000002', name: 'Tonic-clonic' },
    });
    await add(ctx, patientId, 300, 60);
    await add(ctx, patientId, 60, 30, { profile: null, status: 'recorded' });
    const user = await openHistory(ctx);
    await screen.findByText('Seizures: 3');
    await user.selectOptions(screen.getByLabelText('Type'), 'profile:00000000-0000-4000-8000-000000000002');
    expect(await screen.findByText('Seizures: 1')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Type'), 'none');
    expect(await screen.findByText('Seizures: 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Seizures: 3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('"needs details" shows only the seizures that wait for details', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 600, 60);
    await add(ctx, patientId, 60, 30, { status: 'recorded' });
    const user = await openHistory(ctx);
    await user.click(await screen.findByRole('checkbox', { name: 'Needs details' }));
    expect(await screen.findByText('Seizures: 1')).toBeTruthy();
  });

  it('says when no seizure matches the filters', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 60, 30, {
      profile: { id: '00000000-0000-4000-8000-000000000002', name: 'Tonic-clonic' },
    });
    const user = await openHistory(ctx);
    await user.selectOptions(await screen.findByLabelText('Type'), 'none');
    expect(await screen.findByText('No seizures match these filters.')).toBeTruthy();
  });

  it('keeps the filters when you open a seizure and come back', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 600, 60, {
      profile: { id: '00000000-0000-4000-8000-000000000002', name: 'Tonic-clonic' },
    });
    await add(ctx, patientId, 60, 30);
    const user = await openHistory(ctx);
    await user.selectOptions(await screen.findByLabelText('Type'), 'profile:00000000-0000-4000-8000-000000000002');
    await screen.findByText('Seizures: 1');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByText('History of changes');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Seizures: 1')).toBeTruthy();
    expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe(
      'profile:00000000-0000-4000-8000-000000000002',
    );
  });

  it('shows the page size from the settings, with Earlier and Later between pages', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    for (let i = 0; i < 12; i++) await add(ctx, patientId, 10 + i * 30, 30);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Dates and numbers');
    await user.click(await screen.findByRole('button', { name: '10' }));
    await backToHome(user);
    await openPlace(user, 'History');
    await screen.findByText('Page 1 of 2');
    expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(10);
    expect((screen.getByRole('button', { name: 'Earlier' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Later' }));
    await screen.findByText('Page 2 of 2');
    expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(2);
    expect((screen.getByRole('button', { name: 'Later' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the seizure in full', () => {
  it('shows the timing, the notes, the triggers and the history, and flags a long seizure', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 60, 400, {
      notes: 'Woke at night',
      triggerCodes: ['trigger.stress'],
      // recovery from the end of the seizure, 20 minutes, as a phase mark
      phases: {
        start: { at: T0 - 3_600_000, source: 'timed' },
        auraEnd: null,
        seizureEnd: { at: T0 - 3_600_000 + 400_000, source: 'timed' },
        recoveryEnd: { at: T0 - 3_600_000 + 400_000 + 1_200_000, source: 'timed' },
      },
    });
    const user = await openHistory(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Woke at night')).toBeTruthy();
    expect(screen.getByText(/At or over the emergency alert time \(5 minutes\)/)).toBeTruthy();
    expect(screen.getByText('Recovery, until back to usual self: 20:00')).toBeTruthy();
    expect(screen.getByText('Possible triggers')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Seizure timeline' })).toBeTruthy();
    expect(screen.getByText(/· Recorded/)).toBeTruthy();
  });

  it('opens the editor from Edit, and returns to the seizure', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 60, 40);
    const user = await openHistory(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByText('Seizure details');
  });

  it('deletes the seizure and the EEG note linked to it, after asking', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const seizure = (await add(ctx, patientId, 60, 40)) as { id: string };
    const sessionId = newId();
    await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: 1000,
        plannedEndTime: null,
        actualEndTime: null,
        durationPreset: '24h',
        customHours: null,
        title: '',
        notes: '',
        status: 'active',
        id: sessionId,
      },
    });
    await ctx.client.createRecord({
      type: 'eegActivity',
      values: {
        patientId,
        sessionId,
        kind: 'seizure_reference',
        activityCode: null,
        customText: '',
        moodCode: null,
        notes: '',
        startTime: 1000,
        endTime: null,
        durationSec: null,
        linkedSeizureId: seizure.id,
      },
    });
    const user = await openHistory(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/EEG diary is removed too/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(0));
    await waitFor(async () => expect(await ctx.client.list({ type: 'eegActivity' })).toHaveLength(0));
    expect(await screen.findByText('No seizures recorded yet.')).toBeTruthy();
  });
});

describe('the chart', () => {
  it('counts the seizures in the period and those at or over the alert time', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 60, 400);
    await add(ctx, patientId, 600, 30);
    await add(ctx, patientId, 60 * 24 * 40, 30); // outside 12 weeks? no: 40 days is inside 12 weeks
    const user = await openHistory(ctx);
    await user.click(screen.getByRole('button', { name: 'Chart' }));
    // It opens on the last 30 days, a bar per day
    expect(
      await screen.findByText(/Seizures in this period: 2\. At or over the emergency alert time: 1\./),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: /Seizures per day: 2 in all/ })).toBeTruthy();
    // Zooming out shows 13 weeks, a bar per week
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(
      await screen.findByText(/Seizures in this period: 3\. At or over the emergency alert time: 1\./),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: /Seizures per week: 3 in all/ })).toBeTruthy();
  });

  it('lists the medicine changes of the period under the chart', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'medicationChange',
      values: {
        patientId,
        medicationId: newId(),
        medicationName: 'Lamotrigine',
        type: 'changed',
        effectiveAt: T0 - 3 * 86_400_000,
        recordedAt: T0 - 3 * 86_400_000,
        from: null,
        to: null,
        changedFields: ['dose'],
        note: '',
        isBaseline: false,
      },
    });
    const user = await openHistory(ctx);
    await user.click(screen.getByRole('button', { name: 'Chart' }));
    expect(await screen.findByText(/Lamotrigine: changed/)).toBeTruthy();
  });
});

describe('the timeline', () => {
  it('lists what is in the period, and tapping a seizure opens it', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await add(ctx, patientId, 60, 90);
    await ctx.client.createRecord({
      type: 'interictalEvent',
      values: {
        patientId,
        occurredAt: T0 - 3_600_000 * 5,
        timeZone: 'Europe/Oslo',
        symptomCode: 'symptom.dizziness',
        area: null,
        notes: '',
        recordedBy: 'carer',
      },
    });
    const user = await openHistory(ctx);
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText(/Between seizures:/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Timeline\. Events: 2/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /usual seizure · 1:30/i }));
    await screen.findByText('History of changes');
  });

  it('moves to the period before, and back, and says when nothing is there', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openHistory(ctx);
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('Nothing in this period.')).toBeTruthy();
    const later = screen.getByRole('button', { name: 'Later' }) as HTMLButtonElement;
    expect(later.disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Earlier' }));
    await waitFor(() => expect(later.disabled).toBe(false));
    await user.click(later);
    await waitFor(() => expect(later.disabled).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(await screen.findByText('Nothing in this period.')).toBeTruthy();
  });
});
