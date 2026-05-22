// Pure SVG chart generators for the neurologist PDF report.
// Each function returns an SVG string — no React, no recharts needed.

import { esc } from './htmlEscape';
import { phaseDurs } from './phaseCalculations';

const NO_DATA = (title) => `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg">
  <rect width="520" height="140" fill="#f9fafb" rx="6"/>
  <text x="260" y="58" text-anchor="middle" font-size="10" font-weight="bold" fill="#374151">${esc(title)}</text>
  <text x="260" y="76" text-anchor="middle" font-size="9" fill="#9ca3af">No data available for this period</text>
</svg>`;

// ── A. Seizure frequency bar chart (last N days) ─────────────
export function freqBarChartSVG(events, days = 30) {
  if (!events.length) return NO_DATA(`SEIZURE FREQUENCY — LAST ${days} DAYS`);

  const W = 520, H = 150, ml = 35, mr = 15, mt = 18, mb = 30;
  const cw = W - ml - mr, ch = H - mt - mb;
  const now = Date.now();

  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400000);
    d.setHours(0, 0, 0, 0);
    return { label: d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }), start: d.getTime(), end: d.getTime() + 86399999, count: 0, hasLong: false };
  });

  events.forEach(e => {
    const t = e.startTime || 0;
    for (const b of buckets) {
      if (t >= b.start && t <= b.end) { b.count++; if ((e.duration || 0) > 300) b.hasLong = true; break; }
    }
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const bw = cw / days;
  const showEvery = Math.ceil(days / 8);

  const bars = buckets.map((b, i) => {
    const bh = (b.count / maxCount) * ch;
    const x = (ml + i * bw + 0.5).toFixed(1);
    const y = (mt + ch - bh).toFixed(1);
    const fill = b.count === 0 ? '#e5e7eb' : (b.hasLong ? '#dc2626' : '#1e3a5f');
    return `<rect x="${x}" y="${y}" width="${Math.max(bw - 1, 1).toFixed(1)}" height="${Math.max(bh, 0.5).toFixed(1)}" fill="${fill}"/>`;
  }).join('');

  const xLbls = buckets.map((b, i) => i % showEvery === 0
    ? `<text x="${(ml + i * bw + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="#9ca3af">${esc(b.label)}</text>`
    : '').join('');

  const yLines = [0, Math.ceil(maxCount / 2), maxCount].map(v => {
    const y = (mt + ch - (v / maxCount) * ch).toFixed(1);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">SEIZURE FREQUENCY — LAST ${days} DAYS</text>
  ${yLines}${bars}${xLbls}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <rect x="${W - 90}" y="${H - 18}" width="8" height="8" fill="#1e3a5f"/>
  <text x="${W - 79}" y="${H - 11}" font-size="7" fill="#6b7280">Normal</text>
  <rect x="${W - 40}" y="${H - 18}" width="8" height="8" fill="#dc2626"/>
  <text x="${W - 29}" y="${H - 11}" font-size="7" fill="#6b7280">&gt;5 min</text>
</svg>`;
}

// ── B. Duration trend line chart ──────────────────────────────
export function durationLineSVG(events) {
  if (!events.length) return NO_DATA('SEIZURE DURATION TREND');

  const W = 520, H = 150, ml = 45, mr = 15, mt = 18, mb = 28;
  const cw = W - ml - mr, ch = H - mt - mb;
  const sorted = [...events].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const maxDur = Math.max(...sorted.map(e => e.duration || 0), 60);
  const n = sorted.length;

  const px = i => (ml + (n > 1 ? i / (n - 1) : 0.5) * cw).toFixed(1);
  const py = d => (mt + ch - Math.min(d / maxDur, 1) * ch).toFixed(1);

  const pts = sorted.map((e, i) => `${px(i)},${py(e.duration || 0)}`).join(' ');

  const dots = sorted.map((e, i) => {
    const isLong = (e.duration || 0) > 300;
    return `<circle cx="${px(i)}" cy="${py(e.duration || 0)}" r="${isLong ? 4 : 3}" fill="${isLong ? '#dc2626' : '#1e3a5f'}"/>`;
  }).join('');

  const ty = +py(300);
  const thresh = ty > mt && ty < mt + ch
    ? `<line x1="${ml}" y1="${ty.toFixed(1)}" x2="${ml + cw}" y2="${ty.toFixed(1)}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="4 3"/>` +
      `<text x="${ml + 3}" y="${(ty - 3).toFixed(1)}" font-size="7" fill="#dc2626">5 min</text>`
    : '';

  const yTicks = [0, Math.round(maxDur * 0.5), maxDur].map(v => {
    const y = py(v);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}s</text>`;
  }).join('');

  const step = Math.max(1, Math.ceil(n / 6));
  const xLbls = sorted.map((e, i) => (i % step === 0 || i === n - 1)
    ? `<text x="${px(i)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="#9ca3af">${esc(e.date || '')}</text>`
    : '').join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">SEIZURE DURATION TREND</text>
  ${yTicks}${thresh}
  <polyline points="${pts}" fill="none" stroke="#1e3a5f" stroke-width="1.5" stroke-linejoin="round"/>
  ${dots}${xLbls}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
</svg>`;
}

// ── C. Seizure type distribution (horizontal bars) ────────────
export function typeBarSVG(byType, total) {
  const entries = Object.entries(byType).sort(([, a], [, b]) => b - a);
  if (!entries.length) return NO_DATA('SEIZURE TYPE DISTRIBUTION');

  const W = 520, rowH = 26, lblW = 160, barMax = 260, padT = 22, padB = 10;
  const H = padT + entries.length * rowH + padB;

  const rows = entries.map(([type, count], i) => {
    const pct = total ? count / total : 0;
    const bw = Math.max(pct * barMax, 2).toFixed(1);
    const y = padT + i * rowH;
    return `<text x="${lblW - 6}" y="${y + 17}" text-anchor="end" font-size="9" fill="#374151">${esc(type)}</text>` +
           `<rect x="${lblW}" y="${y + 5}" width="${bw}" height="${rowH - 10}" fill="#1e293b" rx="2"/>` +
           `<text x="${(lblW + +bw + 5).toFixed(1)}" y="${y + 17}" font-size="9" fill="#6b7280">${count} (${Math.round(pct * 100)}%)</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="14" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">SEIZURE TYPE DISTRIBUTION</text>
  ${rows}
</svg>`;
}

// ── D. Phase breakdown stacked bar (last N events) ────────────
export function phaseStackSVG(events, last = 10) {
  const slice = [...events].sort((a, b) => (a.startTime || 0) - (b.startTime || 0)).slice(-last);
  if (!slice.length) return NO_DATA('PHASE BREAKDOWN');

  const W = 520, H = 175, ml = 42, mr = 15, mt = 18, mb = 45;
  const cw = W - ml - mr, ch = H - mt - mb;

  const allMax = slice.map(e => { const d = phaseDurs(e); return Math.max(d.aura + d.seizure + d.recovery, e.duration || 0); });
  const maxTotal = Math.max(...allMax, 1);
  const bw = cw / slice.length;
  const toH = v => (v / maxTotal) * ch;

  const bars = slice.map((e, i) => {
    const d = phaseDurs(e);
    const x = ml + i * bw;
    let yBot = mt + ch;
    let segs = '';

    if (d.recovery > 0) { const h = toH(d.recovery); yBot -= h; segs += `<rect x="${(x + 1.5).toFixed(1)}" y="${yBot.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" fill="#3b82f6" rx="1"/>`; }
    if (d.seizure  > 0) { const h = toH(d.seizure);  yBot -= h; segs += `<rect x="${(x + 1.5).toFixed(1)}" y="${yBot.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" fill="#dc2626" rx="1"/>`; }
    if (d.aura     > 0) { const h = toH(d.aura);     yBot -= h; segs += `<rect x="${(x + 1.5).toFixed(1)}" y="${yBot.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" fill="#d97706" rx="1"/>`; }

    // Fallback: show total as grey if no phase data
    if (d.aura + d.seizure + d.recovery === 0 && (e.duration || 0) > 0) {
      const h = toH(e.duration || 0);
      segs += `<rect x="${(x + 1.5).toFixed(1)}" y="${(mt + ch - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" fill="#94a3b8" rx="1"/>`;
    }

    const lbl = (e.date || '').split('/').slice(0, 2).join('/');
    segs += `<text x="${(x + bw / 2).toFixed(1)}" y="${mt + ch + 12}" text-anchor="middle" font-size="7" fill="#9ca3af">${esc(lbl)}</text>`;
    return segs;
  }).join('');

  const yTicks = [0, Math.round(maxTotal / 2), maxTotal].map(v => {
    const y = (mt + ch - (v / maxTotal) * ch).toFixed(1);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}s</text>`;
  }).join('');

  const ly = mt + ch + 28, cx = W / 2;
  const legend =
    `<rect x="${cx - 120}" y="${ly}" width="9" height="9" fill="#d97706" rx="1"/><text x="${cx - 108}" y="${ly + 8}" font-size="8" fill="#374151">Aura</text>` +
    `<rect x="${cx - 75}" y="${ly}" width="9" height="9" fill="#dc2626" rx="1"/><text x="${cx - 63}" y="${ly + 8}" font-size="8" fill="#374151">Seizure</text>` +
    `<rect x="${cx - 20}" y="${ly}" width="9" height="9" fill="#3b82f6" rx="1"/><text x="${cx - 8}" y="${ly + 8}" font-size="8" fill="#374151">Recovery</text>` +
    `<rect x="${cx + 50}" y="${ly}" width="9" height="9" fill="#94a3b8" rx="1"/><text x="${cx + 62}" y="${ly + 8}" font-size="8" fill="#374151">No phase data</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">PHASE BREAKDOWN — LAST ${slice.length} EVENTS</text>
  ${yTicks}${bars}${legend}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
</svg>`;
}
