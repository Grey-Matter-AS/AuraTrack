import 'fake-indexeddb/auto';
import { CSV_SECTIONS, newId, type CsvSection } from '@auratrack/model';
import { medicationFixture, stripBase } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { TEST_PIN_KDF } from './crypto';
import { checkCsvImport, detectDelimiter, importCsv, parseCsvRows, type CsvImportOptions } from './importCsv';
import { Store } from './store';

// The CSV import, on a real store in memory: the export's format read back, checked first, nothing guessed, nothing doubled.

let counter = 0;
async function setup() {
  const store = await Store.create(`csv-${Date.now()}-${counter++}`, { pin: '2468' }, { pinKdf: TEST_PIN_KDF });
  const patientId = newId();
  await store.create('patient', {
    id: patientId,
    patientId,
    name: 'Alex Example',
    dateOfBirth: null,
    emergencyContact: '',
    color: '#336699',
  });
  const options: CsvImportOptions = {
    patientId,
    dateOrder: 'dmy',
    timeZone: 'Europe/Oslo',
    now: Date.UTC(2026, 10, 3, 12),
  };
  return { store, patientId, options };
}

/** A file in the export's format: a block per section, with only the columns given filled in. */
function file(blocks: Partial<Record<CsvSection, Record<string, string>[]>>, delimiter = ','): string {
  const quote = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return Object.entries(blocks)
    .map(([section, rows]) => {
      const head = CSV_SECTIONS[section as CsvSection];
      return [
        section,
        head.join(delimiter),
        ...rows!.map((r) => head.map((c) => quote(r[c] ?? '')).join(delimiter)),
      ].join('\n');
    })
    .join('\n\n');
}

const at = (y: number, m: number, d: number, h: number, mi: number) => new Date(y, m - 1, d, h, mi).getTime();

describe('reading the file', () => {
  it('reads quoted cells with commas, quotes and new lines, and a byte-order mark', () => {
    const rows = parseCsvRows('﻿a,"b, ""c""\nd",e\r\nf,g', ',');
    expect(rows.map((r) => r.cells)).toEqual([
      ['﻿a', 'b, "c"\nd', 'e'],
      ['f', 'g'],
    ]);
    expect(rows.map((r) => r.line)).toEqual([1, 3]);
  });

  it('finds the separator a spreadsheet used: semicolons in most European languages', () => {
    expect(detectDelimiter('SEIZURES\nid;date;time\n;2026-01-02;10:00')).toBe(';');
    expect(detectDelimiter('SEIZURES\nid,date,time\n,2026-01-02,10:00')).toBe(',');
  });
});

