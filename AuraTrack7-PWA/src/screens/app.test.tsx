// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { newId } from '@auratrack/model';
import { medicationFixture, stripBase } from '@auratrack/model/fixtures';
import { TEST_PIN_KDF, createStoreApi } from '@auratrack/store';
import { act, cleanup, render, screen, waitFor, within, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppApi } from '../app/AppContext';
import { fakeEnv, T0 } from '../recording/fakeEnv';
import AppRoot from './AppRoot';
import { backToHome, openSettings } from './testSupport';

// The real screens, on the real store (in memory) and a clock the test moves. Nothing is mocked except time and the browser.

// Under coverage, with every test file running at once, the first screen can take longer than a second
configure({ asyncUtilTimeout: 8000 });

const PIN = '2468';
let counter = 0;

function setup() {
  const f = fakeEnv({}, T0);
  const { api } = createStoreApi({
    name: `screens-${Date.now()}-${counter++}`,
    options: { pinKdf: TEST_PIN_KDF, now: f.env.now },
  });
  // Straight to the store, with the same shape the worker gives (every call answers with a promise)
  const client = new Proxy({} as AppApi, {
    get: (_t, method: string) => async (arg: unknown) =>
      (api as unknown as Record<string, (a: unknown) => unknown>)[method]!(arg),
  });
  const mount = () => render(<AppRoot client={client} env={f.env} />);
  return { f, api, client, mount };
}
type Ctx = ReturnType<typeof setup>;

async function firstRun(ctx: Ctx, name = 'Alex') {
  const user = userEvent.setup();
  ctx.mount();
  await user.type(await screen.findByLabelText('Name of the person being tracked'), name);
  await user.type(screen.getByLabelText('PIN (at least 4 digits)'), PIN);
  await user.type(screen.getByLabelText('PIN again'), PIN);
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await screen.findByRole('button', { name: 'Start timer' });
  return user;
}

/** Ends a recording the unlocked way: "Add details" opens the editor; Back returns to Home with the timing saved. */
async function addDetailsThenBack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add details' }));
  await screen.findByText('Seizure details');
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('button', { name: 'Start timer' });
}

const tick = (ctx: Ctx, ms: number) => act(async () => ctx.f.advance(ms, 1000));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.localStorage.clear(); // the language is remembered there
});

describe('first run', () => {
  it('sets up the store and the first person, then shows Home', async () => {
    const ctx = setup();
    await firstRun(ctx);
    expect(screen.getByRole('img', { name: 'Alex' })).toBeTruthy();
    expect(screen.getByText('No seizures recorded yet.')).toBeTruthy();
    expect((await ctx.client.status()).unlocked).toBe(true);
  });

  it('asks for a PIN of at least 4 digits, typed twice the same', async () => {
    const ctx = setup();
    const user = userEvent.setup();
    ctx.mount();
    await user.type(await screen.findByLabelText('Name of the person being tracked'), 'Alex');
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), '12');
    await user.type(screen.getByLabelText('PIN again'), '12');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('The PIN needs at least 4 digits.')).toBeTruthy();
    await user.clear(screen.getByLabelText('PIN (at least 4 digits)'));
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), '1234');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('The two PINs are not the same.')).toBeTruthy();
    expect((await ctx.client.status()).exists).toBe(false);
  });
});

