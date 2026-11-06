import 'fake-indexeddb/auto';
import { encodeHlc, newId, type ChangeLogEntry } from '@auratrack/model';
import {
  doseLogFixture,
  ids,
  interictalFixture,
  medicationFixture,
  seizureFixture,
  seizureProfileFixture,
  stripBase,
  symptomSetFixture,
} from '@auratrack/model/fixtures';
import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { DecryptError, TEST_PIN_KDF, WrongSecretError } from './crypto';
import {
  AppendOnlyError,
  NotFoundError,
  Store,
  StoreError,
  ValidationError,
  isInstalledPwa,
  requestPersistentStorage,
} from './store';

const FAST = { pinKdf: TEST_PIN_KDF };
let counter = 0;
const dbName = () => `test-${Date.now()}-${counter++}`;

/** The values a caller supplies: the store fills in id, householdId, deviceId and createdAt. */
const seizure = (over: Parameters<typeof seizureFixture>[0] = {}) =>
  stripBase(seizureFixture({ patientId: ids.patient, ...over }));

async function newStore(options: { now?: () => number; householdId?: string } = {}) {
  return Store.create(dbName(), { pin: '2468' }, { ...FAST, ...options });
}

describe('creating and reading', () => {
  it('fills in who wrote the record and when, and gives it back', async () => {
    const store = await newStore({ now: () => 1_760_000_000_000 });
    const made = await store.create('seizure', seizure());
    expect(made).toMatchObject({
      householdId: store.info.householdId,
      deviceId: store.info.deviceId,
      createdAt: 1_760_000_000_000,
    });
    expect(store.get('seizure', made.id)).toEqual(made);
    expect(store.list('seizure')).toEqual([made]);
    expect(store.list('seizure', (s) => s.notes === 'nothing')).toEqual([]);
    expect(store.get('seizure', newId())).toBeNull();
    expect(store.list('medication')).toEqual([]);
  });

  it('refuses an invalid record and leaves nothing behind', async () => {
    const store = await newStore();
    await expect(store.create('seizure', seizure({ typeCode: 'Focal Aware' }))).rejects.toBeInstanceOf(ValidationError);
    expect(store.list('seizure')).toEqual([]);
    expect(await store.changesSince()).toEqual([]);
  });

  it('refuses a second record with the same id', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    await expect(store.create('seizure', { ...seizure(), id: made.id })).rejects.toBeInstanceOf(StoreError);
  });

  it('writes a change-log line for each change', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    await store.update('seizure', made.id, { notes: 'x' });
    await store.delete('seizure', made.id);
    expect((await store.changesSince()).map((e) => e.kind)).toEqual(['create', 'update', 'delete']);
  });
});

describe('persistence and the lock', () => {
  it('keeps everything across a restart, and nothing readable on disk', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const made = await store.create('seizure', seizure({ notes: 'a very private note' }));
    store.close();
    expect(await Store.exists(name)).toBe(true);
    const raw = new Dexie(name);
    await raw.open();
    expect(JSON.stringify(await raw.table('records').toArray())).not.toContain('private');
    expect(JSON.stringify(await raw.table('changeLog').toArray())).not.toContain('private');
    raw.close();
    const again = await Store.unlock(name, { pin: '2468' }, FAST);
    expect(again.get('seizure', made.id)?.notes).toBe('a very private note');
    expect(again.info).toEqual(store.info);
  });

  it('refuses a wrong PIN, and a store that does not exist', async () => {
    const name = dbName();
    (await Store.create(name, { pin: '2468' }, FAST)).close();
    await expect(Store.unlock(name, { pin: '0000' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
    await expect(Store.unlock(dbName(), { pin: '2468' })).rejects.toBeInstanceOf(StoreError);
    expect(await Store.exists(dbName())).toBe(false);
    await expect(Store.create(name, { pin: '1' }, FAST)).rejects.toBeInstanceOf(StoreError);
  });

  it('can be unlocked with a passkey secret instead of a PIN', async () => {
    const name = dbName();
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const store = await Store.create(name, { secret });
    const made = await store.create('seizure', seizure());
    store.close();
    expect((await Store.unlock(name, { secret })).get('seizure', made.id)).toBeTruthy();
    await expect(Store.unlock(name, { secret: crypto.getRandomValues(new Uint8Array(32)) })).rejects.toBeInstanceOf(
      WrongSecretError,
    );
  });

  it('notices a record that was changed on disk, or moved to another record', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const a = await store.create('seizure', seizure());
    const b = await store.create('seizure', seizure());
    store.close();
    const raw = new Dexie(name);
    await raw.open();
    const rows = await raw.table('records').toArray();
    const rowA = rows.find((r) => r.id === a.id);
    const rowB = rows.find((r) => r.id === b.id);
    await raw.table('records').update(['seizure', b.id], { ct: rowA.ct, iv: rowA.iv }); // a's data under b's name
    raw.close();
    await expect(Store.unlock(name, { pin: '2468' }, FAST)).rejects.toBeInstanceOf(DecryptError);
    expect(rowB).toBeTruthy();
  });

  it('keeps the clock moving forward across a restart, even if the wall clock went back', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, { ...FAST, now: () => 5_000_000 });
    await store.create('seizure', seizure());
    store.close();
    const again = await Store.unlock(name, { pin: '2468' }, { ...FAST, now: () => 1_000 });
    const made = await again.create('seizure', seizure());
    const stamps = (await again.changesSince()).map((e) => e.stamp);
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(2);
    expect(again.get('seizure', made.id)).toBeTruthy();
  });
});

