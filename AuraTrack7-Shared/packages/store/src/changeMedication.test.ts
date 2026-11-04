import 'fake-indexeddb/auto';
import { ids, medicationFixture, stripBase } from '@auratrack/model/fixtures';
import { planMedicationChange, regimenSnapshot, type ChangePlan, type Medication } from '@auratrack/model';
import { describe, expect, it, vi } from 'vitest';
import { createStoreApi } from './api';
import { TEST_PIN_KDF } from './crypto';

const NOW = new Date(2026, 9, 10, 12).getTime();
const flags = { isRescue: false, showInEmergency: false, reminderEnabled: false };
const planOf = (r: ReturnType<typeof planMedicationChange>): ChangePlan => {
  if ('problem' in r) throw new Error(r.problem);
  return r;
};
let n = 0;
async function open() {
  const { api, store } = createStoreApi({ name: `change-med-${Date.now()}-${n++}`, options: { pinKdf: TEST_PIN_KDF } });
  await api.create({ credential: { pin: '2468' } });
  return { api, store };
}

describe('changing a medicine writes the medicine and its history together', () => {
  it('a new medicine gets its id on the "started" record', async () => {
    const { api } = await open();
    const base = medicationFixture({ patientId: ids.patient });
    const plan = planOf(
      planMedicationChange({
        patientId: ids.patient,
        before: null,
        next: { ...regimenSnapshot(base), ...flags },
        type: 'started',
        effectiveAt: NOW - 86_400_000,
        recordedAt: NOW,
        note: '',
      }),
    );
    await api.changeMedication({ plan });
    const meds = api.list({ type: 'medication' }) as unknown as Medication[];
    const changes = api.list({ type: 'medicationChange' }) as unknown as { medicationId: string; type: string }[];
    expect(meds).toHaveLength(1);
    expect(changes).toMatchObject([{ type: 'started', medicationId: meds[0]!.id }]);
  });

  it('a change updates the medicine and adds a record with before and after', async () => {
    const { api } = await open();
    const created = (await api.createRecord({
      type: 'medication',
      values: stripBase(medicationFixture({ patientId: ids.patient })),
    })) as unknown as Medication;
    const plan = planOf(
      planMedicationChange({
        patientId: ids.patient,
        before: created,
        next: { ...regimenSnapshot(created), dose: 750, ...flags },
        type: 'changed',
        effectiveAt: NOW,
        recordedAt: NOW,
        note: '',
      }),
    );
    await api.changeMedication({ plan });
    expect((api.get({ type: 'medication', id: created.id }) as unknown as Medication).dose).toBe(750);
    const [change] = api.list({ type: 'medicationChange' }) as unknown as {
      from: { dose: number };
      to: { dose: number };
    }[];
    expect([change?.from.dose, change?.to.dose]).toEqual([500, 750]);
  });

  it('puts the medicine back as it was when the history record cannot be written', async () => {
    const { api, store } = await open();
    const created = (await api.createRecord({
      type: 'medication',
      values: stripBase(medicationFixture({ patientId: ids.patient })),
    })) as unknown as Medication;
    const plan = planOf(
      planMedicationChange({
        patientId: ids.patient,
        before: created,
        next: { ...regimenSnapshot(created), dose: 999, ...flags },
        type: 'changed',
        effectiveAt: NOW,
        recordedAt: NOW,
        note: '',
      }),
    );
    const s = store();
    const original = s.create.bind(s);
    vi.spyOn(s, 'create').mockImplementation(((type: string, values: never) =>
      type === 'medicationChange' ? Promise.reject(new Error('disk full')) : original(type as never, values)) as never);
    await expect(api.changeMedication({ plan })).rejects.toThrow('disk full');
    expect((api.get({ type: 'medication', id: created.id }) as unknown as Medication).dose).toBe(500);
    expect(api.list({ type: 'medicationChange' })).toHaveLength(0);
  });

  it('removes a new medicine again when its "started" record cannot be written', async () => {
    const { api, store } = await open();
    const base = medicationFixture({ patientId: ids.patient });
    const plan = planOf(
      planMedicationChange({
        patientId: ids.patient,
        before: null,
        next: { ...regimenSnapshot(base), ...flags },
        type: 'started',
        effectiveAt: NOW,
        recordedAt: NOW,
        note: '',
      }),
    );
    const s = store();
    const original = s.create.bind(s);
    vi.spyOn(s, 'create').mockImplementation(((type: string, values: never) =>
      type === 'medicationChange' ? Promise.reject(new Error('disk full')) : original(type as never, values)) as never);
    await expect(api.changeMedication({ plan })).rejects.toThrow('disk full');
    expect(api.list({ type: 'medication' })).toHaveLength(0);
  });
});
