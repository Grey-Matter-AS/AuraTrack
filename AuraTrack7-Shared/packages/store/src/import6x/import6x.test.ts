import 'fake-indexeddb/auto';
import { seizureSeconds, totalSeconds } from '@auratrack/model';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DecryptError, TEST_PIN_KDF } from '../crypto';
import { Store } from '../store';
import { compareImport } from './compare';
import { derivedId } from './ids';
import { import6x } from './import';
import { Legacy6xFormatError, PassphraseNeededError, read6xFile } from './read';
import { legacySeizureSeconds, mapPhases } from './map';
import { encryptedFile, householdFile, makeBackup, makeEvents, plainFile, rng, type Row } from './legacy.fixture';

let n = 0;
const newStore = () => Store.create(`import-${Date.now()}-${n++}`, { pin: '2468' }, { pinKdf: TEST_PIN_KDF });
const TZ = 'Europe/Oslo';
/** The original 6.1 row kept on a record. (store.list() gives schema-checked values, which leave it out.) */
const legacyOf = (store: Store, type: 'seizure', id: string) =>
  store.versioned(type, id)?.fields.legacy?.value as Row | undefined;

describe('reading 6.1 files', () => {
  it('plain, encrypted, household and the old plain list of seizures', async () => {
    const single = await read6xFile(plainFile());
    expect(single).toMatchObject({ kind: 'single', encrypted: false });
    expect(single.patients[0]?.name).toBe('Test Patient');
    expect(single.patients[0]?.tables.events).toHaveLength(24);

    const enc = await read6xFile(await encryptedFile(makeBackup(), 'secret words'), 'secret words');
    expect(enc.encrypted).toBe(true);
    expect(enc.patients[0]?.tables.medications).toHaveLength(3);

    const house = await read6xFile(householdFile());
    expect(house).toMatchObject({ kind: 'household' });
    expect(house.patients.map((p) => [p.profileId, p.name])).toEqual([
      ['p1', 'Alex'],
      ['p2', 'Sam'],
    ]);

    const old = await read6xFile(JSON.stringify(makeEvents(3)));
    expect(old.patients[0]?.tables.events).toHaveLength(3);
    expect(old.patients[0]?.name).toBe('');
    expect((await read6xFile(JSON.stringify({ events: [{ startTime: 1 }] }))).patients[0]?.tables.events).toHaveLength(
      1,
    );
  });

  it('an encrypted household backup works too', async () => {
    const file = await encryptedFile(JSON.parse(householdFile()), 'secret words');
    expect((await read6xFile(file, 'secret words')).kind).toBe('household');
  });

  it('asks for a passphrase, refuses a wrong one, and refuses files that are not backups', async () => {
    const file = await encryptedFile(makeBackup(), 'secret words');
    await expect(read6xFile(file)).rejects.toBeInstanceOf(PassphraseNeededError);
    await expect(read6xFile(file, '')).rejects.toBeInstanceOf(PassphraseNeededError);
    await expect(read6xFile(file, 'wrong words')).rejects.toBeInstanceOf(DecryptError);
    await expect(
      read6xFile(
        await encryptedFile(makeBackup(), 'secret words', 1000).then((f) =>
          f.replace('"iterations":1000', '"iterations":9000000'),
        ),
        'secret words',
      ),
    ).rejects.toBeInstanceOf(DecryptError);
    await expect(read6xFile('not json')).rejects.toBeInstanceOf(Legacy6xFormatError);
    await expect(read6xFile('{"hello":1}')).rejects.toBeInstanceOf(Legacy6xFormatError);
    await expect(read6xFile('42')).rejects.toBeInstanceOf(Legacy6xFormatError);
  });

  it('ignores rows that are not objects, and settings without a key', async () => {
    const file = await read6xFile(
      JSON.stringify({ events: [1, null, { startTime: 5 }], settings: [{ value: 1 }, { key: 'a', value: 2 }, 'x'] }),
    );
    expect(file.patients[0]?.tables.events).toHaveLength(1);
    expect(file.patients[0]?.settings).toEqual([{ key: 'a', value: 2 }]);
  });
});

describe('derived ids', () => {
  it('are valid UUIDs, the same for the same input, different otherwise', async () => {
    const a = await derivedId('h', 'events', 'u1');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await derivedId('h', 'events', 'u1')).toBe(a);
    expect(await derivedId('h', 'events', 'u2')).not.toBe(a);
    expect(await derivedId('h', 'events', 'u1', '')).not.toBe(a);
  });
});