describe('recording', () => {
  it('records with the phase buttons, and saves the seizure', async () => {
    const ctx = setup();
    const user = await firstRun(ctx);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    expect((await screen.findByRole('timer')).textContent).toBe('0:00');
    await tick(ctx, 20_000);
    expect(screen.getByRole('timer').textContent).toBe('0:20');
    await user.click(screen.getByRole('button', { name: 'End aura' }));
    await tick(ctx, 60_000);
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await user.click(screen.getByRole('button', { name: 'Back to usual self' }));
    await addDetailsThenBack(user);
    const [seizure] = (await ctx.client.list({ type: 'seizure' })) as unknown as {
      status: string;
      phases: { seizureEnd: { at: number } };
    }[];
    expect(seizure).toMatchObject({ status: 'recorded', phases: { seizureEnd: { at: T0 + 80_000 } } });
    expect(await screen.findByText('Type not set')).toBeTruthy();
    expect(await screen.findByText(/· 1:20/)).toBeTruthy(); // the seizure length: the aura counts, recovery never does
  });

  it('has no buttons beyond the phase buttons and the quick notes', async () => {
    const ctx = setup();
    const user = await firstRun(ctx);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['End aura', 'End seizure', 'FELL', 'BLUE', 'VOMITED', 'WET']);
  });

  it('keeps timed quick notes', async () => {
    const ctx = setup();
    const user = await firstRun(ctx);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await tick(ctx, 35_000);
    await user.click(screen.getByRole('button', { name: 'FELL' }));
    expect(await screen.findByText('[T+35s] FELL')).toBeTruthy();
  });

  it('warns a minute before the alert, then shows the red alert with the rescue medication and the contact', async () => {
    const ctx = setup();
    await seed(ctx, { contact: 'Sam 555 0100', rescue: 'Midazolam' });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await tick(ctx, 239_000);
    expect(screen.queryByText('One minute to the emergency alert time')).toBeNull();
    await tick(ctx, 1000);
    expect(await screen.findByText('One minute to the emergency alert time')).toBeTruthy();
    await tick(ctx, 60_000);
    const alert = await screen.findByRole('alertdialog');
    expect(within(alert).getByText('5 minutes: follow the emergency plan')).toBeTruthy();
    expect(within(alert).getByText(/Midazolam 10 mg/)).toBeTruthy();
    expect(within(alert).getByText(/Sam 555 0100/)).toBeTruthy();
    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('counts the alert from Start, through the aura', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await tick(ctx, 10_000);
    await user.click(screen.getByRole('button', { name: 'End aura' }));
    await tick(ctx, 290_000);
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
  });

  it('stops by itself at 12 minutes, says so, and keeps the seizure end unknown', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await user.click(screen.getByRole('button', { name: 'FELL' }));
    await tick(ctx, 301_000);
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dismiss' }));
    await tick(ctx, 420_000);
    const stop = await screen.findByRole('alertdialog');
    expect(within(stop).getByText('Recording stopped at 12 minutes')).toBeTruthy();
    await user.click(within(stop).getByRole('button', { name: 'Dismiss' }));
    await addDetailsThenBack(user);
    const [seizure] = (await ctx.client.list({ type: 'seizure' })) as unknown as {
      isEmergencyStop: boolean;
      quickNotes: unknown[];
      phases: { seizureEnd: unknown };
    }[];
    expect(seizure).toMatchObject({ isEmergencyStop: true, phases: { seizureEnd: null } });
    expect(seizure!.quickNotes).toHaveLength(1);
    expect(await screen.findByText(/stopped at 12 minutes, end time not known/)).toBeTruthy();
  });

  it('shows the simpler screen when recording for yourself', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Recording and emergency plan');
    const mine = await screen.findByRole('checkbox', { name: /Recording for myself/ });
    await user.click(mine);
    await waitFor(() => expect((mine as HTMLInputElement).checked).toBe(true));
    await backToHome(user);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End aura' })).toBeNull();
  });

  it('warns at once when the last seizures were close together', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx, {});
    for (const minutes of [2, 5]) {
      const at = T0 - minutes * 60_000;
      await ctx.client.createRecord({
        type: 'seizure',
        values: {
          ...baseSeizure(patientId),
          phases: {
            start: { at, source: 'timed' },
            auraEnd: null,
            seizureEnd: { at: at + 30_000, source: 'timed' },
            recoveryEnd: null,
          },
        },
      });
    }
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    expect(await screen.findByText('3 seizures within 8 min: follow the emergency plan.')).toBeTruthy();
  });

  it('offers the symptom strip only when it is switched on', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx, {});
    await ctx.client.createRecord({
      type: 'seizure',
      values: {
        ...baseSeizure(patientId),
        symptoms: [
          {
            id: newId(),
            code: 'symptom.big_shaking_jerking.rhythmic_shaking',
            area: null,
            moment: 0,
            order: 0,
            sincePrevious: { kind: 'unknown', ms: null },
            isFirst: true,
            phase: 'seizure',
          },
        ],
      },
    });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    expect(screen.queryByText('Symptoms (one tap, timed automatically)')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await addDetailsThenBack(user);
    await openSettings(user, 'Recording and emergency plan');
    await user.click(await screen.findByRole('checkbox', { name: /Symptom strip while recording/ }));
    await backToHome(user);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    expect(await screen.findByText('Symptoms (one tap, timed automatically)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /shaking/i }));
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await addDetailsThenBack(user);
    const all = (await ctx.client.list({ type: 'seizure' })) as unknown as {
      symptoms: { phase: string }[];
      createdAt: number;
    }[];
    expect(all.some((s) => s.symptoms.length === 1 && s.symptoms[0]?.phase === 'seizure')).toBe(true);
  });
});