describe('PIN key upgrade (PBKDF2 to Argon2id)', () => {
  const OLD = { pinKdf: { name: 'PBKDF2', iterations: 1000 } } as const;
  const wrapOnDisk = async (name: string) => {
    const raw = new Dexie(name);
    await raw.open();
    const row = (await raw.table('meta').get('wrappedKey')) as { value: { kdf: { name: string } } };
    raw.close();
    return row.value;
  };

  it('re-wraps a PBKDF2 store on the next unlock, with every record and the change log intact', async () => {
    const name = dbName();
    const old = await Store.create(name, { pin: '2468' }, OLD);
    const made = await old.create('seizure', seizure({ notes: 'before the upgrade' }));
    const log = await old.changesSince();
    old.close();
    expect((await wrapOnDisk(name)).kdf.name).toBe('PBKDF2');

    const upgraded = await Store.unlock(name, { pin: '2468' }, FAST);
    expect((await wrapOnDisk(name)).kdf.name).toBe('Argon2id');
    expect(upgraded.get('seizure', made.id)).toEqual(made);
    expect(await upgraded.changesSince()).toEqual(log);
    expect(upgraded.info).toEqual(old.info);
    upgraded.close();

    // and it opens again with the same PIN, but not a wrong one
    const again = await Store.unlock(name, { pin: '2468' }, FAST);
    expect(again.get('seizure', made.id)?.notes).toBe('before the upgrade');
    again.close();
    await expect(Store.unlock(name, { pin: '1357' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('a wrong PIN changes nothing on disk', async () => {
    const name = dbName();
    (await Store.create(name, { pin: '2468' }, OLD)).close();
    const before = await wrapOnDisk(name);
    await expect(Store.unlock(name, { pin: '0000' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
    expect(await wrapOnDisk(name)).toEqual(before);
  });

  it('keeps the old wrap, and still opens, if the new one cannot be made', async () => {
    const name = dbName();
    const old = await Store.create(name, { pin: '2468' }, OLD);
    const made = await old.create('seizure', seizure());
    old.close();
    const before = await wrapOnDisk(name);
    const broken = { pinKdf: { name: 'Argon2id', m: 1, t: 1, p: 1 } } as const; // below the lower limit: refused
    const opened = await Store.unlock(name, { pin: '2468' }, broken);
    expect(opened.get('seizure', made.id)).toBeTruthy();
    expect(await wrapOnDisk(name)).toEqual(before);
  });

  it('leaves a store that is already current alone, and does not touch passkey or recovery unlocks', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const kit = await store.addRecoveryKit({ pin: '2468' });
    store.close();
    const before = await wrapOnDisk(name);
    (await Store.unlock(name, { pin: '2468' }, FAST)).close();
    expect(await wrapOnDisk(name)).toEqual(before);
    (await Store.unlock(name, { recoveryKit: kit }, FAST)).close();
    expect(await wrapOnDisk(name)).toEqual(before);
  });

  it('the recovery kit still works after the upgrade, and a new PIN is made under Argon2id', async () => {
    const name = dbName();
    const old = await Store.create(name, { pin: '2468' }, OLD);
    const made = await old.create('seizure', seizure());
    const kit = await old.addRecoveryKit({ pin: '2468' });
    old.close();
    (await Store.unlock(name, { pin: '2468' }, FAST)).close(); // upgrade
    const viaKit = await Store.unlock(name, { recoveryKit: kit }, FAST);
    expect(viaKit.get('seizure', made.id)).toBeTruthy();
    await viaKit.changePin({ recoveryKit: kit }, '9753');
    viaKit.close();
    expect((await wrapOnDisk(name)).kdf.name).toBe('Argon2id');
    expect((await Store.unlock(name, { pin: '9753' }, FAST)).get('seizure', made.id)).toBeTruthy();
    await expect(Store.unlock(name, { pin: '2468' }, FAST)).rejects.toBeInstanceOf(WrongSecretError);
  });
});

describe('between-seizures events and symptom sets (7.0.3)', () => {
  it('saves both, validates them, and keeps them across a restart', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const event = await store.create(
      'interictalEvent',
      stripBase(interictalFixture({ notes: 'headache after lunch' })),
    );
    const set = await store.create('symptomSet', stripBase(symptomSetFixture({ name: 'Usual start' })));
    await expect(
      store.create('interictalEvent', stripBase(interictalFixture({ symptomCode: 'Headache' }))),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(store.create('symptomSet', stripBase(symptomSetFixture({ items: [] })))).rejects.toBeInstanceOf(
      ValidationError,
    );
    store.close();
    const again = await Store.unlock(name, { pin: '2468' }, FAST);
    expect(again.get('interictalEvent', event.id)?.notes).toBe('headache after lunch');
    expect(again.get('symptomSet', set.id)?.name).toBe('Usual start');
    expect(again.list('interictalEvent')).toHaveLength(1);
    expect(again.list('symptomSet')).toHaveLength(1);
  });

  it('keeps seizure profiles encrypted, checks them, and keeps a seizure’s own copy when its profile changes (D-17)', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    const profile = await store.create('seizureProfile', stripBase(seizureProfileFixture({ name: 'Night seizure' })));
    await expect(store.create('seizureProfile', stripBase(seizureProfileFixture({ name: '' })))).rejects.toBeInstanceOf(
      ValidationError,
    );
    const seizure = await store.create(
      'seizure',
      stripBase(seizureFixture({ ilae2025: profile.ilae, profile: { id: profile.id, name: profile.name } })),
    );
    await store.update('seizureProfile', profile.id, {
      name: 'Night-time seizure',
      ilae: { ...profile.ilae, class: 'unknown' },
    });
    store.close();
    const again = await Store.unlock(name, { pin: '2468' }, FAST);
    expect(again.get('seizureProfile', profile.id)?.name).toBe('Night-time seizure');
    expect(again.get('seizure', seizure.id)).toMatchObject({
      profile: { id: profile.id, name: 'Night seizure' },
      ilae2025: { class: 'focal' },
    });
  });

  it('indexes an event by when it happened, so ranges can be read without opening everything', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: '2468' }, FAST);
    await store.create('interictalEvent', stripBase(interictalFixture({ occurredAt: 1_760_100_000_000 })));
    store.close();
    const raw = new Dexie(name);
    await raw.open();
    const rows = (await raw.table('records').toArray()) as { type: string; at: number }[];
    raw.close();
    expect(rows.find((r) => r.type === 'interictalEvent')?.at).toBe(1_760_100_000_000);
  });

  it('two devices editing different fields of one symptom set both keep their edit', async () => {
    let t = 1_000_000;
    const now = () => t++;
    const household = newId();
    const a = await Store.create(dbName(), { pin: '2468' }, { ...FAST, householdId: household, now });
    const b = await Store.create(dbName(), { pin: '2468' }, { ...FAST, householdId: household, now });
    const set = await a.create('symptomSet', stripBase(symptomSetFixture()));
    await b.applyChanges(await a.changesSince());
    await a.update('symptomSet', set.id, { name: 'Usual start' });
    await b.update('symptomSet', set.id, { seizureTypeCode: null });
    await a.applyChanges(await b.changesSince());
    await b.applyChanges(await a.changesSince());
    for (const store of [a, b]) {
      expect(store.get('symptomSet', set.id)).toMatchObject({ name: 'Usual start', seizureTypeCode: null });
    }
  });

  it('a seizure written the old way still opens and can gain a phase on a symptom', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    const symptoms = [
      {
        id: newId(),
        code: 'symptom.big_shaking_jerking.rhythmic_shaking',
        area: null,
        moment: 0,
        order: 0,
        sincePrevious: { kind: 'exact' as const, ms: 0 },
        isFirst: true,
        phase: 'seizure' as const,
      },
    ];
    await store.update('seizure', made.id, { symptoms, prodromeSecondsBefore: 7200 });
    expect(store.get('seizure', made.id)).toMatchObject({
      prodromeSecondsBefore: 7200,
      symptoms: [{ phase: 'seizure' }],
    });
  });
});

describe('updating and deleting', () => {
  it('stamps only the fields that changed', async () => {
    let t = 1_000;
    const store = await newStore({ now: () => t++ });
    const made = await store.create('seizure', seizure());
    const before = store.versioned('seizure', made.id)!;
    await store.update('seizure', made.id, { notes: 'new' });
    const after = store.versioned('seizure', made.id)!;
    expect(after.fields.notes!.stamp).not.toBe(before.fields.notes!.stamp);
    expect(after.fields.timeZone).toEqual(before.fields.timeZone);
  });

  it('a change that changes nothing writes nothing', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    await store.update('seizure', made.id, { notes: '' });
    expect(await store.changesSince()).toHaveLength(1);
  });

  it('an update that would make the record invalid is refused and changes nothing', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    await expect(store.update('seizure', made.id, { typeCode: 'Not a code' })).rejects.toBeInstanceOf(ValidationError);
    expect(store.get('seizure', made.id)?.typeCode).toBe('seizure_type.focal_aware');
  });

  it('refuses to update or delete what is missing or already deleted', async () => {
    const store = await newStore();
    await expect(store.update('seizure', newId(), { notes: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.delete('seizure', newId())).rejects.toBeInstanceOf(NotFoundError);
    const made = await store.create('seizure', seizure());
    await store.delete('seizure', made.id);
    expect(store.get('seizure', made.id)).toBeNull();
    expect(store.list('seizure')).toEqual([]);
    await expect(store.update('seizure', made.id, { notes: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    expect(store.versioned('seizure', made.id)?.deletedAt).not.toBeNull();
  });

  it('medication changes are only ever added', async () => {
    const store = await newStore();
    const med = await store.create('medication', stripBase(medicationFixture({ patientId: ids.patient })));
    const change = await store.create('medicationChange', {
      patientId: ids.patient,
      medicationId: med.id,
      medicationName: med.name,
      type: 'started',
      effectiveAt: 1,
      recordedAt: 1,
      from: null,
      to: null,
      changedFields: [],
      note: '',
      isBaseline: true,
    });
    await expect(store.update('medicationChange', change.id, { note: 'edited' })).rejects.toBeInstanceOf(
      AppendOnlyError,
    );
    await expect(store.delete('medicationChange', change.id)).rejects.toBeInstanceOf(AppendOnlyError);
  });
});

describe('two devices', () => {
  const household = newId();
  async function pair() {
    let t = 1_000_000; // one shared clock, so "newest" is the same for both
    const now = () => t++;
    const a = await newStore({ householdId: household, now });
    const b = await newStore({ householdId: household, now });
    return { a, b };
  }
  const sync = async (from: Store, to: Store) => to.applyChanges(await from.changesSince());

  it('a record made on one device appears on the other', async () => {
    const { a, b } = await pair();
    const made = await a.create('seizure', seizure({ notes: 'from A' }));
    const result = await sync(a, b);
    expect(result).toMatchObject({ applied: 1, duplicates: 0, rejected: [], conflicts: [] });
    expect(b.get('seizure', made.id)).toEqual(made);
  });

  it('receiving the same changes again changes nothing', async () => {
    const { a, b } = await pair();
    await a.create('seizure', seizure());
    await sync(a, b);
    expect(await sync(a, b)).toMatchObject({ applied: 0, duplicates: 1 });
  });

  it('edits to different fields on both devices both survive', async () => {
    const { a, b } = await pair();
    const made = await a.create('seizure', seizure());
    await sync(a, b);
    await a.update('seizure', made.id, { notes: 'note from A' });
    await b.update('seizure', made.id, { triggerCodes: ['trigger.stress'] });
    await sync(a, b);
    await sync(b, a);
    for (const store of [a, b])
      expect(store.get('seizure', made.id)).toMatchObject({ notes: 'note from A', triggerCodes: ['trigger.stress'] });
    expect(a.get('seizure', made.id)).toEqual(b.get('seizure', made.id));
  });

  it('the newest edit to the same field wins on both', async () => {
    const { a, b } = await pair();
    const made = await a.create('seizure', seizure());
    await sync(a, b);
    await a.update('seizure', made.id, { notes: 'first' });
    await b.update('seizure', made.id, { notes: 'second' });
    await b.update('seizure', made.id, { notes: 'third' });
    await sync(a, b);
    await sync(b, a);
    expect(a.get('seizure', made.id)?.notes).toBe('third');
    expect(b.get('seizure', made.id)?.notes).toBe('third');
  });

  it('a deletion reaches the other device and a later edit cannot bring the record back', async () => {
    const { a, b } = await pair();
    const made = await a.create('seizure', seizure());
    await sync(a, b);
    await a.delete('seizure', made.id);
    await b.update('seizure', made.id, { notes: 'edited after the delete, elsewhere' });
    await sync(a, b);
    await sync(b, a);
    expect(a.get('seizure', made.id)).toBeNull();
    expect(b.get('seizure', made.id)).toBeNull();
  });

  it('dose status: taken beats a newer missed', async () => {
    const { a, b } = await pair();
    const med = await a.create('medication', stripBase(medicationFixture({ patientId: ids.patient })));
    const dose = await a.create(
      'doseLog',
      stripBase(doseLogFixture(med.id, { patientId: ids.patient, status: 'assumed' })),
    );
    await sync(a, b);
    await a.update('doseLog', dose.id, { status: 'taken' });
    await b.update('doseLog', dose.id, { status: 'missed' });
    await sync(a, b);
    await sync(b, a);
    expect(a.get('doseLog', dose.id)?.status).toBe('taken');
    expect(b.get('doseLog', dose.id)?.status).toBe('taken');
  });

  it('changes that arrive out of order wait for the rest of their record', async () => {
    const { a, b } = await pair();
    const made = await a.create('seizure', seizure());
    await a.update('seizure', made.id, { notes: 'later' });
    const [create, update] = await a.changesSince();
    await b.applyChanges([update!]);
    expect(b.get('seizure', made.id)).toBeNull();
    expect(b.incomplete()).toEqual([{ type: 'seizure', id: made.id }]);
    await b.applyChanges([create!]);
    expect(b.get('seizure', made.id)?.notes).toBe('later');
    expect(b.incomplete()).toEqual([]);
  });

  it('gives only what the other device has not seen', async () => {
    const { a } = await pair();
    await a.create('seizure', seizure());
    const [first] = await a.changesSince();
    await a.create('seizure', seizure());
    expect(await a.changesSince(first!.stamp)).toHaveLength(1);
  });

  it('refuses a change that is not valid, of an unknown type, or from a clock far in the future', async () => {
    const { a, b } = await pair();
    await a.create('seizure', seizure());
    const [entry] = await a.changesSince();
    const result = await b.applyChanges([
      { ...entry!, id: newId(), stamp: 'nope' },
      { ...entry!, id: newId(), recordType: 'spaceship' },
      { ...entry!, id: newId(), stamp: encodeHlc({ wall: 4_000_000_000_000, counter: 0, node: 'x' }) },
      { nonsense: true } as unknown as ChangeLogEntry,
    ]);
    expect(result.applied).toBe(0);
    expect(result.rejected.map((r) => r.reason)).toEqual(
      expect.arrayContaining(['not a valid change', 'unknown record type spaceship', 'its clock is too far ahead']),
    );
    expect(result.rejected).toHaveLength(4);
  });

  it('two different append-only records under one id are reported, and both devices keep the same one', async () => {
    const { a, b } = await pair();
    const id = newId();
    const med = newId();
    const base = {
      id,
      patientId: ids.patient,
      medicationId: med,
      medicationName: 'X',
      type: 'started' as const,
      effectiveAt: 1,
      recordedAt: 1,
      from: null,
      to: null,
      changedFields: [],
      isBaseline: true,
    };
    await a.create('medicationChange', { ...base, note: 'written on A' });
    await b.create('medicationChange', { ...base, note: 'written on B' });
    const ra = await sync(b, a);
    const rb = await sync(a, b);
    expect(ra.conflicts.length + rb.conflicts.length).toBeGreaterThan(0);
    expect(a.get('medicationChange', id)?.note).toBe(b.get('medicationChange', id)?.note);
  });
});

describe('convergence (property test)', () => {
  it('any mix of edits on three devices, synced in any order, ends identical everywhere', async () => {
    const household = newId();
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            device: fc.integer({ min: 0, max: 2 }),
            op: fc.constantFrom('note', 'trigger', 'delete'),
            value: fc.constantFrom('a', 'b', 'c'),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 2 })), {
          minLength: 2,
          maxLength: 8,
        }),
        async (ops, order) => {
          const clocks = [1000, 1000, 1000];
          const stores = await Promise.all(
            [0, 1, 2].map((i) => newStore({ householdId: household, now: () => clocks[i]!++ * (i + 1) })),
          );
          const made = await stores[0]!.create('seizure', seizure());
          for (const other of [stores[1]!, stores[2]!]) await other.applyChanges(await stores[0]!.changesSince());
          for (const { device, op, value } of ops) {
            const store = stores[device]!;
            if (!store.get('seizure', made.id)) continue;
            if (op === 'note') await store.update('seizure', made.id, { notes: value });
            else if (op === 'trigger') await store.update('seizure', made.id, { triggerCodes: [`trigger.${value}`] });
            else await store.delete('seizure', made.id);
          }
          for (const [from, to] of order)
            if (from !== to) await stores[to]!.applyChanges(await stores[from]!.changesSince());
          for (const from of [0, 1, 2])
            for (const to of [0, 1, 2])
              if (from !== to) await stores[to]!.applyChanges(await stores[from]!.changesSince());
          const states = stores.map((s) => JSON.stringify(s.versioned('seizure', made.id)));
          expect(new Set(states).size).toBe(1);
          stores.forEach((s) => s.close());
        },
      ),
      { numRuns: 15 },
    );
  }, 120_000);
});

