import type { PhaseName } from '@auratrack/model';
import type { AdditionsData, BodyPart, PeriodTimelineData } from '../additions';
import type { ReportText } from '../context';
import type { DetailCard, NeurologistReport, SeizureTimeline } from '../neurologist';
import { barList } from './charts';
import { COLORS, Flow } from './flow';
import type { Color, Surface } from './surface';

// The drawing of the sections added in version 7 (see ../additions.ts).

const PHASE_COLOR: Record<PhaseName, Color> = { prodrome: COLORS.violet, aura: COLORS.amber, seizure: COLORS.accent, recovery: COLORS.blue };
const SERIES: Color[] = [
  [59, 142, 208],
  [230, 159, 0],
  [0, 163, 122],
  [204, 121, 167],
  [86, 180, 233],
  [213, 94, 0],
  [201, 187, 46],
  [154, 165, 177],
];

/** The first page: the numbers that matter, then the report starts on a new page. */
export function drawSummary(flow: Flow, r: NeurologistReport, d: NonNullable<AdditionsData['summary']>, t: ReportText): void {
  flow.header({ title: t('rep.sumTitle'), lines: [`${r.patient.name} - ${r.period.from} - ${r.period.to}`] });
  const facts = d.facts;
  for (let i = 0; i < facts.length; i += 2)
    flow.cards(facts.slice(i, i + 2).map((f) => ({ label: f.label, value: f.value })), { minHeight: 52, valueSize: 13 });
  if (d.flags.length > 0) {
    flow.title(t('rep.flags'), 70);
    for (const f of d.flags) flow.note({ edge: f.level === 'warning' ? COLORS.amber : COLORS.blue, title: f.label, lines: f.detail ? [f.detail] : [] });
  }
  for (const line of d.lines) flow.paragraph(line, { size: 9, color: COLORS.muted });
  flow.ensure(Number.POSITIVE_INFINITY); // the report itself starts on the next page
}

interface Event {
  kind: 'mark' | 'moment';
  label: string;
  sub: string;
  phase: PhaseName;
  atMs: number | null;
  first: boolean;
}

/** The marks and symptoms of one seizure in order: warning signs, start, aura, end of aura, seizure, end of seizure, recovery, back to usual self. */
function timelineEvents(tl: SeizureTimeline, t: ReportText): Event[] {
  const mark = (kind: SeizureTimeline['marks'][number]['kind'], phase: Event['phase']): Event[] => {
    const m = tl.marks.find((x) => x.kind === kind);
    const label = { start: t('tl.start'), auraEnd: t('tl.auraEnds'), seizureEnd: t('tl.seizureEnds'), recoveryEnd: t('rec.backToNormal') }[kind];
    return m ? [{ kind: 'mark', label, sub: m.time, phase, atMs: m.atMs, first: false }] : [];
  };
  const moments = (phase: Event['phase']): Event[] =>
    tl.moments.filter((m) => m.phase === phase).map((m) => ({ kind: 'moment', label: m.label, sub: m.place, phase, atMs: m.atMs, first: m.first }));
  return [
    ...moments('prodrome'),
    ...mark('start', 'aura'),
    ...moments('aura'),
    ...mark('auraEnd', 'seizure'),
    ...moments('seizure'),
    ...mark('seizureEnd', 'recovery'),
    ...moments('recovery'),
    ...mark('recoveryEnd', 'recovery'),
  ];
}

/**
 * One seizure as a vertical timeline (README 5.1): a line coloured by phase, the marks on it, and each symptom in a box that
 * alternates left and right with a leader line. A long one continues in a second column. Spaced evenly by default (the order
 * is exact), or by the real time between symptoms when it is known.
 */
