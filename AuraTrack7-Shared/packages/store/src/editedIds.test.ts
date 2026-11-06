import 'fake-indexeddb/auto';
import { doseLogFixture, ids, medicationFixture, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { createStoreApi } from './api';
import { TEST_PIN_KDF } from './crypto';

describe('which records were changed after they were written', () => {
  it('lists only the records that have an update in the log, each once', async () => {
    const { api } = createStoreApi({ name: `edited-${Date.now()}`, options: { pinKdf: TEST_PIN_KDF } });
    await api.create({ credential: { pin: '2468' } });
    const med = (await api.createRecord({
      type: 'medication',
      values: stripBase(medicationFixture({ patientId: ids.patient })),
    })) as { id: string };
    const make = async () =>
      (await api.createRecord({
        type: 'doseLog',
        values: stripBase(doseLogFixture(med.id, { patientId: ids.patient })),
      })) as { id: string };
    const kept = await make();
    const changed = await make();
    await api.update({ type: 'doseLog', id: changed.id, patch: { status: 'missed' } });
    await api.update({ type: 'doseLog', id: changed.id, patch: { note: 'forgot' } });
    expect(await api.editedIds({ type: 'doseLog' })).toEqual([changed.id]);
    expect(await api.editedIds({ type: 'doseLog' })).not.toContain(kept.id);
    expect(await api.editedIds({ type: 'seizure' })).toEqual([]);
  });
});

describe('looking into a backup without changing anything', () => {
  it('says what a backup holds and who is in it, refuses a wrong passphrase, and leaves the store alone', async () => {
    const { api } = createStoreApi({ name: `check-${Date.now()}`, options: { pinKdf: TEST_PIN_KDF } });
    await api.create({ credential: { pin: '2468' } });
    const id = (ids as { patient: string }).patient;
    await api.createRecord({
      type: 'patient',
      values: {
        id,
        patientId: id,
        name: 'Alex',
        dateOfBirth: null,
        emergencyContact: '',
        emergencyPhone: '',
        color: '#336699',
      },
    });
    await api.createRecord({ type: 'seizure', values: stripBase(seizureFixture({ patientId: id })) });
    const file = await api.backup({ passphrase: 'a long passphrase' });
    const check = await api.checkBackup({ text: file.text, passphrase: 'a long passphrase' });
    expect(check).toMatchObject({ countsMatch: true, invalid: 0, badChanges: 0, patients: ['Alex'] });
    expect(check.counts.records['seizure']).toBe(1);
    await expect(api.checkBackup({ text: file.text, passphrase: 'not the passphrase' })).rejects.toThrow();
    expect(api.list({ type: 'seizure' })).toHaveLength(1);
  });

  it('a recovery kit comes with its QR code as a grid for printing', async () => {
    const { api } = createStoreApi({ name: `kit-${Date.now()}`, options: { pinKdf: TEST_PIN_KDF } });
    await api.create({ credential: { pin: '2468' } });
    const kit = await api.recoveryKit({ credential: { pin: '2468' } });
    expect(kit.kit).toMatch(/^AT7KIT1\./);
    expect(kit.qr.dark).toHaveLength(kit.qr.size * kit.qr.size);
    expect(kit.qr.dark.some(Boolean)).toBe(true);
    expect(kit.qrSvg).toContain('<svg');
  });
});
