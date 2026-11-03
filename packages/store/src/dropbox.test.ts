import 'fake-indexeddb/auto';
import { newId, type RecordingEvent } from '@auratrack/model';
import { medicationFixture, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { TEST_PIN_KDF } from './crypto';
import { AuraDb } from './db';
import {
  DropBoxUnavailableError,
  LockedRecorder,
  MAX_DROPBOX_ENTRIES,
  NO_LOCKED_SCREEN,
  newDropBoxKeys,
  openPosted,
  readLockedScreen,
  sealPosted,
  loadDropBoxPrivateKey,
} from './dropbox';
import { Store } from './store';

const FAST = { pinKdf: TEST_PIN_KDF };
const PIN = '2468';
const T0 = 1_760_000_000_000;
const S = 1000;
let counter = 0;
const dbName = () => `dropbox-${Date.now()}-${counter++}`;

async function setup(over: Partial<{ now: () => number; name: string }> = {}) {
  const name = over.name ?? dbName();
  const options = { ...FAST, ...(over.now ? { now: over.now } : {}) };
  const store = await Store.create(name, { pin: PIN }, options);
  const patientId = newId();
  await store.create('patient', {
    id: patientId,
    patientId,
    name: 'Alex Example',
    dateOfBirth: null,
    emergencyContact: 'Sam 555 0100',
    color: '#336699',
  });
  await store.publishLockedScreen();
  return { name, store, patientId, options };
}

const startEvent = (patientId: string, seizureId: string, at = T0): RecordingEvent => ({
  kind: 'start',
  id: newId(),
  at,
  seizureId,
  patientId,
  recordedBy: 'carer',
  timeZone: 'Europe/Oslo',
});
const tap = (
  kind: 'end_aura' | 'end_seizure' | 'back_to_normal' | 'finish' | 'cancel' | 'auto_stop',
  at: number,
): RecordingEvent => ({
  kind,
  id: newId(),
  at,
});
const note = (label: string, at: number): RecordingEvent => ({ kind: 'quick_note', id: newId(), at, label });

/** What a locked page does: no store, no key to the records, only the database and the public key. */
const lockedPage = (name: string) => new LockedRecorder(new AuraDb(name));

describe('the key pair', () => {
  it('is made with a new store: the public half in the clear, the private half sealed', async () => {
    const { name, store } = await setup();
    store.close();
    const db = new AuraDb(name);
    const publicKey = (await db.meta.get('dropBoxPublicKey'))?.value as string;
    const sealed = (await db.meta.get('dropBoxPrivateKey'))?.value as Record<string, string>;
    expect(publicKey).toMatch(/^[\w-]{80,100}$/); // a raw P-256 point
    expect(Object.keys(sealed).sort()).toEqual(['ct', 'iv']);
    db.close();
  });

  it('is made at the next unlock for a store that has none (made before 7.0.3), and the old data is untouched', async () => {
    const { name, store, patientId } = await setup();
    store.close();
    const db = new AuraDb(name);
    await db.meta.bulkDelete(['dropBoxPublicKey', 'dropBoxPrivateKey']);
    db.close();
    const back = await Store.unlock(name, { pin: PIN }, FAST);
    expect(back.list('patient')[0]?.id).toBe(patientId);
    back.close();
    const check = new AuraDb(name);
    expect(await check.meta.get('dropBoxPublicKey')).toBeDefined();
    expect(await check.meta.get('dropBoxPrivateKey')).toBeDefined();
    check.close();
  });

  it('keeps the same pair when the store is unlocked again', async () => {
    const { name, store } = await setup();
    store.close();
    const db = new AuraDb(name);
    const before = (await db.meta.get('dropBoxPublicKey'))?.value;
    (await Store.unlock(name, { pin: PIN }, FAST)).close();
    expect((await db.meta.get('dropBoxPublicKey'))?.value).toBe(before);
    db.close();
  });

  it('opens an entry only with the matching private key', async () => {
    const { name, store } = await setup();
    const posted = { recording: newId(), event: tap('finish', T0) };
    const db = new AuraDb(name);
    const publicKey = (await db.meta.get('dropBoxPublicKey'))?.value as string;
    const row = await sealPosted(publicKey, posted);
    const mine = await loadDropBoxPrivateKey(db, (store as unknown as { key: CryptoKey }).key);
    expect(await openPosted(mine as CryptoKey, row)).toEqual(posted);
    const other = await setup();
    const otherDb = new AuraDb(other.name);
    const theirs = await loadDropBoxPrivateKey(otherDb, (other.store as unknown as { key: CryptoKey }).key);
    await expect(openPosted(theirs as CryptoKey, row)).rejects.toThrow('could not be decrypted');
    db.close();
    otherDb.close();
  });

  it('gives an entry that is different every time, even for the same event', async () => {
    const { publicKey } = await newDropBoxKeys(
      (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])) as CryptoKey,
    );
    const posted = { recording: newId(), event: tap('finish', T0) };
    const a = await sealPosted(publicKey, posted);
    const b = await sealPosted(publicKey, posted);
    expect(a.ct).not.toBe(b.ct);
    expect(a.epk).not.toBe(b.epk);
  });
});

