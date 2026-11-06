// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { ids } from '@auratrack/model/fixtures';
import {
  buildUpdate,
  inviteListenerId,
  inviteQrText,
  loadHousehold,
  parseInvite,
  runInviter,
  startHousehold,
  type HouseholdState,
} from '@auratrack/sync';
import { firstDevice, join, newDevice, type Device } from '@auratrack/sync/testing';
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HouseholdService } from '../household/service';
import { memoryBroker } from '../household/testTransport';
import { householdEnv } from '../household/transport';
import { PIN, makeSeizure, seed, setup, tick, type Ctx } from './testSupport';

// The household screens on the real app and real stores: starting one, adding a device by code, the up-to-date screen,
// removing a device, joining from set-up, and the update by file. Devices are other real stores; the broker is in memory.

configure({ asyncUtilTimeout: 8000 });
let broker = memoryBroker();
const original = householdEnv.transport;
beforeEach(() => {
  broker = memoryBroker();
  householdEnv.transport = () => broker;
});
afterEach(() => {
  cleanup();
  householdEnv.transport = original;
});

const openHousehold = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('button', { name: 'Household' }));
};

/** The app's own store as a household's first device. */
async function appAsFirst(ctx: Ctx) {
  const { patientId } = await seed(ctx);
  const info = (await ctx.api.status()).info;
  if (!info) throw new Error('no store');
  await startHousehold(ctx.api, info, {
    name: 'Home',
    deviceName: 'Kitchen tablet',
    patientIds: [patientId],
    now: Date.now(),
  });
  const device: Device = { api: ctx.api, who: info };
  return { patientId, device };
}

const serviceFor = (d: Device) => {
  const service = new HouseholdService({
    api: d.api,
    who: d.who,
    transport: broker,
    now: Date.now,
    isBusy: () => false,
  });
  return service;
};

describe('the household screen', () => {
  it('explains what a household is, and starts one with a name for it and for this device', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    expect(await screen.findByText(/A household lets the other devices/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start a household' }));
    const sheet = await screen.findByRole('dialog', { name: 'Start a household' });
    await user.type(within(sheet).getByLabelText('Name of the household'), 'Home');
    await user.type(within(sheet).getByLabelText('Name of this device'), 'Kitchen tablet');
    await user.click(within(sheet).getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Kitchen tablet · This device')).toBeTruthy();
    expect(await screen.findByText(/Reachable by the household/)).toBeTruthy();
    const state = await loadHousehold(ctx.api);
    expect(Object.keys(state?.membership.patients ?? {})).toHaveLength(1);
  });

  it('lists the other devices, renames this one and changes who it keeps', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    await join(device, 'Mum’s phone', undefined, ctx.f.env.now);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    expect(await screen.findByText('Mum’s phone')).toBeTruthy();
    expect(screen.getAllByText('Not met yet').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const sheet = await screen.findByRole('dialog', { name: 'Rename' });
    const field = within(sheet).getByLabelText('Name of this device');
    await user.clear(field);
    await user.type(field, 'Hall tablet');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Hall tablet · This device')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'People this device keeps' }));
    const follow = await screen.findByRole('dialog', { name: 'People this device keeps' });
    await user.click(within(follow).getByRole('button', { name: 'Only the people I choose' }));
    await user.click(within(follow).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/Keeps a copy of: /)).toBeTruthy());
  });

  it('removes a device after saying what that means, and it is gone from the list', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    const other = await join(device, 'Old phone', undefined, ctx.f.env.now);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Remove the device' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/What it already holds stays on that device/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Remove the device' }));
    await waitFor(() => expect(screen.queryByText('Old phone')).toBeNull());
    const state = (await loadHousehold(ctx.api)) as HouseholdState;
    expect(state.membership.devices[other.who.deviceId]?.removedAt).not.toBeNull();
    expect(state.keyring.revoked.length).toBeGreaterThan(0);
  });

  it('leaves the household, keeping the records', async () => {
    const ctx = setup();
    const { patientId } = await appAsFirst(ctx);
    await ctx.api.createRecord({ type: 'seizure', values: makeSeizure(patientId, 5, 40) });
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Leave the household' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Leave the household' }));
    expect(await screen.findByRole('button', { name: 'Start a household' })).toBeTruthy();
    expect(ctx.api.list({ type: 'seizure' })).toHaveLength(1);
  });
});

