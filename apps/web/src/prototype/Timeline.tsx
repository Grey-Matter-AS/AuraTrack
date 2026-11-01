import { Button, IconButton, Select } from '@auratrack/ui';
import { areaText } from './BodyMap';
import {
  GAPS,
  PHASES,
  areaRule,
  clock,
  inSeizureOrder,
  mmss,
  type Draft,
  type Gap,
  type Item,
  type PhaseName,
} from './data';
import { usePrototype } from './state';

// The graphical timeline, vertical: a line with the phases, and the symptoms as boxes in the order they happened, with the
// time between them written on the line. Phones: line on the left. This version has made-up behaviour for the prototype.

const GAP_LABEL: Record<Gap, string> = {
  same: 'At the same time',
  few: 'A few seconds later',
  s10: 'About 10 s later',
  s30: 'About 30 s later',
  m1: 'About 1 min later',
  unknown: 'Time between not known',
};
const PHASE_LABEL: Record<PhaseName, string> = { before: 'Before', during: 'During', after: 'After' };

export interface TimelineActions {
  move: (id: string, direction: -1 | 1) => void;
  setGap: (id: string, gap: Gap) => void;
  remove: (id: string) => void;
  /** Opens the body map for this symptom. */
  pickArea: (id: string) => void;
}

function Moment({
  item,
  first,
  position,
  last,
  actions,
}: {
  item: Item;
  first: boolean;
  position: number;
  last: boolean;
  actions?: TimelineActions | undefined;
}) {
  const { label, language } = usePrototype();
  const area = areaText(item.area, label);
  const rule = areaRule(item.code); // feelings and states have no place on the body; some symptoms are always in one place
  return (
    <>
      {position > 0 ? <li className="proto-gap">{GAP_LABEL[item.gap]}</li> : null}
      <li className={`proto-phase-${item.phase}`}>
        <div className="proto-moment">
          <p className="proto-moment__name">
            {first ? '★ ' : ''}
            {label(item.code)}
          </p>
          <p className="proto-moment__meta" lang={language}>
            {PHASE_LABEL[item.phase]}
            {area ? ` · ${area}` : ''}
          </p>
          {actions ? (
            <>
              <div className="ui-cluster">
                <IconButton label="Move up" onClick={() => actions.move(item.id, -1)} disabled={position === 0}>
                  ↑
                </IconButton>
                <IconButton label="Move down" onClick={() => actions.move(item.id, 1)} disabled={last}>
                  ↓
                </IconButton>
                <IconButton label="Remove" tone="danger" onClick={() => actions.remove(item.id)}>
                  ✕
                </IconButton>
                {rule.kind === 'ask' ? (
                  <Button size="md" onClick={() => actions.pickArea(item.id)}>
                    {area ? 'Change area' : 'Add area'}
                  </Button>
                ) : null}
              </div>
              {position > 0 ? (
                <Select
                  label="Time since the one before"
                  value={item.gap}
                  onChange={(v) => actions.setGap(item.id, v as Gap)}
                  options={GAPS.map((g) => ({ value: g, label: GAP_LABEL[g] }))}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </li>
    </>
  );
}

/** All phases in order: start, symptoms before, aura end, symptoms during, seizure end, symptoms after, back to normal. */
export function Timeline({
  draft,
  actions,
  only,
}: {
  draft: Draft;
  actions?: TimelineActions | undefined;
  only?: PhaseName;
}) {
  const ordered = inSeizureOrder(draft.items);
  const firstId = ordered[0]?.id;
  const rows = (phase: PhaseName) =>
    ordered
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.phase === phase)
      .map(({ item, index }) => (
        <Moment
          key={item.id}
          item={item}
          first={item.id === firstId}
          position={index}
          last={index === ordered.length - 1}
          actions={actions}
        />
      ));
  const marker = (text: string, time: number | null, phase: PhaseName | 'seizure' | 'recovery' | 'aura') =>
    time === null ? null : (
      <li className="proto-marker" style={{ ['--phase' as string]: phaseColour(phase) }}>
        {text} · {clock(time)}
      </li>
    );
  if (only) return <ol className="proto-timeline">{rows(only)}</ol>;
  return (
    <ol className="proto-timeline" aria-label="Seizure timeline">
      {marker('Start', draft.start, 'aura')}
      {draft.prodromeHours > 0 ? (
        <li className="proto-gap">Warning signs began about {draft.prodromeHours} h before</li>
      ) : null}
      {rows('before')}
      {marker('Aura ends', draft.auraEnd, 'aura')}
      {rows('during')}
      {marker('Seizure ends', draft.seizureEnd, 'seizure')}
      {rows('after')}
      {marker('Back to normal', draft.recoveryEnd, 'recovery')}
    </ol>
  );
}

const phaseColour = (phase: string): string =>
  phase === 'aura' || phase === 'before'
    ? '#d97706'
    : phase === 'seizure' || phase === 'during'
      ? 'var(--danger)'
      : 'var(--accent)';

/** The whole seizure as one bar, shown above every tab so the full picture is always in view. */
export function OverviewStrip({ draft, now }: { draft: Draft; now?: number }) {
  const end = draft.recoveryEnd ?? draft.seizureEnd ?? now ?? draft.start;
  const total = Math.max(1, end - draft.start);
  const auraMs = draft.auraEnd !== null ? Math.max(0, draft.auraEnd - draft.start) : 0;
  const seizureMs = Math.max(0, (draft.seizureEnd ?? end) - (draft.auraEnd ?? draft.start));
  const recoveryMs = draft.seizureEnd !== null ? Math.max(0, (draft.recoveryEnd ?? end) - draft.seizureEnd) : 0;
  const pct = (ms: number) => `${Math.round((ms / total) * 100)}%`;
  return (
    <div>
      <div className="proto-strip" role="img" aria-label="Overview: aura, seizure, recovery">
        <span className="proto-aura" style={{ width: pct(auraMs) }} />
        <span className="proto-seizure" style={{ width: pct(seizureMs) }} />
        <span className="proto-recovery" style={{ width: pct(recoveryMs) }} />
      </div>
      <ul className="proto-legend">
        <li>
          <span className="proto-dot proto-aura" />
          Aura {mmss(auraMs / 1000)}
        </li>
        <li>
          <span className="proto-dot proto-seizure" />
          Seizure {mmss(seizureMs / 1000)}
        </li>
        <li>
          <span className="proto-dot proto-recovery" />
          Recovery {mmss(recoveryMs / 1000)}
        </li>
      </ul>
    </div>
  );
}

export { PHASES, PHASE_LABEL };
