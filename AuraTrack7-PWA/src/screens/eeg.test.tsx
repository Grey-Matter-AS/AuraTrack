// @vitest-environment jsdom
import type { EegActivity, EegSession, Seizure } from '@auratrack/model';
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { T0, backToHome, makeSeizure, openPlace, openSettings, seed, setup } from './testSupport';

// The EEG diary: switched on in Settings, a session with activities, a seizure that happens during it, and deleting.
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);

type Ctx = ReturnType<typeof setup>;
const list = async <T,>(ctx: Ctx, type: 'eegSession' | 'eegActivity' | 'seizure') =>
  (await ctx.client.list({ type })) as unknown as T[];

async function withEeg(ctx: Ctx) {
  const { patientId } = await seed(ctx);
  await ctx.client.createRecord({
    type: 'setting',
    values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
  });
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  return { user, patientId };
}

describe('switching it on', () => {
  it('shows nothing of the EEG diary until it is switched on, then a card on Home and an entry under More', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByRole('button', { name: 'Start an EEG session' })).toBeNull();
    await openSettings(user, 'Recording and emergency plan');
    await user.click(await screen.findByRole('checkbox', { name: /^EEG diary/ }));
    await backToHome(user);
    expect(await screen.findByRole('button', { name: 'Start an EEG session' })).toBeTruthy();
    await openPlace(user, 'More');
    expect(await screen.findByRole('button', { name: 'EEG diary' })).toBeTruthy();
  });
});

describe('a session', () => {
  it('starts with a title and a planned length, shows its time, and ends', async () => {
    const ctx = setup();
    const { user } = await withEeg(ctx);
    await user.click(screen.getByRole('button', { name: 'Start an EEG session' }));
    const sheet = await screen.findByRole('dialog', { name: 'Start an EEG session' });
    await user.type(within(sheet).getByLabelText('Title (optional)'), 'Night 1');
    await user.click(within(sheet).getByRole('button', { name: '48h' }));
    await user.click(within(sheet).getByRole('button', { name: 'Start an EEG session' }));
    await waitFor(async () => expect(await list(ctx, 'eegSession')).toHaveLength(1));
    const [session] = await list<EegSession>(ctx, 'eegSession');
    expect(session).toMatchObject({ title: 'Night 1', status: 'active', durationPreset: '48h', actualEndTime: null });
    expect(session!.plannedEndTime! - session!.startTime).toBe(48 * 3_600_000);
    expect(await screen.findByRole('timer')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'End the session' }));
    await waitFor(async () => expect((await list<EegSession>(ctx, 'eegSession'))[0]?.status).toBe('completed'));
    expect((await list<EegSession>(ctx, 'eegSession'))[0]?.actualEndTime).not.toBeNull();
  });

  it('wants hours for a custom length', async () => {
    const ctx = setup();
    const { user } = await withEeg(ctx);
    await user.click(screen.getByRole('button', { name: 'Start an EEG session' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: 'Other' }));
    const start = within(sheet).getByRole('button', { name: 'Start an EEG session' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await user.type(within(sheet).getByLabelText('Hours'), '1,5');
    expect(start.disabled).toBe(false);
    await user.click(start);
    await waitFor(async () => expect((await list<EegSession>(ctx, 'eegSession'))[0]?.customHours).toBe(1.5));
  });

  it('adds an activity with a mood, stops it, and ending the session stops one that is still running', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: T0 - 3_600_000,
        plannedEndTime: null,
        actualEndTime: null,
        durationPreset: '24h',
        customHours: null,
        title: '',
        notes: '',
        status: 'active',
      },
    });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start an activity' }));
    const sheet = await screen.findByRole('dialog', { name: 'Start an activity' });
    await user.selectOptions(within(sheet).getByLabelText('Activity'), 'activity.sleeping');
    await user.selectOptions(within(sheet).getByLabelText('Mood (optional)'), 'mood.calm');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx, 'eegActivity')).toHaveLength(1));
    expect((await list<EegActivity>(ctx, 'eegActivity'))[0]).toMatchObject({
      kind: 'activity',
      activityCode: 'activity.sleeping',
      moodCode: 'mood.calm',
      endTime: null,
    });
    await user.click(await screen.findByRole('button', { name: 'Stop the activity' }));
    await waitFor(async () => expect((await list<EegActivity>(ctx, 'eegActivity'))[0]?.endTime).not.toBeNull());
    expect((await list<EegActivity>(ctx, 'eegActivity'))[0]?.durationSec).toBeGreaterThanOrEqual(0);

    await user.click(await screen.findByRole('button', { name: 'Start an activity' }));
    const again = await screen.findByRole('dialog', { name: 'Start an activity' });
    await user.selectOptions(within(again).getByLabelText('Activity'), '__own__');
    await user.type(within(again).getByLabelText('What was happening'), 'Photic stimulation');
    await user.click(within(again).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx, 'eegActivity')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'End the session' }));
    await waitFor(async () => {
      const all = await list<EegActivity>(ctx, 'eegActivity');
      expect(all.every((a) => a.endTime !== null)).toBe(true);
    });
  });
});

