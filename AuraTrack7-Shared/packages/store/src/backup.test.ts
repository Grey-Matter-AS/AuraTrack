import 'fake-indexeddb/auto';
import { newId } from '@auratrack/model';
import {
  doseLogFixture,
  ids,
  medicationFixture,
  seizureFixture,
  seizureProfileFixture,
  stripBase,
} from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import {
  BackupFormatError,
  BackupVerificationError,
  PassphraseTooShortError,
  countRecords,
  createBackup,
  readBackup,
  restoreBackup,
  suggestedBackupName,
} from './backup';
import { toBase64Url } from './bytes';
import { DecryptError, TEST_PIN_KDF, backupKey, seal } from './crypto';
import { InvalidKitError, buildRecoveryKit, parseRecoveryKit, recoveryKitQr } from './recovery';
import { Store } from './store';
import { WrongSecretError } from './crypto';

const FAST = { pinKdf: TEST_PIN_KDF };
const BK = { iterations: 1000 };
let n = 0;
const name = () => `backup-${Date.now()}-${n++}`;
const seizure = (over = {}) => stripBase(seizureFixture({ patientId: ids.patient, ...over }));

async function filled() {
  const store = await Store.create(name(), { pin: '2468' }, FAST);
  const a = await store.create('seizure', seizure({ notes: 'first' }));
  const b = await store.create('seizure', seizure({ notes: 'second' }));
  await store.update('seizure', a.id, { notes: 'first, edited' });
  await store.delete('seizure', b.id);
  const med = await store.create('medication', stripBase(medicationFixture({ patientId: ids.patient })));
  await store.create('doseLog', stripBase(doseLogFixture(med.id, { patientId: ids.patient })));
  return { store, a, b, med };
}

describe('making a backup', () => {
  it('writes an encrypted file with nothing readable in it', async () => {
    const { store } = await filled();
    const file = await createBackup(store, 'a good passphrase', BK);
    expect(file).toMatchObject({
      schema: 'auratrack.v7.encrypted-backup',
      version: 1,
      kdf: { name: 'PBKDF2', iterations: 1000 },
    });
    const text = JSON.stringify(file);
    expect(text).not.toContain('first');
    expect(text).not.toContain('Levetiracetam');
  });

  it('refuses a short passphrase', async () => {
    const { store } = await filled();
    await expect(createBackup(store, 'short', BK)).rejects.toBeInstanceOf(PassphraseTooShortError);
  });

  it('counts the records per type, with deleted ones apart', async () => {
    const { store } = await filled();
    const { payload, check } = await readBackup(
      await createBackup(store, 'a good passphrase', BK),
      'a good passphrase',
    );
    expect(payload.counts).toMatchObject({ records: { seizure: 1, medication: 1, doseLog: 1 }, tombstones: 1 });
    expect(payload.counts.changeLog).toBe(payload.changeLog.length);
    expect(check).toMatchObject({ countsMatch: true, invalid: [], badChanges: 0 });
    expect(countRecords([], 0)).toEqual({ records: {}, tombstones: 0, changeLog: 0 });
  });

  it('names the file by the local date', () => {
    expect(suggestedBackupName(new Date(2026, 9, 31, 23, 59))).toBe('auratrack-backup-2026-10-31.atbak');
  });
});

