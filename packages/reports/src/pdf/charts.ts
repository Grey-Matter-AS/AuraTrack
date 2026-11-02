import type { ChartData } from '../neurologist';
import { COLORS, hexColor, type Flow } from './flow';
import type { Color } from './surface';

// Charts drawn as vector shapes, so they print sharp at any size and the text in them stays text.

const PLOT = { left: 34, right: 8, top: 22, bottom: 24 };

function frame(flow: Flow, title: string, height: number) {
  flow.ensure(height + 22);
  flow.s.text(title, flow.left, flow.y + 9, { size: 9, bold: true });
  const top = flow.y + PLOT.top;
  const box = { x: flow.left + PLOT.left, y: top, w: flow.width - PLOT.left - PLOT.right, h: height - PLOT.top - PLOT.bottom };
  return { box, bottom: flow.y + height };
}

/** Seizures per day (week or month), with those at or over the alert time marked in red. */
export function frequencyChart(flow: Flow, data: ChartData, title: string, legend: string): void {
  const height = 150;
  const { box, bottom } = frame(flow, title, height);
  const s = flow.s;
  const max = Math.max(1, ...data.frequency.map((b) => b.count));
  const step = data.frequency.length > 0 ? box.w / data.frequency.length : box.w;
  const barW = Math.max(1.2, Math.min(18, step * 0.72));
  for (const v of [0, max]) {
    const y = box.y + box.h - (v / max) * box.h;
    s.line(box.x, y, box.x + box.w, y, { color: COLORS.line, width: 0.6 });
    s.text(String(v), box.x - 4, y + 3, { size: 7, color: COLORS.muted, align: 'right' });
  }
  const every = Math.max(1, Math.ceil(data.frequency.length / 8));
  data.frequency.forEach((b, i) => {
    const x = box.x + i * step + (step - barW) / 2;
    const h = (b.count / max) * box.h;
    if (b.count > 0) s.rect(x, box.y + box.h - h, barW, h, { fill: COLORS.blue });
    if (b.long > 0) s.rect(x, box.y + box.h - (b.long / max) * box.h, barW, (b.long / max) * box.h, { fill: COLORS.accent });
    if (i % every === 0) s.text(b.day.slice(5), x + barW / 2, bottom - 8, { size: 6.5, color: COLORS.muted, align: 'center' });
  });
  s.text(legend, flow.right, flow.y + 9, { size: 7, color: COLORS.muted, align: 'right' });
  flow.y = bottom + 8;
}

/** The length of each seizure over time, with the alert time as a dashed line. */
export function durationChart(flow: Flow, data: ChartData, alertSeconds: number, title: string, legend: string): void {
  const height = 150;
  const { box, bottom } = frame(flow, title, height);
  const s = flow.s;
  const points = data.durations;
  const max = Math.max(60, alertSeconds * 1.1, ...points.map((p) => p.seconds));
  const first = points[0]?.at ?? 0;
  const last = points[points.length - 1]?.at ?? first;
  const xOf = (at: number) => (last === first ? box.x + box.w / 2 : box.x + ((at - first) / (last - first)) * box.w);
  const yOf = (sec: number) => box.y + box.h - (sec / max) * box.h;
  for (const v of [0, Math.round(max)]) {
    s.line(box.x, yOf(v), box.x + box.w, yOf(v), { color: COLORS.line, width: 0.6 });
    s.text(String(v), box.x - 4, yOf(v) + 3, { size: 7, color: COLORS.muted, align: 'right' });
  }
  s.line(box.x, yOf(alertSeconds), box.x + box.w, yOf(alertSeconds), { color: COLORS.accent, width: 0.8, dash: [3, 2] });
  if (points.length > 1) s.polyline(points.map((p) => [xOf(p.at), yOf(p.seconds)] as const), { color: COLORS.blue, width: 1 });
  for (const p of points) s.circle(xOf(p.at), yOf(p.seconds), 2, { fill: p.seconds >= alertSeconds ? COLORS.accent : COLORS.blue });
  s.text(legend, flow.right, flow.y + 9, { size: 7, color: COLORS.muted, align: 'right' });
  flow.y = bottom + 8;
}