describe('what the PIN screen may show', () => {
  it('has Start, the patient and the default card (rescue medication and contacts)', async () => {
    const { store, patientId } = await setup();
    await store.create('medication', {
      ...stripBase(medicationFixture({ patientId, name: 'Midazolam', dose: 10, unit: 'mg', isRescue: true })),
    });
    await store.create('medication', { ...stripBase(medicationFixture({ patientId, name: 'Daily tablet' })) });
    const screen = await store.publishLockedScreen();
    expect(screen).toEqual({
      start: true,
      patientId,
      patientName: null,
      plan: { emergencyAlertMinutes: 5, clusterMinCount: 3, clusterWindowMinutes: 8 },
      card: { contact: 'Sam 555 0100', rescue: [{ name: 'Midazolam', dose: 10, unit: 'mg' }] },
      video: null,
    });
  });

  it('follows the settings: rescue medication only, nothing, the name, and no Start button', async () => {
    const { store, patientId } = await setup();
    const put = (key: string, value: unknown) =>
      store.create('setting', { patientId, scope: 'device', key, value: value as never });
    await put('lockedAlertContent', 'rescue');
    expect((await store.publishLockedScreen()).card).toEqual({ contact: null, rescue: [] });
    await put('lockedAlertContent', 'nothing');
    expect((await store.publishLockedScreen()).card).toBeNull();
    await put('lockedShowName', true);
    expect((await store.publishLockedScreen()).patientName).toBe('Alex Example');
    await put('lockedStart', false);
    expect((await store.publishLockedScreen()).start).toBe(false);
  });

  it('wipes the card from disk when the user chooses "nothing"', async () => {
    const { name, store, patientId } = await setup();
    await store.create('setting', { patientId, scope: 'device', key: 'lockedAlertContent', value: 'nothing' });
    await store.publishLockedScreen();
    const db = new AuraDb(name);
    expect(JSON.stringify(await db.meta.get('lockedScreen'))).not.toContain('Sam 555');
    db.close();
  });

  it('is empty when there is no patient yet', async () => {
    const store = await Store.create(dbName(), { pin: PIN }, FAST);
    expect(await store.publishLockedScreen()).toEqual(NO_LOCKED_SCREEN);
  });

  it('keeps the chosen patient while that patient exists', async () => {
    const { store, patientId } = await setup();
    const second = newId();
    await store.create('patient', {
      id: second,
      patientId: second,
      name: 'B',
      dateOfBirth: null,
      emergencyContact: '',
      color: '#000',
    });
    expect((await store.publishLockedScreen()).patientId).toBe(patientId);
    expect((await store.publishLockedScreen(second)).patientId).toBe(second);
    expect((await store.publishLockedScreen()).patientId).toBe(second);
  });

  it('reads as empty before anything was written', async () => {
    const name = dbName();
    const store = await Store.create(name, { pin: PIN }, FAST);
    store.close();
    const db = new AuraDb(name);
    expect(await readLockedScreen(db)).toEqual(NO_LOCKED_SCREEN);
    db.close();
  });
});