describe('Log past seizure', () => {
  it('saves the phases in order (aura, seizure, then recovery after it), each entered later', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Log past seizure' }));
    const sheet = await screen.findByRole('dialog', { name: 'Log a past seizure' });
    // One box each, HH:MM:SS, filled from the right: 2, 0 is 00:00:20; 2, 4, 0 is 00:02:40
    await user.type(within(sheet).getByLabelText('Aura'), '20');
    await user.type(within(sheet).getByLabelText('Seizure'), '240');
    await user.type(within(sheet).getByLabelText('Recovery, until back to usual self'), '1000');
    expect(within(sheet).getByText('Seizure length: 00:03:00 (aura and seizure)')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log a past seizure' })).toBeNull());
    expect(screen.getByText(/entered later/)).toBeTruthy();
    const [seizure] = (await ctx.client.list({ type: 'seizure' })) as unknown as {
      isManualEntry: boolean;
      phases: {
        start: { at: number; source: string };
        auraEnd: { at: number };
        seizureEnd: { at: number };
        recoveryEnd: { at: number };
      };
    }[];
    expect(seizure!.isManualEntry).toBe(true);
    expect(seizure!.phases.start.source).toBe('entered-later');
    expect(seizure!.phases.auraEnd.at - seizure!.phases.start.at).toBe(20_000);
    expect(seizure!.phases.seizureEnd.at - seizure!.phases.start.at).toBe(180_000);
    expect(seizure!.phases.recoveryEnd.at - seizure!.phases.seizureEnd.at).toBe(600_000);
  });

  it('asks for the seizure, and refuses one of no length', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Log past seizure' }));
    const sheet = await screen.findByRole('dialog', { name: 'Log a past seizure' });
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Enter how long the seizure lasted.')).toBeTruthy();
    await user.type(within(sheet).getByLabelText('Seizure'), '0');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Set a length of at least one second.')).toBeTruthy();
    expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(0);
  });
});

