import 'fake-indexeddb/auto';
import { newId, type RecordingEvent } from '@auratrack/model';
import { describe, expect, it, vi } from 'vitest';
import { createStoreApi } from './api';
import { TEST_PIN_KDF } from './crypto';
import { RecordingService } from './recording';
import { Store, StoreError } from './store';

const PIN = '2468';
const T0 = 1_760_000_000_000;
const S = 1000;
let counter = 0;
const dbName = () => `recording-${Date.now()}-${counter++}`;
const FAST = { pinKdf: TEST_PIN_KDF };

const startEvent = (patientId: string, seizureId: string, at = T0): RecordingEvent => ({
  kind: 'start',
  id: newId(),
  at,
  seizureId,
  patientId,
  recordedBy: 'self',
  timeZone: 'Europe/Oslo',
});
const tap = (kind: 'end_aura' | 'end_seizure' | 'back_to_normal' | 'finish', at: number): RecordingEvent => ({
  kind,
  id: newId(),
  at,
});

async function setup(now = () => T0 + 60 * S) {
  const name = dbName();
  const store = await Store.create(name, { pin: PIN }, { ...FAST, now });
  const patientId = newId();
  await store.create('patient', {
    id: patientId,
    patientId,
    name: 'Alex',
    dateOfBirth: null,
    emergencyContact: '',
    color: '#000',
  });
  return { name, store, patientId, service: new RecordingService(store, now), now };
}

describe('saving a recording as it happens', () => {
  it('writes the seizure at Start, in progress, before anything else is tapped', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    const session = await service.apply(id, startEvent(patientId, id));
    expect(session.status).toBe('running');
    expect(store.get('seizure', id)).toMatchObject({
      status: 'in_progress',
      patientId,
      recordedBy: 'self',
      phases: { start: { at: T0 }, auraEnd: null, seizureEnd: null, recoveryEnd: null },
    });
  });

  it('writes each tap as a small change of its own', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    await service.apply(id, tap('end_aura', T0 + 5 * S));
    await service.apply(id, { kind: 'quick_note', id: newId(), at: T0 + 6 * S, label: 'Calm' });
    const log = (await store.changesSince()).filter((e) => e.recordId === id);
    expect(log.map((e) => e.kind)).toEqual(['create', 'update', 'update']);
    expect(Object.keys(log[1]?.fields ?? {})).toEqual(['phases']);
    expect(Object.keys(log[2]?.fields ?? {})).toEqual(['quickNotes']);
  });

  it('ends with the seizure recorded, when the person is back to normal', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    await service.apply(id, tap('end_seizure', T0 + 40 * S));
    const done = await service.apply(id, tap('back_to_normal', T0 + 100 * S));
    expect(done.status).toBe('finished');
    expect(store.get('seizure', id)).toMatchObject({
      status: 'recorded',
      phases: { recoveryEnd: { at: T0 + 100 * S } },
    });
  });

  it('does nothing for a repeated Start or a repeated tap', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    const start = startEvent(patientId, id);
    await service.apply(id, start);
    await service.apply(id, start);
    const end = tap('end_aura', T0 + 5 * S);
    await service.apply(id, end);
    await service.apply(id, end);
    expect(store.list('seizure')).toHaveLength(1);
    expect((await store.changesSince()).filter((e) => e.recordId === id)).toHaveLength(2);
  });

  it('refuses a Start for a recording that is already finished, and events with no recording', async () => {
    const { patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    await service.apply(id, tap('finish', T0 + 5 * S));
    const fresh = new RecordingService((service as unknown as { store: Store }).store);
    await expect(fresh.apply(id, startEvent(patientId, id))).rejects.toThrow('already finished');
    await expect(service.apply(newId(), tap('end_aura', T0))).rejects.toBeInstanceOf(StoreError);
  });

  it('refuses anything that is not a recording event, or is for another recording', async () => {
    const { patientId, service } = await setup();
    await expect(service.apply(newId(), { kind: 'delete_everything' })).rejects.toThrow('Not a recording event');
    await expect(service.apply(newId(), startEvent(patientId, newId()))).rejects.toThrow('different recording');
  });

  it('keeps the recording as it was when a save fails, and takes the same tap again', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    const end = tap('end_aura', T0 + 5 * S);
    const update = vi.spyOn(store, 'update').mockRejectedValueOnce(new Error('disk full'));
    await expect(service.apply(id, end)).rejects.toThrow('disk full');
    expect(store.get('seizure', id)?.phases.auraEnd).toBeNull();
    update.mockRestore();
    const session = await service.apply(id, end);
    expect(session.auraEnd).toBe(T0 + 5 * S);
    expect(store.get('seizure', id)?.phases.auraEnd?.at).toBe(T0 + 5 * S);
  });

  it('applies taps in the order they arrive, even when sent together', async () => {
    const { store, patientId, service } = await setup();
    const id = newId();
    await Promise.all([
      service.apply(id, startEvent(patientId, id)),
      service.apply(id, tap('end_aura', T0 + 5 * S)),
      service.apply(id, tap('end_seizure', T0 + 20 * S)),
    ]);
    expect(store.get('seizure', id)?.phases).toMatchObject({
      auraEnd: { at: T0 + 5 * S },
      seizureEnd: { at: T0 + 20 * S },
    });
  });
});

