import { describe, expect, it } from 'vitest';
import { buildNeurologistReport } from './neurologist';
import { buildDiary, buildEegDiary, buildEventLog } from './others';
import { createJsPdfSurface, makePdf } from './pdfEntry';
import { drawJob } from './job';
import { renderDiary, renderEeg, renderEventLog, renderNeurologist } from './pdf/render';
import { RecordingSurface, pdfSafe } from './pdf/surface';
import {
  changes, context, eegActivities, eegSession, medications, neurologistInput, patient, seizures,
} from './testData';

const ctx = context();

function neurologist(over: Parameters<typeof neurologistInput>[0] = {}) {
  const input = neurologistInput(over);
  const surface = new RecordingSurface();
  renderNeurologist(buildNeurologistReport(input, ctx), ctx.t, surface, { alertSeconds: input.plan.alertSec });
  return surface;
}

describe('the logo in the header', () => {
  it('is on the first page, left of the name, and on no other page', () => {
    const s = neurologist();
    const images = s.marks.filter((m) => m.kind === 'image');
    expect(images).toHaveLength(1);
    const [logo] = images;
    const name = s.marks.find((m) => m.kind === 'text' && m.lines[0] === 'AuraTrack');
    expect(logo?.page).toBe(1);
    expect(logo && name && logo.kind === 'image' && name.kind === 'text' && logo.x + logo.w < name.x).toBe(true);
  });
  it('goes into a real PDF as a picture', () => {
    const input = neurologistInput({});
    const job = { kind: 'neurologist', language: 'en', model: buildNeurologistReport(input, ctx), alertSeconds: input.plan.alertSec } as const;
    expect(new TextDecoder('latin1').decode(makePdf(job))).toContain('/Subtype /Image');
  });
});

describe('the neurologist report as pages', () => {
  it('has every section in the order of 6.1', () => {
    const texts = neurologist().texts();
    const order = [
      'Neurological report', 'PATIENT', 'REPORT SUMMARY', 'MEDICINES', 'MEDICINE CHANGES', 'RECENT SEIZURES', 'CLINICAL CONTEXT',
      'WELLBEING', 'CLINICAL FLAGS', 'TRENDS', 'SEIZURES IN DETAIL', 'SYMPTOMS DURING SEIZURES', 'HOW COMPLETELY IT WAS RECORDED',
    ];
    let from = 0;
    for (const heading of order) {
      const at = texts.findIndex((t, i) => i >= from && t.toUpperCase().startsWith(heading.toUpperCase()));
      expect(at, `"${heading}" comes after the one before it`).toBeGreaterThanOrEqual(from);
      from = at;
    }
  });

  it('keeps everything inside the page, with the margins', () => {
    expect(neurologist().outside(14)).toEqual([]);
  });

  it('runs to several pages for a long period, with a page number on each', () => {
    const s = neurologist();
    expect(s.pageCount()).toBeGreaterThan(2);
    const numbers = s.texts().filter((t) => /^Page \d+ of \d+$/.test(t));
    expect(numbers).toHaveLength(s.pageCount());
    expect(numbers.at(-1)).toBe(`Page ${s.pageCount()} of ${s.pageCount()}`);
  });

  it('writes the doctor, the person and the period in the header', () => {
    const texts = neurologist().texts();
    expect(texts).toContain('For: Dr. Random Example');
    expect(texts).toContain('Kari Nordmann');
    expect(texts.some((t) => /^Period: \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2} \(days: 91\)$/.test(t))).toBe(true);
  });

  it('draws nothing of wellbeing while the module is off', () => {
    const texts = neurologist({ wellbeingEnabled: false }).texts().join('\n');
    expect(texts).not.toMatch(/WELLBEING/i);
  });

  it('never cuts a long note: all of it is on the page', () => {
    const [first, ...rest] = seizures(12);
    const long = 'word '.repeat(400).trim();
    const s = neurologist({ seizures: [{ ...first!, notes: long }, ...rest] });
    const text = s.texts().join(' ');
    expect((text.match(/word/g) ?? []).length).toBeGreaterThanOrEqual(400);
    expect(s.outside(14)).toEqual([]);
  });

  it('works for an empty period', () => {
    const s = neurologist({ seizures: [] });
    expect(s.texts()).toContain('0');
    expect(s.outside(14)).toEqual([]);
  });

  it('writes no character that the PDF fonts cannot show', () => {
    for (const t of neurologist().texts()) expect(t, t).toBe(pdfSafe(t));
  });
});

