// @vitest-environment jsdom
import { makePdf } from '@auratrack/reports/pdf';
import { RecordingSurface } from '@auratrack/reports';
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reportsEnv, type ReportsEnv } from '../reports/env';
import { T0, makeSeizure, openPlace, seed, setup } from './testSupport';

// Reports: choosing a report and a period, the preview, saving, sharing and the CSV. The real store and the real PDF
// library (jsPDF); only the browser's canvas, worker and file dialog are replaced.
configure({ asyncUtilTimeout: 8000 });

class FakePreview extends RecordingSurface {
  get pages(): HTMLCanvasElement[] {
    return Array.from({ length: this.pageCount() }, () => document.createElement('canvas'));
  }
}

const original = { ...reportsEnv };
let saved: { bytes: Uint8Array | string; fileName: string; mime: string }[] = [];
let surfaces: FakePreview[] = [];
beforeEach(() => {
  saved = [];
  surfaces = [];
  Object.assign(reportsEnv, {
    previewSurface: (landscape: boolean) => {
      const s = landscape ? new FakePreview(841.89, 595.28) : new FakePreview();
      surfaces.push(s);
      return s;
    },
    makePdf: async (job) => makePdf(job),
    save: async (bytes, fileName, mime) => {
      saved.push({ bytes, fileName, mime });
      return 'saved';
    },
    canShare: () => false,
  } satisfies Partial<ReportsEnv>);
});
afterEach(() => {
  cleanup();
  Object.assign(reportsEnv, original);
});

type Ctx = ReturnType<typeof setup>;
async function openReports(ctx: Ctx, seizures = 3) {
  const { patientId } = await seed(ctx, { contact: 'Sam 555 0100' });
  for (let i = 0; i < seizures; i++)
    await ctx.client.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 600 * (i + 1), 40 + i * 30, { notes: `note ${i}` }),
    });
  // A note that a spreadsheet would run as a formula
  await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 5, 30, { notes: '=SUM(A1:A9)' }) });
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'More');
  await user.click(await screen.findByRole('button', { name: 'Reports' }));
  await screen.findByRole('group', { name: 'Which report' });
  return { user, patientId };
}

describe('choosing a report', () => {
  it('offers the report for the neurologist, the event log, the diary and the spreadsheet, and the EEG diary only when it is on', async () => {
    const ctx = setup();
    await openReports(ctx);
    for (const name of ['Report for the neurologist', 'Event log', 'Monthly seizure diary', 'Spreadsheet file (CSV)'])
      expect(screen.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^EEG diary/ })).toBeNull();
  });

  it('shows the period of the last 90 days, and a custom period with a check that the first day is not after the last', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    expect(screen.getByText(/ – /).textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/); // the date format of the settings
    await user.click(screen.getByRole('button', { name: 'Choose dates' }));
    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('The first day must not be after the last.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save as PDF' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('preview, save and share', () => {
  it('previews the pages, made from the person’s records, with the settings of the report', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    const [surface] = surfaces;
    expect(surface?.texts()).toContain('Neurological report');
    expect(surface?.texts()).toContain('Seizures in the period: 4');
    expect(surface?.texts().some((t) => t.includes('Alex'))).toBe(true);
    expect(document.querySelectorAll('canvas.app-page').length).toBe(surface?.pageCount());
  });

  it('saves a real PDF named with the local date', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const file = saved[0]!;
    expect(file.mime).toBe('application/pdf');
    expect(file.fileName).toMatch(/^auratrack-neurologist-report-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(new TextDecoder().decode((file.bytes as Uint8Array).slice(0, 5))).toBe('%PDF-');
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('saves the PDF from the preview too, and offers Share only where the browser can share a file', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    reportsEnv.canShare = () => true;
    const shared: string[] = [];
    reportsEnv.share = async (_bytes, fileName) => {
      shared.push(fileName);
      return 'shared';
    };
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]).toMatch(/\.pdf$/);
  });

  it('says so when the PDF cannot be made, and nothing is saved', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    reportsEnv.makePdf = async () => {
      throw new Error('no worker');
    };
    await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
    expect(await screen.findByText('The report could not be made. Nothing was changed.')).toBeTruthy();
    expect(saved).toEqual([]);
  });
});

describe('the extra sections of version 7', () => {
  it('are off at first, so the report is the one of version 6, and each can be switched on and then shows in the preview', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    expect(screen.getByRole('checkbox', { name: /A summary page first/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Space the timeline by real time/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    const plain = surfaces[0]!.texts();
    expect(plain).not.toContain('At a glance');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('checkbox', { name: /A summary page first/ }));
    await user.click(screen.getByRole('checkbox', { name: /Time of day, day and night/ }));
    await user.click(screen.getByRole('checkbox', { name: /A timeline for each seizure/ }));
    expect(await screen.findByRole('checkbox', { name: /Space the timeline by real time/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(surfaces.length).toBeGreaterThan(1));
    const extra = surfaces.at(-1)!.texts();
    expect(extra).toContain('At a glance');
    expect(extra.map((t) => t.toUpperCase())).toContain('TIME OF DAY');
    expect(extra).toContain('Seizure timeline');
    expect(surfaces.at(-1)!.outside(14)).toEqual([]);
  });

  it('are offered for the report for the neurologist only', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: /^Event log/ }));
    expect(screen.queryByRole('checkbox', { name: /A summary page first/ })).toBeNull();
  });
});

describe('the other reports', () => {
  it('the event log lists every seizure with its note', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: /^Event log/ }));
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    const texts = surfaces[0]!.texts().join(' ');
    for (const i of [0, 1, 2]) expect(texts).toContain(`note ${i}`);
  });

  it('the diary is of one month, on a landscape page, named with the month', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: /^Monthly seizure diary/ }));
    fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '2025-10' } });
    await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.fileName).toBe('auratrack-seizure-diary-2025-10.pdf');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(surfaces.at(-1)?.pageWidth).toBeGreaterThan(800));
  });

  it('the spreadsheet file has a block for each kind of record, quoted, and no formula can run in it', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(await screen.findByRole('button', { name: /^Spreadsheet file/ }));
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save the spreadsheet file' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const text = saved[0]!.bytes as string;
    expect(saved[0]!.mime).toBe('text/csv');
    expect(saved[0]!.fileName).toMatch(/\.csv$/);
    for (const block of ['SEIZURES', 'BETWEEN_SEIZURES', 'MEDICATIONS', 'MEDICATION_LOGS', 'MEDICATION_CHANGES'])
      expect(text).toContain(`${block}\n`);
    expect(text).toContain('"\'=SUM(A1:A9)"');
    expect(text).not.toContain(',"=SUM');
  });

  it('the EEG diary is offered once the EEG diary is on, and lists its sessions', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'patient', key: 'eegEnabled', value: true },
    });
    await ctx.client.createRecord({
      type: 'eegSession',
      values: {
        patientId,
        startTime: T0 - 86_400_000,
        plannedEndTime: null,
        actualEndTime: T0 - 3_600_000,
        durationPreset: '24h',
        customHours: null,
        title: 'Night one',
        notes: '',
        status: 'completed',
      },
    });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Reports' }));
    await user.click(await screen.findByRole('button', { name: /^EEG diary/ }));
    expect(await screen.findByLabelText('EEG session')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    expect(surfaces[0]!.texts()).toContain('Night one');
  });

  it('draws nothing of wellbeing in the report while it is switched off', async () => {
    const ctx = setup();
    const { user } = await openReports(ctx);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/^Pages: \d+$/);
    expect(surfaces[0]!.texts().join(' ')).not.toMatch(/wellbeing/i);
    void within;
  });
});
