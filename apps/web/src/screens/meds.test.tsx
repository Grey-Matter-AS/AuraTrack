// @vitest-environment jsdom
import { medicationFixture, stripBase } from '@auratrack/model/fixtures';
import type { DoseLog, Medication, MedicationChange } from '@auratrack/model';
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { T0, openPlace, openSettings, backToHome, seed, setup } from './testSupport';

// Medicines: adding, changing, renaming, stopping, the day's doses, extra doses and the dose history. Real store.
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);

type Ctx = ReturnType<typeof setup>;
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const list = async <T,>(ctx: Ctx, type: 'medication' | 'medicationChange' | 'doseLog') =>
  (await ctx.client.list({ type })) as unknown as T[];

async function openMeds(ctx: Ctx) {
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'Medicines');
  await screen.findByRole('heading', { name: 'Medicines' });
  return user;
}

/** A medicine taken once a day, `minutesAgo` minutes before the test clock's start. */
async function dailyMedicine(ctx: Ctx, patientId: string, minutesAgo: number, extra: Partial<Medication> = {}) {
  return (await ctx.client.createRecord({
    type: 'medication',
    values: stripBase(
      medicationFixture({
        patientId,
        name: 'Lamotrigine',
        activeIngredient: 'Lamotrigine',
        frequency: 'OD',
        scheduledTimes: [hhmm(T0 - minutesAgo * 60_000)],
        startedAt: T0 - 3 * 86_400_000,
        ...extra,
      }),
    ),
  })) as unknown as Medication;
}

describe('adding a medicine', () => {
  it('adds it with its dose and times, and starts its history', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openMeds(ctx);
    expect(await screen.findByText('No medicines added yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add a medicine' }));
    await user.type(await screen.findByLabelText('Name'), 'Keppra');
    await user.selectOptions(screen.getByLabelText('Active ingredient'), 'Levetiracetam');
    await user.type(screen.getByLabelText('Dose'), '500');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx, 'medication')).toHaveLength(1));
    const [med] = await list<Medication>(ctx, 'medication');
    expect(med).toMatchObject({
      name: 'Keppra',
      activeIngredient: 'Levetiracetam',
      dose: 500,
      unit: 'mg',
      frequency: 'BD',
      scheduledTimes: ['08:00', '20:00'],
      active: true,
    });
    await waitFor(async () => expect(await list(ctx, 'medicationChange')).toHaveLength(1));
    expect(await list<MedicationChange>(ctx, 'medicationChange')).toMatchObject([
      { type: 'started', medicationId: med!.id, from: null, medicationName: 'Keppra' },
    ]);
    expect(await screen.findByText(/500 mg · BD 08:00, 20:00/)).toBeTruthy();
  });

  it('wants a name before it can be saved, and a time for a scheduled medicine', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openMeds(ctx);
    await user.click(screen.getByRole('button', { name: 'Add a medicine' }));
    const save = (await screen.findByRole('button', { name: 'Save' })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(screen.getByLabelText('Name'), 'Rescue');
    expect(save.disabled).toBe(false);
  });

  it('as-needed medicine has no times and can be the rescue medicine', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openMeds(ctx);
    await user.click(screen.getByRole('button', { name: 'Add a medicine' }));
    await user.type(await screen.findByLabelText('Name'), 'Buccal midazolam');
    await user.click(screen.getByRole('button', { name: 'When needed' }));
    expect(screen.queryByLabelText('Time 1')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: /Rescue medicine/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx, 'medication')).toHaveLength(1));
    expect((await list<Medication>(ctx, 'medication'))[0]).toMatchObject({
      frequency: 'PRN',
      isRescue: true,
      scheduledTimes: [],
    });
  });
});

