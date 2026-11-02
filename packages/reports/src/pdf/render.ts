import type { ReportText } from '../context';
import type { DiaryReport, EegReport, EventLogReport } from '../others';
import type { NeurologistReport } from '../neurologist';
import type { AdditionsData } from '../additions';
import {
  drawBetween,
  drawBodyMap,
  drawClusters,
  drawIlae,
  drawMedVsFrequency,
  drawPeriodTimeline,
  drawRecovery,
  drawSeizureTimeline,
  drawSummary,
  drawTimeOfDay,
} from './additions';
import { barList, durationChart, factorChart, frequencyChart, hexColor, phaseChart } from './charts';
import { COLORS, Flow } from './flow';
import type { Surface } from './surface';

// The reports drawn from their data. The order of the neurologist report is the one of 6.1 (docs/plan/report-inventory.md, R-1).

const CONFIDENCE = { HIGH: COLORS.green, MEDIUM: COLORS.amber, LOW: COLORS.accent } as const;

export function renderNeurologist(
  r: NeurologistReport,
  t: ReportText,
  s: Surface,
  options: { alertSeconds: number; additions?: AdditionsData | undefined },
): void {
  const flow = new Flow(s, { margin: 40, top: 42 });
  const extra = options.additions;
  if (extra?.summary) drawSummary(flow, r, extra.summary, t);
  flow.header({
    title: t('rep.titleNeuro'),
    lines: [
      `${t('rep.generated')}: ${r.generated}`,
      `${t('rep.period')}: ${r.period.from} - ${r.period.to} (${t('rep.selectedDays', { count: r.period.days })})`,
    ],
    right: { label: t('rep.preparedBy'), value: r.preparedBy, meta: r.forLines },
  });

  flow.cards([
    { label: t('rep.patient'), value: r.patient.name, lines: r.patient.lines },
    { label: t('rep.summary'), value: r.summary.value, lines: r.summary.lines },
  ], { minHeight: 70, valueSize: 11 });
  flow.stats([
    { value: r.stats.seizures, label: t('rep.statSeizures', { count: r.period.days }) },
    { value: r.stats.average, label: t('rep.avgDuration') },
    { value: r.stats.days, label: t('rep.statDays') },
    { value: r.stats.types, label: t('rep.statTypes') },
  ]);

  if (r.medications.length > 0) {
    flow.title(t('rep.currentMeds'));
    flow.table(
      [
        { title: t('rep.drug'), grow: 3 },
        { title: t('rep.dose'), grow: 2 },
        { title: t('rep.frequency'), grow: 2 },
      ],
      r.medications.map((m) => [[m.name, m.detail, m.stopped].filter(Boolean).join('\n'), m.dose, m.how]),
      { pad: 5 },
    );
    for (const line of r.adherenceLines) flow.paragraph(line, { size: 8, color: COLORS.ink });
    flow.space(6);
  }

  if (r.changes.length > 0) {
    flow.title(t('rep.medChanges'));
    changesTable(flow, r.changes, t);
  }

  flow.title(t('rep.recent', { count: r.recent.length }));
  flow.table(
    [
      { title: '#', width: 18 },
      { title: t('rep.date'), width: 62 },
      { title: t('rep.time'), width: 34 },
      { title: t('rep.type'), grow: 2 },
      { title: t('rep.total'), width: 40 },
      { title: t('rep.aura'), width: 36 },
      { title: t('rep.seizure'), width: 40 },
      { title: t('rep.recovery'), width: 44 },
      { title: t('rep.noteShort'), width: 26, align: 'center' },
      { title: t('rep.editedShort'), width: 28, align: 'center' },
      { title: t('rep.by'), width: 22, align: 'center' },
    ],
    r.recent.map((e) => [String(e.index), e.date, e.time, e.type, e.total, e.aura, e.seizure, e.recovery, e.hasNote ? 'Y' : '', e.edited ? 'Y' : '', e.by]),
    { size: 7 },
  );

  flow.title(t('rep.clinical'));
  flow.cards(r.clinical.slice(0, 2), { minHeight: 54 });
  flow.cards(r.clinical.slice(2, 4), { minHeight: 54 });

  if (r.wellbeing) {
    flow.title(t('rep.wellbeing'));
    flow.cards(
      [
        { label: t('rep.wbCovered'), value: t('rep.wbDays', { days: r.wellbeing.days, entries: r.wellbeing.entries }) },
        { label: t('rep.wbMoods'), value: r.wellbeing.moods || t('rep.notRecorded') },
        { label: t('rep.wbFactors'), value: r.wellbeing.factors || t('rep.notRecorded') },
      ],
      { minHeight: 50, valueSize: 8.5 },
    );
    if (r.wellbeing.recent.length > 0)
      flow.table(
        [
          { title: t('rep.date'), grow: 2 },
          { title: t('wb.mood'), grow: 2 },
          { title: t('wb.howStrong'), grow: 1 },
          { title: t('rep.wbFactors'), grow: 3 },
        ],
        r.wellbeing.recent.map((e) => [e.when, e.mood, e.strength, [e.factors, e.notes].filter(Boolean).join(' - ')]),
        { size: 7 },
      );
  }

  if (r.flags.length > 0) {
    flow.title(t('rep.flags'));
    for (const f of r.flags)
      flow.note({ edge: f.level === 'warning' ? COLORS.amber : COLORS.blue, title: f.label, lines: f.detail ? [f.detail] : [] });
  }
  flow.paragraph(r.planRule, { size: 8, color: COLORS.muted, gap: 6 });

  flow.title(t('rep.trends'));
  frequencyChart(flow, r.chart, t('rep.chartFrequency', { unit: t(`rep.unit.${r.chart.bucket}` as never) }), t('rep.chartFrequencyLegend'));
  durationChart(flow, r.chart, options.alertSeconds, t('rep.chartDuration'), t('rep.chartDurationLegend'));
  if (r.chart.factors.length > 0) factorChart(flow, r.chart, t('rep.chartFactors'), [t('rep.seizureDays'), t('rep.otherDays')]);
  barList(
    flow,
    r.chart.types.map((x) => ({ label: x.label, value: x.count, text: `${x.count} (${Math.round((x.count / Math.max(1, Number(r.stats.seizures))) * 100)}%)` })),
    t('rep.chartTypes'),
  );
  phaseChart(flow, r.chart, t('rep.chartPhases'), [t('rep.aura'), t('rep.seizure'), t('rep.recovery')]);

  if (extra?.periodTimeline) drawPeriodTimeline(flow, extra.periodTimeline, options.alertSeconds, t);
  if (extra?.medVsFrequency) drawMedVsFrequency(flow, extra.medVsFrequency, t);
  if (extra?.clusters) drawClusters(flow, extra.clusters, r.planRule, t);
  if (extra?.timeOfDay) drawTimeOfDay(flow, extra.timeOfDay, t);
  if (extra?.recovery) drawRecovery(flow, extra.recovery, t, (n) => (n === null ? '-' : `${Math.round(n)} min`));
  if (extra?.ilae) drawIlae(flow, extra.ilae, t);
  if (extra?.between) drawBetween(flow, extra.between, t);
  if (extra?.bodyMap) drawBodyMap(flow, extra.bodyMap, t);

  if (r.details.length > 0) {
    flow.title(t('rep.details'));
    for (const d of r.details) {
      const lines = [
        `${t('rep.total')} ${d.total} | ${t('rep.aura')} ${d.aura} | ${t('rep.seizure')} ${d.seizure} | ${t('rep.recovery')} ${d.recovery} | ${t('rep.recordedBy')}: ${d.by}`,
        ...(d.badges.length > 0 ? [d.badges.join(' | ')] : []),
        ...(d.symptoms.length > 0 ? [`${t('rep.symptoms')}: ${d.symptoms.map((x) => (x.location !== '-' ? `${x.path} @ ${x.location}` : x.path)).join('; ')}`] : []),
        ...(d.afterFindings.length > 0 ? [`${t('rep.afterSymptoms')}: ${d.afterFindings.join(', ')}`] : []),
        ...(d.notes ? [`${t('rep.notes')}: ${d.notes}`] : []),
        ...(d.video ? [`${t('rep.video')}: ${d.video}`] : []),
      ];
      flow.note({ edge: d.badges.length > 0 ? COLORS.accent : COLORS.slate, title: `${d.date} ${d.time} - ${d.type}`, lines });
      if (extra?.seizureTimelines) drawSeizureTimeline(flow, d.timeline, extra.trueScale, t);
    }
  }

  if (r.symptomLog.length > 0) {
    flow.title(t('rep.symptomLog'));
    for (const g of r.symptomLog) {
      flow.ensure(60);
      flow.paragraph(`#${g.index}  ${g.date} ${g.time} - ${g.type} (${g.total})`, { size: 8.5, bold: true, gap: 3 });
      flow.table(
        [
          { title: t('rep.symptomPath'), grow: 3 },
          { title: t('rep.medicalTerm'), grow: 2 },
          { title: t('rep.location'), grow: 3 },
        ],
        g.symptoms.map((x) => [x.path, x.term, x.location]),
        { size: 7, pad: 4, head: [241, 245, 249] as const },
      );
    }
  }

  flow.title(t('rep.quality'));
  flow.ensure(110);
  const q = r.quality;
  flow.s.rect(flow.left, flow.y, flow.width, 28, { fill: COLORS.panel, stroke: CONFIDENCE[q.confidence], radius: 4 });
  flow.s.text(`${t('rep.confidence')}: ${t(`rep.confidence.${q.confidence}` as never)} (${q.percent}%)`, flow.left + 10, flow.y + 18, {
    size: 10,
    bold: true,
    color: CONFIDENCE[q.confidence],
  });
  flow.y += 38;
  flow.stats([
    { value: String(q.fully), label: t('rep.fully') },
    { value: String(q.partial), label: t('rep.partial') },
    { value: String(q.untagged), label: t('rep.untagged') },
    { value: String(q.autoStopped), label: t('rep.autoStopped') },
    { value: String(q.edited), label: t('rep.edited') },
  ]);
  for (const line of r.footer) flow.paragraph(line, { size: 8, color: COLORS.muted, gap: 3 });
  flow.pageNumbers((p, n) => t('rep.page', { page: p, pages: n }));
}

