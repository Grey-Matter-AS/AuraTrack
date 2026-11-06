import type { CSSProperties } from 'react';
import { cx } from './cx';

/** The four phases of a seizure's symptoms: warning signs (before it), aura, seizure, recovery. */
export type TimelinePhase = 'prodrome' | 'aura' | 'seizure' | 'recovery';

/** One line of the timeline, top to bottom. Texts are already in the reader's language. */
export type TimelineEntry =
  | { kind: 'marker'; id: string; text: string; phase: 'prodrome' | 'aura' | 'seizure' | 'recovery' }
  | { kind: 'gap'; id: string; text: string }
  | { kind: 'moment'; id: string; name: string; meta: string; phase: TimelinePhase; first?: boolean };

const MARKER_COLOUR = {
  prodrome: 'var(--phase-prodrome)',
  aura: 'var(--phase-aura)',
  seizure: 'var(--phase-seizure)',
  recovery: 'var(--phase-recovery)',
};

/**
 * The vertical seizure timeline, read-only: a line with the phase markers, and the symptoms as boxes in the order they
 * happened, with the time between them written on the line. The editor adds its own buttons to the same look.
 */
export function PhaseTimeline({ entries, label }: { entries: readonly TimelineEntry[]; label: string }) {
  return (
    <ol className="ui-timeline" aria-label={label}>
      {entries.map((entry) =>
        entry.kind === 'marker' ? (
          <li
            key={entry.id}
            className="ui-timeline__marker"
            style={{ '--phase': MARKER_COLOUR[entry.phase] } as CSSProperties}
          >
            {entry.text}
          </li>
        ) : entry.kind === 'gap' ? (
          <li key={entry.id} className="ui-timeline__gap">
            {entry.text}
          </li>
        ) : (
          <li key={entry.id} className={cx('ui-timeline__moment', `ui-timeline__moment--${entry.phase}`)}>
            <div className="ui-timeline__box">
              <p className="ui-timeline__name">
                {entry.first ? '★ ' : ''}
                {entry.name}
              </p>
              {entry.meta ? <p className="ui-timeline__meta">{entry.meta}</p> : null}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

export interface PhaseStripProps {
  /** Lengths in milliseconds. */
  aura: number;
  seizure: number;
  recovery: number;
  label: string;
  /** The words and times under the bar, such as "Aura 0:30". */
  legend: { aura: string; seizure: string; recovery: string };
}

/** The whole seizure as one bar (aura, seizure, recovery) with its legend. */
export function PhaseStrip({ aura, seizure, recovery, label, legend }: PhaseStripProps) {
  const total = Math.max(1, aura + seizure + recovery);
  const pct = (ms: number) => `${Math.round((ms / total) * 100)}%`;
  return (
    <div className="ui-strip">
      <div className="ui-strip__bar" role="img" aria-label={label}>
        <span className="ui-strip__aura" style={{ width: pct(aura) }} />
        <span className="ui-strip__seizure" style={{ width: pct(seizure) }} />
        <span className="ui-strip__recovery" style={{ width: pct(recovery) }} />
      </div>
      <ul className="ui-strip__legend">
        <li>
          <span className="ui-strip__dot ui-strip__aura" />
          {legend.aura}
        </li>
        <li>
          <span className="ui-strip__dot ui-strip__seizure" />
          {legend.seizure}
        </li>
        <li>
          <span className="ui-strip__dot ui-strip__recovery" />
          {legend.recovery}
        </li>
      </ul>
    </div>
  );
}
