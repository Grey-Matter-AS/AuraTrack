// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { newId } from '@auratrack/model';
import { TEST_PIN_KDF, createStoreApi, type PasskeyEnv } from '@auratrack/store';
import { act, cleanup, fireEvent, render, screen, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppApi } from '../app/AppContext';
import { updates } from '../app/updates';
import { fakeEnv, T0 } from '../recording/fakeEnv';
import AppRoot from './AppRoot';

// Locking by itself, unlocking with a passkey, the update card, and the quick-note buttons. Real store, a clock the test moves.

// Under coverage, with every test file running at once, the first screen can take longer than a second
configure({ asyncUtilTimeout: 8000 });

const PIN = '2468';
let counter = 0;

function setup() {
  const f = fakeEnv({}, T0);
  const { api } = createStoreApi({
    name: `lock-${Date.now()}-${counter++}`,
    options: { pinKdf: TEST_PIN_KDF, now: f.env.now },
  });
  const client = new Proxy({} as AppApi, {
    get: (_t, method: string) => async (arg: unknown) =>
      (api as unknown as Record<string, (a: unknown) => unknown>)[method]!(arg),
  });
  return { f, api, client };
}
type Ctx = ReturnType<typeof setup>;

async function seed(ctx: Ctx, settings: Record<string, unknown> = {}) {
  await ctx.api.create({ credential: { pin: PIN } });
  const patientId = newId();
  await ctx.api.createRecord({
    type: 'patient',
    values: { id: patientId, patientId, name: 'Alex', dateOfBirth: null, emergencyContact: '', color: '#336699' },
  });
  for (const [key, value] of Object.entries(settings))
    await ctx.api.createRecord({ type: 'setting', values: { patientId, scope: 'device', key, value } });
  return { patientId };
}

/** A stand-in for the phone's passkey: it always gives the same secret, as a real one does for the same salt. */
function fakePasskeys(options: { refuse?: boolean } = {}): PasskeyEnv {
  const secret = new Uint8Array(32).fill(7);
  const result = () => ({
    rawId: new Uint8Array([1, 2, 3]).buffer,
    getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: secret.buffer.slice(0) } } }),
  });
  return {
    credentials: {
      create: async () => result(),
      get: async () => {
        if (options.refuse) throw new Error('cancelled');
        return result();
      },
    },
    rpId: 'localhost',
    rpName: 'AuraTrack',
  };
}

const away = async (f: Ctx['f'], seconds: number) => {
  await act(async () => {
    f.hide();
    f.jump(f.env.now() + seconds * 1000);
    f.show();
  });
};

afterEach(() => {
  cleanup();
  updates.dismiss();
});

describe('locking by itself', () => {
  it('locks when the app comes back after the set time away', async () => {
    const ctx = setup();
    await seed(ctx, { autoLockSeconds: 30 });
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await screen.findByRole('button', { name: 'Start timer' });
    await away(ctx.f, 10);
    expect(screen.queryByText('AuraTrack is locked')).toBeNull();
    await away(ctx.f, 31);
    expect(await screen.findByText('AuraTrack is locked')).toBeTruthy();
    expect((await ctx.client.status()).unlocked).toBe(false);
  });

  it('locks as the app goes away when the time is 0', async () => {
    const ctx = setup();
    await seed(ctx, { autoLockSeconds: 0 });
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await screen.findByRole('button', { name: 'Start timer' });
    await act(async () => ctx.f.hide());
    expect(await screen.findByText('AuraTrack is locked')).toBeTruthy();
  });

  it('does not lock when the setting is off', async () => {
    const ctx = setup();
    await seed(ctx, { appLockEnabled: false, autoLockSeconds: 0 });
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await screen.findByRole('button', { name: 'Start timer' });
    await away(ctx.f, 3600);
    await act(async () => {
      ctx.f.advance(30 * 60_000, 60_000);
    });
    expect(screen.queryByText('AuraTrack is locked')).toBeNull();
  });

  it('locks after five minutes untouched, and a touch starts the five minutes again', async () => {
    const ctx = setup();
    await seed(ctx);
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await screen.findByRole('button', { name: 'Start timer' });
    await act(async () => ctx.f.advance(4 * 60_000, 60_000));
    fireEvent.pointerDown(window);
    await act(async () => ctx.f.advance(4 * 60_000, 60_000));
    expect(screen.queryByText('AuraTrack is locked')).toBeNull();
    await act(async () => ctx.f.advance(2 * 60_000, 60_000));
    expect(await screen.findByText('AuraTrack is locked')).toBeTruthy();
  });

  it('never locks while a recording runs', async () => {
    const ctx = setup();
    await seed(ctx, { autoLockSeconds: 0 });
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    await away(ctx.f, 600);
    await act(async () => ctx.f.advance(10 * 60_000, 60_000));
    expect(screen.queryByText('AuraTrack is locked')).toBeNull();
    expect(screen.getByRole('timer')).toBeTruthy();
  });

  it('saves what the editor holds before it locks, so nothing typed is lost', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx, { autoLockSeconds: 0 });
    const made = (await ctx.api.createRecord({
      type: 'seizure',
      values: {
        patientId,
        timeZone: 'Europe/Oslo',
        phases: {
          start: { at: T0 - 600_000, source: 'timed' },
          auraEnd: null,
          seizureEnd: { at: T0 - 500_000, source: 'timed' },
          recoveryEnd: null,
        },
        status: 'recorded',
        typeCode: null,
        ilae: null,
        symptoms: [],
        afterFindings: [],
        recoveryMinutes: null,
        recoveryOngoing: false,
        triggerCodes: [],
        notes: '',
        video: null,
        isManualEntry: false,
        isEmergencyStop: false,
        recordedBy: 'carer',
        eegSessionId: null,
      },
    })) as { id: string };
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await user.click(await screen.findByRole('button', { name: 'Add details' }));
    await user.click(await screen.findByRole('tab', { name: /^Notes/ }));
    await user.type(screen.getByLabelText('Notes for the neurologist'), 'Typed before the lock');
    await act(async () => ctx.f.hide());
    expect(await screen.findByText('AuraTrack is locked')).toBeTruthy();
    await user.type(screen.getByLabelText('PIN'), PIN);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = (await ctx.client.get({ type: 'seizure', id: made.id })) as unknown as {
      notes: string;
      status: string;
    };
    expect(saved).toMatchObject({ notes: 'Typed before the lock', status: 'recorded' }); // saved as a change, not completed
  });
});