export function drawSeizureTimeline(flow: Flow, tl: SeizureTimeline, trueScale: boolean, t: ReportText): void {
  const events = timelineEvents(tl, t);
  if (events.length < 2) return;
  const s = flow.s;
  const perColumn = 12;
  const columns = Math.ceil(events.length / perColumn);
  const colW = (flow.width - 12 * (columns - 1)) / columns;
  const minGap = 24;
  // Time of each event; the unknown ones are placed between the known ones around them
  const times = events.map((e) => e.atMs);
  if (trueScale) {
    // A symptom whose time is not known sits between the known ones around it, by its place in the order
    const known = times.map((x, k) => (x === null ? -1 : k)).filter((k) => k >= 0);
    for (let k = 0; k < times.length; k++) {
      if (times[k] !== null) continue;
      const before = [...known].reverse().find((x) => x < k);
      const after = known.find((x) => x > k);
      times[k] =
        before !== undefined && after !== undefined
          ? (times[before] as number) + ((times[after] as number) - (times[before] as number)) * ((k - before) / (after - before))
          : (times[before ?? after ?? 0] ?? 0);
    }
  }
  const maxHeight = 300;
  const total = Math.max(1, tl.totalMs);
  const pxPerMs = trueScale ? Math.max(0, (maxHeight - events.length * minGap) / total) : 0;
  const ys: number[] = [];
  events.forEach((_, i) => {
    const dt = i === 0 ? 0 : Math.max(0, (times[i] ?? 0) - (times[i - 1] ?? 0));
    ys.push(i === 0 ? 0 : (ys[i - 1] ?? 0) + (trueScale ? minGap + dt * pxPerMs : 26));
  });
  const colEvents = (c: number) => events.map((e, i) => ({ e, i })).filter(({ i }) => Math.floor(i / perColumn) === c);
  const heights = Array.from({ length: columns }, (_, c) => {
    const list = colEvents(c);
    const first = list[0]?.i ?? 0;
    return (ys[list[list.length - 1]?.i ?? first] ?? 0) - (ys[first] ?? 0) + 30;
  });
  const height = Math.max(...heights) + 28;
  flow.ensure(height + 22);
  s.text(t('rep.exTimeline'), flow.left, flow.y + 9, { size: 8.5, bold: true });
  s.text(trueScale ? t('rep.exTimelineScale') : t('rep.exTimelineEven'), flow.right, flow.y + 9, { size: 6.5, color: COLORS.muted, align: 'right' });
  const top = flow.y + 32;
  for (let c = 0; c < columns; c++) {
    const list = colEvents(c);
    const x0 = flow.left + c * (colW + 12);
    const cx = x0 + colW / 2;
    const baseY = ys[list[0]?.i ?? 0] ?? 0;
    // The line, in the colour of the phase it runs through
    for (let k = 0; k < list.length - 1; k++) {
      const a = list[k];
      const b = list[k + 1];
      if (!a || !b) continue;
      s.line(cx, top + (ys[a.i] ?? 0) - baseY, cx, top + (ys[b.i] ?? 0) - baseY, { color: PHASE_COLOR[b.e.phase], width: 2.4 });
    }
    list.forEach(({ e, i }, k) => {
      const y = top + (ys[i] ?? 0) - baseY;
      s.circle(cx, y, e.kind === 'mark' ? 4 : 3, { fill: e.kind === 'mark' ? COLORS.white : PHASE_COLOR[e.phase], stroke: PHASE_COLOR[e.phase], lineWidth: 1.2 });
      const left = k % 2 === 0;
      const boxW = colW / 2 - 14;
      const bx = left ? cx - 8 - boxW : cx + 8;
      const lines = s.wrap(`${e.first ? '* ' : ''}${e.label}`, boxW - 8, { size: 7, bold: e.kind === 'mark' });
      const sub = e.sub ? s.wrap(e.sub, boxW - 8, { size: 6.5 }).slice(0, 2) : [];
      const h = 8 + lines.length * 8 + sub.length * 7.5;
      s.line(left ? cx - 4 : cx + 4, y, left ? bx + boxW : bx, y, { color: COLORS.soft, width: 0.6 });
      s.rect(bx, y - h / 2, boxW, h, { fill: e.kind === 'mark' ? COLORS.panel : COLORS.white, stroke: PHASE_COLOR[e.phase], radius: 3, lineWidth: 0.7 });
      lines.forEach((l, n) => s.text(l, bx + 4, y - h / 2 + 8 + n * 8, { size: 7, bold: e.kind === 'mark', align: 'left' }));
      sub.forEach((l, n) => s.text(l, bx + 4, y - h / 2 + 8 + lines.length * 8 + n * 7.5 + 1, { size: 6.5, color: COLORS.muted }));
    });
  }
  flow.y = top + height - 10;
}