function changesTable(flow: Flow, rows: NeurologistReport['changes'], t: ReportText): void {
  flow.table(
    [
      { title: t('rep.date'), width: 68 },
      { title: t('rep.drug'), grow: 2 },
      { title: t('rep.type'), width: 62 },
      { title: t('rep.whatChanged'), grow: 3 },
    ],
    rows.map((c) => [`${c.date}\n${c.time}`, [c.medication, c.detail].filter(Boolean).join('\n'), c.typeLabel, [...c.lines, c.note].filter(Boolean).join('\n')]),
    { size: 7.5 },
  );
}

export function renderEventLog(r: EventLogReport, t: ReportText, s: Surface): void {
  const flow = new Flow(s, { margin: 40, top: 34 });
  flow.header({ title: t('rep.titleEventLog'), lines: [`${t('rep.generated')}: ${r.generated}`, `${t('rep.period')}: ${r.period.from} - ${r.period.to}`] });
  flow.table(
    [
      { title: t('rep.date'), width: 70 },
      { title: t('rep.time'), width: 40 },
      { title: t('rep.type'), width: 90 },
      { title: t('rep.duration'), width: 56 },
      { title: t('rep.notes'), grow: 1 },
    ],
    r.events.flatMap((e) => {
      const main: (string | { text: string; span: number; italic: boolean; fill: readonly [number, number, number]; color: readonly [number, number, number] })[] = [e.date, e.time, e.type, e.duration, e.notes];
      return e.symptoms ? [main, [{ text: e.symptoms, span: 5, italic: true, fill: COLORS.panel, color: [75, 85, 99] as const }]] : [main];
    }),
  );
  if (r.changes.length > 0) {
    flow.title(t('rep.medChanges'));
    changesTable(flow, r.changes, t);
  }
  flow.pageNumbers((p, n) => t('rep.page', { page: p, pages: n }));
}