describe('finding a recording again (F-212)', () => {
  it('returns a recording that is still within 12 minutes, after a restart', async () => {
    const { name, store, patientId, service, now } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    await service.apply(id, tap('end_aura', T0 + 5 * S));
    store.close();
    const again = await Store.unlock(name, { pin: PIN }, { ...FAST, now });
    const found = await new RecordingService(again, now).recover();
    expect(found.autoStopped).toEqual([]);
    expect(found.running).toHaveLength(1);
    expect(found.running[0]).toMatchObject({ seizureId: id, start: T0, auraEnd: T0 + 5 * S, status: 'running' });
  });

  it('lets the recovered recording carry on', async () => {
    const { name, store, patientId, service, now } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    store.close();
    const again = await Store.unlock(name, { pin: PIN }, { ...FAST, now });
    const second = new RecordingService(again, now);
    await second.recover();
    await second.apply(id, tap('end_seizure', T0 + 30 * S));
    expect(again.get('seizure', id)?.phases.seizureEnd?.at).toBe(T0 + 30 * S);
  });

  it('stops one past 12 minutes with the seizure end unknown, and says so', async () => {
    const { name, store, patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    store.close();
    const later = () => T0 + 3600 * S;
    const again = await Store.unlock(name, { pin: PIN }, { ...FAST, now: later });
    const found = await new RecordingService(again, later).recover();
    expect(found.running).toEqual([]);
    expect(found.autoStopped).toHaveLength(1);
    expect(again.get('seizure', id)).toMatchObject({
      status: 'recorded',
      isEmergencyStop: true,
      phases: { seizureEnd: null, recoveryEnd: null },
    });
  });

  it('skips seizures that are not recordings in progress', async () => {
    const { patientId, service } = await setup();
    const id = newId();
    await service.apply(id, startEvent(patientId, id));
    await service.apply(id, tap('finish', T0 + 5 * S));
    expect(await service.recover()).toEqual({ running: [], autoStopped: [] });
  });
});

describe('through the store interface', () => {
  const run = async () => {
    const name = dbName();
    const { api } = createStoreApi({ name, options: { ...FAST, now: () => T0 + 60 * S } });
    await api.create({ credential: { pin: PIN } });
    const patientId = newId();
    await api.createRecord({
      type: 'patient',
      values: {
        id: patientId,
        patientId,
        name: 'Alex Example',
        dateOfBirth: null,
        emergencyContact: 'Sam 555 0100',
        color: '#000',
      },
    });
    return { api, patientId };
  };

  it('has nothing to show before a store exists, without creating one', async () => {
    const { api } = createStoreApi({ name: dbName() });
    expect(await api.lockedStatus()).toEqual({
      available: false,
      screen: { start: false, patientId: null, patientName: null, card: null, plan: expect.any(Object), video: null },
      session: null,
      waiting: 0,
      recentStarts: [],
    });
    expect(await api.status()).toMatchObject({ exists: false });
  });

  it('follows the patient and the settings with the PIN screen, as they change', async () => {
    const { api, patientId } = await run();
    expect((await api.lockedStatus()).screen).toMatchObject({
      start: true,
      patientId,
      card: { contact: 'Sam 555 0100' },
    });
    const made = await api.createRecord({
      type: 'setting',
      values: { patientId, scope: 'device', key: 'lockedAlertContent', value: 'nothing' },
    });
    expect((await api.lockedStatus()).screen.card).toBeNull();
    await api.update({ type: 'setting', id: made.id as string, patch: { value: 'rescue' } });
    expect((await api.lockedStatus()).screen.card).toEqual({ contact: null, rescue: [] });
    await api.remove({ type: 'setting', id: made.id as string });
    expect((await api.lockedStatus()).screen.card).toMatchObject({ contact: 'Sam 555 0100' });
  });

  it('records while locked and merges at unlock', async () => {
    const { api, patientId } = await run();
    api.lock();
    const seizureId = newId();
    expect((await api.lockedStatus()).available).toBe(true);
    await api.lockedPost({ event: startEvent(patientId, seizureId) });
    await api.lockedPost({ event: tap('end_seizure', T0 + 20 * S) });
    expect((await api.lockedStatus()).waiting).toBe(2);
    expect(() => api.counts()).toThrow('locked');
    await api.unlock({ credential: { pin: PIN } });
    expect(api.dropBoxReport()).toEqual({ recordings: 1, events: 2, quarantined: 0, failed: 0 });
    expect(api.get({ type: 'seizure', id: seizureId })).toMatchObject({
      recordedWhileLocked: true,
      status: 'in_progress',
    });
    expect((await api.lockedStatus()).waiting).toBe(0);
    const found = await api.recordingRecover();
    expect(found.running.map((s) => s.seizureId)).toEqual([seizureId]);
    const done = await api.recordingEvent({ seizureId, event: tap('back_to_normal', T0 + 50 * S) });
    expect(done.status).toBe('finished');
  });

  it('records while unlocked', async () => {
    const { api, patientId } = await run();
    const id = newId();
    await api.recordingEvent({ seizureId: id, event: startEvent(patientId, id) });
    expect(api.get({ type: 'seizure', id })).toMatchObject({ status: 'in_progress' });
    expect(await api.refreshLockedScreen({})).toMatchObject({ patientId });
    expect(await api.refreshLockedScreen({ patientId })).toMatchObject({ patientId });
  });

  it('refuses recording and recovery while locked', async () => {
    const { api, patientId } = await run();
    api.lock();
    await expect(api.recordingRecover()).rejects.toThrow('locked');
    await expect(api.recordingEvent({ seizureId: newId(), event: startEvent(patientId, newId()) })).rejects.toThrow(
      'locked',
    );
  });
});
