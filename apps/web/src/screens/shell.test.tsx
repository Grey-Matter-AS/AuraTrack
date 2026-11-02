// @vitest-environment jsdom
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PIN, backToHome, openPlace, openSettings, seed, setup } from './testSupport';

// The shell: the main places, people, the settings groups, Help, About, and erasing everything. Real store, nothing mocked.
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);

async function home(ctx: ReturnType<typeof setup>, opts?: Parameters<typeof seed>[1]) {
  await seed(ctx, opts);
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  return user;
}

describe('the main places', () => {
  it('moves between Home, History, Medicines and More, marking where you are', async () => {
    const ctx = setup();
    const user = await home(ctx);
    for (const place of ['History', 'Medicines', 'More'] as const) {
      await openPlace(user, place);
      await screen.findByRole('heading', { name: place });
      expect(screen.getByRole('button', { name: place }).getAttribute('aria-current')).toBe('page');
    }
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await screen.findByRole('button', { name: 'Start timer' });
  });

  it('has Settings, People, Help and About under More, and no wellbeing or EEG until they are switched on', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    for (const name of ['People', 'Settings', 'Help', 'About'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Wellbeing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'EEG diary' })).toBeNull();
    await openSettings(user, 'Recording and emergency plan');
    await user.click(await screen.findByRole('checkbox', { name: /^Wellbeing/ }));
    await user.click(await screen.findByRole('checkbox', { name: /^EEG diary/ }));
    await backToHome(user);
    await openPlace(user, 'More');
    expect(await screen.findByRole('button', { name: 'Wellbeing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'EEG diary' })).toBeTruthy();
  });
});

describe('people', () => {
  it('adds a person with a colour, records for them, renames them, and removes them with their records', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    await user.click(screen.getByRole('button', { name: 'People' }));
    await user.click(await screen.findByRole('button', { name: 'Add a person' }));
    await user.type(await screen.findByLabelText('Name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Purple' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'patient' })).toHaveLength(2));
    const people = (await ctx.client.list({ type: 'patient' })) as unknown as {
      id: string;
      name: string;
      color: string;
    }[];
    const sam = people.find((p) => p.name === 'Sam')!;
    expect(sam.color).toBe('#7e22ce');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Sam is now the person the app records for
    expect(await screen.findByText('Recording for this person now')).toBeTruthy();
    await ctx.client.createRecord({
      type: 'interictalEvent',
      values: {
        patientId: sam.id,
        occurredAt: 1000,
        timeZone: 'UTC',
        symptomCode: 'symptom.dizziness',
        area: null,
        notes: '',
        recordedBy: 'carer',
      },
    });

    // Alex can be used again, and removed
    const alexCard = screen.getByText('Alex', { selector: '.app-banner' }).closest('.ui-card')! as HTMLElement;
    await user.click(within(alexCard).getByRole('button', { name: 'Edit' }));
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Alexander');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Alexander', { selector: '.app-banner' })).toBeTruthy();

    const samCard = screen.getByText('Sam', { selector: '.app-banner' }).closest('.ui-card')! as HTMLElement;
    await user.click(within(samCard).getByRole('button', { name: 'Remove' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove for good' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'patient' })).toHaveLength(1));
    expect(await ctx.client.list({ type: 'interictalEvent' })).toHaveLength(0);
    expect(await screen.findByText('Recording for this person now')).toBeTruthy();
  });

  it('does not offer to remove the only person', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    await user.click(screen.getByRole('button', { name: 'People' }));
    await screen.findByText('Alex', { selector: '.app-banner' });
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});