describe('Face ID or fingerprint', () => {
  it('is set up with the PIN, then unlocks the app from the PIN screen', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={fakePasskeys()} />);
    await user.type(await screen.findByLabelText('Your PIN (to set it up)'), PIN);
    await user.click(screen.getByRole('button', { name: 'Set up Face ID or fingerprint' }));
    expect(await screen.findByText('Face ID or fingerprint is set up')).toBeTruthy();
    expect((await ctx.client.status()).passkey).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.click(await screen.findByRole('button', { name: 'Unlock with Face ID or fingerprint' }));
    await screen.findByRole('button', { name: 'Start timer' });
  });

  it('refuses a wrong PIN when setting up', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={fakePasskeys()} />);
    await user.type(await screen.findByLabelText('Your PIN (to set it up)'), '1111');
    await user.click(screen.getByRole('button', { name: 'Set up Face ID or fingerprint' }));
    expect(await screen.findByText('That PIN is not right. Try again.')).toBeTruthy();
    expect((await ctx.client.status()).passkey).toBeNull();
  });

  it('says to use the PIN when the passkey is refused, and the PIN still works', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    const { unmount } = render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={fakePasskeys()} />);
    await user.type(await screen.findByLabelText('Your PIN (to set it up)'), PIN);
    await user.click(screen.getByRole('button', { name: 'Set up Face ID or fingerprint' }));
    await screen.findByText('Face ID or fingerprint is set up');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    unmount();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={fakePasskeys({ refuse: true })} />);
    await user.click(await screen.findByRole('button', { name: 'Unlock with Face ID or fingerprint' }));
    expect(await screen.findByText('That did not work. Use the PIN.')).toBeTruthy();
    await user.type(screen.getByLabelText('PIN'), PIN);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('button', { name: 'Start timer' });
  });

  it('says so when the browser has no passkeys, and offers no button', async () => {
    const ctx = setup();
    await seed(ctx);
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    expect(await screen.findByText(/cannot unlock with Face ID or fingerprint/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up Face ID or fingerprint' })).toBeNull();
  });

  it('can be removed again', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={fakePasskeys()} />);
    await user.type(await screen.findByLabelText('Your PIN (to set it up)'), PIN);
    await user.click(screen.getByRole('button', { name: 'Set up Face ID or fingerprint' }));
    await screen.findByText('Face ID or fingerprint is set up');
    const section = screen.getByText('Face ID or fingerprint is set up').parentElement!;
    await user.click(section.querySelector('button')!);
    await waitFor(async () => expect((await ctx.client.status()).passkey).toBeNull());
  });
});

describe('the update card', () => {
  it('shows on Home when a new version is ready, applies it on request, and hides on Later', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await screen.findByRole('button', { name: 'Start timer' });
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    const apply = vi.fn(async () => {});
    act(() => updates.ready(apply));
    expect(await screen.findByText('A new version is ready.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    expect(apply).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('A new version is ready.')).toBeNull();
  });

  it('never appears during a recording', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    act(() => updates.ready(async () => {}));
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await user.click(screen.getByRole('button', { name: 'Add details' }));
    await screen.findByText('Seizure details');
    expect(screen.queryByRole('status')).toBeNull(); // nor while editing (Home is still there, hidden, under the editor)
    act(() => updates.dismiss());
  });
});

describe('quick-note buttons', () => {
  it('use the labels the person chose', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    render(<AppRoot client={ctx.client} env={ctx.f.env} passkeyEnv={null} />);
    const field = await screen.findByLabelText('Quick note buttons');
    await user.type(field, 'Fell, Cried out, Very long label that is cut at twenty-four letters');
    const save = screen.getAllByRole('button', { name: 'Save' }).at(-1)! as HTMLButtonElement;
    await user.click(save);
    await waitFor(() => expect(save.disabled).toBe(true)); // the screen has taken the new labels
    await waitFor(async () => {
      const labels = (
        (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: string[] }[]
      ).find((s) => s.key === 'quickNoteLabels');
      expect(labels?.value).toEqual(['Fell', 'Cried out', 'Very long label that is']);
    });
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['End aura', 'End seizure', 'Fell', 'Cried out', 'Very long label that is']);
  });
});
