import { describe, expect, it } from 'vitest';
import type { Seizure } from '@auratrack/model';
import { ADDITION_KEYS, NO_ADDITIONS, bodyPartOf, buildAdditions, clusterEpisodes, type Additions } from './additions';
import { buildNeurologistReport, seizureTimeline } from './neurologist';
import { RecordingSurface } from './pdf/surface';
import { renderNeurologist } from './pdf/render';
import { between, context, neurologistInput, seizures } from './testData';

const ctx = context();
const ALL: Additions = Object.fromEntries(ADDITION_KEYS.map((k) => [k, true])) as unknown as Additions;
const input = () => neurologistInput({ between });
const make = (flags: Partial<Additions>) => {
  const i = input();
  const report = buildNeurologistReport(i, ctx);
  return { i, report, data: buildAdditions(i, report, ctx, { ...NO_ADDITIONS, ...flags }) };
};
const render = (flags: Partial<Additions>) => {
  const { i, report, data } = make(flags);
  const s = new RecordingSurface();
  renderNeurologist(report, ctx.t, s, { alertSeconds: i.plan.alertSec, additions: data });
  return s;
};

describe('the report additions', () => {
  it('build nothing until they are switched on: the 6.1 report is what it was', () => {
    const { data } = make({});
    expect(Object.keys(data).sort()).toEqual(['seizureTimelines', 'trueScale']);
    const plain = new RecordingSurface();
    const { i, report } = make({});
    renderNeurologist(report, ctx.t, plain, { alertSeconds: i.plan.alertSec });
    expect(render({}).texts()).toEqual(plain.texts());
  });

  it('can each be switched on alone, and then only that one is built', () => {
    for (const key of ADDITION_KEYS.filter((k) => k !== 'trueScale' && k !== 'seizureTimelines')) {
      const { data } = make({ [key]: true });
      const built = Object.keys(data).filter((k) => k !== 'trueScale' && k !== 'seizureTimelines');
      expect(built, key).toHaveLength(1);
    }
  });

  it('with all of them on, draws every section, inside the page, and the report starts on the second page', () => {
    const s = render(ALL);
    const texts = s.texts().map((t) => t.toUpperCase());
    for (const heading of [
      'AT A GLANCE', 'THE PERIOD ON ONE LINE', 'MEDICINES AND SEIZURES PER WEEK', 'CLUSTERS AND LONG SEIZURES', 'TIME OF DAY',
      'HOW LONG IT TAKES TO RECOVER', 'TYPE OF SEIZURE BY THE ILAE CLASSIFICATION', 'SYMPTOMS BETWEEN SEIZURES', 'WHERE ON THE BODY',
    ])
      expect(texts, heading).toContain(heading);
    expect(texts.indexOf('NEUROLOGICAL REPORT')).toBeGreaterThan(texts.indexOf('AT A GLANCE'));
    expect(s.marks.filter((m) => m.kind === 'text' && m.lines[0] === 'Neurological report').every((m) => m.page >= 2)).toBe(true);
    expect(s.outside(14)).toEqual([]);
  });

  it('draws a vertical timeline for each detailed seizure, spaced evenly or by the real time', () => {
    const even = render({ seizureTimelines: true });
    const scale = render({ seizureTimelines: true, trueScale: true });
    for (const s of [even, scale]) {
      expect(s.texts().filter((t) => t === 'Seizure timeline').length).toBeGreaterThanOrEqual(3);
      expect(s.outside(14)).toEqual([]);
    }
    expect(even.texts()).toContain('Spaced evenly: the order is exact, the spacing is not.');
    expect(scale.texts()).toContain('Spaced by the time between symptoms.');
  });
});