describe('reading a backup', () => {
  it('accepts the file as text or as an object', async () => {
    const { store } = await filled();
    const file = await createBackup(store, 'a good passphrase', BK);
    expect((await readBackup(JSON.stringify(file), 'a good passphrase')).payload.householdId).toBe(
      store.info.householdId,
    );
    expect((await readBackup(file, 'a good passphrase')).payload.deviceId).toBe(store.info.deviceId);
  });

  it('refuses a wrong passphrase, a damaged file and a file of another kind', async () => {
    const { store } = await filled();
    const file = await createBackup(store, 'a good passphrase', BK);
    await expect(readBackup(file, 'another passphrase')).rejects.toBeInstanceOf(DecryptError);
    await expect(
      readBackup({ ...file, ciphertext: `${file.ciphertext.slice(0, -3)}AAA` }, 'a good passphrase'),
    ).rejects.toBeInstanceOf(DecryptError);
    await expect(readBackup('not json', 'x')).rejects.toBeInstanceOf(BackupFormatError);
    await expect(readBackup({ schema: 'auratrack.encrypted-backup', version: 1 }, 'x')).rejects.toBeInstanceOf(
      BackupFormatError,
    );
    await expect(
      readBackup({ ...file, kdf: { ...file.kdf, iterations: 5_000_000 } }, 'a good passphrase'),
    ).rejects.toBeInstanceOf(DecryptError);
  });

  it('lists records that do not validate instead of dropping them', async () => {
    const { store, a } = await filled();
    // A record that arrived from an older or newer version, with a value that no longer fits
    const raw = (await store.snapshot()).records.find((r) => r.id === a.id)!;
    const broken = {
      ...raw,
      fields: { ...raw.fields, triggerCodes: { ...raw.fields.triggerCodes!, value: ['Not a code'] } },
    };
    const { check } = await readBackup(await backupOf(store, [broken]), 'a good passphrase');
    expect(check.invalid).toHaveLength(1);
    expect(check.invalid[0]).toMatchObject({ type: 'seizure', id: a.id });
    const unknown = await readBackup(
      await backupOf(store, [{ ...raw, id: newId(), type: 'spaceship' }]),
      'a good passphrase',
    );
    expect(unknown.check.invalid.some((i) => i.reason === 'unknown record type')).toBe(true);
  });
});

/** An encrypted file around any payload, made with the real crypto, to test files that lie. */
async function forge(payload: object) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const sealed = await seal(
    await backupKey('a good passphrase', salt, 1000),
    JSON.stringify(payload),
    'auratrack.v7.backup',
  );
  return {
    schema: 'auratrack.v7.encrypted-backup' as const,
    version: 1 as const,
    exportedAt: 1,
    kdf: { name: 'PBKDF2' as const, hash: 'SHA-256' as const, iterations: 1000, salt: toBase64Url(salt) },
    cipher: { name: 'AES-GCM' as const, iv: sealed.iv },
    ciphertext: sealed.ct,
  };
}

/** A backup file with some records swapped, made the way createBackup makes it. */
async function backupOf(store: Store, replace: object[]) {
  const real = await store.snapshot();
  const swapped = real.records.map(
    (r) => (replace.find((x) => (x as { id: string }).id === r.id) as typeof r | undefined) ?? r,
  );
  const extra = replace.filter((x) => !real.records.some((r) => r.id === (x as { id: string }).id));
  const fake = {
    ...store,
    snapshot: async () => ({ records: [...swapped, ...(extra as typeof swapped)], changeLog: real.changeLog }),
    info: store.info,
  } as unknown as Store;
  return createBackup(fake, 'a good passphrase', BK);
}