describe('seizures', () => {
  it('checks first and writes nothing, then brings the seizure in with codes, areas and phases', async () => {
    const { store, options } = await setup();
    const text = file({
      SEIZURES: [
        {
          date: '2026-10-05',
          time: '14:05',
          type: 'Absens', // the Norwegian name is enough when the code column is empty
          seizureSeconds: '90',
          totalSeconds: '600',
          symptomCodes:
            'symptom.small_twitching.muscle_flickering@body.head_and_face/body.head_and_face.eyes#during|symptom.skin_and_temperature.face_flushing_red',
          triggerCodes: 'trigger.stress',
          afterFindingCodes: 'after.confused|after.custom',
          afterFindings: 'Confused|Very sleepy',
          notes: 'From the paper diary, "evening"',
        },
      ],
    });
    const check = await checkCsvImport(store, text, options);
    expect(check.totals).toEqual({ found: 1, ready: 1, duplicates: 0, rejected: 0 });
    expect(check.examples).toEqual([{ section: 'SEIZURES', line: 3, read: '2026-10-05 14:05' }]);
    expect(store.list('seizure')).toHaveLength(0);

    const done = await importCsv(store, text, options);
    expect(done.applied).toBe(1);
    const [s] = store.list('seizure');
    const start = at(2026, 10, 5, 14, 5);
    expect(s).toMatchObject({
      typeCode: 'seizure_type.absence',
      status: 'recorded',
      isManualEntry: true,
      timeZone: 'Europe/Oslo',
      phases: {
        start: { at: start, source: 'entered-later' },
        auraEnd: null,
        seizureEnd: { at: start + 90_000, source: 'entered-later' },
        recoveryEnd: { at: start + 600_000, source: 'entered-later' },
      },
      triggerCodes: ['trigger.stress'],
      afterFindings: [
        { code: 'after.confused', customLabel: null, areas: [] },
        { code: 'after.custom', customLabel: 'Very sleepy', areas: [] },
      ],
      notes: 'From the paper diary, "evening"',
    });
    expect(s?.symptoms[0]).toMatchObject({
      code: 'symptom.small_twitching.muscle_flickering',
      area: { region: 'body.head_and_face', subRegion: 'body.head_and_face.eyes', part: null },
      phase: 'during',
      isFirst: true,
    });
  });

  it('adds nothing the second time, and leaves out a row at the same minute as a seizure already there', async () => {
    const { store, options } = await setup();
    const text = file({ SEIZURES: [{ date: '2026-10-05', time: '14:05', seizureSeconds: '60' }] });
    await importCsv(store, text, options);
    const again = await importCsv(store, text, options);
    expect(again.totals).toMatchObject({ found: 1, ready: 0, duplicates: 1 });
    expect(again.applied).toBe(0);
    expect(store.list('seizure')).toHaveLength(1);
  });

  it('reads dates the way the date setting says, and refuses one that could be read two ways', async () => {
    const { store, options } = await setup();
    const text = file({ SEIZURES: [{ date: '03/04/2026', time: '2:05 PM', seizureSeconds: '30' }] });
    expect((await checkCsvImport(store, text, options)).examples[0]?.read).toBe('2026-04-03 14:05');
    expect((await checkCsvImport(store, text, { ...options, dateOrder: 'mdy' })).examples[0]?.read).toBe(
      '2026-03-04 14:05',
    );
    const ymd = await checkCsvImport(store, text, { ...options, dateOrder: 'ymd' });
    expect(ymd.problems[0]?.reason).toMatch(/could be read two ways/);
    const dotted = file({ SEIZURES: [{ date: '05.10.2026', time: '14.05', seizureSeconds: '30' }] });
    expect((await checkCsvImport(store, dotted, options)).examples[0]?.read).toBe('2026-10-05 14:05');
  });

  it('rejects a row it cannot read exactly, with the line and the reason, and still takes the others', async () => {
    const { store, options } = await setup();
    const text = file({
      SEIZURES: [
        { date: '2026-10-05', time: '14:05', seizureSeconds: '60' },
        { date: '2026-10-06', time: '09:00', typeCode: 'seizure_type.made_up' },
        { date: '2026-10-07', time: '09:00', seizureEnd: '2026-10-07 08:00' },
        { date: '2026-10-08', time: '09:00', status: 'in_progress' },
        { date: '2026-02-30', time: '09:00' },
        { date: '2026-10-09', time: '09:00', symptoms: 'Not a symptom at all' },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.totals).toEqual({ found: 6, ready: 1, duplicates: 0, rejected: 5 });
    expect(report.unaccounted).toBe(0);
    expect(report.problems.map((p) => p.line)).toEqual([4, 5, 6, 7, 8]);
    expect(report.problems.map((p) => p.reason)).toEqual([
      expect.stringMatching(/typeCode: "seizure_type.made_up" is not a known code/),
      expect.stringMatching(/not in order/),
      expect.stringMatching(/unfinished recording/),
      expect.stringMatching(/not a real date/),
      expect.stringMatching(/not a name the app knows/),
    ]);
    expect(store.list('seizure')).toHaveLength(1);
  });

  it('reads a file saved with semicolons and decimal commas', async () => {
    const { store, options } = await setup();
    const text = file(
      {
        SEIZURES: [{ date: '2026-10-05', time: '14:05', seizureSeconds: '60' }],
        MEDICATIONS: [{ name: 'Lamotrigine', dose: '12,5', unit: 'mg', frequency: 'OD', scheduledTimes: '08:00' }],
      },
      ';',
    );
    const report = await importCsv(store, text, options);
    expect(report.delimiter).toBe(';');
    expect(report.totals.ready).toBe(2);
    expect(store.list('medication')[0]?.dose).toBe(12.5);
  });

  it('keeps the CSV row with each record, and lists a block it does not know', async () => {
    const { store, options } = await setup();
    const text = `${file({ SEIZURES: [{ date: '2026-10-05', time: '14:05', seizureSeconds: '60' }] })}\n\nSOMETHING_ELSE\na,b\n1,2`;
    const report = await importCsv(store, text, options);
    expect(report.unknownSections).toEqual(['SOMETHING_ELSE']);
    const raw = (await store.changesSince(null)).find((e) => e.recordType === 'seizure');
    expect((raw?.fields as { legacy?: { csv?: Record<string, string> } }).legacy?.csv?.date).toBe('2026-10-05');
  });
});

describe('medicines, their changes and doses', () => {
  it('replays the changes through the medicine rules, so the history and the medicine agree', async () => {
    const { store, options } = await setup();
    const text = file({
      MEDICATIONS: [
        {
          id: 'm1',
          name: 'Lamotrigine',
          dose: '150',
          unit: 'mg',
          frequency: 'BD',
          scheduledTimes: '08:00|20:00',
          active: 'true',
        },
      ],
      MEDICATION_CHANGES: [
        {
          medicationId: 'm1',
          type: 'started',
          effectiveAt: '2026-01-01 08:00',
          name: 'Lamotrigine',
          dose: '100',
          unit: 'mg',
          frequency: 'BD',
          scheduledTimes: '08:00|20:00',
        },
        { medicationId: 'm1', type: 'changed', effectiveAt: '2026-03-01 08:00', dose: '150', note: 'Raised' },
      ],
      MEDICATION_LOGS: [
        { medication: 'Lamotrigine', takenAt: '2026-10-05 08:10', scheduledTime: '08:00', status: 'taken' },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.sections.MEDICATIONS).toMatchObject({ ready: 1 });
    expect(report.sections.MEDICATION_CHANGES).toMatchObject({ found: 2, ready: 2 });
    expect(report.sections.MEDICATION_LOGS).toMatchObject({ ready: 1 });
    const [med] = store.list('medication');
    expect(med).toMatchObject({ name: 'Lamotrigine', dose: 150, active: true, startedAt: at(2026, 1, 1, 8, 0) });
    const changes = store.list('medicationChange').sort((a, b) => a.effectiveAt - b.effectiveAt);
    expect(changes.map((c) => [c.type, c.from?.dose ?? null, c.to?.dose ?? null, c.medicationId])).toEqual([
      ['started', null, 100, med?.id],
      ['changed', 100, 150, med?.id],
    ]);
    expect(store.list('doseLog')[0]).toMatchObject({ medicationId: med?.id, status: 'taken', doseSnapshot: 150 });
  });

  it('a medicine with no changes is started (and stopped) from its own row', async () => {
    const { store, options } = await setup();
    const text = file({
      MEDICATIONS: [
        {
          name: 'Valproate',
          dose: '500',
          unit: 'mg',
          frequency: 'OD',
          scheduledTimes: '08:00',
          active: 'false',
          startedAt: '2025-01-01 08:00',
          stoppedAt: '2025-06-01 08:00',
        },
      ],
    });
    await importCsv(store, text, options);
    expect(store.list('medication')[0]).toMatchObject({ active: false, stoppedAt: at(2025, 6, 1, 8, 0) });
    expect(
      store
        .list('medicationChange')
        .map((c) => c.type)
        .sort(),
    ).toEqual(['started', 'stopped']);
  });

  it('refuses changes that do not end where the medicine is, and those for a medicine already in the app', async () => {
    const { store, patientId, options } = await setup();
    await store.create('medication', { ...stripBase(medicationFixture({ patientId, name: 'Clobazam' })) });
    const text = file({
      MEDICATIONS: [
        { id: 'm1', name: 'Lamotrigine', dose: '200', unit: 'mg', frequency: 'OD', scheduledTimes: '08:00' },
      ],
      MEDICATION_CHANGES: [
        {
          medicationId: 'm1',
          type: 'started',
          effectiveAt: '2026-01-01 08:00',
          name: 'Lamotrigine',
          dose: '100',
          unit: 'mg',
          frequency: 'OD',
          scheduledTimes: '08:00',
        },
        { medication: 'Clobazam', type: 'changed', effectiveAt: '2026-02-01 08:00', dose: '20' },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.problems.map((p) => p.reason)).toEqual([
      expect.stringMatching(/do not end at the dose/),
      expect.stringMatching(/made in Medicines/),
    ]);
    expect(report.unaccounted).toBe(0);
    // the medicine itself still comes in, from its own row
    expect(store.list('medication').find((m) => m.name === 'Lamotrigine')).toMatchObject({ dose: 200 });
  });
});

describe('between seizures, wellbeing and the EEG diary', () => {
  it('brings each in, and ties EEG activities to their session and to a seizure in the same file', async () => {
    const { store, options } = await setup();
    const seizureId = newId();
    const text = file({
      SEIZURES: [{ id: seizureId, date: '2026-10-05', time: '23:30', seizureSeconds: '40' }],
      BETWEEN_SEIZURES: [
        {
          date: '2026-10-04',
          time: '10:00',
          symptomCode: 'symptom.small_twitching.muscle_flickering',
          areaCode: 'body.head_and_face',
          notes: 'Morning',
        },
      ],
      WELLBEING_ENTRIES: [
        {
          recordedAt: '2026-10-04 21:00',
          moodCode: 'mood.happy',
          intensity: '2',
          factorCodes: 'factor.sleep_hours=7,5|factor.sleep_quality=3',
        },
      ],
      EEG_SESSIONS: [{ id: 'e1', startTime: '2026-10-05 20:00', durationPreset: '24h', title: 'Night EEG' }],
      EEG_ACTIVITIES: [
        { sessionId: 'e1', kind: 'activity', activityCode: 'activity.sleeping', startTime: '2026-10-05 22:00' },
        { sessionId: 'e1', kind: 'seizure_reference', startTime: '2026-10-05 23:30', linkedSeizureId: seizureId },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.problems).toEqual([]);
    expect(report.totals).toMatchObject({ found: 6, ready: 6 });
    expect(store.list('interictalEvent')[0]).toMatchObject({
      area: { region: 'body.head_and_face', subRegion: null, part: null },
    });
    expect(store.list('wellbeingEntry')[0]).toMatchObject({
      dayKey: '2026-10-04',
      factors: { 'factor.sleep_hours': 7.5 },
    });
    const [session] = store.list('eegSession');
    const activities = store.list('eegActivity');
    expect(activities.every((a) => a.sessionId === session?.id)).toBe(true);
    expect(activities.find((a) => a.kind === 'seizure_reference')?.linkedSeizureId).toBe(seizureId);
  });

  it('refuses an activity for a session that is nowhere', async () => {
    const { store, options } = await setup();
    const text = file({ EEG_ACTIVITIES: [{ sessionId: 'nope', startTime: '2026-10-05 22:00' }] });
    expect((await checkCsvImport(store, text, options)).problems[0]?.reason).toMatch(/no EEG session "nope"/);
  });
});

describe('every row it cannot read is named, with its reason', () => {
  const reasons = async (text: string, extra: Partial<CsvImportOptions> = {}) => {
    const { store, options } = await setup();
    const report = await checkCsvImport(store, text, { ...options, ...extra });
    expect(report.unaccounted).toBe(0);
    return report.problems.map((p) => p.reason);
  };

  it('times, dates, numbers and words in seizure rows', async () => {
    const ok = { date: '2026-10-05', time: '14:05' };
    const text = file({
      SEIZURES: [
        { date: 'yesterday', time: '14:05' },
        { date: '2026-10-05', time: 'noon' },
        { date: '2026-10-05', time: '13:00 PM' },
        { date: '2026-10-05', time: '24:30' },
        { date: '', time: '14:05' },
        { ...ok, seizureSeconds: '1.5' },
        { ...ok, seizureSeconds: 'about a minute' },
        { ...ok, autoStopped: 'maybe' },
        { ...ok, notes: 'x'.repeat(5001) },
        { ...ok, auraEnd: '14:06' },
        { ...ok, symptoms: 'Muscle Flickering (left arm)' },
        { ...ok, afterFindingCodes: 'after.custom' },
        { ...ok, recordedBy: 'nurse' },
        { ...ok, symptomCodes: 'symptom.small_twitching.muscle_flickering@body.tail' },
        { ...ok, symptomCodes: 'symptom.not_a_symptom' },
      ],
    });
    expect(await reasons(text)).toEqual([
      expect.stringMatching(/date: "yesterday" is not a date/),
      expect.stringMatching(/time: "noon" is not a time/),
      expect.stringMatching(/time: "13:00 PM" is not a time/),
      expect.stringMatching(/time: "24:30" is not a time/),
      expect.stringMatching(/date: is empty/),
      expect.stringMatching(/seizureSeconds: 1.5 is not a whole number/),
      expect.stringMatching(/seizureSeconds: "about a minute" is not a number/),
      expect.stringMatching(/autoStopped: "maybe" is not yes or no/),
      expect.stringMatching(/notes: longer than 5000/),
      expect.stringMatching(/auraEnd: "14:06" needs a date and a time/),
      expect.stringMatching(/write the body area in symptomCodes/),
      expect.stringMatching(/words for your own finding are missing/),
      expect.stringMatching(/recordedBy: "nurse" is not one of carer, self/),
      expect.stringMatching(/"body.tail" is not a body area/),
      expect.stringMatching(/"symptom.not_a_symptom" is not a known code/),
    ]);
  });

  it('a line outside any block, and the rows of a block it does not know', async () => {
    const text = `1,2,3\n\n${file({ SEIZURES: [{ date: '2026-10-05', time: '14:05' }] })}\n\nOLD_STUFF\na,b\n1,2`;
    const { store, options } = await setup();
    const report = await checkCsvImport(store, text, options);
    expect(report.problems).toEqual([
      { section: 'file', line: 1, reason: expect.stringMatching(/not under a block title/) },
    ]);
    expect(report.unknownSections).toEqual(['OLD_STUFF']);
    expect(report.totals).toMatchObject({ found: 1, ready: 1 });
  });

  it('medicines, changes and doses', async () => {
    const med = { name: 'Lamotrigine', dose: '100', unit: 'mg', frequency: 'BD', scheduledTimes: '08:00|20:00' };
    const text = file({
      MEDICATIONS: [
        { ...med, id: 'm1' },
        { ...med, id: 'm2', name: 'Levetiracetam', frequency: 'every now and then' },
        { ...med, id: 'm3', name: 'Topiramate', scheduledDays: '7' },
        { ...med, id: 'm4', name: 'Zonisamide', slotDoses: '08:00=lots' },
        { ...med, id: 'm5', name: '' },
        { ...med, id: 'm6', name: 'Perampanel' },
      ],
      MEDICATION_CHANGES: [
        { medicationId: 'm6', type: 'changed', effectiveAt: '2026-02-01 08:00', dose: '150' },
        { medicationId: 'm2', type: 'started', effectiveAt: '2026-02-01 08:00' },
      ],
      MEDICATION_LOGS: [
        { medication: 'Nothing like it', takenAt: '2026-10-05 08:10', status: 'taken' },
        { medicationId: 'm1', takenAt: '', status: 'taken' },
        { medicationId: 'm1', takenAt: '2026-10-05 08:10', status: 'gulped' },
      ],
    });
    expect(await reasons(text)).toEqual([
      expect.stringMatching(/frequency: "every now and then" is not one of/),
      expect.stringMatching(/scheduledDays: "7" is not 0 to 6/),
      expect.stringMatching(/slotDoses: "08:00=lots" is not a time=dose pair/),
      expect.stringMatching(/the name is empty/),
      expect.stringMatching(/the first change of Perampanel must be its start/),
      expect.stringMatching(/could not be brought in/),
      expect.stringMatching(/no medicine "Nothing like it"/),
      expect.stringMatching(/takenAt: is empty/),
      expect.stringMatching(/status: "gulped" is not one of/),
    ]);
  });

  it('two medicines with the same name in the app need the id', async () => {
    const { store, patientId, options } = await setup();
    for (const dose of [10, 20])
      await store.create('medication', { ...stripBase(medicationFixture({ patientId, name: 'Clobazam', dose })) });
    const text = file({
      MEDICATION_LOGS: [{ medication: 'Clobazam', takenAt: '2026-10-05 08:10', status: 'taken' }],
    });
    const report = await checkCsvImport(store, text, options);
    expect(report.problems[0]?.reason).toMatch(/more than one medicine is called "Clobazam"; use medicationId/);
  });

  it('wellbeing and the EEG diary', async () => {
    const seizureId = newId();
    const text = file({
      WELLBEING_ENTRIES: [
        { recordedAt: '', moodCode: 'mood.happy' },
        { recordedAt: '2026-10-04 21:00' },
        { recordedAt: '2026-10-04 22:00', moodCode: 'mood.happy', factorCodes: 'factor.sleep_hours' },
        { recordedAt: '2026-10-04 23:00', moodCode: 'mood.happy', factorCodes: 'factor.sleep_hours=lots' },
        { recordedAt: '2026-10-05 07:00', moodCode: 'mood.happy', intensity: '5' },
      ],
      EEG_SESSIONS: [
        { id: 'e1', startTime: '' },
        { id: 'e2', startTime: '2026-10-05 20:00' },
      ],
      EEG_ACTIVITIES: [
        { sessionId: '', startTime: '2026-10-05 22:00' },
        { sessionId: 'e2', startTime: '' },
        { sessionId: 'e2', startTime: '2026-10-05 22:00', linkedSeizureId: seizureId },
        { sessionId: 'e2', kind: 'nap', startTime: '2026-10-05 22:00' },
      ],
    });
    expect(await reasons(text)).toEqual([
      expect.stringMatching(/recordedAt: is empty/),
      expect.stringMatching(/moodCode: is empty/),
      expect.stringMatching(/factors: "factor.sleep_hours" is not name=value/),
      expect.stringMatching(/factors: "factor.sleep_hours=lots" has no number or yes\/no/),
      expect.stringMatching(/intensity: 5 is not a whole number from 1/),
      expect.stringMatching(/startTime: is empty/),
      expect.stringMatching(/sessionId: is empty/),
      expect.stringMatching(/startTime: is empty/),
      expect.stringMatching(/linkedSeizureId: no seizure/),
      expect.stringMatching(/kind: "nap" is not one of/),
    ]);
  });
});

describe('what it reads besides the plain columns', () => {
  it('names in place of codes, a time zone, only a total time, yes in Norwegian, and the formula guard', async () => {
    const { store, options } = await setup();
    const text = file({
      SEIZURES: [
        {
          date: '2026-10-05',
          time: '14:05',
          timeZone: 'Europe/Stockholm',
          totalSeconds: '120',
          auraEnd: '2026-10-05 14:05',
          triggers: 'Stress',
          afterFindings: 'Confused / disoriented',
          symptoms: 'Muscle Flickering',
          autoStopped: 'ja',
          recordedBy: 'Self',
          notes: "'=SUM(A1)",
        },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.problems).toEqual([]);
    const start = at(2026, 10, 5, 14, 5);
    expect(store.list('seizure')[0]).toMatchObject({
      timeZone: 'Europe/Stockholm',
      phases: { auraEnd: null, seizureEnd: { at: start + 120_000 }, recoveryEnd: null },
      triggerCodes: ['trigger.stress'],
      afterFindings: [{ code: 'after.confused' }],
      symptoms: [{ code: 'symptom.small_twitching.muscle_flickering' }],
      isEmergencyStop: true,
      recordedBy: 'self',
      notes: '=SUM(A1)',
    });
  });

  it('a household word of its own, by name', async () => {
    const { store, patientId, options } = await setup();
    await store.create('customCode', {
      id: newId(),
      patientId,
      kind: 'trigger',
      code: 'custom.trigger.loud_music',
      label: 'Loud music',
      parentCode: null,
    });
    const text = file({ SEIZURES: [{ date: '2026-10-05', time: '14:05', triggers: 'loud music' }] });
    await importCsv(store, text, options);
    expect(store.list('seizure')[0]?.triggerCodes).toEqual(['custom.trigger.loud_music']);
  });

  it('a file saved with tabs, a 12-hour time past noon, and a day and seconds', async () => {
    const { store, options } = await setup();
    const text = file(
      {
        SEIZURES: [{ date: '2026/10/05', time: '12:30:15 AM' }],
        WELLBEING_ENTRIES: [
          {
            recordedAt: '2026-10-05T07:00',
            day: '2026-10-04',
            mood: 'Happy',
            factors: 'Sleep hours=6|Sleep quality=true',
          },
        ],
      },
      '\t',
    );
    const report = await importCsv(store, text, options);
    expect(report.delimiter).toBe('\t');
    expect(report.problems).toEqual([]);
    expect(store.list('seizure')[0]?.phases.start.at).toBe(new Date(2026, 9, 5, 0, 30, 15).getTime());
    expect(store.list('wellbeingEntry')[0]).toMatchObject({ dayKey: '2026-10-04', moodCode: 'mood.happy' });
  });

  it('doses with their own amount, and a medicine already in the app found by its name', async () => {
    const { store, patientId, options } = await setup();
    await store.create('medication', { ...stripBase(medicationFixture({ patientId, name: 'Clobazam' })) });
    const text = file({
      MEDICATIONS: [{ name: 'clobazam', dose: '10', unit: 'mg', frequency: 'OD', scheduledTimes: '08:00' }],
      MEDICATION_LOGS: [
        {
          medication: 'Clobazam',
          takenAt: '2026-10-05 08:10',
          status: 'taken',
          dose: '5',
          unit: 'ml',
          scheduledTime: '8:00',
        },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.sections.MEDICATIONS).toMatchObject({ duplicates: 1 });
    expect(store.list('doseLog')[0]).toMatchObject({ doseSnapshot: 5, unitSnapshot: 'ml', scheduledTime: '08:00' });
    const again = await importCsv(store, text, options);
    expect(again.sections.MEDICATION_LOGS).toMatchObject({ duplicates: 1 });
  });

  it('a medicine whose changes end in a stop, with times, days and slot doses', async () => {
    const { store, options } = await setup();
    const regimen = {
      name: 'Lamotrigine',
      dose: '100',
      unit: 'mg',
      frequency: 'BD',
      scheduledTimes: '08:00|20:00',
      scheduledDays: '1|3|5',
      slotDoses: '08:00=50|20:00=50',
    };
    const text = file({
      MEDICATIONS: [{ ...regimen, id: 'm1', active: 'no' }],
      MEDICATION_CHANGES: [
        { ...regimen, id: newId(), medicationId: 'm1', type: 'started', effectiveAt: '2026-01-01 08:00' },
        { medicationId: 'm1', type: 'stopped', effectiveAt: '2026-05-01 08:00', note: 'Side effects' },
      ],
    });
    const report = await importCsv(store, text, options);
    expect(report.problems).toEqual([]);
    expect(store.list('medication')[0]).toMatchObject({
      active: false,
      scheduledDays: [1, 3, 5],
      slotDoses: { '08:00': 50, '20:00': 50 },
    });
    const again = await checkCsvImport(store, text, options);
    expect(again.sections.MEDICATIONS).toMatchObject({ duplicates: 1 });
  });

  it('an EEG session already in the app takes new activities by its id', async () => {
    const { store, options } = await setup();
    const text = file({
      EEG_SESSIONS: [{ id: 'e1', startTime: '2026-10-05 20:00', status: 'active', customHours: '6' }],
    });
    await importCsv(store, text, options);
    const later = file({
      EEG_SESSIONS: [{ id: 'e1', startTime: '2026-10-05 20:00' }],
      EEG_ACTIVITIES: [{ sessionId: 'e1', activity: 'Sleeping', mood: 'Happy', startTime: '2026-10-05 22:00' }],
    });
    const report = await importCsv(store, later, options);
    expect(report.sections.EEG_SESSIONS).toMatchObject({ duplicates: 1 });
    expect(report.sections.EEG_ACTIVITIES).toMatchObject({ ready: 1 });
    expect(store.list('eegActivity')[0]).toMatchObject({ activityCode: 'activity.sleeping', moodCode: 'mood.happy' });
    expect((await checkCsvImport(store, later, options)).sections.EEG_ACTIVITIES).toMatchObject({ duplicates: 1 });
  });
});