describe('the figures the additions work out', () => {
  it('the summary compares the period with the one before it, finds the longest, and counts clusters and changes', () => {
    const facts = Object.fromEntries((make({ summary: true }).data.summary?.facts ?? []).map((f) => [f.label, f.value]));
    expect(Number(facts['Seizures in the period'])).toBeGreaterThan(0);
    expect(facts['Longest seizure']).toMatch(/^\d+:\d{2} \(\d{4}-\d{2}-\d{2}\)$/);
    expect(facts['Medicine changes']).toBe('1');
    expect(facts['Logged doses that were taken']).toMatch(/^\d+%$/);
  });

  it('the time of day counts every seizure once, by the local hour, and the four parts add up', () => {
    const { data, i } = make({ timeOfDay: true });
    const total = i.seizures.filter((s) => s.phases.start.at >= i.from && s.phases.start.at <= i.to && s.status !== 'in_progress').length;
    expect(data.timeOfDay?.hours.reduce((a, b) => a + b, 0)).toBe(total);
    expect(data.timeOfDay?.periods.reduce((a, b) => a + b.count, 0)).toBe(total);
    expect(data.timeOfDay?.hours).toHaveLength(24);
  });

  it('recovery times use the marks when there are some, otherwise the minutes that were typed, and group them', () => {
    const { data } = make({ recoveryTimes: true });
    const r = data.recovery!;
    expect(r.n).toBeGreaterThan(0);
    expect(r.buckets.reduce((a, b) => a + b.count, 0)).toBe(r.n);
    expect(r.min).toBeLessThanOrEqual(r.median ?? 0);
    expect(r.median).toBeLessThanOrEqual(r.max ?? 0);
  });

  it('the ILAE rows count only seizures that were classified, and say how many that was', () => {
    const base = seizures(6).map((s, i) => ({
      ...s,
      ilae: i < 3 ? { onset: 'focal' as const, awareness: 'impaired' as const, motor: null, feature: null, spreadToBothSides: i === 0 } : null,
    }));
    const i = neurologistInput({ seizures: base });
    const report = buildNeurologistReport(i, ctx);
    const d = buildAdditions(i, report, ctx, { ...NO_ADDITIONS, ilae: true }).ilae!;
    // Recorded before 7.2: counted apart, as ILAE 2017 answers
    expect(d.recorded).toBe(0);
    expect(d.earlier.recorded).toBe(3);
    expect(d.earlier.rows).toContainEqual({ label: 'Onset: focal', count: 3 });
    expect(d.earlier.rows).toContainEqual({ label: 'Spread to both sides', count: 1 });
  });

  it('counts ILAE 2025 types, and a seizure with 2025 answers is never counted again by its 2017 ones (D-17)', () => {
    const none = { recall: null, responsive: null, bilateralTonicClonic: null, observable: null, generalized: null };
    const focalImpaired = { ...none, class: 'focal' as const, recall: 'no' as const };
    const base = seizures(5).map((s, i) => ({
      ...s,
      ilae2025: i < 2 ? focalImpaired : i === 2 ? { ...none, class: 'generalized' as const, generalized: 'atonic' as const } : null,
      ilae: i === 0 || i === 3 ? { onset: 'focal' as const, awareness: 'aware' as const, motor: null, feature: null, spreadToBothSides: null } : null,
      profile: i === 1 ? { id: 'p1', name: 'Usual seizure' } : null,
    }));
    const i = neurologistInput({ seizures: base });
    const d = buildAdditions(i, buildNeurologistReport(i, ctx), ctx, { ...NO_ADDITIONS, ilae: true }).ilae!;
    expect(d.recorded).toBe(3);
    expect(d.total).toBe(5);
    expect(d.rows).toEqual([
      { label: 'Focal impaired consciousness seizure', count: 2 },
      { label: 'Generalized atonic seizure', count: 1 },
    ]);
    expect(d.earlier.recorded).toBe(1);
  });

  it('the body map counts symptoms by the part of the body, and after-seizure findings apart', () => {
    expect(bodyPartOf({ region: 'body.arms', subRegion: 'body.arms.left_arm' })).toBe('leftArm');
    expect(bodyPartOf({ region: 'body.head_and_face', subRegion: null })).toBe('head');
    expect(bodyPartOf({ region: 'body.whole_body', subRegion: 'body.whole_body.general' })).toBe('whole');
    expect(bodyPartOf(null)).toBeNull();
    const { data } = make({ bodyMaps: true });
    expect(data.bodyMap?.during.leftArm).toBeGreaterThan(0);
    expect(data.bodyMap?.after.leftArm).toBe(0);
  });

  it('the between-seizures section counts the symptoms in the period, commonest first, and per week', () => {
    const { data } = make({ betweenSymptoms: true });
    expect(data.between?.total).toBe(1);
    expect(data.between?.symptoms[0]).toMatchObject({ count: 1 });
    expect(data.between?.weekly.reduce((a, b) => a + b.count, 0)).toBe(1);
  });

  it('clusters follow the person’s own rule: three within eight minutes, chained, and long seizures are listed', () => {
    const base = seizures(1)[0]!;
    const at = (minutes: number): Seizure => ({ ...base, id: `c${minutes}`, phases: { ...base.phases, start: { at: base.phases.start.at + minutes * 60_000, source: 'timed' }, auraEnd: null, seizureEnd: { at: base.phases.start.at + minutes * 60_000 + 30_000, source: 'timed' }, recoveryEnd: null } });
    const plan = neurologistInput().plan;
    const group = [at(0), at(3), at(6), at(9)];
    expect(clusterEpisodes(group, plan)).toEqual([{ from: at(0).phases.start.at, to: at(9).phases.start.at, count: 4 }]);
    expect(clusterEpisodes([at(0), at(30), at(60)], plan)).toEqual([]);
    expect(clusterEpisodes([at(0), at(2), at(4), at(100), at(102), at(104)], plan).map((e) => e.count)).toEqual([3, 3]);
  });

  it('medicines against frequency has a week for each week of the period, with the change on its week', () => {
    const { data, i } = make({ medicationVsFrequency: true });
    expect(data.medVsFrequency?.weeks.length).toBeGreaterThanOrEqual(13);
    expect(data.medVsFrequency?.weeks.reduce((a, b) => a + b.count, 0)).toBe(
      i.seizures.filter((s) => s.phases.start.at >= i.from && s.phases.start.at <= i.to && s.status !== 'in_progress').length,
    );
    expect(data.medVsFrequency?.changes).toHaveLength(1);
    for (const w of data.medVsFrequency?.weeks ?? []) if (w.adherence !== null) {
      expect(w.adherence).toBeGreaterThanOrEqual(0);
      expect(w.adherence).toBeLessThanOrEqual(1);
    }
  });
});