describe('the PIN screen', () => {
  it('starts a recording without the PIN, and the recording joins the records at unlock', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Lock the app' }));
    await screen.findByText('AuraTrack is locked');
    await user.click(screen.getByRole('button', { name: 'Start timer without the PIN' }));
    expect(await screen.findByText(/Recording while the app is locked/)).toBeTruthy();
    await tick(ctx, 30_000);
    await user.click(screen.getByRole('button', { name: 'FELL' }));
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await user.click(screen.getByRole('button', { name: 'Back to usual self' }));
    await user.click(await screen.findByRole('button', { name: 'Save and close' }));
    await screen.findByText('AuraTrack is locked');
    await user.type(await screen.findByLabelText('PIN'), PIN);
    await user.click(await screen.findByRole('button', { name: 'Unlock' })); // it reads "Unlocking…" while the screen is busy
    await screen.findByRole('button', { name: 'Start timer' });
    expect(await screen.findByText(/recorded while locked/)).toBeTruthy();
    const [seizure] = (await ctx.client.list({ type: 'seizure' })) as unknown as {
      recordedWhileLocked: boolean;
      quickNotes: unknown[];
    }[];
    expect(seizure).toMatchObject({ recordedWhileLocked: true });
    expect(seizure!.quickNotes).toHaveLength(1);
  });

  it('refuses a wrong PIN, and keeps the screen locked', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Lock the app' }));
    await user.type(await screen.findByLabelText('PIN'), '0000');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('That PIN is not right. Try again.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start timer' })).toBeNull();
  });

  it('has no Start button when the setting is off', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Recording and emergency plan');
    await user.click(await screen.findByRole('checkbox', { name: /Start without the PIN/ }));
    await backToHome(user);
    await user.click(screen.getByRole('button', { name: 'Lock the app' }));
    await screen.findByText('AuraTrack is locked');
    expect((screen.getByRole('button', { name: 'Start timer without the PIN' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows the alert card while locked: contact and rescue medication, and no name unless chosen', async () => {
    const ctx = setup();
    await seed(ctx, { contact: 'Sam 555 0100', rescue: 'Midazolam' });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Lock the app' }));
    await user.click(await screen.findByRole('button', { name: 'Start timer without the PIN' }));
    await tick(ctx, 300_000);
    const alert = await screen.findByRole('alertdialog');
    expect(within(alert).getByText(/Midazolam/)).toBeTruthy();
    expect(within(alert).getByText(/Sam 555 0100/)).toBeTruthy();
    expect(screen.queryByText('Alex')).toBeNull();
  });
});

describe('a recording the app lost', () => {
  async function lost(ctx: Ctx, seconds: number) {
    const { patientId } = await seed(ctx, {});
    const seizureId = newId();
    await ctx.client.recordingEvent({
      seizureId,
      event: {
        kind: 'start',
        id: newId(),
        at: ctx.f.env.now(),
        seizureId,
        patientId,
        recordedBy: 'carer',
        timeZone: 'Europe/Oslo',
      },
    });
    await ctx.client.recordingEvent({
      seizureId,
      event: { kind: 'quick_note', id: newId(), at: ctx.f.env.now() + 20_000, label: 'FELL' },
    });
    ctx.f.jump(T0 + seconds * 1000);
    return seizureId;
  }

  it('asks if it is still happening, and carries on with the same clock', async () => {
    const ctx = setup();
    const seizureId = await lost(ctx, 90);
    const user = userEvent.setup();
    ctx.mount();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('A recording was still open')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Still happening' }));
    expect((await screen.findByRole('timer')).textContent).toBe('1:30');
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await waitFor(async () =>
      expect(await ctx.client.get({ type: 'seizure', id: seizureId })).toMatchObject({
        phases: { seizureEnd: { at: T0 + 90_000 } },
      }),
    );
  });

  it('asks when it ended, offering the last tap, and saves the time as entered later', async () => {
    const ctx = setup();
    const seizureId = await lost(ctx, 120);
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'It ended' }));
    const sheet = await screen.findByRole('dialog', { name: 'When did it end?' });
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    type Saved = { phases: { seizureEnd: { at: number; source: string } | null } };
    await waitFor(async () => {
      const saved = (await ctx.client.get({ type: 'seizure', id: seizureId })) as unknown as Saved;
      expect(saved.phases.seizureEnd?.source).toBe('entered-later');
      expect(Math.abs((saved.phases.seizureEnd?.at ?? 0) - (T0 + 20_000))).toBeLessThan(60_000); // the last tap, to the minute
    });
  });

  it('does not ask about one past 12 minutes: it says the timer stopped itself', async () => {
    const ctx = setup();
    const seizureId = await lost(ctx, 3600);
    const user = userEvent.setup();
    ctx.mount();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('A recording was stopped after 12 minutes')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }));
    const saved = (await ctx.client.get({ type: 'seizure', id: seizureId })) as unknown as {
      isEmergencyStop: boolean;
      phases: { seizureEnd: unknown };
    };
    expect(saved).toMatchObject({ isEmergencyStop: true, phases: { seizureEnd: null } });
  });
});

