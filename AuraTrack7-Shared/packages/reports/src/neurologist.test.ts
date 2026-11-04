import { describe, expect, it } from 'vitest';
import { seizureSeconds } from '@auratrack/model';
import { buildNeurologistReport, doseSummary, areaLabel } from './neurologist';
import { changes, context, medications, neurologistInput, seizures } from './testData';

const report = () => buildNeurologistReport(neurologistInput(), context());

describe('the neurologist report: the numbers', () => {
  it('counts the seizures in the period, the days they fell on, and the average length of the ones with a known end', () => {
    const input = neurologistInput();
    const inPeriod = input.seizures.filter((s) => s.phases.start.at >= input.from && s.phases.start.at <= input.to);
    const r = report();
    expect(r.stats.seizures).toBe(String(inPeriod.length));
    const lengths = inPeriod.map((s) => seizureSeconds(s.phases)).filter((n): n is number => n !== null);
    const average = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    expect(r.stats.average).toBe(context().fmt.duration(average));
    const days = new Set(inPeriod.map((s) => context().fmt.date(s.phases.start.at))).size;
    expect(r.stats.days).toBe(String(days));
    expect(r.period.days).toBe(91);
  });

  it('leaves out a recording that is still running and one that was cancelled', () => {
    const base = seizures(3);
    const r = buildNeurologistReport(
      neurologistInput({ seizures: [base[0]!, { ...base[1]!, status: 'in_progress' }, { ...base[2]!, cancelled: true }] }),
      context(),
    );
    expect(r.stats.seizures).toBe('1');
  });

  it('flags the seizures at or over the alert time, with their dates', () => {
    const r = report();
    const flag = r.flags.find((f) => f.label.includes('minutes'));
    expect(flag?.level).toBe('warning');
    expect(flag?.label).toMatch(/^Seizures at or over 5 minutes: \d+$/);
    expect(flag?.detail).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} \(\d+:\d{2}\)/);
  });

  it('flags a recording the timer stopped, seizures that were edited, and names the triggers with how often', () => {
    const r = report();
    expect(r.flags.some((f) => /^Recordings stopped by the timer at 12 minutes: 1$/.test(f.label))).toBe(true);
    expect(r.flags.some((f) => /^Seizures edited by hand: \d+$/.test(f.label))).toBe(true);
    const triggers = r.flags.find((f) => /^Seizures with a possible trigger noted: \d+$/.test(f.label));
    expect(triggers?.detail).toMatch(/\(\d+x/);
  });

  it('says which rule the flags used', () => {
    expect(report().planRule).toBe('Rule used for the flags: emergency alert at 5 minutes; a cluster is 3 seizures within 8 min.');
  });

  it('counts awareness from the awareness symptoms, and the most frequent after-seizure findings', () => {
    const r = report();
    const awareness = r.clinical.find((c) => c.label === 'Awareness');
    expect(awareness?.value).toMatch(/^Fully awake: \d+ \| Confused: \d+ \| Blackout: 0$/);
    expect(r.clinical.find((c) => c.label === 'Afterwards')?.value).toMatch(/\(\d+x\)/);
  });

  it('shows what was written for the doctor, and how many rescue doses were taken', () => {
    const input = neurologistInput({
      doses: [
        ...neurologistInput().doses,
        { ...neurologistInput().doses[0]!, id: 'x', medicationId: 'm2', scheduledTime: null, takenAt: neurologistInput().from + 1000 },
      ],
    });
    const r = buildNeurologistReport(input, context());
    expect(r.clinical.find((c) => c.label === 'Notes for the doctor')?.value).toBe('Sleep is the usual trigger.');
    expect(r.clinical.find((c) => c.label === 'Rescue medicine used')?.value).toBe('Midazolam (1x)');
  });

  it('rates how completely it was recorded, from the share that has every part', () => {
    const q = report().quality;
    expect(q.fully + q.partial + q.untagged).toBe(Number(report().stats.seizures));
    expect(q.confidence).toBe(q.percent >= 80 ? 'HIGH' : q.percent >= 50 ? 'MEDIUM' : 'LOW');
    expect(q.autoStopped).toBe(1);
  });

  it('writes the recent seizures newest first, numbered, and marks who recorded them', () => {
    const r = report();
    expect(r.recent.length).toBeGreaterThanOrEqual(10);
    expect(r.recent.map((x) => x.index)).toEqual(r.recent.map((_, i) => i + 1));
    expect(new Set(r.recent.map((x) => x.by))).toEqual(new Set(['CT', 'SE']));
  });

  it('lists the details of the latest three and every long or edited seizure, newest first', () => {
    const r = report();
    expect(r.details.length).toBeGreaterThanOrEqual(3);
    expect(r.details.some((d) => d.badges.some((b) => b.startsWith('At or over')))).toBe(true);
    const times = r.details.map((d) => `${d.date} ${d.time}`);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('keeps the symptom log: the symptom, its medical term and where on the body', () => {
    const group = report().symptomLog.find((g) => g.symptoms.some((s) => s.term === 'Myoclonic jerks'));
    expect(group?.symptoms.find((s) => s.term === 'Myoclonic jerks')).toMatchObject({ path: expect.any(String), location: expect.stringContaining('Left') });
  });
});

describe('the neurologist report: medicines', () => {
  it('lists the medicines of the period with the dose at its start and its end', () => {
    const r = report();
    const lamotrigine = r.medications.find((m) => m.name === 'Lamotrigine');
    expect(lamotrigine?.dose).toBe('100 mg -> 100 + 150 mg');
    expect(lamotrigine?.how).toBe('BD - Twice a day');
    expect(r.medications.find((m) => m.name === 'Midazolam')?.how).toBe('When needed');
  });

  it('lists the changes of the period, leaving out a baseline', () => {
    const base = neurologistInput({ changes: [...changes, { ...changes[0]!, id: 'b', isBaseline: true }] });
    const r = buildNeurologistReport(base, context());
    // The start 100 days ago is before the period, and the baseline is never a change
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ medication: 'Lamotrigine', typeLabel: 'changed', note: 'Evening dose raised' });
    expect(r.changes[0]?.lines.join(' ')).toContain('100 mg -> 100 + 150 mg');
  });

  it('counts the doses taken, late, assumed and missed in the period, and what was expected', () => {
    const lines = report().adherenceLines;
    expect(lines[0]).toMatch(/^Doses logged: \d+\. Doses expected from the schedule: \d+\.$/);
    expect(lines[1]).toMatch(/^Taken: \d+, late: \d+, assumed: \d+, missed: \d+\.$/);
    expect(lines.some((l) => l.startsWith('Assumed doses'))).toBe(true);
  });

  it('has no dose lines when nothing was logged', () => {
    expect(buildNeurologistReport(neurologistInput({ doses: [] }), context()).adherenceLines).toEqual([]);
  });

  it('writes a dose as one number, or as the doses of the times of the day when they differ', () => {
    const m = medications[0]!;
    expect(doseSummary({ ...m, slotDoses: {} })).toBe('100 mg');
    expect(doseSummary(m)).toBe('100 + 150 mg');
    expect(doseSummary({ ...medications[1]! })).toBe('10 mg');
    expect(doseSummary({ ...m, dose: null, slotDoses: {}, frequency: 'PRN', scheduledTimes: [] })).toBe('');
  });
});