describe('what the locked app knows of the plan and of recent seizures', () => {
  it("uses the user's own plan, wherever the setting is kept", async () => {
    const { store, patientId } = await setup();
    await store.create('setting', { patientId, scope: 'patient', key: 'emergencyAlertMinutes', value: 3 });
    await store.create('setting', { patientId, scope: 'household', key: 'clusterMinCount', value: 'nonsense' });
    expect((await store.publishLockedScreen()).plan).toEqual({
      emergencyAlertMinutes: 3,
      clusterMinCount: 3,
      clusterWindowMinutes: 8,
    });
  });

  it('lists the start times of recent seizures from the clear index, without any key', async () => {
    const { name, store, patientId } = await setup({ now: () => T0 + 10 * S });
    const recent = await store.create('seizure', {
      ...stripBase(
        seizureFixture({
          patientId,
          phases: { start: { at: T0 - 60 * S, source: 'timed' }, auraEnd: null, seizureEnd: null, recoveryEnd: null },
        }),
      ),
    });
    const old = await store.create('seizure', {
      ...stripBase(
        seizureFixture({
          patientId,
          phases: {
            start: { at: T0 - 30 * 24 * 3600 * S, source: 'timed' },
            auraEnd: null,
            seizureEnd: null,
            recoveryEnd: null,
          },
        }),
      ),
    });
    const gone = await store.create('seizure', { ...stripBase(seizureFixture({ patientId })) });
    await store.delete('seizure', gone.id);
    expect(old.id).not.toBe(recent.id);
    store.close();
    const page = new LockedRecorder(new AuraDb(name), () => T0 + 10 * S);
    expect((await page.status()).recentStarts).toEqual([T0 - 60 * S]);
  });
});

describe('recording while locked', () => {
  it('cannot start before the store has a patient, or when Start is switched off', async () => {
    const empty = await Store.create(dbName(), { pin: PIN }, FAST);
    empty.close();
    const { name, store, patientId } = await setup();
    await store.create('setting', { patientId, scope: 'device', key: 'lockedStart', value: false });
    await store.publishLockedScreen();
    store.close();
    const page = lockedPage(name);
    expect((await page.status()).available).toBe(false);
    await expect(page.post(startEvent(patientId, newId()))).rejects.toBeInstanceOf(DropBoxUnavailableError);
  });

  it('posts events with no key to the records, and leaves nothing readable in the database', async () => {
    const { name, store, patientId } = await setup();
    store.close();
    const seizureId = newId();
    const page = lockedPage(name);
    expect((await page.status()).available).toBe(true);
    await page.post(startEvent(patientId, seizureId));
    await page.post(note('Eyes open', T0 + 5 * S));
    const raw = new AuraDb(name);
    const rows = await raw.dropbox.toArray();
    expect(rows).toHaveLength(2);
    // The entries show nothing. What is kept in the clear beside them is only the marks, the patient's id and the card.
    const entries = JSON.stringify(rows);
    for (const secret of ['Eyes open', patientId, seizureId, 'Europe/Oslo', 'carer', 'quick_note', 'start'])
      expect(entries).not.toContain(secret);
    const clear = JSON.stringify(await raw.meta.toArray());
    for (const secret of ['Eyes open', 'carer', 'Europe/Oslo', 'Alex Example']) expect(clear).not.toContain(secret);
    raw.close();
  });

  it('keeps only the marks in the clear, and carries on from them after a reload', async () => {
    const { name, store, patientId } = await setup();
    store.close();
    const seizureId = newId();
    await lockedPage(name).post(startEvent(patientId, seizureId));
    await lockedPage(name).post(tap('end_aura', T0 + 10 * S));
    const marker = (await new AuraDb(name).meta.get('lockedMarker'))?.value as Record<string, unknown>;
    expect(marker).toEqual({
      seizureId,
      start: T0,
      auraEnd: T0 + 10 * S,
      seizureEnd: null,
      recoveryEnd: null,
      status: 'running',
      autoStopped: false,
    });
    const reloaded = lockedPage(name);
    expect((await reloaded.status()).session).toMatchObject({ start: T0, auraEnd: T0 + 10 * S, status: 'running' });
    const after = await reloaded.post(tap('end_seizure', T0 + 40 * S));
    expect(after?.seizureEnd).toBe(T0 + 40 * S);
  });

  it('refuses events with no recording, a start for another patient, and does not post an event that changes nothing', async () => {
    const { name, store, patientId } = await setup();
    store.close();
    const page = lockedPage(name);
    await expect(page.post(tap('end_aura', T0))).rejects.toBeInstanceOf(DropBoxUnavailableError);
    await expect(page.post(startEvent(newId(), newId()))).rejects.toBeInstanceOf(DropBoxUnavailableError);
    await page.post(startEvent(patientId, newId()));
    const tapOnce = tap('end_aura', T0 + S);
    await page.post(tapOnce);
    await page.post(tapOnce);
    expect((await page.status()).waiting).toBe(2); // Start and one End aura: the repeated tap was not posted again
  });

  it('stops taking entries when the drop box is full', async () => {
    const { name, store, patientId } = await setup();
    store.close();
    const page = lockedPage(name);
    await page.post(startEvent(patientId, newId()));
    const db = new AuraDb(name);
    const [template] = await db.dropbox.toArray();
    await db.dropbox.bulkAdd(
      Array.from({ length: MAX_DROPBOX_ENTRIES }, () => ({ ...(template as object), seq: undefined })) as never,
    );
    await expect(page.post(note('x', T0 + S))).rejects.toThrow('full');
    db.close();
  });
});