describe('the timeline of one seizure', () => {
  const base = seizures(2)[1]!; // one with every part recorded
  const seizure = (gaps: { kind: 'exact' | 'approximate' | 'unknown'; ms: number | null }[]): Seizure => ({
    ...base,
    symptoms: gaps.map((g, i) => ({ id: `y${i}`, code: 'symptom.awareness.fully_awake_aware', area: null, moment: i, order: i, sincePrevious: g, isFirst: i === 0, phase: 'during' as const })),
  });

  it('adds up the exact gaps, and does not know the time after one that is not exact', () => {
    const tl = seizureTimeline(seizure([{ kind: 'exact', ms: 2000 }, { kind: 'exact', ms: 3000 }, { kind: 'approximate', ms: 10_000 }, { kind: 'exact', ms: 1000 }]), ctx);
    expect(tl.moments.map((m) => m.atMs)).toEqual([2000, 5000, null, null]);
    expect(tl.moments[0]?.first).toBe(true);
  });

  it('has its marks in order and the length of the whole seizure', () => {
    const tl = seizureTimeline(seizure([]), ctx);
    expect(tl.marks.map((m) => m.kind)).toEqual(['start', 'auraEnd', 'seizureEnd', 'recoveryEnd']);
    expect(tl.totalMs).toBe(tl.marks.at(-1)?.atMs);
  });
});