/** Seizures, symptoms between seizures, medicine changes and missed doses along the period. */
export function drawPeriodTimeline(flow: Flow, d: PeriodTimelineData, alertSeconds: number, t: ReportText): void {
  flow.title(t('rep.exPeriod'), 200);
  const height = 130;
  flow.ensure(height + 40);
  const s = flow.s;
  const left = flow.left + 8;
  const w = flow.width - 16;
  const span = Math.max(1, d.to - d.from);
  const px = (at: number) => left + Math.min(1, Math.max(0, (at - d.from) / span)) * w;
  const rows = { seizure: 22, between: 56, medication: 80, missed: 104 } as const;
  for (const y of Object.values(rows)) s.line(left, flow.y + y, left + w, flow.y + y, { color: COLORS.line, width: 0.6 });
  for (const tick of d.ticks) {
    s.line(px(tick.at), flow.y + 4, px(tick.at), flow.y + height - 16, { color: COLORS.line, width: 0.4 });
    s.text(tick.label, px(tick.at), flow.y + height - 5, { size: 6.5, color: COLORS.muted, align: 'center' });
  }
  for (const it of d.items) {
    const x = px(it.at);
    if (it.kind === 'seizure') {
      const r = 3 + Math.min(1, (it.seconds ?? 0) / 720) * 8;
      const colour = SERIES[((it.kindKey ? (d.typeSeries[it.kindKey] ?? 8) : 8) - 1) % 8] ?? COLORS.soft;
      if (it.long) s.circle(x, flow.y + rows.seizure, r + 2.5, { stroke: COLORS.accent, lineWidth: 1.2 });
      if (it.seconds === null) s.circle(x, flow.y + rows.seizure, r, { stroke: colour, lineWidth: 1.6 });
      else s.circle(x, flow.y + rows.seizure, r, { fill: colour });
    } else if (it.kind === 'between') s.rect(x - 3, flow.y + rows.between - 3, 6, 6, { fill: COLORS.blue });
    else if (it.kind === 'medication')
      s.polyline([[x - 4, flow.y + rows.medication + 4], [x, flow.y + rows.medication - 5], [x + 4, flow.y + rows.medication + 4], [x - 4, flow.y + rows.medication + 4]], { color: COLORS.amber, width: 1.4 });
    else {
      s.line(x - 3, flow.y + rows.missed - 3, x + 3, flow.y + rows.missed + 3, { color: COLORS.accent, width: 1.3 });
      s.line(x - 3, flow.y + rows.missed + 3, x + 3, flow.y + rows.missed - 3, { color: COLORS.accent, width: 1.3 });
    }
  }
  void alertSeconds;
  flow.y += height + 2;
  flow.paragraph(t('rep.exPeriodLegend'), { size: 7, color: COLORS.muted, gap: 3 });
  if (d.legend.seriesLabels.length > 0)
    flow.paragraph(d.legend.seriesLabels.map((x) => x.label).join('  |  '), { size: 7, color: COLORS.muted, gap: 8 });
}

