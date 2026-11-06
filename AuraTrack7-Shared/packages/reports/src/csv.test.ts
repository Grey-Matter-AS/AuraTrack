import { describe, expect, it } from 'vitest';
import type { Seizure } from '@auratrack/model';
import { buildCsv, cell, clockText, type CsvInput } from './csv';
import { between, changes, context, doses, eegActivities, eegSession, medications, NOW, seizures, wellbeing } from './testData';

const ctx = context();
const DAY = 86_400_000;

const input = (over: Partial<CsvInput> = {}): CsvInput => ({
  seizures: seizures(10),
  between,
  medications,
  doses,
  changes,
  wellbeing,
  eegSessions: [eegSession],
  eegActivities,
  from: NOW - 100 * DAY,
  to: NOW,
  label: ctx.label,
  ...over,
});

const blocks = (csv: string) => Object.fromEntries(csv.trim().split('\n\n').map((b) => [b.split('\n')[0] as string, b.split('\n').slice(1)]));

describe('cell', () => {
  it('quotes text, doubles quotes, and leaves numbers and booleans plain', () => {
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell(12)).toBe('12');
    expect(cell(false)).toBe('false');
  });
  it('writes nothing as an empty quoted cell', () => {
    expect(cell(null)).toBe('""');
    expect(cell(undefined)).toBe('""');
  });
  it('makes text that a spreadsheet would run as a formula plain text', () => {
    for (const start of ['=', '+', '-', '@']) expect(cell(`${start}SUM(A1)`)).toBe(`"'${start}SUM(A1)"`);
  });
});

describe('clockText', () => {
  it('pads hours, minutes and seconds', () => {
    expect(clockText(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('03:04:05');
  });
});

describe('buildCsv', () => {
  it('has one block per kind of record, each with its heading line', () => {
    const b = blocks(buildCsv(input()));
    expect(Object.keys(b)).toEqual([
      'SEIZURES',
      'BETWEEN_SEIZURES',
      'MEDICATIONS',
      'MEDICATION_LOGS',
      'MEDICATION_CHANGES',
      'WELLBEING_ENTRIES',
      'EEG_SESSIONS',
      'EEG_ACTIVITIES',
    ]);
    expect(b.SEIZURES?.[0]).toMatch(/^id,date,time,timeZone,profile,ilae2025Type/);
  });

  it('leaves out recordings in progress and cancelled ones, and any outside the period', () => {
    const all = seizures(6);
    const [a, b, c, d] = all as [Seizure, Seizure, Seizure, Seizure];
    const rows = blocks(
      buildCsv(
        input({
          seizures: [
            { ...a, status: 'in_progress' },
            { ...b, cancelled: true },
            { ...c, phases: { ...c.phases, start: { at: NOW - 200 * DAY, source: 'timed' } } },
            d,
          ],
        }),
      ),
    ).SEIZURES as string[];
    expect(rows).toHaveLength(2); // heading plus the one that counts
    expect(rows[1]).toContain(`"${d.id}"`);
  });

  it('writes the optional parts of a seizure: no type, areas, own wording, entered later, locked, video', () => {
    const base = seizures(1)[0] as Seizure;
    const area = { region: 'body.arms', subRegion: 'body.arms.left_arm', part: null };
    const s: Seizure = {
      ...base,
      ilae2025: null,
      profile: null,
      symptoms: [
        { ...(base.symptoms[0] as Seizure['symptoms'][number]), area, order: 1 },
        { ...(base.symptoms[0] as Seizure['symptoms'][number]), area: null, order: 0 },
      ],
      afterFindings: [
        { code: 'after.confused', customLabel: 'Own wording', areas: [area] },
        { code: 'after.confused', customLabel: null, areas: [] },
      ],
      triggerCodes: ['trigger.stress'],
      phases: { ...base.phases, start: { at: base.phases.start.at, source: 'entered-later' } },
      recordedWhileLocked: true,
      video: { fileName: 'clip.webm' } as Seizure['video'],
    };
    const row = (blocks(buildCsv(input({ seizures: [s] }))).SEIZURES as string[])[1] as string;
    expect(row).toContain('Own wording');
    expect(row).toContain('clip.webm');
    expect(row).toContain('true,true'); // entered later, recorded while locked
    expect(row).toMatch(/"",""/); // no type, no code
  });

  it('writes a between-seizures event with and without an area, and only those in the period', () => {
    const first = between[0] as (typeof between)[number];
    const area = { region: 'body.arms', subRegion: null, part: null };
    const rows = blocks(
      buildCsv(input({ between: [first, { ...first, id: 'b2', area }, { ...first, id: 'b3', occurredAt: NOW - 300 * DAY }] })),
    ).BETWEEN_SEIZURES as string[];
    expect(rows).toHaveLength(3);
  });

  it('writes a stopped medicine, and a dose of a medicine that is no longer listed or taken at no set time', () => {
    const m = medications[0] as (typeof medications)[number];
    const d = doses[0] as (typeof doses)[number];
    const b = blocks(
      buildCsv(
        input({
          medications: [{ ...m, stoppedAt: NOW - DAY, active: false }],
          doses: [{ ...d, medicationId: 'gone', scheduledTime: null, takenAt: NOW - DAY }],
        }),
      ),
    );
    expect(b.MEDICATIONS?.[1]).toContain(' ');
    expect(b.MEDICATION_LOGS?.[1]).toContain('"gone","",');
  });

  it('leaves baseline medicine changes out and writes the doses of ones that have a from and a to', () => {
    const [started, changed] = changes as [(typeof changes)[number], (typeof changes)[number]];
    const inside = { ...started, effectiveAt: NOW - 50 * DAY };
    const rows = blocks(buildCsv(input({ changes: [{ ...inside, id: 'base', isBaseline: true }, changed, inside] }))).MEDICATION_CHANGES as string[];
    expect(rows).toHaveLength(3); // heading, the start (no from), the change
    expect(rows[1]).toContain('"",100,'); // earlier first: the start has no from
    expect(rows.join('\n')).toContain('slotDose:20:00');
  });

  it('writes wellbeing factors with their words, and EEG items with and without a code, mood or link', () => {
    const a = eegActivities[0] as (typeof eegActivities)[number];
    const b = blocks(
      buildCsv(
        input({
          eegSessions: [{ ...eegSession, actualEndTime: null, plannedEndTime: null } as typeof eegSession],
          eegActivities: [a, { ...a, id: 'a3', activityCode: null, moodCode: null, linkedSeizureId: 's1', customText: 'Reading' }],
        }),
      ),
    );
    expect(b.WELLBEING_ENTRIES?.[1]).toContain('=');
    expect(b.EEG_SESSIONS?.[1]).toContain('Night EEG');
    expect(b.EEG_ACTIVITIES?.[2]).toContain('Reading');
    expect(b.EEG_ACTIVITIES?.[2]).toContain('"s1"');
  });
});
