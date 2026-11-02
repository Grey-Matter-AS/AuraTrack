import 'fake-indexeddb/auto';
import { newId } from '@auratrack/model';
import { medicationFixture, stripBase } from '@auratrack/model/fixtures';
import { TEST_PIN_KDF, createStoreApi } from '@auratrack/store';
import { act, render, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { AppApi } from '../app/AppContext';
import { fakeEnv, T0 } from '../recording/fakeEnv';
import AppRoot from './AppRoot';

type User = ReturnType<typeof userEvent.setup>;

/** From Home: More, Settings, then one group of settings (named as on screen). */
export async function openSettings(user: User, group: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
  await user.click(await screen.findByRole('button', { name: group }));
}

/** From a group of settings back to Home. */
export async function backToHome(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Back' }));
  await user.click(await screen.findByRole('button', { name: 'Back' }));
  await user.click(await screen.findByRole('button', { name: 'Home' }));
  await screen.findByRole('button', { name: 'Start timer' });
}

/** From Home to one of the main places. */
export async function openPlace(user: User, place: 'History' | 'Medicines' | 'More'): Promise<void> {
  await user.click(await screen.findByRole('button', { name: place }));
}

export const PIN = '2468';
let counter = 0;

/** The real app on the real store (in memory), with a clock the test moves. Only time and the browser are faked. */
export function setup() {
  const f = fakeEnv({}, T0);
  const { api } = createStoreApi({
    name: `shell-${Date.now()}-${counter++}`,
    options: { pinKdf: TEST_PIN_KDF, now: f.env.now },
  });
  const client = new Proxy({} as AppApi, {
    get: (_t, method: string) => async (arg: unknown) => {
      const call = (api as unknown as Record<string, (a: unknown) => unknown>)[method];
      if (!call) throw new Error(`The store has no ${method}`);
      return call(arg);
    },
  });
  const mount = (): void => {
    render(<AppRoot client={client} env={f.env} />);
  };
  return { f, api, client, mount };
}
export type Ctx = ReturnType<typeof setup>;

export const tick = (ctx: Ctx, ms: number) => act(async () => ctx.f.advance(ms, 1000));

/** A store that exists and is open, with one person (optionally with a contact and a rescue medicine). */
export async function seed(ctx: Ctx, opts: { contact?: string; rescue?: string; name?: string } = {}) {
  await ctx.api.create({ credential: { pin: PIN } });
  const patientId = newId();
  await ctx.api.createRecord({
    type: 'patient',
    values: {
      id: patientId,
      patientId,
      name: opts.name ?? 'Alex',
      dateOfBirth: null,
      emergencyContact: opts.contact ?? '',
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

/** The values of a seizure record that began `minutesAgo` before the test clock's start and lasted `seconds`. */
export function makeSeizure(
  patientId: string,
  minutesAgo: number,
  seconds: number,
  extra: Record<string, unknown> = {},
) {
  const start = T0 - minutesAgo * 60_000;
  return {
    patientId,
    timeZone: 'Europe/Oslo',
    phases: {
      start: { at: start, source: 'timed' as const },
      auraEnd: null,
      seizureEnd: { at: start + seconds * 1000, source: 'timed' as const },
      recoveryEnd: null,
    },
    status: 'complete' as const,
    typeCode: 'seizure_type.focal_aware',
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
    recordedBy: 'carer' as const,
    eegSessionId: null,
    ...extra,
  };
}
export { T0 };