describe('browser storage helpers', () => {
  it('asks for persistent storage once, and says whether it got it', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    expect(await requestPersistentStorage({ persisted: () => Promise.resolve(false), persist })).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
    const again = vi.fn();
    expect(await requestPersistentStorage({ persisted: () => Promise.resolve(true), persist: again })).toBe(true);
    expect(again).not.toHaveBeenCalled();
    expect(await requestPersistentStorage({ persist: () => Promise.resolve(false) } as never)).toBe(false);
    expect(await requestPersistentStorage(undefined)).toBe(false);
  });

  it('knows an installed app', () => {
    expect(isInstalledPwa({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isInstalledPwa({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isInstalledPwa({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
    expect(isInstalledPwa({})).toBe(false);
  });
});

describe('importing records from outside', () => {
  const medicationId = newId();
  const draft = (entryId: string, recordId: string, note: string) => ({
    entryId,
    recordId,
    type: 'medicationChange' as const,
    patientId: ids.patient,
    kind: 'import' as const,
    fields: {
      id: recordId,
      householdId: ids.household,
      patientId: ids.patient,
      deviceId: ids.device,
      createdAt: 1,
      medicationId,
      medicationName: 'X',
      type: 'started',
      effectiveAt: 1,
      recordedAt: 1,
      from: null,
      to: null,
      changedFields: [],
      note,
      isBaseline: false,
    },
  });

  it('skips a draft it has already seen, and reports two different records under one id', async () => {
    const store = await newStore();
    const record = newId();
    const first = await store.importDrafts([draft(newId(), record, 'one')]);
    expect(first).toMatchObject({ applied: 1, duplicates: 0, conflicts: [] });
    const same = draft(newId(), record, 'two');
    const second = await store.importDrafts([same, same]);
    expect(second).toMatchObject({ applied: 1, duplicates: 1, conflicts: [record] });
    expect(store.get('medicationChange', record)?.note).toBe('one'); // the same one wins on every device
  });

  it('takes the patient from the record when a change does not name one', async () => {
    const store = await newStore();
    const made = await store.create('seizure', seizure());
    const [entry] = await store.changesSince();
    const other = await newStore();
    await other.applyChanges([{ ...entry!, patientId: null }]);
    expect(other.get('seizure', made.id)).toBeTruthy();
  });
});