describe("phase marks keep 6.1's seizure time exactly", () => {
  const T = 1_760_000_000_000;
  it('laps: aura, seizure and recovery', () => {
    const e = { startTime: T, duration: 600, laps: { aura: T + 180_000, seizure: T + 300_000, recovery: T + 600_000 } };
    const p = mapPhases(e)!;
    expect([seizureSeconds(p), totalSeconds(p)]).toEqual([120, 600]);
    expect(p.start.source).toBe('timed');
  });

  it('laps without a seizure lap: the recovery lap ends the seizure', () => {
    const p = mapPhases({ startTime: T, duration: 400, laps: { aura: T + 60_000, recovery: T + 400_000 } })!;
    expect(seizureSeconds(p)).toBe(340);
  });

  it('aura only, then the stop', () => {
    const p = mapPhases({ startTime: T, duration: 400, laps: { aura: T + 60_000 } })!;
    expect(seizureSeconds(p)).toBe(340);
    expect(p.recoveryEnd).toBeNull();
  });

  it('manual durations are marked as edited', () => {
    const p = mapPhases({
      startTime: T,
      duration: 900,
      manualDurations: { total: 900, aura: 100, seizure: 200, recovery: 600 },
    })!;
    expect([seizureSeconds(p), totalSeconds(p)]).toEqual([200, 900]);
    expect(p.seizureEnd?.source).toBe('edited');
    const noAura = mapPhases({ startTime: T, manualDurations: { seizure: 50, aura: 0, recovery: 0 } })!;
    expect([noAura.auraEnd, seizureSeconds(noAura), noAura.recoveryEnd]).toEqual([null, 50, null]);
  });

  it('a plain total, and a manual entry entered later', () => {
    const p = mapPhases({ startTime: T, duration: 90, isManualEntry: true })!;
    expect(seizureSeconds(p)).toBe(90);
    expect(p.start.source).toBe('entered-later');
    expect(seizureSeconds(mapPhases({ startTime: T })!)).toBe(0);
  });

  it('refuses an event with no start', () => {
    expect(mapPhases({ duration: 5 })).toBeNull();
  });

  it('equals 6.1 for any combination of laps, manual durations and totals (property test)', () => {
    const T0 = 1_760_000_000_000;
    const maybe = (a: fc.Arbitrary<number>) => fc.option(a, { nil: undefined });
    fc.assert(
      fc.property(
        fc.record({
          duration: maybe(fc.integer({ min: 0, max: 3000 })),
          aura: maybe(fc.integer({ min: 0, max: 600 })),
          seizure: maybe(fc.integer({ min: 0, max: 900 })),
          recovery: maybe(fc.integer({ min: 0, max: 1200 })),
          lapAura: maybe(fc.integer({ min: 1, max: 600 })),
          lapSeizure: maybe(fc.integer({ min: 1, max: 1500 })),
          lapRecovery: maybe(fc.integer({ min: 1, max: 3000 })),
          useManual: fc.boolean(),
          useLaps: fc.boolean(),
        }),
        (g) => {
          const event: Row = { startTime: T0, duration: g.duration };
          if (g.useManual)
            event.manualDurations = { total: g.duration, aura: g.aura, seizure: g.seizure, recovery: g.recovery };
          if (g.useLaps)
            event.laps = {
              aura: g.lapAura && T0 + g.lapAura * 1000,
              seizure: g.lapSeizure && T0 + g.lapSeizure * 1000,
              recovery: g.lapRecovery && T0 + g.lapRecovery * 1000,
            };
          const phases = mapPhases(JSON.parse(JSON.stringify(event)))!;
          expect(seizureSeconds(phases) ?? 0).toBe(legacySeizureSeconds(JSON.parse(JSON.stringify(event))));
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('importing', () => {
  it('imports every record, accounts for each row, and maps English to codes', async () => {
    const store = await newStore();
    const { report } = await import6x(store, plainFile(), { timeZone: TZ });
    expect(report.unaccounted).toBe(0);
    expect(report.file).toEqual({ kind: 'single', encrypted: false, patients: 1 });
    const p = report.patients[0]!;
    expect(p.tables.events).toEqual({ found: 24, imported: 24, rejected: 0 });
    expect(p.tables.medications).toEqual({ found: 3, imported: 3, rejected: 0 });
    expect(p.tables.medicationLogs).toEqual({ found: 40, imported: 40, rejected: 0 });
    expect(p.tables.wellbeingEntries).toEqual({ found: 10, imported: 10, rejected: 0 });
    expect(p.tables.eegSessions).toEqual({ found: 1, imported: 1, rejected: 0 });
    // the ghost change, the orphan activity and the nonsense tombstone are rejected with a reason
    expect(p.rejected.map((r) => `${r.table}: ${r.reason}`).sort()).toEqual([
      'eegActivities: its session is not in the backup',
      'medicationChanges: its medication is not in the backup',
      'tombstones: not a valid deletion',
    ]);
    expect(store.list('seizure')).toHaveLength(24);
    expect(store.list('patient')).toMatchObject([
      { name: 'Test Patient', dateOfBirth: '1995-04-12', emergencyContact: '+47 123' },
    ]);
    expect(store.incomplete()).toEqual([]);
  });

  it('turns English text into codes, keeps what is not in the catalogue as own codes, and lists them for review', async () => {
    const store = await newStore();
    const { report } = await import6x(store, plainFile(), { timeZone: TZ });
    const all = store.list('seizure');
    expect(all.some((s) => s.symptoms.some((x) => x.code === 'symptom.eyes.rapid_blinking'))).toBe(true);
    expect(all.every((s) => s.typeCode?.startsWith('seizure_type.'))).toBe(true);
    expect(all.some((s) => s.triggerCodes.includes('trigger.stress'))).toBe(true);
    expect(all.flatMap((s) => s.afterFindings.map((f) => f.code))).toEqual(
      expect.arrayContaining(['after.drowsy', 'after.headache', 'after.custom', 'after.paralysis', 'after.weakness']),
    );
    const reviewed = Object.fromEntries(report.review.map((r) => [`${r.kind}:${r.text}`, r]));
    expect(reviewed['symptom:Eyes: Staring']?.keptAs).toMatch(/^custom\./);
    expect(reviewed['trigger:Poor sleep']).toBeTruthy();
    expect(reviewed['finding:Muscle soreness']?.keptAs).toBe('after.custom');
    expect(reviewed['mood:Tired and flat']).toBeTruthy();
    expect(reviewed['factor:Hydration']).toBeTruthy();
    // an own code is a record with its label
    const customs = store.list('customCode');
    expect(customs.length).toBe(report.customCodes);
    expect(customs.find((c) => c.label === 'Poor sleep')).toMatchObject({ kind: 'trigger' });
    // a symptom's body area is carried as codes
    const withArea = all.flatMap((s) => s.symptoms).find((x) => x.code === 'symptom.movement.jerking' || x.area);
    expect(withArea).toBeTruthy();
  });

  it('keeps the whole original 6.1 row on every record, so nothing can be lost', async () => {
    const store = await newStore();
    await import6x(store, plainFile(), { timeZone: TZ });
    const raw = store.versioned('seizure', store.list('seizure')[0]!.id)!;
    const legacy = raw.fields.legacy!.value as Row;
    expect(legacy).toMatchObject({ uuid: expect.stringMatching(/^ev-/), editLog: expect.any(Array) });
    expect(store.list('seizure').find((s) => s.video !== null)).toBeTruthy();
  });

  it('a deleted medication is kept as a stopped one, and 6.1 deletions stay deleted', async () => {
    const store = await newStore();
    const file = makeBackup();
    (file.data as { tombstones: Row[] }).tombstones.push({ uuid: 'ev-1', table: 'events', deletedAt: 5 });
    await import6x(store, JSON.stringify(file), { timeZone: TZ });
    const old = store.list('medication').find((m) => m.name === 'Old drug')!;
    expect(old).toMatchObject({ active: false, stoppedAt: expect.any(Number) });
    expect(store.list('seizure').some((s) => legacyOf(store, 'seizure', s.id)?.uuid === 'ev-1')).toBe(false);
    expect(store.allVersioned().some((r) => r.type === 'seizure' && r.deletedAt !== null)).toBe(true);
  });

  it('links records through their 6.1 uuids', async () => {
    const store = await newStore();
    await import6x(store, plainFile(), { timeZone: TZ });
    const lev = store.list('medication').find((m) => m.name === 'Levetiracetam')!;
    expect(store.list('doseLog').every((l) => l.medicationId === lev.id)).toBe(true);
    expect(store.list('medicationChange').every((c) => c.medicationId === lev.id)).toBe(true);
    const session = store.list('eegSession')[0]!;
    const ref = store.list('eegActivity').find((a) => a.kind === 'seizure_reference')!;
    expect(ref.sessionId).toBe(session.id);
    expect(ref.linkedSeizureId).toBe(
      store.list('seizure').find((s) => legacyOf(store, 'seizure', s.id)?.uuid === 'ev-0')!.id,
    );
    expect(ref.activityCode).toBe('seizure_type.focal_aware');
  });

  it("settings: device ones apart from the patient's", async () => {
    const store = await newStore();
    await import6x(store, plainFile(), { timeZone: TZ });
    const settings = Object.fromEntries(store.list('setting').map((s) => [s.key, s.scope]));
    expect(settings).toEqual({ language: 'device', emergencyAlertMinutes: 'patient', neurologistName: 'patient' });
  });

  it('is safe to run twice: the second time adds nothing', async () => {
    const store = await newStore();
    const first = await import6x(store, plainFile(), { timeZone: TZ });
    const logLength = (await store.changesSince()).length;
    const second = await import6x(store, plainFile(), { timeZone: TZ });
    expect(second.report.applied).toBe(0);
    expect(second.report.duplicates).toBe(first.report.applied);
    expect((await store.changesSince()).length).toBe(logLength);
  });

  it('reads an encrypted backup, and says that the time zone was assumed', async () => {
    const store = await newStore();
    const { report } = await import6x(store, await encryptedFile(makeBackup(), 'secret words'), {
      passphrase: 'secret words',
    });
    expect(report.file.encrypted).toBe(true);
    expect(report.timeZoneAssumed).toBe(true);
    expect(store.list('seizure')[0]?.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect((await import6x(await newStore(), plainFile(), { timeZone: TZ })).report.timeZoneAssumed).toBe(false);
  });

  it('an all-patients backup becomes several patients in one household', async () => {
    const store = await newStore();
    const { report } = await import6x(store, householdFile(), { timeZone: TZ });
    expect(report.patients.map((p) => p.name)).toEqual(['Alex', 'Sam']);
    const patients = store.list('patient');
    expect(patients.map((p) => p.name).sort()).toEqual(['Alex', 'Sam']);
    expect(store.list('seizure')).toHaveLength(10);
    for (const p of patients)
      expect(store.list('seizure', (s) => s.patientId === p.id).length).toBe(p.name === 'Alex' ? 6 : 4);
    expect(report.unaccounted).toBe(0);
  });

  it('rejects an invalid row with its reason and imports the rest', async () => {
    const store = await newStore();
    const file = makeBackup();
    const data = file.data as { events: Row[]; medications: Row[]; wellbeingEntries: Row[] };
    data.events.push({ uuid: 'bad-1', duration: 5 }); // no start
    data.medications.push({ uuid: 'bad-med', name: '   ' });
    data.medications.push({ uuid: 'weird-freq', name: 'Odd', dose: 1, unit: 'mg', frequency: 'WEEKLY' });
    data.wellbeingEntries.push({ uuid: 'bad-wb', recordedAt: 5, primaryMood: '' });
    const { report } = await import6x(store, JSON.stringify(file), { timeZone: TZ });
    const reasons = report.patients[0]!.rejected.map((r) => `${r.table}: ${r.reason}`);
    expect(reasons).toEqual(
      expect.arrayContaining(['events: no start time', 'medications: no name', 'wellbeingEntries: no mood']),
    );
    expect(reasons.some((r) => r.startsWith('medications: frequency'))).toBe(true);
    expect(report.unaccounted).toBe(0);
    expect(store.list('seizure')).toHaveLength(24);
  });

  it('a seizure type 6.1 did not have is kept in the notes and listed', async () => {
    const store = await newStore();
    const file = makeBackup({ events: 1 });
    (file.data as { events: Row[] }).events[0]!.type = 'Gelastic';
    const { report } = await import6x(store, JSON.stringify(file), { timeZone: TZ });
    const seizure = store.list('seizure')[0]!;
    expect(seizure.typeCode).toBeNull();
    expect(seizure.notes).toContain('Gelastic');
    expect(report.review.find((r) => r.kind === 'seizure_type')?.text).toBe('Gelastic');
  });

  it('never loses a record, whatever the rows look like (property test)', async () => {
    const rowArb = fc.record(
      {
        uuid: fc.option(fc.string({ maxLength: 6 }), { nil: undefined }),
        startTime: fc.option(
          fc.oneof(fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }), fc.constant('x'), fc.constant(null)),
          { nil: undefined },
        ),
        duration: fc.option(fc.oneof(fc.integer({ min: 0, max: 2000 }), fc.constant('9')), { nil: undefined }),
        type: fc.option(fc.constantFrom('Focal Aware', 'Gelastic', '', 'Tonic-Clonic'), { nil: undefined }),
        symptoms: fc.option(
          fc.array(
            fc.oneof(
              fc.record({ symptom: fc.string({ maxLength: 8 }), detail: fc.string({ maxLength: 8 }) }),
              fc.constant(5),
              fc.constant(null),
            ),
          ),
          { nil: undefined },
        ),
        triggers: fc.option(fc.array(fc.oneof(fc.string({ maxLength: 6 }), fc.constant(3))), { nil: undefined }),
        postIctal: fc.option(
          fc.oneof(
            fc.constant(null),
            fc.record({
              findings: fc.array(
                fc.oneof(
                  fc.string({ maxLength: 6 }),
                  fc.record({ key: fc.constantFrom('custom', 'weakness', 'zzz'), label: fc.string({ maxLength: 5 }) }),
                ),
              ),
            }),
          ),
          { nil: undefined },
        ),
      },
      { requiredKeys: [] },
    );
    await fc.assert(
      fc.asyncProperty(fc.array(rowArb, { maxLength: 12 }), async (events) => {
        const store = await newStore();
        const { report } = await import6x(store, JSON.stringify({ events }), { timeZone: TZ });
        const found = report.patients[0]?.tables.events?.found ?? 0;
        const imported = report.patients[0]?.tables.events?.imported ?? 0;
        const rejected = report.patients[0]?.tables.events?.rejected ?? 0;
        expect(found).toBe(events.length);
        expect(imported + rejected).toBe(found);
        expect(report.unaccounted).toBe(0);
        expect(store.list('seizure')).toHaveLength(imported);
        store.close();
      }),
      { numRuns: 25 },
    );
  }, 120_000);
});

describe('comparison report', () => {
  it('matches 6.1 on every number for a clean import', async () => {
    const store = await newStore();
    const { legacy, report: imported } = await import6x(store, plainFile(), { timeZone: TZ });
    const report = await compareImport(store, legacy, imported);
    expect(report.mismatches).toEqual([]);
    expect(report.allMatch).toBe(true);
    expect(report.seizureTimeDifferences).toEqual([]);
    const sections = new Set(report.rows.map((r) => r.section));
    expect(sections).toEqual(
      new Set([
        'records',
        'seizures per month',
        'durations',
        'emergency plan',
        'medication changes',
        'doses per month',
      ]),
    );
    expect(report.rows.find((r) => r.metric === 'seizures')).toMatchObject({ v6: 24, v7: 24 });
    // what was rejected is visible beside the numbers, never hidden
    expect(report.rows.find((r) => r.metric.startsWith('rows rejected'))).toMatchObject({ v6: 3, match: true });
  });

  it('is exact for a larger random history, and for several patients', async () => {
    const store = await newStore();
    const { legacy, report: imported } = await import6x(store, householdFile(), { timeZone: TZ });
    const report = await compareImport(store, legacy, imported);
    expect(report.allMatch).toBe(true);
    expect(new Set(report.rows.map((r) => r.patient))).toEqual(new Set(['Alex', 'Sam']));
  });

  it('shows where the numbers differ, if the imported data is changed', async () => {
    const store = await newStore();
    const { legacy, report: imported } = await import6x(store, plainFile(), { timeZone: TZ });
    const victim = store.list('seizure')[0]!;
    await store.delete('seizure', victim.id);
    const report = await compareImport(store, legacy, imported);
    expect(report.allMatch).toBe(false);
    expect(report.mismatches.map((m) => m.metric)).toEqual(expect.arrayContaining(['seizures']));
  });

  it('lists a seizure whose time differs, with both numbers', async () => {
    const store = await newStore();
    const { legacy, report: imported } = await import6x(store, plainFile(), { timeZone: TZ });
    const target = store.list('seizure').find((s) => s.phases.seizureEnd)!;
    await store.update('seizure', target.id, {
      phases: { ...target.phases, seizureEnd: { at: target.phases.seizureEnd!.at + 5000, source: 'edited' } },
    });
    const report = await compareImport(store, legacy, imported);
    expect(report.seizureTimeDifferences).toHaveLength(1);
    expect(report.seizureTimeDifferences[0]).toMatchObject({ patient: 'Test Patient' });
    expect(report.allMatch).toBe(false);
  });

  it('handles events without a uuid, and the 6.1 random generator is repeatable', async () => {
    expect(rng(5)()).toBe(rng(5)());
    const store = await newStore();
    const file = makeBackup({ events: 4 });
    for (const e of (file.data as { events: Row[] }).events) delete e.uuid;
    const { legacy, report } = await import6x(store, JSON.stringify(file), { timeZone: TZ });
    expect(report.unaccounted).toBe(0);
    expect((await compareImport(store, legacy, report)).allMatch).toBe(true);
  });
});
