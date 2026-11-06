import type { CSSProperties } from 'react';

// Charts drawn as SVG. They are pictures (a screen reader gets the summary and the list that goes with them), so the shapes
// are hidden from assistive technology; anything that must be reachable is also offered as a real button next to the chart.

export interface TrendBar {
  /** The text under the bar when it is shown, such as "5 Oct". */
  label: string;
  value: number;
  /** How many of the value are marked (for example long seizures); drawn on top in the warning colour. */
  marked?: number;
}
export interface TrendMarker {
  /** The bar the marker stands under. */
  index: number;
  label: string;
}

const W = 320;
const H = 150;
const PAD = { left: 24, right: 6, top: 8, bottom: 30 };

/** Bars per day, week or month, with markers under the axis (for example a change of medicine). */
export function TrendChart({
  bars,
  markers = [],
  label,
}: {
  bars: readonly TrendBar[];
  markers?: readonly TrendMarker[];
  /** What the chart says in words, for a screen reader. */
  label: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = bars.length > 0 ? plotW / bars.length : plotW;
  const barW = Math.max(1, Math.min(24, step * 0.7));
  const x = (i: number) => PAD.left + step * i + (step - barW) / 2;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  // About four labels under the axis, whatever the number of bars
  const every = Math.max(1, Math.ceil(bars.length / 4));
  return (
    <svg className="ui-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <g aria-hidden="true">
        <line className="ui-chart__axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
        <text className="ui-chart__tick" x={PAD.left - 4} y={y(0) + 3} textAnchor="end">
          0
        </text>
        <text className="ui-chart__tick" x={PAD.left - 4} y={y(max) + 3} textAnchor="end">
          {max}
        </text>
        {bars.map((b, i) => (
          <g key={i}>
            <rect
              className="ui-chart__bar"
              x={x(i)}
              y={y(b.value)}
              width={barW}
              height={Math.max(0, y(0) - y(b.value))}
              rx="2"
            />
            {b.marked ? (
              <rect
                className="ui-chart__bar ui-chart__bar--marked"
                x={x(i)}
                y={y(b.value)}
                width={barW}
                height={Math.max(0, y(0) - y(b.marked))}
                rx="2"
              />
            ) : null}
            {i % every === 0 ? (
              <text className="ui-chart__tick" x={x(i) + barW / 2} y={H - 14} textAnchor="middle">
                {b.label}
              </text>
            ) : null}
          </g>
        ))}
        {markers.map((m, i) => (
          <path key={i} className="ui-chart__marker" d={`M ${x(m.index) + barW / 2 - 4} ${H - 4} l 4 -8 l 4 8 z`} />
        ))}
      </g>
    </svg>
  );
}

export type EventKind = 'seizure' | 'between' | 'medication' | 'missed';

export interface ChartEvent {
  id: string;
  /** Position along the axis, 0 to 1. */
  at: number;
  kind: EventKind;
  /** Seizures: 0 to 1, the length of the seizure against the longest the chart expects. */
  size?: number;
  /** Seizures: which of the eight series colours (the type), 1 to 8. */
  series?: number;
  /** A seizure whose end was not recorded is drawn as a ring. */
  open?: boolean;
  /** A seizure at or over the emergency alert time gets a second ring. */
  long?: boolean;
  /** Seizures: the local day ("2026-11-04"). Seizures on the same day share one circle with their number in it. */
  day?: string;
}

const ROW_Y: Record<EventKind, number> = { seizure: 24, between: 58, medication: 84, missed: 110 };
const EW = 320;
const EH = 142;
const EPAD = { left: 8, right: 8 };

interface SeizureGroup {
  first: string;
  at: number;
  count: number;
  size: number;
  series: number;
  open: boolean;
  long: boolean;
}

/**
 * Seizures on the same day share one circle, with how many there were written inside it; a single seizure shows 1.
 * Seizures on different days always keep their own circles. The circle takes the largest size and the colour of the
 * longest seizure in it, a ring when any end was not recorded, and the alert ring when any was long.
 */
function groupSeizures(events: readonly ChartEvent[]): SeizureGroup[] {
  const groups = new Map<string, ChartEvent[]>();
  for (const e of events) {
    if (e.kind !== 'seizure') continue;
    const key = e.day ?? `own:${e.id}`; // without a day, a seizure is never joined with another
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].map((members) => {
    const longest = members.reduce((a, b) => ((b.size ?? 0) > (a.size ?? 0) ? b : a));
    const earliest = members.reduce((a, b) => (b.at < a.at ? b : a));
    return {
      first: earliest.id,
      at: members.reduce((n, m) => n + m.at, 0) / members.length,
      count: members.length,
      size: longest.size ?? 0,
      series: longest.series ?? 1,
      open: members.some((m) => m.open),
      long: members.some((m) => m.long),
    };
  });
}

/** Seizures, between-seizures entries, medicine changes and missed doses along one axis. */
export function EventChart({
  events,
  ticks,
  label,
  onOpen,
}: {
  events: readonly ChartEvent[];
  /** Labels under the axis, each at a position 0 to 1. */
  ticks: readonly { at: number; label: string }[];
  label: string;
  /** Called with the event id when its shape is tapped (the list next to the chart does the same for the keyboard). */
  onOpen?: (id: string) => void;
}) {
  const plotW = EW - EPAD.left - EPAD.right;
  const px = (at: number) => EPAD.left + Math.min(1, Math.max(0, at)) * plotW;
  const seizureGroups = groupSeizures(events);
  // Different days never share a circle; where neighbouring days' circles would overlap, the next steps down a lane,
  // so every number stays readable
  const radius = (g: SeizureGroup) => Math.max(g.count > 9 ? 9 : 7.5, 4 + g.size * 9);
  const placed: { g: SeizureGroup; r: number; lane: number }[] = [];
  for (const g of [...seizureGroups].sort((a, b) => a.at - b.at)) {
    const r = radius(g);
    const prev = placed[placed.length - 1];
    const overlaps = prev !== undefined && px(g.at) - px(prev.g.at) < r + prev.r + 4;
    placed.push({ g, r, lane: overlaps && prev.lane === 0 ? 1 : 0 });
  }
  return (
    <svg className="ui-chart" viewBox={`0 0 ${EW} ${EH}`} role="img" aria-label={label}>
      <g aria-hidden="true">
        {(Object.keys(ROW_Y) as EventKind[]).map((kind) => (
          <line
            key={kind}
            className="ui-chart__row"
            x1={EPAD.left}
            x2={EW - EPAD.right}
            y1={ROW_Y[kind]}
            y2={ROW_Y[kind]}
          />
        ))}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line className="ui-chart__grid" x1={px(tick.at)} x2={px(tick.at)} y1={6} y2={EH - 22} />
            {/* A label at either edge is set inwards, so it is never cut off */}
            <text
              className="ui-chart__tick"
              x={px(tick.at)}
              y={EH - 8}
              textAnchor={px(tick.at) < 24 ? 'start' : px(tick.at) > EW - 24 ? 'end' : 'middle'}
            >
              {tick.label}
            </text>
          </g>
        ))}
        {placed.map(({ g, r, lane }) => {
          const cx = px(g.at);
          const cy = ROW_Y.seizure + lane * 17;
          const open = onOpen ? () => onOpen(g.first) : undefined;
          // The first (usual) kind follows the accent colour; further kinds keep their own colours, so kinds stay apart
          const style = {
            '--series': g.series === 1 ? 'var(--accent)' : `var(--series-${g.series})`,
          } as CSSProperties;
          return (
            <g key={g.first} onClick={open} style={style}>
              {g.long ? <circle className="ui-chart__long" cx={cx} cy={cy} r={r + 3} /> : null}
              <circle
                className={g.open ? 'ui-chart__seizure ui-chart__seizure--open' : 'ui-chart__seizure'}
                cx={cx}
                cy={cy}
                r={r}
              />
              <text
                className={g.open ? 'ui-chart__count ui-chart__count--open' : 'ui-chart__count'}
                x={cx}
                y={cy + 3.2}
                textAnchor="middle"
              >
                {g.count}
              </text>
            </g>
          );
        })}
        {events.map((e) => {
          const cx = px(e.at);
          const cy = ROW_Y[e.kind];
          const open = onOpen ? () => onOpen(e.id) : undefined;
          if (e.kind === 'seizure') return null;
          if (e.kind === 'between')
            return (
              <rect
                key={e.id}
                className="ui-chart__between"
                x={cx - 4}
                y={cy - 4}
                width="8"
                height="8"
                transform={`rotate(45 ${cx} ${cy})`}
                onClick={open}
              />
            );
          if (e.kind === 'medication')
            return (
              <path
                key={e.id}
                className="ui-chart__marker"
                d={`M ${cx - 5} ${cy + 5} l 5 -10 l 5 10 z`}
                onClick={open}
              />
            );
          return (
            <path
              key={e.id}
              className="ui-chart__missed"
              d={`M ${cx - 4} ${cy - 4} l 8 8 m 0 -8 l -8 8`}
              onClick={open}
            />
          );
        })}
      </g>
    </svg>
  );
}