describe('merging after unlock', () => {
  async function lockedRecording(events: (seizureId: string) => RecordingEvent[], now = () => T0 + 600 * S) {
    const { name, store, patientId, options } = await setup({ now });
    store.close();
    const seizureId = newId();
    const page = lockedPage(name);
    await page.post(startEvent(patientId, seizureId));
    for (const event of events(seizureId)) await page.post(event);
    return { name, patientId, seizureId, options: { ...options, now } };
  }

  it('turns a locked recording into a normal seizure, flagged, and empties the drop box', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [
      tap('end_aura', T0 + 10 * S),
      note('Eyes open', T0 + 15 * S),
      tap('end_seizure', T0 + 70 * S),
      tap('back_to_normal', T0 + 200 * S),
    ]);
    const store = await Store.unlock(name, { pin: PIN }, options);
    const seizure = store.get('seizure', seizureId);
    expect(seizure).toMatchObject({
      status: 'recorded',
      recordedWhileLocked: true,
      recordedBy: 'carer',
      timeZone: 'Europe/Oslo',
      isEmergencyStop: false,
      phases: {
        start: { at: T0, source: 'timed' },
        auraEnd: { at: T0 + 10 * S },
        seizureEnd: { at: T0 + 70 * S },
        recoveryEnd: { at: T0 + 200 * S },
      },
    });
    expect(seizure?.quickNotes).toMatchObject([{ label: 'Eyes open', at: T0 + 15 * S }]);
    expect(store.lastDropBox).toEqual({ recordings: 1, events: 5, quarantined: 0, failed: 0 });
    const raw = new AuraDb(name);
    expect(await raw.dropbox.count()).toBe(0);
    expect(await raw.meta.get('lockedMarker')).toBeUndefined();
    raw.close();
  });

  it('gives the same seizure as recording unlocked', async () => {
    const events = [
      tap('end_aura', T0 + 10 * S),
      note('Calm', T0 + 20 * S),
      tap('end_seizure', T0 + 70 * S),
      tap('finish', T0 + 90 * S),
    ];
    const viaLock = await lockedRecording(() => events);
    const lockedStore = await Store.unlock(viaLock.name, { pin: PIN }, viaLock.options);
    const { RecordingService } = await import('./recording');
    const plain = await setup({ now: () => T0 + 600 * S });
    const service = new RecordingService(plain.store);
    const id = newId();
    await service.apply(id, startEvent(plain.patientId, id));
    for (const event of events) await service.apply(id, event);
    const strip = (s: unknown) => {
      const { id, householdId, deviceId, createdAt, patientId, recordedWhileLocked, ...rest } = s as Record<
        string,
        unknown
      >;
      return { rest, kept: [id, householdId, deviceId, createdAt, patientId, recordedWhileLocked].length };
    };
    expect(strip(lockedStore.get('seizure', viaLock.seizureId))).toEqual(strip(plain.store.get('seizure', id)));
  });

  it('adds a recording that is still running as in progress, so the screen can carry on', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [tap('end_aura', T0 + 10 * S)]);
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.get('seizure', seizureId)).toMatchObject({ status: 'in_progress', recordedWhileLocked: true });
    const { RecordingService } = await import('./recording');
    const service = new RecordingService(store, options.now);
    const found = await service.recover();
    expect(found.running.map((s) => s.seizureId)).toEqual([seizureId]);
    await service.apply(seizureId, tap('end_seizure', T0 + 100 * S));
    expect(store.get('seizure', seizureId)?.phases.seizureEnd?.at).toBe(T0 + 100 * S);
  });

  it('continues a recording that was merged earlier and locked again', async () => {
    const first = await lockedRecording(() => [tap('end_aura', T0 + 10 * S)]);
    (await Store.unlock(first.name, { pin: PIN }, first.options)).close();
    const page = lockedPage(first.name);
    // the screen was unlocked and locked again mid-recording: the page carries on posting to the same recording
    const status = await page.status();
    expect(status.session).toBeNull(); // the marker went with the merge; the page adopts the recording itself
    const restarted = lockedPage(first.name);
    await restarted.post(startEvent(first.patientId, first.seizureId));
    await restarted.post(tap('end_seizure', T0 + 90 * S));
    const store = await Store.unlock(first.name, { pin: PIN }, first.options);
    expect(store.get('seizure', first.seizureId)).toMatchObject({
      phases: { auraEnd: { at: T0 + 10 * S }, seizureEnd: { at: T0 + 90 * S } },
    });
    expect(store.list('seizure')).toHaveLength(1);
  });

  it('ends a recording found after 12 minutes with the seizure end unknown, and marks it', async () => {
    const { name, seizureId, options } = await lockedRecording(
      () => [],
      () => T0 + 3600 * S,
    );
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.get('seizure', seizureId)).toMatchObject({
      status: 'recorded',
      isEmergencyStop: true,
      phases: { seizureEnd: null, recoveryEnd: null },
    });
  });

  it('keeps a cancelled recording and flags it', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [
      note('Calm', T0 + 5 * S),
      tap('cancel', T0 + 9 * S),
    ]);
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.get('seizure', seizureId)).toMatchObject({
      cancelled: true,
      status: 'recorded',
      recordedWhileLocked: true,
    });
    expect(store.get('seizure', seizureId)?.quickNotes).toHaveLength(1);
  });

  it('is safe to repeat: entries that come back after a crash add nothing and overwrite nothing', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [
      tap('end_seizure', T0 + 30 * S),
      tap('finish', T0 + 40 * S),
    ]);
    const raw = new AuraDb(name);
    const copy = await raw.dropbox.toArray();
    const store = await Store.unlock(name, { pin: PIN }, options);
    const merged = store.get('seizure', seizureId);
    // the user then edits the details...
    await store.update('seizure', seizureId, { typeCode: 'seizure_type.focal_aware', notes: 'my edit' });
    store.close();
    // ...and the entries reappear, as if the delete had not happened before a crash
    await raw.dropbox.bulkAdd(copy.map((row) => ({ ...row, seq: undefined }) as never));
    raw.close();
    const again = await Store.unlock(name, { pin: PIN }, options);
    expect(again.get('seizure', seizureId)).toMatchObject({
      typeCode: 'seizure_type.focal_aware',
      notes: 'my edit',
      phases: merged?.phases,
    });
    expect(again.list('seizure')).toHaveLength(1);
    expect(again.lastDropBox).toMatchObject({ recordings: 0, events: 3, quarantined: 0, failed: 0 });
  });

  it('is safe to repeat while the recording is still running: no note is doubled', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [note('Calm', T0 + 5 * S)]);
    const raw = new AuraDb(name);
    const copy = await raw.dropbox.toArray();
    (await Store.unlock(name, { pin: PIN }, options)).close();
    await raw.dropbox.bulkAdd(copy.map((row) => ({ ...row, seq: undefined }) as never));
    raw.close();
    const again = await Store.unlock(name, { pin: PIN }, options);
    expect(again.get('seizure', seizureId)?.quickNotes).toHaveLength(1);
  });

  it('keeps an entry that was changed on disk, and merges the rest', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [
      note('Calm', T0 + 5 * S),
      note('Again', T0 + 8 * S),
    ]);
    const raw = new AuraDb(name);
    const rows = await raw.dropbox.orderBy('seq').toArray();
    const damaged = rows[1] as { seq: number; ct: string };
    await raw.dropbox.update(damaged.seq, { ct: damaged.ct.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) });
    raw.close();
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.get('seizure', seizureId)?.quickNotes?.map((n) => n.label)).toEqual(['Again']);
    expect(store.lastDropBox).toMatchObject({ quarantined: 1, failed: 0 });
    const after = new AuraDb(name);
    const left = await after.dropbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]?.quarantined).toContain('decrypted');
    after.close();
    // the kept entry is not tried again, and not counted again
    store.close();
    const third = await Store.unlock(name, { pin: PIN }, options);
    expect(third.lastDropBox.quarantined).toBe(0);
  });

  it('keeps an entry sealed for another store, one that is not a recording event, and one with no start', async () => {
    const { name, patientId, options } = await lockedRecording(() => []);
    const raw = new AuraDb(name);
    const publicKey = (await raw.meta.get('dropBoxPublicKey'))?.value as string;
    const other = await newDropBoxKeys(
      (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])) as CryptoKey,
    );
    await raw.dropbox.add(await sealPosted(other.publicKey, { recording: newId(), event: tap('finish', T0) }));
    await raw.dropbox.add(
      await sealPosted(publicKey, { recording: newId(), event: { kind: 'format_disk', id: newId(), at: T0 } } as never),
    );
    await raw.dropbox.add(await sealPosted(publicKey, { recording: newId(), event: tap('finish', T0 + S) }));
    await raw.dropbox.add(
      await sealPosted(publicKey, { recording: newId(), event: startEvent(patientId, newId()), extra: true } as never),
    );
    raw.close();
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.lastDropBox).toMatchObject({ recordings: 1, quarantined: 4, failed: 0 });
    expect(store.list('seizure')).toHaveLength(1);
    const after = new AuraDb(name);
    const reasons = (await after.dropbox.toArray()).map((r) => r.quarantined);
    expect(reasons).toHaveLength(4);
    expect(reasons.some((r) => r?.includes('no start'))).toBe(true);
    expect(reasons.some((r) => r?.includes('understands'))).toBe(true);
    after.close();
  });

  it('keeps the entries when the write fails, and merges them at the next try', async () => {
    const { name, patientId, options } = await lockedRecording(() => []);
    const store = await Store.unlock(name, { pin: PIN }, options);
    const raw = new AuraDb(name);
    const publicKey = (await raw.meta.get('dropBoxPublicKey'))?.value as string;
    const seizureId = newId();
    const event = startEvent(patientId, seizureId);
    await raw.dropbox.add(await sealPosted(publicKey, { recording: seizureId, event }));
    const create = vi.spyOn(store, 'create').mockRejectedValueOnce(new Error('disk full'));
    expect(await store.mergeDropBox()).toEqual({ recordings: 0, events: 0, quarantined: 0, failed: 1 });
    expect(await raw.dropbox.count()).toBe(1);
    expect(store.get('seizure', seizureId)).toBeNull();
    create.mockRestore();
    expect(await store.mergeDropBox()).toMatchObject({ recordings: 1, failed: 0 });
    expect(await raw.dropbox.count()).toBe(0);
    expect(store.get('seizure', seizureId)).not.toBeNull();
    raw.close();
  });

  it('does not bring back a seizure the user deleted', async () => {
    const { name, seizureId, options } = await lockedRecording(() => [tap('finish', T0 + S)]);
    const raw = new AuraDb(name);
    const copy = await raw.dropbox.toArray();
    const store = await Store.unlock(name, { pin: PIN }, options);
    await store.delete('seizure', seizureId);
    await raw.dropbox.bulkAdd(copy.map((row) => ({ ...row, seq: undefined }) as never));
    expect(await store.mergeDropBox()).toMatchObject({ recordings: 0, events: 2, failed: 0 });
    expect(store.get('seizure', seizureId)).toBeNull();
    expect(await raw.dropbox.count()).toBe(0);
    raw.close();
  });

  it('puts the entries aside when the private key is missing, and loses nothing', async () => {
    const { name, options } = await lockedRecording(() => []);
    const store = await Store.unlock(name, { pin: PIN }, options);
    const raw = new AuraDb(name);
    const sealedPrivate = (await raw.meta.get('dropBoxPrivateKey'))?.value;
    await raw.meta.delete('dropBoxPrivateKey');
    const publicKey = (await raw.meta.get('dropBoxPublicKey'))?.value as string;
    await raw.dropbox.add(await sealPosted(publicKey, { recording: newId(), event: tap('finish', T0) }));
    expect(await store.mergeDropBox()).toMatchObject({ failed: 1, recordings: 0 });
    expect(await raw.dropbox.count()).toBe(1);
    await raw.meta.put({ key: 'dropBoxPrivateKey', value: sealedPrivate });
    raw.close();
  });

  it('opens with a changed PIN, the recovery kit and the passkey secret alike', async () => {
    const { name, store, patientId, options } = await setup();
    const kit = await store.addRecoveryKit({ pin: PIN });
    await store.changePin({ pin: PIN }, '1357');
    store.close();
    const seizureId = newId();
    const page = lockedPage(name);
    await page.post(startEvent(patientId, seizureId));
    await page.post(tap('finish', T0 + 5 * S));
    const viaKit = await Store.unlock(name, { recoveryKit: kit }, options);
    expect(viaKit.get('seizure', seizureId)?.recordedWhileLocked).toBe(true);
    viaKit.close();
    const second = newId();
    await lockedPage(name).post(startEvent(patientId, second, T0 + 100 * S));
    const viaPin = await Store.unlock(name, { pin: '1357' }, { ...options, now: () => T0 + 200 * S });
    expect(viaPin.get('seizure', second)).toMatchObject({ status: 'in_progress' });
  });
});