describe('restoring a backup', () => {
  it('brings back every record exactly, deleted ones included, on a new device', async () => {
    const { store, a, b, med } = await filled();
    const file = JSON.stringify(await createBackup(store, 'a good passphrase', BK));
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    const report = await restoreBackup(fresh, file, 'a good passphrase');
    expect(report.ok).toBe(true);
    expect(report.mismatched).toEqual([]);
    expect(report.applied).toMatchObject({ rejected: [], conflicts: [] });
    expect(report.restored).toEqual(report.backup);
    expect(fresh.get('seizure', a.id)?.notes).toBe('first, edited');
    expect(fresh.get('seizure', b.id)).toBeNull();
    expect(fresh.versioned('seizure', b.id)?.deletedAt).not.toBeNull();
    expect(fresh.get('medication', med.id)?.name).toBe('Levetiracetam');
    expect((await fresh.changesSince()).length).toBe((await store.changesSince()).length);
  });

  it('brings back seizure profiles and the ILAE 2025 answers of a seizure (D-17)', async () => {
    const store = await Store.create(name(), { pin: '2468' }, FAST);
    const profile = await store.create('seizureProfile', stripBase(seizureProfileFixture({ patientId: ids.patient })));
    const s = await store.create(
      'seizure',
      seizure({ ilae2025: profile.ilae, profile: { id: profile.id, name: profile.name } }),
    );
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    const report = await restoreBackup(fresh, await createBackup(store, 'a good passphrase', BK), 'a good passphrase');
    expect(report.ok).toBe(true);
    expect(fresh.get('seizureProfile', profile.id)).toEqual(store.get('seizureProfile', profile.id));
    expect(fresh.get('seizure', s.id)).toEqual(store.get('seizure', s.id));
  });

  it('is safe to restore twice, and on the device it came from', async () => {
    const { store } = await filled();
    const file = await createBackup(store, 'a good passphrase', BK);
    const again = await restoreBackup(store, file, 'a good passphrase');
    expect(again.ok).toBe(true);
    expect(again.applied.applied).toBe(0);
    expect(again.applied.duplicates).toBe(again.backup.changeLog);
  });

  it('merges into a device that already has other data, losing neither', async () => {
    const { store, a } = await filled();
    const file = await createBackup(store, 'a good passphrase', BK);
    const other = await Store.create(name(), { pin: '1357' }, FAST);
    const mine = await other.create('seizure', seizure({ notes: 'already here' }));
    expect((await restoreBackup(other, file, 'a good passphrase')).ok).toBe(true);
    expect(other.get('seizure', mine.id)?.notes).toBe('already here');
    expect(other.get('seizure', a.id)).toBeTruthy();
  });

  it('refuses a backup whose counts do not match what it holds', async () => {
    const { store } = await filled();
    const real = await createBackup(store, 'a good passphrase', BK);
    const { payload } = await readBackup(real, 'a good passphrase');
    const file = await forge({
      ...payload,
      counts: { ...payload.counts, records: { ...payload.counts.records, seizure: 99 } },
    });
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    const refused = await restoreBackup(fresh, file, 'a good passphrase').catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(BackupVerificationError);
    expect((refused as BackupVerificationError).report.countsMatch).toBe(false);
    expect(fresh.allVersioned()).toEqual([]); // nothing was restored
  });

  it('refuses a backup whose change log holds lines that are not valid', async () => {
    const { store } = await filled();
    const { payload } = await readBackup(await createBackup(store, 'a good passphrase', BK), 'a good passphrase');
    const file = await forge({
      ...payload,
      changeLog: [...payload.changeLog, { nonsense: true } as never],
      counts: { ...payload.counts, changeLog: payload.changeLog.length + 1 },
    });
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    await expect(restoreBackup(fresh, file, 'a good passphrase')).rejects.toBeInstanceOf(BackupVerificationError);
  });

  it('reports invalid records but still restores them', async () => {
    const { store, a } = await filled();
    const raw = (await store.snapshot()).records.find((r) => r.id === a.id)!;
    const broken = {
      ...raw,
      fields: { ...raw.fields, triggerCodes: { ...raw.fields.triggerCodes!, value: ['Not a code'] } },
    };
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    const report = await restoreBackup(fresh, await backupOf(store, [broken]), 'a good passphrase');
    expect(report.invalid).toHaveLength(1);
    expect(fresh.versioned('seizure', a.id)).toBeTruthy(); // kept, even though it does not validate
  });
});

