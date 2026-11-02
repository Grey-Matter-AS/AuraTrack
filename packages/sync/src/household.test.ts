import 'fake-indexeddb/auto';
import { ids, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { removeDevice, effectiveFollows } from './membership';
import { firstDevice as first, join, meet, type Device } from './testDevices';
import { loadHousehold, registerPatient } from './storeContext';

const firstDevice = (patientId: string = ids.patient) => first(patientId);

// Real stores (encrypted, in memory), meeting through the real protocol. Made-up data only.

const seizures = (d: Device) => d.api.list({ type: 'seizure' }) as { id: string; notes?: string }[];
const make = (d: Device, patch: Record<string, unknown> = {}) =>
  d.api.createRecord({
    type: 'seizure',
    values: { ...stripBase(seizureFixture({ patientId: ids.patient })), ...patch },
  });

describe('a household of real stores', () => {
  it('a new device gets the person and every seizure after it joins and they meet', async () => {
    const a = await firstDevice();
    await make(a);
    await make(a);
    const b = await join(a, 'Mum’s phone');
    expect(b.who.householdId).toBe(a.who.householdId);
    const [ra, rb] = await meet(a, b);
    expect([ra.outcome, rb.outcome]).toEqual(['done', 'done']);
    expect(seizures(b)).toHaveLength(2);
    expect((b.api.list({ type: 'patient' }) as { name: string }[])[0]?.name).toBe('Alex');
  });

  it('three devices: edits to different fields on different devices both survive, in any meeting order', async () => {
    const a = await firstDevice();
    const created = (await make(a, { notes: 'first' })) as { id: string };
    const b = await join(a, 'B');
    const c = await join(a, 'C');
    await meet(a, b);
    await meet(a, c);
    await a.api.update({ type: 'seizure', id: created.id, patch: { notes: 'from A' } });
    await b.api.update({ type: 'seizure', id: created.id, patch: { cancelled: true } });
    await meet(b, c);
    await meet(c, a);
    await meet(a, b);
    for (const d of [a, b, c]) {
      const s = d.api.get({ type: 'seizure', id: created.id }) as { notes?: string; cancelled?: boolean };
      expect(s.notes).toBe('from A');
      expect(s.cancelled).toBe(true);
    }
  });

  it('a deletion on one device reaches the others and is not undone by an older edit', async () => {
    const a = await firstDevice();
    const s = (await make(a)) as { id: string };
    const b = await join(a, 'B');
    await meet(a, b);
    await b.api.update({ type: 'seizure', id: s.id, patch: { notes: 'edited offline' } });
    await a.api.remove({ type: 'seizure', id: s.id });
    await meet(a, b);
    expect(seizures(a)).toHaveLength(0);
    expect(seizures(b)).toHaveLength(0);
  });

  it('a device’s own settings (theme, lock) stay on that device; a patient’s settings travel', async () => {
    const a = await firstDevice();
    const b = await join(a, 'B');
    await a.api.createRecord({
      type: 'setting',
      values: { patientId: ids.patient, scope: 'device', key: 'theme', value: 'light' },
    });
    await a.api.createRecord({
      type: 'setting',
      values: { patientId: ids.patient, scope: 'patient', key: 'recordedBy', value: 'self' },
    });
    await meet(a, b);
    const keys = (b.api.list({ type: 'setting' }) as { key: string }[]).map((r) => r.key);
    expect(keys).toEqual(['recordedBy']);
  });

  it('a second person added on one device reaches a device that follows everyone, key and all', async () => {
    const a = await firstDevice();
    const b = await join(a, 'B');
    await meet(a, b);
    const second = crypto.randomUUID();
    await a.api.createRecord({
      type: 'patient',
      values: { id: second, patientId: second, name: 'Sam', dateOfBirth: null, emergencyContact: '', color: '#aa3366' },
    });
    await registerPatient(a.api, second, Date.now());
    await a.api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: second })) });
    await meet(a, b);
    expect((b.api.list({ type: 'patient' }) as unknown[]).length).toBe(2);
    expect((b.api.list({ type: 'seizure', patientId: second }) as unknown[]).length).toBe(1);
  });

  it('a device that follows only one person never receives the other', async () => {
    const a = await firstDevice();
    const second = crypto.randomUUID();
    await a.api.createRecord({
      type: 'patient',
      values: { id: second, patientId: second, name: 'Sam', dateOfBirth: null, emergencyContact: '', color: '#aa3366' },
    });
    await registerPatient(a.api, second, Date.now());
    await a.api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: second })) });
    const b = await join(a, 'B', [ids.patient]);
    await meet(a, b);
    expect(effectiveFollows((await loadHousehold(b.api))!.membership, b.who.deviceId)).toEqual([ids.patient]);
    expect((b.api.list({ type: 'patient' }) as { id: string }[]).map((p) => p.id)).toEqual([ids.patient]);
    expect(Object.keys((await loadHousehold(b.api))!.keyring.patients)).toEqual([ids.patient]);
  });

  it('a removed device stops receiving: what came after is never sent to it', async () => {
    const a = await firstDevice();
    const b = await join(a, 'B');
    const c = await join(a, 'C');
    await meet(a, b);
    await meet(a, c);
    const state = (await loadHousehold(a.api))!;
    await a.api.saveHouseholdState({ state: removeDevice(state, c.who.deviceId, Date.now()) });
    await make(a, { notes: 'after the removal' });
    const [ra, rc] = await meet(a, c);
    expect(ra.outcome).toBe('refused');
    expect(rc.outcome === 'removed' || rc.outcome === 'refused').toBe(true);
    expect(seizures(c).some((s) => s.notes === 'after the removal')).toBe(false);
    const [, rb] = await meet(a, b);
    expect(rb.outcome).toBe('done');
    expect(seizures(b).some((s) => s.notes === 'after the removal')).toBe(true);
  });

  it('nothing the other device sends changes a record of this device except by the merge rules (no entry is lost, none is invented)', async () => {
    const a = await firstDevice();
    const b = await join(a, 'B');
    for (let i = 0; i < 12; i++) await make(i % 2 ? a : b, { notes: `n${i}` });
    await meet(a, b);
    await meet(a, b);
    expect(
      seizures(a)
        .map((s) => s.id)
        .sort(),
    ).toEqual(
      seizures(b)
        .map((s) => s.id)
        .sort(),
    );
    expect(seizures(a)).toHaveLength(12);
  });

  it('a phone with records of its own cannot join a household', async () => {
    const full = await firstDevice(crypto.randomUUID());
    await expect(full.api.adoptHousehold({ householdId: 'hhh' })).rejects.toThrow(/already has records/);
  });
});