export function renderDiary(r: DiaryReport, t: ReportText, s: Surface): void {
  const flow = new Flow(s, { margin: 28, top: 24, bottom: 40 });
  flow.header({
    title: r.title,
    lines: [],
    right: { label: t('rep.patient'), value: r.patient, meta: [t('rep.diaryTotal', { count: r.total })] },
  });
  const columns = 7;
  const gap = 4;
  const cellW = (flow.width - gap * (columns - 1)) / columns;
  const top = flow.y;
  r.weekdays.forEach((w, i) => s.text(w.toUpperCase(), flow.left + i * (cellW + gap) + cellW / 2, top + 8, { size: 8, bold: true, color: COLORS.muted, align: 'center' }));
  const legendRoom = 70 + (r.changeLines.length + (r.medications ? 1 : 0)) * 11;
  const gridH = Math.min(s.pageHeight - top - legendRoom - 40, 330);
  const cellH = (gridH - 18 - gap * r.rows) / r.rows;
  r.cells.forEach((c, i) => {
    const x = flow.left + (i % columns) * (cellW + gap);
    const y = top + 16 + Math.floor(i / columns) * (cellH + gap);
    s.rect(x, y, cellW, cellH, { fill: c.kind === 'empty' ? COLORS.panel : COLORS.white, stroke: COLORS.line, radius: 4 });
    if (c.kind !== 'day') return;
    s.text(String(c.day), x + 5, y + 12, { size: 9, bold: true, color: (c.count ?? 0) > 0 ? COLORS.ink : COLORS.soft });
    if (c.triggers) s.circle(x + cellW - 8, y + 9, 2.5, { fill: COLORS.amber });
    (c.types ?? []).slice(0, 3).forEach((ty, k) => {
      const ty0 = y + 20 + k * 11;
      s.rect(x + 5, ty0, cellW - 10, 9, { fill: hexColor(ty.color), radius: 2 });
      s.text(`${ty.abbrev} x${ty.count}`, x + cellW / 2, ty0 + 7, { size: 6.5, bold: true, color: COLORS.white, align: 'center' });
    });
  });
  flow.y = top + 16 + r.rows * (cellH + gap) + 6;
  if (r.legend.length > 0) {
    let x = flow.left;
    for (const l of r.legend) {
      s.rect(x, flow.y, 8, 8, { fill: hexColor(l.color), radius: 2 });
      s.text(`${l.abbrev} = ${l.label}`, x + 11, flow.y + 7, { size: 8 });
      x += 22 + s.width(`${l.abbrev} = ${l.label}`, { size: 8 });
    }
    s.circle(flow.right - 100, flow.y + 4, 2.5, { fill: COLORS.amber });
    s.text(t('rep.diaryTrigger'), flow.right - 94, flow.y + 7, { size: 8, color: COLORS.muted });
    flow.y += 16;
  }
  if (r.medications) flow.paragraph(`${t('rep.currentMeds')}: ${r.medications}`, { size: 8, gap: 3 });
  for (const line of r.changeLines) flow.paragraph(`${t('rep.medChanges')}: ${line}`, { size: 8, color: COLORS.muted, gap: 1 });
  flow.pageNumbers((p, n) => t('rep.page', { page: p, pages: n }));
}