export function drawBetween(flow: Flow, d: NonNullable<AdditionsData['between']>, t: ReportText): void {
  flow.title(t('rep.exBetween'), 120);
  if (d.total === 0) return flow.paragraph(t('rep.exBetweenNone'), { size: 8.5, color: COLORS.muted, gap: 8 });
  barList(flow, d.symptoms.map((x) => ({ label: x.label, value: x.count })), '');
  const max = Math.max(1, ...d.weekly.map((w) => w.count));
  const h = 60;
  flow.ensure(h + 34);
  const s = flow.s;
  s.text(t('rep.exBetweenWeekly'), flow.left, flow.y + 9, { size: 8.5, bold: true });
  const w = flow.width - 34;
  const step = w / Math.max(1, d.weekly.length);
  const barW = Math.max(1.2, Math.min(14, step * 0.7));
  d.weekly.forEach((b, i) => {
    const bh = (b.count / max) * h;
    if (b.count > 0) s.rect(flow.left + 34 + i * step + (step - barW) / 2, flow.y + 16 + h - bh, barW, bh, { fill: COLORS.blue });
  });
  s.line(flow.left + 34, flow.y + 16 + h, flow.right, flow.y + 16 + h, { color: COLORS.line, width: 0.6 });
  flow.y += h + 30;
}

/** A simple figure with the parts shaded by how many symptoms were in them. */
function figure(s: Surface, x: number, y: number, counts: Record<BodyPart, number>, max: number): void {
  const shade = (n: number): Color => {
    const k = max > 0 ? n / max : 0;
    return [Math.round(235 - k * 15), Math.round(237 - k * 199), Math.round(240 - k * 202)];
  };
  const part = (p: BodyPart, draw: (c: Color) => void) => draw(shade(counts[p]));
  part('head', (c) => s.circle(x + 40, y + 16, 14, { fill: c, stroke: COLORS.soft }));
  part('torso', (c) => s.rect(x + 22, y + 34, 36, 58, { fill: c, stroke: COLORS.soft, radius: 8 }));
  part('rightArm', (c) => s.rect(x + 2, y + 36, 16, 62, { fill: c, stroke: COLORS.soft, radius: 7 }));
  part('leftArm', (c) => s.rect(x + 62, y + 36, 16, 62, { fill: c, stroke: COLORS.soft, radius: 7 }));
  part('rightLeg', (c) => s.rect(x + 24, y + 96, 15, 80, { fill: c, stroke: COLORS.soft, radius: 7 }));
  part('leftLeg', (c) => s.rect(x + 41, y + 96, 15, 80, { fill: c, stroke: COLORS.soft, radius: 7 }));
  const label = (txt: string, lx: number, ly: number) => s.text(txt, lx, ly, { size: 7, bold: true, color: COLORS.ink, align: 'center' });
  if (counts.head) label(String(counts.head), x + 40, y + 19);
  if (counts.torso) label(String(counts.torso), x + 40, y + 66);
  if (counts.rightArm) label(String(counts.rightArm), x + 10, y + 70);
  if (counts.leftArm) label(String(counts.leftArm), x + 70, y + 70);
  if (counts.rightLeg) label(String(counts.rightLeg), x + 31, y + 138);
  if (counts.leftLeg) label(String(counts.leftLeg), x + 48, y + 138);
}