describe('cancelled recordings and settings', () => {
  it('keeps a cancelled recording until the user decides', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx, {});
    const made = (await ctx.client.createRecord({
      type: 'seizure',
      values: { ...baseSeizure(patientId), cancelled: true },
    })) as unknown as { id: string };
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText('A recording was cancelled')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(screen.queryByText('A recording was cancelled')).toBeNull());
    expect(await ctx.client.get({ type: 'seizure', id: made.id })).toMatchObject({ cancelled: false });
  });

  it('deletes a cancelled recording when asked', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx, {});
    await ctx.client.createRecord({ type: 'seizure', values: { ...baseSeizure(patientId), cancelled: true } });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('A recording was cancelled')).toBeNull());
    expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(0);
  });

  it('follows the language setting', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openSettings(user, 'Appearance');
    await user.selectOptions(await screen.findByLabelText('Language'), 'nb');
    expect(await screen.findByLabelText('Språk')).toBeTruthy();
    expect(globalThis.localStorage.getItem('auratrack.language')).toBe('nb');
  });

  it('starts in English, lets the language be chosen on the set-up screen, and keeps it afterwards', async () => {
    const ctx = setup();
    const user = userEvent.setup();
    ctx.mount();
    expect(await screen.findByText(/Everything stays on this device/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Language'), 'nb');
    expect(await screen.findByText(/Alt blir på denne enheten/)).toBeTruthy();
    expect(globalThis.localStorage.getItem('auratrack.language')).toBe('nb'); // the screens before unlock use it too
    await user.type(screen.getByLabelText(/Navn på/), 'Alex');
    for (const field of screen.getAllByLabelText(/PIN/)) await user.type(field, PIN);
    await user.click(screen.getByRole('button', { name: 'Opprett' }));
    expect(await screen.findByRole('button', { name: 'Logg tidligere anfall' })).toBeTruthy(); // not switched back to English
    const saved = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
    expect(saved.find((r) => r.key === 'language')?.value).toBe('nb'); // kept in the store for next time
  });

  it('cycles between people from the chip', async () => {
    const ctx = setup();
    await seed(ctx, {});
    const second = newId();
    await ctx.client.createRecord({
      type: 'patient',
      values: {
        id: second,
        patientId: second,
        name: 'Bo',
        dateOfBirth: null,
        emergencyContact: '',
        emergencyPhone: '',
        color: '#000',
      },
    });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: /Switch person: Alex/ }));
    expect(await screen.findByRole('button', { name: /Switch person: Bo/ })).toBeTruthy();
  });
});

function baseSeizure(patientId: string) {
  return {
    patientId,
    timeZone: 'Europe/Oslo',
    phases: {
      start: { at: T0 - 3_600_000, source: 'timed' as const },
      auraEnd: null,
      seizureEnd: { at: T0 - 3_500_000, source: 'timed' as const },
      recoveryEnd: null,
    },
    status: 'recorded' as const,
    ilae2025: null,
    profile: null,
    symptoms: [],
    afterFindings: [],
    recoveryOngoing: false,
    triggerCodes: [],
    notes: '',
    video: null,
    isManualEntry: false,
    isEmergencyStop: false,
    recordedBy: 'carer' as const,
    eegSessionId: null,
    prodromeSecondsBefore: null,
    quickNotes: [],
    recordedWhileLocked: false,
    cancelled: false,
  };
}

/** A store that already exists and is open, with one person (and optionally a contact and rescue medication). */
async function seed(ctx: Ctx, opts: { contact?: string; rescue?: string }) {
  await ctx.api.create({ credential: { pin: PIN } });
  const patientId = newId();
  await ctx.api.createRecord({
    type: 'patient',
    values: {
      id: patientId,
      patientId,
      name: 'Alex',
      dateOfBirth: null,
      emergencyContact: opts.contact ?? '',
      emergencyPhone: '',
      color: '#336699',
    },
  });
  if (opts.rescue)
    await ctx.api.createRecord({
      type: 'medication',
      values: stripBase(medicationFixture({ patientId, name: opts.rescue, dose: 10, unit: 'mg', isRescue: true })),
    });
  return { patientId };
}