describe('a seizure during a session', () => {
  async function seedSession(ctx: Ctx, patientId: string) {
    const session = (await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: T0 - 5 * 3_600_000,
        plannedEndTime: null,
        actualEndTime: null,
        durationPreset: '24h',
        customHours: null,
        title: 'Home EEG',
        notes: '',
        status: 'active',
      },
    })) as unknown as EegSession;
    await ctx.client.createRecord({
      type: 'eegActivity',
      values: {
        patientId,
        sessionId: session.id,
        kind: 'activity',
        activityCode: 'activity.sleeping',
        customText: '',
        moodCode: null,
        notes: '',
        startTime: T0 - 4 * 3_600_000,
        endTime: null,
        durationSec: null,
        linkedSeizureId: null,
      },
    });
    return session;
  }

  it('is referenced in the diary with its type, the activity that was running stops when it began, and the seizure knows its session', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    const session = await seedSession(ctx, patientId);
    const seizure = (await ctx.client.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 120, 60),
    })) as unknown as Seizure;
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await waitFor(async () => expect((await list<Seizure>(ctx, 'seizure'))[0]?.eegSessionId).toBe(session.id));
    const activities = await list<EegActivity>(ctx, 'eegActivity');
    expect(activities).toHaveLength(2);
    expect(activities.find((a) => a.kind === 'seizure_reference')).toMatchObject({
      linkedSeizureId: seizure.id,
      activityCode: 'seizure_type.focal_aware',
      durationSec: 60,
      sessionId: session.id,
    });
    const stopped = activities.find((a) => a.kind === 'activity')!;
    expect(stopped.endTime).toBe(seizure.phases.start.at);
    expect(stopped.durationSec).toBe(Math.round((seizure.phases.start.at - stopped.startTime) / 1000));
  });

  it('is shown in the session’s timeline, next to the activities, and opens the seizure', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    await seedSession(ctx, patientId);
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 120, 60) });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await waitFor(async () => expect(await list(ctx, 'eegActivity')).toHaveLength(2));
    await user.click(await screen.findByRole('button', { name: 'EEG diary' }));
    await user.click(await screen.findByRole('button', { name: 'EEG diary' }));
    expect(await screen.findByText(/^Seizure · /)).toBeTruthy();
    expect(screen.getByText('Sleeping')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Open' }).at(-1)!);
    await screen.findByText('History of changes');
  });

  it('is not tied to a session that had already ended, or one that began after the seizure', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: T0 - 10 * 3_600_000,
        plannedEndTime: null,
        actualEndTime: T0 - 8 * 3_600_000,
        durationPreset: '2h',
        customHours: null,
        title: '',
        notes: '',
        status: 'completed',
      },
    });
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 60, 30) });
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await new Promise((r) => setTimeout(r, 200));
    expect((await list<Seizure>(ctx, 'seizure'))[0]?.eegSessionId).toBeNull();
    expect(await list(ctx, 'eegActivity')).toHaveLength(0);
  });
});

describe('editing and deleting', () => {
  it('changes an activity, deletes it after asking, and deleting the session leaves the seizures and frees them', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    const session = (await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: T0 - 5 * 3_600_000,
        plannedEndTime: null,
        actualEndTime: T0 - 3_600_000,
        durationPreset: '24h',
        customHours: null,
        title: 'Night',
        notes: '',
        status: 'completed',
      },
    })) as unknown as EegSession;
    await ctx.client.createRecord({
      type: 'eegActivity',
      values: {
        patientId,
        sessionId: session.id,
        kind: 'activity',
        activityCode: 'activity.resting',
        customText: '',
        moodCode: null,
        notes: '',
        startTime: T0 - 4 * 3_600_000,
        endTime: T0 - 3 * 3_600_000,
        durationSec: 3600,
        linkedSeizureId: null,
      },
    });
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 120, 30) });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await waitFor(async () => expect((await list<Seizure>(ctx, 'seizure'))[0]?.eegSessionId).toBe(session.id));
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'EEG diary' }));
    await user.click(await screen.findByRole('button', { name: 'Open' }));

    const card = (await screen.findByText('Resting')).closest('.ui-card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change the activity' });
    await user.type(within(sheet).getByLabelText('Notes'), 'woke once');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await list<EegActivity>(ctx, 'eegActivity')).find((a) => a.kind === 'activity')?.notes).toBe('woke once'),
    );

    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    const ask = await screen.findByRole('alertdialog');
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect((await list<EegActivity>(ctx, 'eegActivity')).filter((a) => a.kind === 'activity')).toHaveLength(1);
    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () =>
      expect((await list<EegActivity>(ctx, 'eegActivity')).filter((a) => a.kind === 'activity')).toHaveLength(0),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Delete this session' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await list(ctx, 'eegSession')).toHaveLength(0));
    await waitFor(async () => expect(await list(ctx, 'eegActivity')).toHaveLength(0));
    await waitFor(async () => expect((await list<Seizure>(ctx, 'seizure'))[0]?.eegSessionId).toBeNull());
    expect(await list(ctx, 'seizure')).toHaveLength(1);
  });
});