export function drawBodyMap(flow: Flow, d: NonNullable<AdditionsData['bodyMap']>, t: ReportText): void {
  flow.title(t('rep.exBody'), 240);
  const total = Object.values(d.during).reduce((a, b) => a + b, 0) + Object.values(d.after).reduce((a, b) => a + b, 0);
  if (total === 0) return flow.paragraph(t('rep.exBodyNone'), { size: 8.5, color: COLORS.muted, gap: 8 });
  const max = Math.max(1, ...Object.values({ ...d.during, whole: 0 }), ...Object.values({ ...d.after, whole: 0 }));
  flow.ensure(230);
  const s = flow.s;
  const half = flow.width / 2;
  s.text(t('rep.exBodyDuring'), flow.left + half / 2, flow.y + 9, { size: 8.5, bold: true, align: 'center' });
  s.text(t('rep.exBodyAfter'), flow.left + half + half / 2, flow.y + 9, { size: 8.5, bold: true, align: 'center' });
  figure(s, flow.left + half / 2 - 40, flow.y + 18, d.during, max);
  figure(s, flow.left + half + half / 2 - 40, flow.y + 18, d.after, max);
  flow.y += 206;
  if (d.during.whole > 0) flow.paragraph(`${t('rep.exBodyDuring')}: ${t('rep.exBodyWhole', { count: d.during.whole })}`, { size: 8, gap: 1 });
  if (d.after.whole > 0) flow.paragraph(`${t('rep.exBodyAfter')}: ${t('rep.exBodyWhole', { count: d.after.whole })}`, { size: 8, gap: 1 });
  flow.paragraph(t('rep.exBodyHelp'), { size: 7, color: COLORS.muted, gap: 8 });
}

export function drawIlae(flow: Flow, d: NonNullable<AdditionsData['ilae']>, t: ReportText): void {
  flow.title(t('rep.exIlae'), 100);
  if (d.recorded === 0 && d.earlier.recorded === 0)
    return flow.paragraph(t('rep.ilaeNone'), { size: 8.5, color: COLORS.muted, gap: 8 });
  const columns = [
    { title: t('rep.type'), grow: 4 },
    { title: t('rep.exCount'), width: 50, align: 'right' as const },
  ];
  flow.paragraph(t('rep.ilaeCover', { recorded: d.recorded, total: d.total }), { size: 8.5, gap: 4 });
  if (d.recorded > 0) flow.table(columns, d.rows.map((r) => [r.label, String(r.count)]), { size: 8 });
  if (d.earlier.recorded > 0) {
    flow.paragraph(t('rep.ilae2017', { recorded: d.earlier.recorded }), { size: 8.5, gap: 4 });
    flow.table(columns, d.earlier.rows.map((r) => [r.label, String(r.count)]), { size: 8 });
  }
}

export function drawRecovery(flow: Flow, d: NonNullable<AdditionsData['recovery']>, t: ReportText, minutes: (n: number | null) => string): void {
  flow.title(t('rep.exRecovery'), 130);
  if (d.n === 0) return flow.paragraph(t('rep.exRecoveryNone'), { size: 8.5, color: COLORS.muted, gap: 8 });
  flow.paragraph(t('rep.exRecoveryStats', { n: d.n, median: minutes(d.median), min: minutes(d.min), max: minutes(d.max) }), { size: 8.5, gap: 4 });
  barList(flow, d.buckets.map((b) => ({ label: b.label, value: b.count })), '');
}

export function drawTimeOfDay(flow: Flow, d: NonNullable<AdditionsData['timeOfDay']>, t: ReportText): void {
  flow.title(t('rep.exTime'), 160);
  const h = 80;
  flow.ensure(h + 44);
  const s = flow.s;
  const max = Math.max(1, ...d.hours);
  const w = flow.width - 30;
  const step = w / 24;
  d.hours.forEach((n, i) => {
    const bh = (n / max) * h;
    const night = i < 6 || i >= 22;
    if (n > 0) s.rect(flow.left + 30 + i * step + 1, flow.y + h - bh, step - 2, bh, { fill: night ? COLORS.slate : COLORS.blue });
    if (i % 3 === 0) s.text(String(i).padStart(2, '0'), flow.left + 30 + i * step + step / 2, flow.y + h + 10, { size: 6.5, color: COLORS.muted, align: 'center' });
  });
  s.line(flow.left + 30, flow.y + h, flow.right, flow.y + h, { color: COLORS.line, width: 0.6 });
  s.text('0', flow.left + 24, flow.y + h, { size: 6.5, color: COLORS.muted, align: 'right' });
  s.text(String(max), flow.left + 24, flow.y + 6, { size: 6.5, color: COLORS.muted, align: 'right' });
  flow.y += h + 20;
  flow.cards(d.periods.map((p) => ({ label: p.label, value: String(p.count) })), { minHeight: 44, valueSize: 13 });
  flow.paragraph(t('rep.exTimeHelp'), { size: 7, color: COLORS.muted, gap: 8 });
}

