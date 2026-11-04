import type { MessageKey } from '@auratrack/i18n';
import { Button, IconButton, PhaseStrip, Select } from '@auratrack/ui';
import { areaText } from './BodyMap';
import {
  GAPS,
  areaRule,
  clock,
  inSeizureOrder,
  mmss,
  prodromeText,
  type Draft,
  type Gap,
  type Item,
  type PhaseName,
} from './draft';
import { useApp } from '../app/AppContext';

// The graphical timeline, vertical: a line with the phases, and the symptoms as boxes in the order they happened, with the
// time between them written on the line. Phones: line on the left. This version has made-up behaviour for the prototype.

const gapKey = (gap: Gap): MessageKey => `gap.${gap}`;

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
  const { label, language, t } = useApp();
  const area = areaText(item.area, label);
  const rule = areaRule(item.code); // feelings and states have no place on the body; some symptoms are always in one place
  return (
    <>
      {position > 0 ? <li className="ed-gap">{t(gapKey(item.gap))}</li> : null}
      <li className={`ed-phase-${item.phase}`}>
        <div className="ed-moment">
          <p className="ed-moment__name">
            {first ? '★ ' : ''}
            {label(item.code)}
          </p>
          <p className="ed-moment__meta" lang={language}>
            {t(`tab.${item.phase}`)}
            {area ? ` · ${area}` : ''}
          </p>
          {actions ? (
            <>
              <div className="ui-cluster">
                <IconButton label={t('tl.up')} onClick={() => actions.move(item.id, -1)} disabled={position === 0}>
                  ↑
                </IconButton>
                <IconButton label={t('tl.down')} onClick={() => actions.move(item.id, 1)} disabled={last}>
                  ↓
                </IconButton>
                <IconButton label={t('tl.remove')} tone="danger" onClick={() => actions.remove(item.id)}>
                  ✕
                </IconButton>
                {rule.kind === 'ask' ? (
                  <Button size="md" onClick={() => actions.pickArea(item.id)}>
                    {area ? t('tl.changeArea') : t('tl.addArea')}
                  </Button>
                ) : null}
              </div>
              {position > 0 ? (
                <Select
                  label={t('tl.gapLabel')}
                  value={item.gap}
                  onChange={(v) => actions.setGap(item.id, v as Gap)}
                  options={GAPS.map((g) => ({ value: g, label: t(gapKey(g)) }))}
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
  const { t } = useApp();
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
      <li className="ed-marker" style={{ ['--phase' as string]: phaseColour(phase) }}>
        {text} · {clock(time)}
      </li>
    );
  if (only) return <ol className="ed-timeline">{rows(only)}</ol>;
  return (
    <ol className="ed-timeline" aria-label={t('tl.aria')}>
      {marker(t('tl.start'), draft.start, 'aura')}
      {prodromeText(draft, t) ? (
        <li className="ed-gap">{t('tl.warning', { time: prodromeText(draft, t) ?? '' })}</li>
      ) : null}
      {rows('before')}
      {marker(t('tl.auraEnds'), draft.auraEnd, 'aura')}
      {rows('during')}
      {marker(t('tl.seizureEnds'), draft.seizureEnd, 'seizure')}
      {rows('after')}
      {marker(t('rec.backToNormal'), draft.recoveryEnd, 'recovery')}
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
  const { t } = useApp();
  const end = draft.recoveryEnd ?? draft.seizureEnd ?? now ?? draft.start;
  const aura = draft.auraEnd !== null ? Math.max(0, draft.auraEnd - draft.start) : 0;
  const seizure = Math.max(0, (draft.seizureEnd ?? end) - (draft.auraEnd ?? draft.start));
  const recovery = draft.seizureEnd !== null ? Math.max(0, (draft.recoveryEnd ?? end) - draft.seizureEnd) : 0;
  return (
    <PhaseStrip
      aura={aura}
      seizure={seizure}
      recovery={recovery}
      label={t('tl.overview')}
      legend={{
        aura: `${t('rec.aura')} ${mmss(aura / 1000)}`,
        seizure: `${t('rec.seizure')} ${mmss(seizure / 1000)}`,
        recovery: `${t('rec.recovery')} ${mmss(recovery / 1000)}`,
      }}
    />
  );
}