describe('the other reports as pages', () => {
  it('the event log has a row for every seizure in the period and the medicine changes', () => {
    const input = neurologistInput();
    const data = buildEventLog({ seizures: input.seizures, changes, from: input.from, to: input.to }, ctx);
    const s = new RecordingSurface();
    renderEventLog(data, ctx.t, s);
    expect(data.events.length).toBe(input.seizures.filter((x) => x.phases.start.at >= input.from).length);
    expect(s.texts()).toContain('Event log');
    expect(s.texts().some((t) => t === 'MEDICINE CHANGES')).toBe(true);
    expect(s.outside(14)).toEqual([]);
  });

  it('the diary is a month grid: every day of the month once, the legend, and the medicines', () => {
    const data = buildDiary({ patient, seizures: seizures(), medications, changes, year: 2026, month: 10 }, ctx);
    expect(data.cells.filter((c) => c.kind === 'day')).toHaveLength(31);
    expect(data.rows).toBeGreaterThanOrEqual(5);
    expect(data.cells.length).toBe(data.rows * 7);
    expect(data.total).toBe(data.cells.reduce((n, c) => n + (c.count ?? 0), 0));
    const s = new RecordingSurface(841.89, 595.28);
    renderDiary(data, ctx.t, s);
    expect(s.texts()[0]).toBe('AuraTrack');
    expect(s.texts().some((t) => t.startsWith('Medicines: Lamotrigine'))).toBe(true);
    expect(s.outside(14)).toEqual([]);
  });

  it('the diary starts the month on the right weekday', () => {
    const data = buildDiary({ patient, seizures: [], medications: [], changes: [], year: 2026, month: 11 }, ctx);
    // 1 November 2026 is a Sunday: the first cell is the 1st
    expect(data.cells[0]).toMatchObject({ kind: 'day', day: 1 });
    const oct = buildDiary({ patient, seizures: [], medications: [], changes: [], year: 2026, month: 10 }, ctx);
    expect(oct.cells.slice(0, 4).map((c) => c.kind)).toEqual(['empty', 'empty', 'empty', 'empty']); // 1 October is a Thursday
  });

  it('the EEG diary lists the session and its activities and seizure references in time order', () => {
    const data = buildEegDiary({ session: eegSession, activities: [...eegActivities].reverse() }, ctx);
    expect(data.items.map((i) => i.kind)).toEqual(['activity', 'seizure']);
    const s = new RecordingSurface();
    renderEeg(data, ctx.t, s);
    expect(s.texts()).toContain('Night EEG');
    expect(s.outside(14)).toEqual([]);
  });

  it('the EEG diary works with no session', () => {
    const s = new RecordingSurface();
    renderEeg(buildEegDiary({ session: null, activities: [] }, ctx), ctx.t, s);
    expect(s.texts()).toContain('EEG diary');
  });
});

describe('a real PDF file', () => {
  it('is made with jsPDF: it starts like a PDF, has the pages, and the text can be found in it', () => {
    const input = neurologistInput();
    const surface = createJsPdfSurface();
    renderNeurologist(buildNeurologistReport(input, ctx), ctx.t, surface, { alertSeconds: input.plan.alertSec });
    const bytes = surface.output();
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(surface.pageCount()).toBeGreaterThan(2);
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });

  it('the landscape diary is made too', () => {
    const surface = createJsPdfSurface('landscape');
    renderDiary(buildDiary({ patient, seizures: seizures(), medications, changes, year: 2026, month: 10 }, ctx), ctx.t, surface);
    expect(surface.pageWidth).toBeGreaterThan(surface.pageHeight);
    expect(new TextDecoder().decode(surface.output().slice(0, 5))).toBe('%PDF-');
  });

  it('makes the same report in every language without a problem', () => {
    for (const language of ['nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es']) {
      const c = context(language);
      const input = neurologistInput();
      const surface = new RecordingSurface();
      renderNeurologist(buildNeurologistReport(input, c), c.t, surface, { alertSeconds: input.plan.alertSec });
      expect(surface.outside(14), language).toEqual([]);
    }
  });
});

describe('a report job', () => {
  it('draws the same on a recording surface and in a PDF, and the PDF is made from it', () => {
    const input = neurologistInput();
    const job = { kind: 'neurologist' as const, language: 'en' as const, model: buildNeurologistReport(input, ctx), alertSeconds: 300 };
    const rec = new RecordingSurface();
    drawJob(job, rec);
    expect(rec.texts()).toContain('Neurological report');
    const bytes = makePdf(job);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});

describe('text that the PDF fonts cannot show', () => {
  it('is written with a look-alike, and anything unknown becomes a question mark', () => {
    expect(pdfSafe('100 mg → 150 mg – “ok” …')).toBe('100 mg -> 150 mg - "ok" ...');
    expect(pdfSafe('Åse søker ä ö ü é ñ ß ¿')).toBe('Åse søker ä ö ü é ñ ß ¿');
    expect(pdfSafe('日本')).toBe('??');
    expect(pdfSafe('a\nb c')).toBe('a\nb c');
  });
});