export function drawClusters(flow: Flow, d: NonNullable<AdditionsData['clusters']>, rule: string, t: ReportText): void {
  flow.title(t('rep.exClusters'), 100);
  flow.paragraph(rule, { size: 8, color: COLORS.muted, gap: 4 });
  flow.paragraph(t('rep.exClustersHeading'), { size: 8.5, bold: true, gap: 2 });
  if (d.episodes.length === 0) flow.paragraph(t('rep.exClusterNone'), { size: 8.5, gap: 4 });
  for (const e of d.episodes) flow.paragraph(t('rep.exClusterLine', { when: e.from, to: e.to, count: e.count }), { size: 8.5, gap: 1 });
  flow.space(4);
  flow.paragraph(t('rep.exLongHeading'), { size: 8.5, bold: true, gap: 2 });
  if (d.long.length === 0) flow.paragraph(t('rep.exLongNone'), { size: 8.5, gap: 8 });
  for (const l of d.long) flow.paragraph(`${l.when} (${l.duration})`, { size: 8.5, gap: 1 });
  flow.space(8);
}

export function drawMedVsFrequency(flow: Flow, d: NonNullable<AdditionsData['medVsFrequency']>, t: ReportText): void {
  flow.title(t('rep.exMedFreq'), 190);
  const h = 110;
  flow.ensure(h + 50);
  const s = flow.s;
  const left = flow.left + 30;
  const w = flow.width - 60;
  const top = flow.y + 14;
  const max = Math.max(1, ...d.weeks.map((x) => x.count));
  const step = w / Math.max(1, d.weeks.length);
  const barW = Math.max(1.2, Math.min(16, step * 0.7));
  s.line(left, top + h, left + w, top + h, { color: COLORS.line, width: 0.6 });
  d.weeks.forEach((wk, i) => {
    const bh = (wk.count / max) * h;
    if (wk.count > 0) s.rect(left + i * step + (step - barW) / 2, top + h - bh, barW, bh, { fill: COLORS.blue });
  });
  const line = d.weeks.flatMap((wk, i) => (wk.adherence === null ? [] : [[left + i * step + step / 2, top + h - wk.adherence * h] as const]));
  if (line.length > 1) s.polyline(line, { color: COLORS.green, width: 1.2 });
  for (const p of line) s.circle(p[0], p[1], 1.6, { fill: COLORS.green });
  for (const c of d.changes) {
    const x = left + c.index * step + step / 2;
    s.line(x, top, x, top + h, { color: COLORS.amber, width: 0.7, dash: [2, 2] });
    s.polyline([[x - 4, top - 1], [x, top - 9], [x + 4, top - 1], [x - 4, top - 1]], { color: COLORS.amber, width: 1.3 });
  }
  s.text(String(max), left - 4, top + 6, { size: 6.5, color: COLORS.muted, align: 'right' });
  s.text('0', left - 4, top + h + 3, { size: 6.5, color: COLORS.muted, align: 'right' });
  s.text('100%', left + w + 4, top + 6, { size: 6.5, color: COLORS.green });
  flow.y = top + h + 16;
  flow.paragraph(t('rep.exMedFreqHelp'), { size: 7, color: COLORS.muted, gap: 2 });
  if (d.changes.length === 0) flow.paragraph(t('rep.exMedFreqNone'), { size: 8, gap: 8 });
  for (const c of d.changes) flow.paragraph(`- ${c.label}`, { size: 8, gap: 1 });
  flow.space(8);
}

export type { DetailCard };