describe('adding a device', () => {
  it('shows a code, and when the other phone confirms the same six digits, the device is in the household', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Add a device' }));
    await user.click(await screen.findByRole('button', { name: 'Add a device' }));
    const code = (await screen.findByLabelText('Code')).textContent ?? '';
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(await screen.findByRole('img', { name: 'QR code to join the household' })).toBeTruthy();
    expect(inviteQrText({ code, secret: new Uint8Array(), expiresAt: 0 })).toContain(code);

    // The other phone: a real joiner, through the in-memory broker
    const joiner = await newDevice();
    const secret = parseInvite(code);
    expect(secret).not.toBeNull();
    const { runJoiner } = await import('@auratrack/sync');
    const channel = await broker.connect(await inviteListenerId(secret as Uint8Array), 1000);
    const joined = runJoiner(channel, {
      secret: secret as Uint8Array,
      deviceId: joiner.who.deviceId,
      deviceName: 'Dad’s phone',
      now: Date.now,
      confirm: async () => true,
      timeoutMs: 5000,
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/“Dad’s phone” wants to join/)).toBeTruthy();
    expect(within(dialog).getByText(/\d{3} \d{3}/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'The same' }));
    expect((await joined).outcome).toBe('joined');
    expect(await screen.findByText(/“Dad’s phone” has joined/)).toBeTruthy();
    const state = (await loadHousehold(device.api)) as HouseholdState;
    expect(Object.values(state.membership.devices).map((d) => d.name)).toContain('Dad’s phone');
  });

  it('adds nothing when the digits are said to differ', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Add a device' }));
    await user.click(await screen.findByRole('button', { name: 'Add a device' }));
    const code = (await screen.findByLabelText('Code')).textContent ?? '';
    const joiner = await newDevice();
    const secret = parseInvite(code) as Uint8Array;
    const { runJoiner } = await import('@auratrack/sync');
    const channel = await broker.connect(await inviteListenerId(secret), 1000);
    const joined = runJoiner(channel, {
      secret,
      deviceId: joiner.who.deviceId,
      deviceName: 'Stranger',
      now: Date.now,
      confirm: async () => true,
      timeoutMs: 5000,
    });
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'They differ' }));
    expect((await joined).outcome).not.toBe('joined');
    expect(await screen.findByText(/it was not added/i)).toBeTruthy();
    const state = (await loadHousehold(device.api)) as HouseholdState;
    expect(Object.values(state.membership.devices).map((d) => d.name)).not.toContain('Stranger');
  });
});

describe('Household up to date?', () => {
  it('shows a device that was never met, then the meeting once the other device is open', async () => {
    const ctx = setup();
    const { device, patientId } = await appAsFirst(ctx);
    await ctx.api.createRecord({ type: 'seizure', values: makeSeizure(patientId, 5, 40) });
    const other = await join(device, 'Mum’s phone', undefined, ctx.f.env.now);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Household up to date?' }));
    expect(await screen.findByText('Not received yet from Mum’s phone')).toBeTruthy();
    const service = serviceFor(other);
    await service.start();
    await user.click(screen.getByRole('button', { name: 'Look for devices now' }));
    await waitFor(() => expect(other.api.list({ type: 'seizure' })).toHaveLength(1), { timeout: 5000 });
    expect((await screen.findAllByText(/Last met/)).length).toBeGreaterThan(0);
    service.stop();
  });

  it('says what the limit is, in plain words', async () => {
    const ctx = setup();
    await appAsFirst(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    expect(await screen.findByText(/A device whose app is closed cannot be updated or alerted/)).toBeTruthy();
  });
});

describe('what arrives from another device', () => {
  it('brings a quiet note on Home with the number of changes', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    const other = await join(device, 'Mum’s phone', undefined, ctx.f.env.now);
    const service = serviceFor(other);
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await service.start();
    // the other phone first gets the person, then makes a seizure of its own, then looks again
    await waitFor(() => expect(other.api.list({ type: 'patient' })).toHaveLength(1), { timeout: 8000 });
    const patient = (other.api.list({ type: 'patient' }) as { id: string }[])[0];
    await other.api.createRecord({ type: 'seizure', values: makeSeizure(patient?.id ?? '', 3, 30) });
    service.searchNow();
    expect(await screen.findByText(/Changes from Mum’s phone: \d+/, undefined, { timeout: 8000 })).toBeTruthy();
    const user = userEvent.setup();
    const card = (await screen.findByText(/Changes from Mum’s phone/)).parentElement as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText(/Changes from Mum’s phone/)).toBeNull());
    service.stop();
  });

  it('a removed device is told, and keeps what it had', async () => {
    const ctx = setup();
    const { device } = await appAsFirst(ctx);
    const other = await join(device, 'Old phone', undefined, ctx.f.env.now);
    const state = (await loadHousehold(device.api)) as HouseholdState;
    const { removeDevice } = await import('@auratrack/sync');
    await device.api.saveHouseholdState({ state: removeDevice(state, other.who.deviceId, Date.now()) });
    const service = serviceFor(device);
    await service.start();
    const removed = serviceFor(other);
    await removed.start();
    await waitFor(() => expect(removed.snapshot().removed).toBe(true), { timeout: 5000 });
    expect(other.api.list({ type: 'patient' })).toHaveLength(0);
    service.stop();
    removed.stop();
  });
});