describe('changing, renaming and stopping', () => {
  it('confirms a change with its date and adds it to the history, keeping the regimen before and after', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const med = await dailyMedicine(ctx, patientId, 30, { dose: 100 });
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const dose = await screen.findByLabelText('Dose');
    await user.clear(dose);
    await user.type(dose, '150');
    await user.click(screen.getByRole('button', { name: 'Review the change' }));
    const sheet = await screen.findByRole('dialog', { name: 'Confirm the change' });
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'increase');
    await user.click(within(sheet).getByRole('button', { name: 'Confirm' }));
    await waitFor(async () => expect(await list(ctx, 'medicationChange')).toHaveLength(1));
    const changes = await list<MedicationChange>(ctx, 'medicationChange');
    expect((await list<Medication>(ctx, 'medication'))[0]?.dose).toBe(150);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: 'changed',
      medicationId: med.id,
      note: 'increase',
      changedFields: expect.arrayContaining(['slotDose:' + hhmm(T0 - 30 * 60_000)]),
    });
    expect(changes[0]?.from?.dose).toBe(100);
    expect(changes[0]?.to?.dose).toBe(150);
    expect(await screen.findByText('Changed', { exact: false })).toBeTruthy();
  });

  it('says nothing changed when the form is unchanged', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 30);
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(await screen.findByRole('button', { name: 'Review the change' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm the change' })).getByRole('button', {
        name: 'Confirm',
      }),
    );
    expect(await screen.findByText('Nothing has changed.')).toBeTruthy();
    expect(await list(ctx, 'medicationChange')).toHaveLength(0);
  });

  it('locks the name, and a rename as a typo is recorded as a correction', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 30, { name: 'Lamotrigne' });
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    expect(((await screen.findByLabelText('Name')) as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.disabled).toBe(false);
    await user.clear(name);
    await user.type(name, 'Lamotrigine');
    await user.click(screen.getByRole('button', { name: 'Review the change' }));
    await user.click(await screen.findByRole('button', { name: /It was spelled wrongly/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    const sheet = await screen.findByRole('dialog', { name: 'Confirm the change' });
    expect(within(sheet).getByRole('button', { name: 'A correction' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(sheet).getByRole('button', { name: 'Confirm' }));
    await waitFor(async () =>
      expect((await list<MedicationChange>(ctx, 'medicationChange'))[0]?.type).toBe('correction'),
    );
    expect((await list<Medication>(ctx, 'medication'))[0]?.name).toBe('Lamotrigine');
  });

  it('a different medicine stops the old one and starts a new one', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 30, { name: 'Lamotrigine' });
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Valproate');
    await user.click(screen.getByRole('button', { name: 'Review the change' }));
    await user.click(await screen.findByRole('button', { name: /It is a different medicine/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    await waitFor(async () => expect(await list(ctx, 'medication')).toHaveLength(2));
    const meds = await list<Medication>(ctx, 'medication');
    expect(meds.find((m) => m.name === 'Lamotrigine')?.active).toBe(false);
    expect(meds.find((m) => m.name === 'Valproate')?.active).toBe(true);
    const types = (await list<MedicationChange>(ctx, 'medicationChange'))
      .map((c) => `${c.medicationName}:${c.type}`)
      .sort();
    expect(types).toEqual(['Lamotrigine:stopped', 'Valproate:started']);
  });

  it('stops a medicine instead of deleting it, keeps it listed as stopped, and can take it up again', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 30);
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    const sheet = await screen.findByRole('dialog', { name: 'Stop Lamotrigine?' });
    await user.click(within(sheet).getByRole('button', { name: 'Stop' }));
    await waitFor(async () => expect((await list<Medication>(ctx, 'medication'))[0]?.active).toBe(false));
    await waitFor(async () => expect(await list(ctx, 'medicationChange')).toHaveLength(1));
    expect((await list<MedicationChange>(ctx, 'medicationChange'))[0]).toMatchObject({ type: 'stopped', to: null });
    expect(await screen.findByRole('button', { name: 'Take up again' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Stopped')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Take up again' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Take up Lamotrigine again?' })).getByRole('button', {
        name: 'Take up again',
      }),
    );
    await waitFor(async () =>
      expect((await list<MedicationChange>(ctx, 'medicationChange')).map((c) => c.type).sort()).toEqual([
        'started',
        'stopped',
      ]),
    );
    expect((await list<Medication>(ctx, 'medication'))[0]?.active).toBe(true);
  });

  it('deletes a medicine entered by mistake, with its dose logs, after asking', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const med = await dailyMedicine(ctx, patientId, 30);
    await ctx.client.createRecord({
      type: 'doseLog',
      values: {
        patientId,
        medicationId: med.id,
        scheduledTime: null,
        takenAt: T0,
        status: 'taken',
        note: '',
        doseSnapshot: 1,
        unitSnapshot: 'mg',
      },
    });
    const user = await openMeds(ctx);
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Delete (entered by mistake)' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await list(ctx, 'medication')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete (entered by mistake)' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await list(ctx, 'medication')).toHaveLength(0));
    expect(await list(ctx, 'doseLog')).toHaveLength(0);
  });
});