export function renderEeg(r: EegReport, t: ReportText, s: Surface): void {
  const flow = new Flow(s, { margin: 40, top: 34 });
  flow.header({ title: t('rep.titleEeg'), lines: [`${t('rep.generated')}: ${r.generated}`] });
  if (r.session) {
    flow.cards([
      { label: t('eeg.title'), value: r.session.title, lines: [`${t('rep.eegStart')}: ${r.session.start}`, `${t('rep.eegEnd')}: ${r.session.end}`, ...(r.session.planned ? [`${t('rep.eegPlanned')}: ${r.session.planned}`] : [])] },
      { label: t('rep.eegStatus'), value: r.session.status, lines: r.session.notes ? [r.session.notes] : [] },
    ], { minHeight: 60 });
  }
  flow.title(t('eeg.timeline'));
  flow.table(
    [
      { title: t('rep.eegWhat'), grow: 3 },
      { title: t('rep.eegStart'), grow: 2 },
      { title: t('rep.eegEnd'), grow: 2 },
      { title: t('rep.duration'), width: 50 },
      { title: t('rep.eegMood'), grow: 1 },
      { title: t('rep.notes'), grow: 2 },
    ],
    r.items.map((i) => [{ text: i.what, bold: i.kind === 'seizure', color: i.kind === 'seizure' ? COLORS.accent : COLORS.ink }, i.start, i.end, i.duration, i.mood, i.notes]),
    { size: 7.5 },
  );
  flow.pageNumbers((p, n) => t('rep.page', { page: p, pages: n }));
}

export interface RecoveryKitReport {
  person: string;
  date: string;
  kit: string;
  qr: { size: number; dark: boolean[] };
}

/** The recovery kit on one page: what it is, the QR code, and the code as text, to print and keep somewhere safe. */
export function renderRecoveryKit(r: RecoveryKitReport, t: ReportText, s: Surface): void {
  const flow = new Flow(s, { margin: 50, top: 48 });
  flow.header({ title: t('kit.title'), lines: [`${r.person} - ${r.date}`] });
  flow.paragraph(t('kit.what'), { size: 10, gap: 8 });
  flow.paragraph(t('kit.keep'), { size: 10, gap: 14 });
  const size = 230;
  const x = (s.pageWidth - size) / 2;
  flow.ensure(size + 40);
  const cell = size / r.qr.size;
  s.rect(x - 8, flow.y - 8, size + 16, size + 16, { fill: COLORS.white, stroke: COLORS.line });
  for (let row = 0; row < r.qr.size; row++)
    for (let col = 0; col < r.qr.size; col++)
      if (r.qr.dark[row * r.qr.size + col]) s.rect(x + col * cell, flow.y + row * cell, cell + 0.3, cell + 0.3, { fill: COLORS.ink });
  flow.y += size + 24;
  flow.paragraph(t('kit.codeLabel'), { size: 9, bold: true, gap: 4 });
  const chunks = r.kit.match(/.{1,52}/g) ?? [];
  for (const chunk of chunks) flow.paragraph(chunk, { size: 9, mono: true, gap: 1 });
  flow.space(12);
  flow.paragraph(t('kit.use'), { size: 9, color: COLORS.muted });
}
