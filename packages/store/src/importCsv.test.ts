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