export interface SeriesPoint {
  /** The first line under the bar, such as "Mon" (or "" for none). */
  sub: string;
  /** The second line, such as "3 Nov". */
  label: string;
  value: number;
  /** How many of the value are marked (for example long seizures): the lower, amber part of the bar. */
  marked: number;
}
export interface SeriesEvent {
  /** The bar the event belongs to. */
  index: number;
  label: string;
}

const TW = 360;
const TH = 230;
const TP = { left: 30, right: 10, top: 18, bottom: 36 };

/** 0, 1, 2 ... up to a clean top a little above the highest value: whole numbers only, at most five steps. */
function countTicks(max: number): number[] {
  const top = Math.max(1, Math.ceil(max));
  const step = Math.max(1, Math.ceil(top / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= top + step - 1; v += step) ticks.push(v);
  return ticks;
}

/**
 * A time series of counts, as in a medical or process-control chart: whole-number y axis with light gridlines, one bar per
 * day, week or month (the marked part in amber, the rest in blue), the count printed on each bar that has room, two-line
 * date labels (day and date), optional reference lines (average, upper limit; their values belong in the legend, so no
 * text sits on the bars) and event markers (a change of medicine).
 * Tapping a column selects it; the screen shows the selected column's numbers, and the same numbers are in a table view,
 * so nothing depends on seeing the picture.
 */
export function TimeSeriesChart({
  points,
  events = [],
  average = null,
  limit = null,
  selected = null,
  onSelect,
  label,
}: {
  points: readonly SeriesPoint[];
  events?: readonly SeriesEvent[];
  average?: number | null;
  limit?: number | null;
  selected?: number | null;
  onSelect?: (index: number) => void;
  /** What the chart shows, in words, for a screen reader. */
  label: string;
}) {
  const ticks = countTicks(Math.max(0, ...points.map((p) => p.value), average ?? 0, limit ?? 0));
  const top = ticks[ticks.length - 1] ?? 1;
  const plotW = TW - TP.left - TP.right;
  const plotH = TH - TP.top - TP.bottom;
  const step = points.length > 0 ? plotW / points.length : plotW;
  const barW = Math.max(2, Math.min(24, step * 0.7));
  const cx = (i: number) => TP.left + step * i + step / 2;
  const y = (v: number) => TP.top + plotH - (v / top) * plotH;
  const base = y(0);
  // About seven date labels, whatever the number of bars; the count on a bar only where it fits
  const every = Math.max(1, Math.ceil(points.length / 7));
  const roomForCount = step >= 8.5;
  // A bar with a rounded data end and a square foot
  const column = (x: number, y0: number, y1: number, round: boolean) => {
    const h = y0 - y1;
    if (h <= 0) return '';
    const r = round ? Math.min(4, barW / 2, h) : 0;
    return `M ${x} ${y0} V ${y1 + r} Q ${x} ${y1} ${x + r} ${y1} H ${x + barW - r} Q ${x + barW} ${y1} ${x + barW} ${y1 + r} V ${y0} Z`;
  };
  return (
    <svg className="ui-chart ui-series" viewBox={`0 0 ${TW} ${TH}`} role="img" aria-label={label}>
      <g aria-hidden="true">
        {ticks.map((v) => (
          <g key={v}>
            <line
              className={v === 0 ? 'ui-chart__axis' : 'ui-chart__grid'}
              x1={TP.left}
              x2={TW - TP.right}
              y1={y(v)}
              y2={y(v)}
            />
            <text className="ui-chart__tick ui-series__num" x={TP.left - 5} y={y(v) + 3.5} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {selected !== null && selected >= 0 && selected < points.length ? (
          <rect
            className="ui-series__selected"
            x={TP.left + step * selected}
            y={TP.top - 6}
            width={step}
            height={plotH + 6}
            rx="3"
          />
        ) : null}
        {events.map((e, i) => (
          <g key={`e${i}`}>
            <line className="ui-series__event" x1={cx(e.index)} x2={cx(e.index)} y1={TP.top} y2={base} />
            <path className="ui-chart__marker" d={`M ${cx(e.index) - 4} ${base + 1} l 4 6 l 4 -6 z`} />
          </g>
        ))}
        {points.map((p, i) => {
          const x = cx(i) - barW / 2;
          const marked = Math.min(p.marked, p.value);
          const gap = marked > 0 && marked < p.value ? 1 : 0; // the 2px surface gap between the two parts (1 each side)
          return (
            <g key={i}>
              {marked > 0 ? (
                <path className="ui-series__marked" d={column(x, base, y(marked) + gap, marked === p.value)} />
              ) : null}
              {p.value > marked ? (
                <path className="ui-series__bar" d={column(x, y(marked) - gap, y(p.value), true)} />
              ) : null}
              {p.value > 0 && roomForCount ? (
                <text className="ui-series__count ui-series__num" x={cx(i)} y={y(p.value) - 4} textAnchor="middle">
                  {p.value}
                </text>
              ) : null}
              {i % every === 0 ? (
                <text className="ui-chart__tick" x={cx(i)} y={TH - 21} textAnchor="middle">
                  {p.sub ? <tspan x={cx(i)}>{p.sub}</tspan> : null}
                  <tspan x={cx(i)} dy={p.sub ? 11 : 0}>
                    {p.label}
                  </tspan>
                </text>
              ) : null}
            </g>
          );
        })}
        {average !== null ? (
          <g>
            <line className="ui-series__average" x1={TP.left} x2={TW - TP.right} y1={y(average)} y2={y(average)} />
          </g>
        ) : null}
        {limit !== null ? (
          <g>
            <line className="ui-series__limit" x1={TP.left} x2={TW - TP.right} y1={y(limit)} y2={y(limit)} />
          </g>
        ) : null}
      </g>
      {onSelect
        ? points.map((_, i) => (
            <rect
              key={`hit${i}`}
              className="ui-series__hit"
              x={TP.left + step * i}
              y={TP.top - 6}
              width={step}
              height={plotH + TP.bottom}
              onClick={() => onSelect(i)}
            />
          ))
        : null}
    </svg>
  );
}

/** The key under a chart: a swatch and a name per series, in text colours (the swatch carries the colour). */
export function ChartLegend({
  items,
}: {
  items: readonly { label: string; kind: 'bar' | 'marked' | 'average' | 'limit' }[];
}) {
  return (
    <ul className="ui-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`ui-legend__key ui-legend__key--${item.kind}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