describe('joining from set-up', () => {
  it('a new phone joins with the code, then waits for the first meeting and gets the person', async () => {
    const ctx = setup();
    const first = await firstDevice(ids.patient, ctx.f.env.now);
    await first.api.createRecord({ type: 'seizure', values: makeSeizure(ids.patient, 4, 35) });
    // The first device is open and showing a code
    const state = (await loadHousehold(first.api)) as HouseholdState;
    const code = 'ABCD-EFGH-JKLM-NPQR';
    const secret = parseInvite(code) as Uint8Array;
    const listener = await broker.listen(await inviteListenerId(secret), (channel) => {
      void runInviter(channel, {
        secret,
        expiresAt: Date.now() + 60_000,
        state,
        inviterId: first.who.deviceId,
        now: Date.now,
        confirm: async () => true,
        save: (s) => first.api.saveHouseholdState({ state: s }),
        timeoutMs: 10_000,
      });
    });
    const inviterService = serviceFor(first);
    await inviterService.start();

    const user = userEvent.setup();
    ctx.mount();
    await screen.findByLabelText('PIN (at least 4 digits)');
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), PIN);
    await user.type(screen.getByLabelText('PIN again'), PIN);
    await user.click(screen.getByRole('button', { name: 'Join a household instead' }));
    await user.type(await screen.findByLabelText('Code from the other device'), code);
    await user.type(screen.getByLabelText('Name of this device'), 'New phone');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'The same' }));
    // Home opens; the person arrives with the first meeting
    expect(await screen.findByRole('button', { name: 'Start timer' }, { timeout: 8000 })).toBeTruthy();
    await waitFor(() => expect(ctx.api.list({ type: 'seizure' })).toHaveLength(1), { timeout: 15_000 });
    expect(await screen.findByText('Alex', undefined, { timeout: 5000 })).toBeTruthy();
    // The language the set-up screens were in is kept as this phone's setting, now that the store has a household
    const saved = (await ctx.api.list({ type: 'setting' })) as unknown as { key: string; value: unknown }[];
    expect(saved.find((r) => r.key === 'language')?.value).toBe('en');
    listener.close();
    inviterService.stop();
  }, 40_000);

  it('a wrong code is said plainly and nothing is made', async () => {
    const ctx = setup();
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByLabelText('PIN (at least 4 digits)');
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), PIN);
    await user.type(screen.getByLabelText('PIN again'), PIN);
    await user.click(screen.getByRole('button', { name: 'Join a household instead' }));
    await user.type(await screen.findByLabelText('Code from the other device'), 'not a code');
    expect(await screen.findByText('That is not a code. It is 16 letters and digits.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('says it was not found when no device answers to the code', async () => {
    const ctx = setup();
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByLabelText('PIN (at least 4 digits)');
    await user.type(screen.getByLabelText('PIN (at least 4 digits)'), PIN);
    await user.type(screen.getByLabelText('PIN again'), PIN);
    await user.click(screen.getByRole('button', { name: 'Join a household instead' }));
    await user.type(await screen.findByLabelText('Code from the other device'), 'ABCD-EFGH-JKLM-NPQR');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText(/The device was not found/)).toBeTruthy();
  });
});

