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
}

const ROW_Y: Record<EventKind, number> = { seizure: 24, between: 58, medication: 84, missed: 110 };
const EW = 320;
const EH = 142;
const EPAD = { left: 8, right: 8 };

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
            <text className="ui-chart__tick" x={px(tick.at)} y={EH - 8} textAnchor="middle">
              {tick.label}
            </text>
          </g>
        ))}
        {events.map((e) => {
          const cx = px(e.at);
          const cy = ROW_Y[e.kind];
          const open = onOpen ? () => onOpen(e.id) : undefined;
          const style = { '--series': `var(--series-${e.series ?? 1})` } as CSSProperties;
          if (e.kind === 'seizure') {
            const r = 4 + (e.size ?? 0) * 9;
            return (
              <g key={e.id} onClick={open} style={style}>
                {e.long ? <circle className="ui-chart__long" cx={cx} cy={cy} r={r + 3} /> : null}
                <circle
                  className={e.open ? 'ui-chart__seizure ui-chart__seizure--open' : 'ui-chart__seizure'}
                  cx={cx}
                  cy={cy}
                  r={r}
                />
              </g>
            );
          }
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