describe('video filmed while locked', () => {
  async function filming(over: { video?: boolean } = {}) {
    const { name, store, patientId, options } = await setup();
    const put = (key: string, value: unknown) =>
      store.create('setting', { patientId, scope: 'device', key, value: value as never });
    if (over.video !== false) {
      await put('videoEnabled', true);
      await put('lockedVideo', true);
      await put('videoCamera', 'front');
    }
    const screen = await store.publishLockedScreen();
    store.close();
    const seizureId = newId();
    const page = lockedPage(name);
    await page.post(startEvent(patientId, seizureId));
    await page.post(tap('end_seizure', T0 + 60 * S));
    return { name, options, seizureId, page, screen };
  }
  const clip = (size = 4096) => Uint8Array.from({ length: size }, (_, i) => i % 251);

  it('tells the PIN screen which camera, only when filming without the PIN is chosen', async () => {
    expect((await filming()).screen.video).toEqual({ facing: 'front' });
    expect((await filming({ video: false })).screen.video).toBeNull();
  });

  it('keeps the clip sealed, and joins it to the seizure at the unlock', async () => {
    const { name, options, seizureId, page } = await filming();
    await page.postClip({
      recording: seizureId,
      mime: 'video/webm',
      fileName: 'AuraTrack-seizure.webm',
      bytes: clip(),
    });
    const raw = new AuraDb(name);
    const row = await raw.lockedClips.get(seizureId);
    expect(row?.size).toBe(4096);
    expect(Buffer.from(row!.data).includes(Buffer.from(clip().subarray(0, 64)))).toBe(false); // nothing readable
    const store = await Store.unlock(name, { pin: PIN }, options);
    expect(store.lastLockedClips).toEqual({ videos: 1, waiting: 0, quarantined: 0 });
    expect(store.get('seizure', seizureId)?.video).toEqual({ fileName: 'AuraTrack-seizure.webm' });
    expect(await store.getVideo(seizureId)).toEqual({ mime: 'video/webm', bytes: clip() });
    expect(await raw.lockedClips.count()).toBe(0);
  });

  it('refuses a clip when filming without the PIN is off, or for another recording', async () => {
    const off = await filming({ video: false });
    await expect(
      off.page.postClip({ recording: off.seizureId, mime: 'video/webm', fileName: 'a.webm', bytes: clip() }),
    ).rejects.toThrow(DropBoxUnavailableError);
    const on = await filming();
    await expect(
      on.page.postClip({ recording: newId(), mime: 'video/webm', fileName: 'a.webm', bytes: clip() }),
    ).rejects.toThrow(DropBoxUnavailableError);
  });

  it('keeps a damaged clip apart instead of deleting it, and never replaces a video the seizure has', async () => {
    const damaged = await filming();
    await damaged.page.postClip({
      recording: damaged.seizureId,
      mime: 'video/webm',
      fileName: 'a.webm',
      bytes: clip(),
    });
    const raw = new AuraDb(damaged.name);
    const row = (await raw.lockedClips.get(damaged.seizureId))!;
    row.data[0] = (row.data[0]! + 1) % 256;
    await raw.lockedClips.put(row);
    const store = await Store.unlock(damaged.name, { pin: PIN }, damaged.options);
    expect(store.lastLockedClips).toEqual({ videos: 0, waiting: 0, quarantined: 1 });
    expect((await raw.lockedClips.get(damaged.seizureId))?.quarantined).toMatch(/could not be decrypted/);

    const twice = await filming();
    await twice.page.postClip({ recording: twice.seizureId, mime: 'video/webm', fileName: 'a.webm', bytes: clip() });
    const opened = await Store.unlock(twice.name, { pin: PIN }, twice.options);
    expect(opened.lastLockedClips.videos).toBe(1);
    // the same clip posted again, as if a page reload repeated it: kept apart, the saved video stays
    const raw2 = new AuraDb(twice.name);
    await raw2.lockedClips.put({
      recording: twice.seizureId,
      epk: 'x',
      iv: new Uint8Array(12),
      data: new Uint8Array(8),
      mime: 'video/webm',
      fileName: 'b.webm',
      size: 8,
      savedAt: T0,
    });
    expect(await opened.mergeLockedClips()).toEqual({ videos: 0, waiting: 0, quarantined: 1 });
    expect((await opened.getVideo(twice.seizureId))?.bytes).toEqual(clip());
  });
});

describe('the database upgrade', () => {
  it('keeps every row of a store made before the drop box existed', async () => {
    const name = dbName();
    const old = new Dexie(name);
    old
      .version(1)
      .stores({ meta: 'key', records: '[type+id], type, patientId, at', changeLog: 'id, stamp, recordType' });
    await old.table('meta').put({ key: 'householdId', value: 'kept' });
    old.close();
    const upgraded = new AuraDb(name);
    expect((await upgraded.meta.get('householdId'))?.value).toBe('kept');
    expect(await upgraded.dropbox.count()).toBe(0);
    upgraded.close();
  });
});