describe('the update by file', () => {
  it('opens an update made on another device and adds what it holds, once', async () => {
    const ctx = setup();
    const { device, patientId } = await appAsFirst(ctx);
    const other = await join(device, 'Mum’s phone', undefined, ctx.f.env.now);
    // the other device meets this one once so it has the person and the key, then adds a seizure of its own
    const sa = serviceFor(device);
    const sb = serviceFor(other);
    await sa.start();
    await sb.start();
    await waitFor(() => expect(other.api.list({ type: 'patient' })).toHaveLength(1), { timeout: 8000 });
    sa.stop();
    sb.stop();
    await other.api.createRecord({ type: 'seizure', values: makeSeizure(patientId, 9, 50) });
    const otherState = (await loadHousehold(other.api)) as HouseholdState;
    const scopes = [];
    for (const scope of ['household', patientId]) {
      const index = await other.api.syncIndex({ scope });
      scopes.push({ scope, entries: await other.api.syncEntries({ ids: index.map((e) => e.id) }) });
    }
    const text = await buildUpdate(otherState, other.who.deviceId, scopes, Date.now());

    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Update by file or QR' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const inputs = [...document.querySelectorAll('input[type="file"]')] as HTMLInputElement[];
    const target = inputs[inputs.length - 1] ?? input;
    await user.upload(target, new File([text], 'update.auraupdate', { type: 'text/plain' }));
    expect(await screen.findByText(/The update holds \d+ changes for 1 people/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add to this device' }));
    expect(await screen.findByText(/Took in \d+ changes/)).toBeTruthy();
    expect(ctx.api.list({ type: 'seizure' })).toHaveLength(1);
  });

  it('refuses a file that is not an update, and one from another household', async () => {
    const ctx = setup();
    await appAsFirst(ctx);
    const strangerFirst = await firstDevice(ids.patient, ctx.f.env.now);
    const strangerState = (await loadHousehold(strangerFirst.api)) as HouseholdState;
    const foreign = await buildUpdate(strangerState, strangerFirst.who.deviceId, [], Date.now());
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Update by file or QR' }));
    const inputs = [...document.querySelectorAll('input[type="file"]')] as HTMLInputElement[];
    const target = inputs[inputs.length - 1] as HTMLInputElement;
    await user.upload(target, new File(['hello'], 'x.txt', { type: 'text/plain' }));
    expect(await screen.findByText('That is not an update file.')).toBeTruthy();
    await user.upload(target, new File([foreign], 'x.auraupdate', { type: 'text/plain' }));
    expect(await screen.findByText('This update is from another household.')).toBeTruthy();
  });
});

describe('connecting a hub', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function openConnect(ctx: Ctx) {
    await appAsFirst(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    await user.click(await screen.findByRole('button', { name: 'Connect a hub' }));
    const sheet = await screen.findByRole('dialog', { name: 'Connect a hub' });
    return { user, sheet };
  }

  it('says plainly when the code is wrong, when nothing answers, and when the address is not https', async () => {
    const ctx = setup();
    const { user, sheet } = await openConnect(ctx);
    const address = within(sheet).getByLabelText('Hub address');
    await user.clear(address);
    await user.type(address, 'https://hub.example');
    await user.type(within(sheet).getByLabelText('Code from the hub'), 'ABCDE12345');

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'wrong_admin_code' }), { status: 403 })) as typeof fetch;
    await user.click(within(sheet).getByRole('button', { name: 'Connect' }));
    expect(await within(sheet).findByText(/That code is not the hub’s/)).toBeTruthy();

    globalThis.fetch = (async () => {
      throw new TypeError('network');
    }) as typeof fetch;
    await user.click(within(sheet).getByRole('button', { name: 'Connect' }));
    expect(await within(sheet).findByText(/Nothing answered at that address/)).toBeTruthy();

    await user.clear(address);
    await user.type(address, 'http://192.168.1.20:8420');
    expect(await within(sheet).findByText(/must start with https:\/\//)).toBeTruthy();
    expect((within(sheet).getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the hub as connected once it accepts, and switching it off asks first and keeps the household', async () => {
    const ctx = setup();
    const { user, sheet } = await openConnect(ctx);
    const address = within(sheet).getByLabelText('Hub address');
    await user.clear(address);
    await user.type(address, 'https://hub.example');
    await user.type(within(sheet).getByLabelText('Code from the hub'), 'ABCDE12345');
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/setup')) return new Response(JSON.stringify({ token: 'tok' }), { status: 200 });
      return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
    }) as typeof fetch;
    await user.click(within(sheet).getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Connected to https://hub.example')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Switch the hub off' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/updating each other when two of them are open/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Switch off' }));
    expect(await screen.findByRole('button', { name: 'Connect a hub' })).toBeTruthy();
    const state = (await loadHousehold(ctx.api)) as HouseholdState;
    expect(Object.keys(state.membership.devices)).toHaveLength(1);
  });
});

describe('alerts to the household', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** An app in a household whose hub (answered by a fake) is connected; returns what was sent to /v1/alert. */
  async function withHub(ctx: Ctx) {
    const { device } = await appAsFirst(ctx);
    const alerts: { event: string; patientId: string; auth: string | null }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/setup')) return new Response(JSON.stringify({ token: 'tok' }), { status: 200 });
      if (url.endsWith('/v1/alert')) {
        const headers = init?.headers as Record<string, string>;
        alerts.push({
          ...(JSON.parse(String(init?.body)) as { event: string; patientId: string }),
          auth: headers.authorization ?? null,
        });
        return new Response(JSON.stringify({ sent: 1, failed: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
    }) as typeof fetch;
    const { connectHub, hubLocalOf } = await import('@auratrack/sync');
    expect(
      await connectHub(
        { api: device.api, who: device.who, local: hubLocalOf(device.api), now: Date.now },
        { url: 'https://hub.example', adminCode: 'X' },
      ),
    ).toBe('ok');
    return { alerts, device };
  }

  it('tells the hub when a recording starts, when it passes the alert time, and when it ends, each once', async () => {
    const ctx = setup();
    const { alerts } = await withHub(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await waitFor(() => expect(alerts.map((a) => a.event)).toEqual(['started']));
    await tick(ctx, 5 * 60_000 + 1000);
    await waitFor(() => expect(alerts.map((a) => a.event)).toEqual(['started', 'alert']));
    await tick(ctx, 30_000);
    expect(alerts.map((a) => a.event)).toEqual(['started', 'alert']); // not again
    await user.click(await screen.findByRole('button', { name: 'Dismiss' })); // the red alert
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await user.click(screen.getByRole('button', { name: 'Back to usual self' }));
    await waitFor(() => expect(alerts.map((a) => a.event)).toEqual(['started', 'alert', 'recorded']));
    expect(new Set(alerts.map((a) => a.auth))).toEqual(new Set(['Bearer tok']));
    expect(alerts[0]?.patientId).toBeTruthy();
  });

  it('a recording is not held up by a hub that does not answer', async () => {
    const ctx = setup();
    await withHub(ctx);
    globalThis.fetch = (async () => {
      throw new TypeError('network down');
    }) as typeof fetch;
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    expect(await screen.findByRole('timer')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await user.click(screen.getByRole('button', { name: 'Back to usual self' }));
    await waitFor(() => expect(ctx.api.list({ type: 'seizure' })).toHaveLength(1));
    await waitFor(() =>
      expect((ctx.api.list({ type: 'seizure' }) as { status: string }[])[0]?.status).not.toBe('in_progress'),
    );
  });

  it('says in plain words what alerts need, and that this browser cannot show them when it cannot', async () => {
    const ctx = setup();
    await withHub(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await openHousehold(user);
    expect(await screen.findByText('Alerts on this device')).toBeTruthy();
    expect(screen.getByText(/The notification says only “AuraTrack”/)).toBeTruthy();
    expect(
      screen.getByText(/iPhone and iPad: alerts work only after AuraTrack is added to the Home Screen/),
    ).toBeTruthy();
    expect(screen.getByText(/They never replace watching the person/)).toBeTruthy();
    expect(screen.getByText('This browser cannot show alerts.')).toBeTruthy();
  });
});