/** Horizontal bars with a name and a count for each. */
export function barList(flow: Flow, rows: { label: string; value: number; text?: string; color?: Color }[], title: string): void {
  const rowH = 15;
  flow.ensure((title ? 24 : 4) + rows.length * rowH + 8);
  if (title) flow.s.text(title, flow.left, flow.y + 9, { size: 9, bold: true });
  const max = Math.max(1, ...rows.map((r) => r.value));
  const labelW = flow.width * 0.34;
  const barX = flow.left + labelW + 6;
  const barW = flow.width - labelW - 6 - 42;
  let y = flow.y + (title ? 22 : 2);
  for (const r of rows) {
    const label = flow.s.wrap(r.label, labelW, { size: 7.5 })[0] ?? '';
    flow.s.text(label, flow.left, y + 8, { size: 7.5 });
    flow.s.rect(barX, y, Math.max(1, (r.value / max) * barW), 10, { fill: r.color ?? COLORS.blue });
    flow.s.text(r.text ?? String(r.value), barX + Math.max(1, (r.value / max) * barW) + 4, y + 8, { size: 7.5, color: COLORS.muted });
    y += rowH;
  }
  flow.y = y + 8;
}

/** The last seizures as stacked bars: aura, seizure and recovery in seconds. */
export function phaseChart(flow: Flow, data: ChartData, title: string, names: [string, string, string]): void {
  const rows = data.phases;
  if (rows.length === 0) return;
  const colours: Color[] = [COLORS.amber, COLORS.accent, COLORS.blue];
  const rowH = 15;
  flow.ensure(34 + rows.length * rowH + 8);
  flow.s.text(title, flow.left, flow.y + 9, { size: 9, bold: true });
  names.forEach((n, i) => {
    const x = flow.right - (names.length - i) * 70;
    flow.s.rect(x, flow.y + 3, 6, 6, { fill: colours[i] ?? COLORS.blue });
    flow.s.text(n, x + 9, flow.y + 9, { size: 7, color: COLORS.muted });
  });
  const max = Math.max(1, ...rows.map((r) => r.aura + r.seizure + r.recovery));
  const labelW = flow.width * 0.3;
  const barX = flow.left + labelW + 6;
  const barW = flow.width - labelW - 6;
  let y = flow.y + 24;
  for (const r of rows) {
    flow.s.text(flow.s.wrap(r.label, labelW, { size: 7 })[0] ?? '', flow.left, y + 8, { size: 7 });
    let x = barX;
    [r.aura, r.seizure, r.recovery].forEach((v, i) => {
      const w = (v / max) * barW;
      if (w > 0) flow.s.rect(x, y, w, 10, { fill: colours[i] ?? COLORS.blue });
      x += w;
    });
    y += rowH;
  }
  flow.y = y + 8;
}

/** For each wellbeing factor, how often it was present on days with a seizure and on days without. */
export function factorChart(flow: Flow, data: ChartData, title: string, names: [string, string]): void {
  const rows = data.factors.filter((f) => f.seizureShare > 0 || f.otherShare > 0);
  if (rows.length === 0) return;
  const rowH = 24;
  flow.ensure(34 + rows.length * rowH + 8);
  flow.s.text(title, flow.left, flow.y + 9, { size: 9, bold: true });
  const colours: Color[] = [COLORS.accent, COLORS.soft];
  names.forEach((n, i) => {
    const x = flow.right - (names.length - i) * 110;
    flow.s.rect(x, flow.y + 3, 6, 6, { fill: colours[i] ?? COLORS.blue });
    flow.s.text(n, x + 9, flow.y + 9, { size: 7, color: COLORS.muted });
  });
  const labelW = flow.width * 0.34;
  const barX = flow.left + labelW + 6;
  const barW = flow.width - labelW - 6 - 44;
  let y = flow.y + 24;
  for (const r of rows) {
    flow.s.text(flow.s.wrap(r.label, labelW, { size: 7.5 })[0] ?? '', flow.left, y + 9, { size: 7.5 });
    flow.s.rect(barX, y, Math.max(1, r.seizureShare * barW), 8, { fill: colours[0] ?? COLORS.accent });
    flow.s.text(r.seizureDays, barX + Math.max(1, r.seizureShare * barW) + 4, y + 7, { size: 6.5, color: COLORS.muted });
    flow.s.rect(barX, y + 10, Math.max(1, r.otherShare * barW), 8, { fill: colours[1] ?? COLORS.soft });
    flow.s.text(r.otherDays, barX + Math.max(1, r.otherShare * barW) + 4, y + 17, { size: 6.5, color: COLORS.muted });
    y += rowH;
  }
  flow.y = y + 8;
}

export { hexColor };