describe('settings', () => {
  it('lists the groups, and appearance changes the look of the whole app at once', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    for (const group of [
      'About the person',
      'Appearance',
      'Dates and numbers',
      'Recording and emergency plan',
      'Medicines',
      'Doctor and reports',
      'Data and backup',
      'Lock',
    ])
      expect(screen.getByRole('button', { name: group })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(await screen.findByRole('button', { name: 'Light' }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Largest' }));
    await waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('light');
      expect(document.documentElement.dataset['accent']).toBe('green');
      expect(document.documentElement.dataset['fontSize']).toBe('xlarge');
    });
  });

  it('keeps the display choices as settings', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Dates and numbers');
    await user.click(await screen.findByRole('button', { name: '50' }));
    await user.click(screen.getByRole('button', { name: '12 hours' }));
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'historyPageSize')?.value).toBe(50);
      expect(rows.find((r) => r.key === 'timeFormat')?.value).toBe('12h');
    });
  });

  it('shows the usual emergency plan, lets it be changed, and puts it back', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Recording and emergency plan');
    const alert = (await screen.findByLabelText(/Emergency alert after/)) as HTMLInputElement;
    expect(alert.value).toBe('5');
    expect((screen.getByRole('button', { name: 'Back to the usual plan' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(alert);
    await user.type(alert, '4');
    await user.tab();
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'emergencyAlertMinutes')?.value).toBe(4);
    });
    const reset = screen.getByRole('button', { name: 'Back to the usual plan' }) as HTMLButtonElement;
    await waitFor(() => expect(reset.disabled).toBe(false));
    await user.click(reset);
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'emergencyAlertMinutes')?.value).toBe(5);
      expect(rows.find((r) => r.key === 'clusterMinCount')?.value).toBe(3);
      expect(rows.find((r) => r.key === 'clusterWindowMinutes')?.value).toBe(8);
    });
  });

  it('keeps the doctor details for reports', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Doctor and reports');
    await user.type(await screen.findByLabelText('Neurologist'), 'Dr Berg');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'neurologistName')?.value).toBe('Dr Berg');
    });
  });

  it('changes the person’s name and contact from "About the person"', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'About the person');
    const contact = await screen.findByLabelText('Emergency contact');
    await user.type(contact, 'Sam 555 0100');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
    await waitFor(async () => {
      const people = (await ctx.client.list({ type: 'patient' })) as unknown as { emergencyContact: string }[];
      expect(people[0]?.emergencyContact).toBe('Sam 555 0100');
    });
  });

  it('keeps a phone number for the contact and the carer, separately', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'About the person');
    await user.type(await screen.findByLabelText('Emergency contact'), 'Sam');
    await user.type(screen.getByLabelText('Emergency contact phone'), '+47 555 0100');
    await user.type(screen.getByLabelText('Carer name'), 'Kari');
    await user.type(screen.getByLabelText('Carer phone'), '555 0199');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const people = (await ctx.client.list({ type: 'patient' })) as unknown as { emergencyPhone: string }[];
      expect(people[0]?.emergencyPhone).toBe('+47 555 0100');
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'carerName')?.value).toBe('Kari');
      expect(rows.find((r) => r.key === 'carerPhone')?.value).toBe('555 0199');
    });
  });

  it('copies the contact to the carer when they are the same person', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'About the person');
    await user.type(await screen.findByLabelText('Emergency contact'), 'Sam');
    await user.type(screen.getByLabelText('Emergency contact phone'), '555 0100');
    await user.click(screen.getByRole('checkbox', { name: /same person/ }));
    const carer = screen.getByLabelText('Carer name') as HTMLInputElement;
    expect(carer.value).toBe('Sam');
    expect(carer.disabled).toBe(true);
    expect((screen.getByLabelText('Carer phone') as HTMLInputElement).value).toBe('555 0100');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
      expect(rows.find((r) => r.key === 'carerIsContact')?.value).toBe(true);
      expect(rows.find((r) => r.key === 'carerName')?.value).toBe('Sam');
      expect(rows.find((r) => r.key === 'carerPhone')?.value).toBe('555 0100');
    });
  });

  it('names each set of choices on Appearance', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Appearance');
    for (const name of ['Theme', 'Accent colour', 'Text size']) expect(await screen.findByText(name)).toBeTruthy();
  });
});

describe('the top bar', () => {
  it('shows the name and the buttons on every screen, and Go to Home returns from anywhere', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Appearance');
    expect(screen.getByText('aTr')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock the app' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Go to Home' }));
    expect(await screen.findByRole('button', { name: 'Start timer' })).toBeTruthy();
  });

  it('Go to Home also returns from a main place, which replaced Home', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await user.click(await screen.findByRole('button', { name: 'Go to Home' }));
    expect(await screen.findByRole('button', { name: 'Start timer' })).toBeTruthy();
  });

  it('is not on the recording screen', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('button', { name: /Stop|Seizure started|Aura/i });
    expect(screen.queryByRole('button', { name: 'Go to Home' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lock the app' })).toBeNull();
  });
});

describe('erasing everything', () => {
  it('refuses a wrong PIN, and with the right one removes everything and returns to set-up', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openSettings(user, 'Data and backup');
    await user.click(await screen.findByRole('button', { name: 'Erase everything on this device' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText('PIN'), '1111');
    await user.click(within(dialog).getByRole('button', { name: 'Erase everything' }));
    expect(await within(dialog).findByText('That PIN is not right. Try again.')).toBeTruthy();
    expect((await ctx.client.status()).exists).toBe(true);
    const pin = within(dialog).getByLabelText('PIN');
    await user.clear(pin);
    await user.type(pin, PIN);
    await user.click(within(dialog).getByRole('button', { name: 'Erase everything' }));
    await screen.findByLabelText('Name of the person being tracked');
    expect((await ctx.client.status()).exists).toBe(false);
  });
});

describe('Help and About', () => {
  it('opens and closes a Help section', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    await user.click(screen.getByRole('button', { name: 'Help' }));
    const section = await screen.findByRole('button', { name: 'Recording a seizure' });
    expect(section.getAttribute('aria-expanded')).toBe('false');
    await user.click(section);
    expect(await screen.findByText(/Press Start timer when it begins/)).toBeTruthy();
    await user.click(section);
    expect(screen.queryByText(/Press Start timer when it begins/)).toBeNull();
  });

  it('shows the version and the disclaimer', async () => {
    const ctx = setup();
    const user = await home(ctx);
    await openPlace(user, 'More');
    await user.click(screen.getByRole('button', { name: 'About' }));
    expect(await screen.findByText(/^Version \d+\.\d+\.\d+$/)).toBeTruthy();
    expect(screen.getByText(/not a medical device/)).toBeTruthy();
  });
});