describe('the neurologist report: who and what', () => {
  it('names the carer as the one who prepared it, or the person for themselves', () => {
    expect(report().preparedBy).toBe('Kari Nordmann');
    const self = buildNeurologistReport(neurologistInput({ recordedBy: 'self' }), context());
    expect(self.preparedBy).toBe('Random Seed Patient');
    expect(self.patient.name).toMatch(/^Self/);
  });

  it('includes the date of birth only when asked, and the contact', () => {
    expect(report().patient.lines).toEqual(['Date of birth: 2010-05-17', 'Emergency contact: Sam 555 0100']);
    expect(buildNeurologistReport(neurologistInput({ includeDateOfBirth: false }), context()).patient.lines).toEqual([
      'Emergency contact: Sam 555 0100',
    ]);
  });

  it('has the wellbeing section only while the module is on', () => {
    expect(report().wellbeing).not.toBeNull();
    const off = buildNeurologistReport(neurologistInput({ wellbeingEnabled: false }), context());
    expect(off.wellbeing).toBeNull();
    expect(off.chart.factors).toEqual([]);
  });

  it('compares the factors on days with a seizure to days without', () => {
    const f = report().chart.factors.find((x) => x.label === 'Stress');
    expect(f?.seizureDays).toMatch(/^\d+\/\d+$/);
    expect(f?.seizureShare).toBeGreaterThanOrEqual(0);
    expect(f?.seizureShare).toBeLessThanOrEqual(1);
  });

  it('chooses days, weeks or months for the frequency chart by the length of the period', () => {
    const at = (d: number) => new Date(2026, 9, 15 - d, 12).getTime();
    const bucket = (days: number) =>
      buildNeurologistReport(neurologistInput({ from: at(days), to: at(0) }), context()).chart.bucket;
    expect([bucket(20), bucket(90), bucket(400)]).toEqual(['day', 'week', 'month']);
  });

  it('works with no seizures at all', () => {
    const r = buildNeurologistReport(neurologistInput({ seizures: [] }), context());
    expect(r.stats).toMatchObject({ seizures: '0', average: '0s', days: '0', types: '0' });
    expect(r.flags).toEqual([]);
    expect(r.quality).toMatchObject({ percent: 0, confidence: 'LOW' });
  });

  it('names a body area from the parts below the region, or the region when there is nothing below', () => {
    const label = (c: string) => c.split('.').pop() ?? c;
    expect(areaLabel(null, label)).toBe('');
    expect(areaLabel({ region: 'body.arms', subRegion: null, part: null }, label)).toBe('arms');
    expect(areaLabel({ region: 'body.arms', subRegion: 'body.arms.left_arm', part: 'body.arms.left_arm.hand' }, label)).toBe('left_arm > hand');
  });
});