describe('the day’s doses', () => {
  it('shows a dose that has come and is not marked, and marking it taken saves it with its dose', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const med = await dailyMedicine(ctx, patientId, 30, { dose: 100 });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByText('Today’s doses');
    expect(await screen.findByText('Not marked yet')).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: new RegExp(`${hhmm(T0 - 30 * 60_000)} · Lamotrigine · 100 mg`) });
    await user.click(box);
    await user.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);
    await waitFor(async () => expect(await list(ctx, 'doseLog')).toHaveLength(1));
    expect((await list<DoseLog>(ctx, 'doseLog'))[0]).toMatchObject({
      medicationId: med.id,
      status: 'taken',
      doseSnapshot: 100,
      unitSnapshot: 'mg',
      scheduledTime: hhmm(T0 - 30 * 60_000),
    });
    expect(await screen.findByText(/Taken · /)).toBeTruthy();
  });

  it('writes "missed" for a dose that passed 90 minutes ago, and marking it taken updates that log instead of adding a second', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 120);
    const user = userEvent.setup();
    ctx.mount();
    await waitFor(async () => expect((await list<DoseLog>(ctx, 'doseLog'))[0]?.status).toBe('missed'));
    await screen.findByText('Missed');
    await user.click(screen.getByRole('checkbox', { name: /Lamotrigine/ }));
    await user.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);
    await waitFor(async () => expect((await list<DoseLog>(ctx, 'doseLog'))[0]?.status).toBe('late'));
    expect(await list(ctx, 'doseLog')).toHaveLength(1);
  });

  it('writes "assumed" instead when that setting is on, and remembers the day it was turned on', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 120);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'device', key: 'assumeDosesTaken', value: true },
    });
    ctx.mount();
    await waitFor(async () => expect((await list<DoseLog>(ctx, 'doseLog'))[0]?.status).toBe('assumed'));
    expect(await screen.findByText('Assumed taken')).toBeTruthy();
  });

  it('turning "assume" on in the settings keeps the day it was turned on', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Medicines');
    await user.click(await screen.findByRole('checkbox', { name: /Assume doses were taken/ }));
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'assumeDosesTakenSince')?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('does not run twice: the same missed dose is never logged again', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 120);
    const user = userEvent.setup();
    ctx.mount();
    await waitFor(async () => expect(await list(ctx, 'doseLog')).toHaveLength(1));
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'Medicines');
    await openPlace(user, 'More');
    await openPlace(user, 'Medicines').catch(() => undefined);
    expect(await list(ctx, 'doseLog')).toHaveLength(1);
  });
});

describe('an extra dose', () => {
  it('logs a dose with no slot, using the usual dose or the one typed', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const med = await dailyMedicine(ctx, patientId, 600, {
      dose: 10,
      name: 'Midazolam',
      isRescue: true,
      frequency: 'PRN',
      scheduledTimes: [],
    });
    const user = await openMeds(ctx);
    await user.click(screen.getByRole('button', { name: 'Extra dose' }));
    const sheet = await screen.findByRole('dialog', { name: 'Extra dose' });
    const amount = within(sheet).getByLabelText(/Amount/);
    expect((amount as HTMLInputElement).value).toBe('10');
    await user.clear(amount);
    await user.type(amount, '5');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await list(ctx, 'doseLog')).toHaveLength(1));
    expect((await list<DoseLog>(ctx, 'doseLog'))[0]).toMatchObject({
      medicationId: med.id,
      scheduledTime: null,
      doseSnapshot: 5,
      status: 'taken',
    });
  });
});

describe('the dose history', () => {
  it('shows each scheduled dose of the last days with its status, and a changed dose is marked', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const med = await dailyMedicine(ctx, patientId, 120);
    const user = await openMeds(ctx);
    await waitFor(async () => expect(await list(ctx, 'doseLog')).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Dose history' }));
    const cell = await screen.findByRole('button', { name: new RegExp(`Lamotrigine .*Missed`) });
    await user.click(cell);
    const sheet = await screen.findByRole('dialog');
    await user.selectOptions(within(sheet).getByLabelText('Status'), 'taken');
    fireEvent.change(within(sheet).getByLabelText('Time taken'), { target: { value: hhmm(T0 - 100 * 60_000) } });
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await list<DoseLog>(ctx, 'doseLog'))[0]?.status).toBe('taken'));
    expect(await screen.findByRole('button', { name: /Lamotrigine .*Taken · changed/ })).toBeTruthy();
    expect((await list<DoseLog>(ctx, 'doseLog'))[0]?.medicationId).toBe(med.id);
  });
});

describe('reminders', () => {
  it('shows a card on Home for a dose that is due, for the person on screen and for another person, until dismissed', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await dailyMedicine(ctx, patientId, 30, { reminderEnabled: true });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Medicines');
    await user.click(await screen.findByRole('checkbox', { name: /^Dose reminders/ }));
    await backToHome(user);
    expect(await screen.findByText('Time for Lamotrigine')).toBeTruthy();
    const card = screen.getByText('Time for Lamotrigine').closest('.ui-card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Time for Lamotrigine')).toBeNull());
  });
});