describe('recovery kit', () => {
  it('unlocks the store after a forgotten PIN, and the PIN can then be reset', async () => {
    const name1 = name();
    const store = await Store.create(name1, { pin: '2468' }, FAST);
    const made = await store.create('seizure', seizure());
    const kit = await store.addRecoveryKit({ pin: '2468' });
    store.close();
    await expect(Store.unlock(name1, { pin: '0000' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
    const back = await Store.unlock(name1, { recoveryKit: kit }, FAST);
    expect(back.get('seizure', made.id)).toBeTruthy();
    await back.changePin({ recoveryKit: kit }, '9999');
    back.close();
    expect((await Store.unlock(name1, { pin: '9999' }, FAST)).get('seizure', made.id)).toBeTruthy();
    await expect(Store.unlock(name1, { pin: '2468' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('needs the right current PIN to make a kit or change the PIN', async () => {
    const store = await Store.create(name(), { pin: '2468' }, FAST);
    await expect(store.addRecoveryKit({ pin: 'wrong' })).rejects.toBeInstanceOf(WrongSecretError);
    await expect(store.changePin({ pin: 'wrong' }, '1111')).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('a kit from another household, or no kit made yet, does not unlock', async () => {
    const n1 = name();
    const s1 = await Store.create(n1, { pin: '2468' }, FAST);
    const kit1 = await s1.addRecoveryKit({ pin: '2468' });
    s1.close();
    const n2 = name();
    const s2 = await Store.create(n2, { pin: '2468' }, FAST);
    s2.close();
    await expect(Store.unlock(n2, { recoveryKit: kit1 }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('the kit text is checked, and prints as a QR code', async () => {
    const secret = new Uint8Array(32).fill(7);
    const kit = await buildRecoveryKit('household-1', secret);
    expect(await parseRecoveryKit(kit)).toEqual({ householdId: 'household-1', secret });
    expect(await parseRecoveryKit(`  ${kit}\n`)).toBeTruthy();
    for (const bad of ['', 'nope', kit.slice(0, -2), `${kit}.x`, kit.replace('AT7KIT1', 'AT7KIT2'), 'AT7KIT1.e30.xxxx'])
      await expect(parseRecoveryKit(bad)).rejects.toBeInstanceOf(InvalidKitError);
    const short = await buildRecoveryKit('h', new Uint8Array(8));
    await expect(parseRecoveryKit(short)).rejects.toBeInstanceOf(InvalidKitError);
    expect(await recoveryKitQr(kit)).toMatch(/^<svg/);
  });
});

describe('a backup that is not what it claims', () => {
  it('whose contents are not a backup, or are not even JSON, is called damaged', async () => {
    const wrong = await forge({ schema: 'something else' });
    await expect(readBackup(wrong, 'a good passphrase')).rejects.toBeInstanceOf(BackupFormatError);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const sealed = await seal(await backupKey('a good passphrase', salt, 1000), 'not json {', 'auratrack.v7.backup');
    const notJson = {
      schema: 'auratrack.v7.encrypted-backup',
      version: 1,
      exportedAt: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt: toBase64Url(salt) },
      cipher: { name: 'AES-GCM', iv: sealed.iv },
      ciphertext: sealed.ct,
    };
    await expect(readBackup(notJson, 'a good passphrase')).rejects.toBeInstanceOf(BackupFormatError);
  });
});

describe('a backup of one person', () => {
  async function twoPeople() {
    const store = await Store.create(name(), { pin: '2468' }, FAST);
    const alexId = newId();
    const samId = newId();
    for (const [id, who] of [
      [alexId, 'Alex'],
      [samId, 'Sam'],
    ] as const)
      await store.create('patient', {
        id,
        patientId: id,
        name: who,
        dateOfBirth: null,
        emergencyContact: '',
        emergencyPhone: '',
        color: '#336699',
      } as never);
    const one = await store.create('seizure', seizure({ patientId: alexId, notes: 'alex one' }));
    await store.create('seizure', seizure({ patientId: alexId, notes: 'alex two' }));
    await store.create('seizure', seizure({ patientId: samId, notes: 'sam one' }));
    await store.create('setting', { patientId: newId(), scope: 'device', key: 'theme', value: 'light' } as never);
    await store.delete('seizure', one.id);
    return { store, alexId, samId };
  }

  it('holds that person, their records and what they deleted, and nobody else', async () => {
    const { store, alexId } = await twoPeople();
    const file = await createBackup(store, 'a long passphrase', { ...BK, patientId: alexId });
    const { payload, check } = await readBackup(file, 'a long passphrase');
    expect(check.countsMatch).toBe(true);
    expect(payload.records.every((r) => r.fields['patientId']?.value === alexId)).toBe(true);
    expect(payload.records.filter((r) => r.type === 'seizure')).toHaveLength(2); // one of them deleted: a tombstone
    expect(payload.records.filter((r) => r.type === 'seizure' && r.deletedAt !== null)).toHaveLength(1);
    expect(payload.records.filter((r) => r.type === 'patient')).toHaveLength(1);
    expect(payload.records.some((r) => r.type === 'setting')).toBe(false);
    expect(payload.changeLog.every((e) => e.patientId === alexId)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('sam one');
  });

  it('restores into another phone as that person only, with the same records', async () => {
    const { store, alexId } = await twoPeople();
    const file = await createBackup(store, 'a long passphrase', { ...BK, patientId: alexId });
    const fresh = await Store.create(name(), { pin: '1357' }, FAST);
    const report = await restoreBackup(fresh, file, 'a long passphrase');
    expect(report.ok).toBe(true);
    expect(fresh.list('patient').map((p) => (p as { name: string }).name)).toEqual(['Alex']);
    expect(fresh.list('seizure').map((s) => (s as { notes: string }).notes)).toEqual(['alex two']);
  });

  it('a backup of everyone still holds everyone', async () => {
    const { store } = await twoPeople();
    const { payload } = await readBackup(await createBackup(store, 'a long passphrase', BK), 'a long passphrase');
    expect(payload.records.filter((r) => r.type === 'patient')).toHaveLength(2);
    expect(payload.records.some((r) => r.type === 'setting')).toBe(true);
  });
});
