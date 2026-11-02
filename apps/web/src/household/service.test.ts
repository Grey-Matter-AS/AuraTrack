import 'fake-indexeddb/auto';
import { ids, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import { removeDevice, loadHousehold } from '@auratrack/sync';
import { firstDevice, join, type Device } from '@auratrack/sync/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HouseholdService, LINGER_MS, type MeetingNote } from './service';
import { memoryBroker } from './testTransport';

const services: HouseholdService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.stop();
});

function serviceFor(
  d: Device,
  broker: ReturnType<typeof memoryBroker>,
  extra: { busy?: () => boolean; onApplied?: (n: MeetingNote) => void } = {},
) {
  const service = new HouseholdService({
    api: d.api,
    who: d.who,
    transport: broker,
    now: Date.now,
    isBusy: extra.busy ?? (() => false),
    ...(extra.onApplied ? { onApplied: extra.onApplied } : {}),
  });
  services.push(service);
  return service;
}

const settle = (check: () => boolean, ms = 4000) =>
  vi.waitFor(() => expect(check()).toBe(true), { timeout: ms, interval: 20 });
const seizures = (d: Device) => d.api.list({ type: 'seizure' }) as unknown[];
const make = (d: Device) =>
  d.api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: ids.patient })) });

describe('the household service', () => {
  it('stays reachable and finds the other device by itself when the app opens, then brings a note', async () => {
    const broker = memoryBroker();
    const a = await firstDevice(ids.patient);
    await make(a);
    const b = await join(a, 'B');
    const notes: MeetingNote[] = [];
    const sa = serviceFor(a, broker);
    const sb = serviceFor(b, broker, { onApplied: (n) => notes.push(n) });
    await sa.start();
    await sb.start();
    await settle(() => seizures(b).length === 1);
    expect(notes[0]?.applied).toBeGreaterThan(0);
    expect(notes[0]?.peerName).toBeTruthy();
    expect(sb.snapshot().last?.outcome).toBe('done');
    expect(broker.listening().length).toBeGreaterThanOrEqual(1);
    expect(sa.snapshot().listening).toBe(true);
  });

  it('after something is saved, looking again passes it on', async () => {
    const broker = memoryBroker();
    const a = await firstDevice(ids.patient);
    const b = await join(a, 'B');
    const sa = serviceFor(a, broker);
    const sb = serviceFor(b, broker);
    await sa.start();
    await sb.start();
    await settle(() => sb.snapshot().last !== null);
    await make(a);
    sa.extend();
    sa.searchNow();
    await settle(() => seizures(b).length === 1);
    expect(LINGER_MS).toBe(5 * 60_000);
  });

  it('turns a device away while a recording runs, and does nothing itself', async () => {
    const broker = memoryBroker();
    const a = await firstDevice(ids.patient);
    await make(a);
    const b = await join(a, 'B');
    let recording = true;
    const sa = serviceFor(a, broker, { busy: () => recording });
    const sb = serviceFor(b, broker);
    await sa.start();
    await sb.start();
    await new Promise((r) => setTimeout(r, 300));
    expect(seizures(b)).toHaveLength(0);
    recording = false;
    sb.searchNow();
    await settle(() => seizures(b).length === 1);
  });

  it('carries on without the broker: nothing breaks, it just is not reachable', async () => {
    const broker = memoryBroker();
    broker.down = true;
    const a = await firstDevice(ids.patient);
    const sa = serviceFor(a, broker);
    await sa.start();
    await new Promise((r) => setTimeout(r, 100));
    expect(sa.snapshot().listening).toBe(false);
    expect(sa.snapshot().status === 'idle' || sa.snapshot().status === 'looking').toBe(true);
    await make(a); // recording and saving are unaffected
    expect(seizures(a)).toHaveLength(1);
  });

  it('a removed device learns it and stops', async () => {
    const broker = memoryBroker();
    const a = await firstDevice(ids.patient);
    const b = await join(a, 'B');
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice(state, b.who.deviceId, Date.now()) });
    const sa = serviceFor(a, broker);
    const sb = serviceFor(b, broker);
    await sa.start();
    await sb.start();
    await settle(() => sb.snapshot().removed);
    expect(sb.snapshot().status).toBe('off');
    expect(seizures(b)).toHaveLength(0);
  });

  it('does nothing for a device that is not in a household', async () => {
    const broker = memoryBroker();
    const a = await firstDevice(ids.patient);
    const lone = await (await import('@auratrack/sync/testing')).newDevice();
    const s = serviceFor(lone, broker);
    await s.start();
    expect(s.snapshot().status).toBe('off');
    expect(broker.listening()).toHaveLength(0);
    void a;
  });
});
