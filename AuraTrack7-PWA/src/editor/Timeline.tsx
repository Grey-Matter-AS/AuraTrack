import type { MessageKey } from '@auratrack/i18n';
import { useState, type ReactNode } from 'react';
import {
  BottomSheet,
  Button,
  ChipGroup,
  DurationField,
  IconButton,
  PhaseStrip,
  Select,
  Stack,
  formatHms,
} from '@auratrack/ui';
import { areaText } from './BodyMap';
import {
  GAPS,
  PHASES,
  areaRule,
  clock,
  firstSignOf,
  inSeizureOrder,
  prodromeText,
  recoverySecondsOf,
  timelinePhases,
  type Draft,
  type Gap,
  type Item,
  type PhaseName,
} from './draft';
import { useApp } from '../app/AppContext';

// The seizure as one vertical timeline: the phase marks (Start, Aura ends, Seizure ends, Back to usual self), a card for
// each symptom in the phase where it happened, and between two symptoms of the seizure a small delay card with the time
// between them. Warning signs come above Start; they are not timed and are never the first sign (★).

const gapKey = (gap: Exclude<Gap, 'custom'>): MessageKey => `gap.${gap}`;

export interface TimelineActions {
  move: (id: string, direction: -1 | 1) => void;
  setGap: (id: string, gap: Gap) => void;
  /** The typed time since the symptom before, in ms; null when the boxes are emptied. */
  setCustomGap: (id: string, ms: number | null) => void;
  setPhase: (id: string, phase: PhaseName) => void;
  remove: (id: string) => void;
  /** Opens the body map for this symptom. */
  pickArea: (id: string) => void;
  /** Opens the sheet to add a symptom card at the end of this phase. */
  add: (phase: PhaseName) => void;
}

/** The time since the symptom before, as its own small card on the line. */
function DelayCard({ item, actions }: { item: Item; actions?: TimelineActions | undefined }) {
  const { t } = useApp();
  const text =
    item.gap === 'custom'
      ? item.customMs === null
        ? t('gap.unknown')
        : t('gap.customValue', { time: formatHms(item.customMs / 1000) })
      : t(gapKey(item.gap));
  if (!actions) return <li className="ed-gap">{text}</li>;
  return (
    <li className="ed-delay">
      <Select
        aria-label={t('tl.delay')}
        value={item.gap}
        onChange={(v) => actions.setGap(item.id, v as Gap)}
        options={GAPS.map((g) => ({ value: g, label: g === 'custom' ? t('gap.custom') : t(gapKey(g)) }))}
      />
      {item.gap === 'custom' ? (
        <DurationField
          value={item.customMs === null ? null : Math.round(item.customMs / 1000)}
          onChange={(sec) => actions.setCustomGap(item.id, sec === null ? null : sec * 1000)}
        />
      ) : null}
    </li>
  );
}

/**
 * A symptom on the timeline, one compact row: its name (★ for the first sign) and place, ↑ ↓ within its phase, and ⋯ for
 * the rest (place on the body, move to another phase, remove).
 */
function SymptomCard({
  item,
  first,
  canUp,
  canDown,
  actions,
}: {
  item: Item;
  /** The first sign of the seizure (never a warning sign). */
  first: boolean;
  canUp: boolean;
  canDown: boolean;
  actions?: TimelineActions | undefined;
}) {
  const { label, language, t } = useApp();
  const [menu, setMenu] = useState(false);
  const name = label(item.code);
  const area = areaText(item.area, label);
  const rule = areaRule(item.code); // feelings and states have no place on the body; some symptoms are always in one place
  return (
    <li className={`ed-phase-${item.phase}`}>
      <div className="ed-moment ed-moment--row">
        <div className="ed-moment__text">
          <p className="ed-moment__name">
            {first ? '★ ' : ''}
            {name}
          </p>
          {area ? (
            <p className="ed-moment__meta" lang={language}>
              {area}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="ed-moment__tools">
            <IconButton label={t('tl.up')} onClick={() => actions.move(item.id, -1)} disabled={!canUp}>
              ↑
            </IconButton>
            <IconButton label={t('tl.down')} onClick={() => actions.move(item.id, 1)} disabled={!canDown}>
              ↓
            </IconButton>
            <IconButton label={t('tl.more', { name })} onClick={() => setMenu(true)}>
              ⋯
            </IconButton>
          </div>
        ) : null}
      </div>
      {actions && menu ? (
        <BottomSheet title={name} onClose={() => setMenu(false)}>
          <Stack>
            {rule.kind === 'ask' ? (
              <Button
                onClick={() => {
                  setMenu(false);
                  actions.pickArea(item.id);
                }}
              >
                {area ? t('tl.changeArea') : t('tl.addArea')}
              </Button>
            ) : null}
            <ChipGroup
              showLabel
              label={t('tl.moveTo')}
              value={item.phase}
              onChange={(phase) => {
                setMenu(false);
                actions.setPhase(item.id, phase);
              }}
              options={PHASES.map((p) => ({ value: p, label: t(`tab.${p}`) }))}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setMenu(false);
                actions.remove(item.id);
              }}
            >
              {t('tl.removeFromTimeline')}
            </Button>
          </Stack>
        </BottomSheet>
      ) : null}
    </li>
  );
}

/**
 * The whole timeline. With `actions` it is the editor: every phase has its heading and an "Add symptom" button, and the
 * cards can be changed. Without, it is read-only (detail screen, review) and shows only the phases that have symptoms.
 */
export function Timeline({
  draft,
  actions,
  details,
  startDetails,
}: {
  draft: Draft;
  actions?: TimelineActions | undefined;
  /** In the editor: the phase's own fields (its length, triggers, findings), under its heading. */
  details?: (phase: PhaseName) => ReactNode;
  /** In the editor: the start time, at the Start mark. */
  startDetails?: ReactNode;
}) {
  const { t } = useApp();
  const ordered = inSeizureOrder(draft.items);
  const firstId = firstSignOf(draft.items)?.id;
  const phases = timelinePhases(draft);
  const marker = (key: string, text: string, time: number | null, phase: PhaseName) =>
    time === null ? null : (
      <li key={key} className="ed-marker" style={{ ['--phase' as string]: phaseColour(phase) }}>
        {text} · {clock(time)}
      </li>
    );
  // Each phase is one band on the line, tinted in its colour: heading, its own fields, its cards, "Add symptom"
  const section = (phase: PhaseName) => {
    const here = ordered.filter((i) => i.phase === phase);
    if (!actions && here.length === 0) return null;
    return (
      <li className={`ed-band ed-band--${phase}`} aria-label={t(`tab.${phase}`)}>
        {/* The line beside this band takes the phase colour, like the strip above the tabs */}
        <span className="ed-band__rail" aria-hidden="true" />
        <p className="ed-section">{t(`tab.${phase}`)}</p>
        {details ? <div className="ed-details">{details(phase)}</div> : null}
        {here.length > 0 ? (
          <ol className="ed-band__list">
            {here.flatMap((item, n) => [
              // The time since the one before is asked from the second sign of the seizure on; warning signs are not timed
              item.phase !== 'prodrome' && item.id !== firstId ? (
                <DelayCard key={`d-${item.id}`} item={item} actions={actions} />
              ) : null,
              <SymptomCard
                key={item.id}
                item={item}
                first={item.id === firstId}
                canUp={n > 0}
                canDown={n < here.length - 1}
                actions={actions}
              />,
            ])}
          </ol>
        ) : null}
        {actions ? (
          <div className="ed-add">
            <Button onClick={() => actions.add(phase)}>{t('tl.addSymptom')}</Button>
          </div>
        ) : null}
      </li>
    );
  };
  return (
    <ol className="ed-timeline" aria-label={t('tl.aria')}>
      {prodromeText(draft, t) ? (
        <li className="ed-gap">{t('tl.warning', { time: prodromeText(draft, t) ?? '' })}</li>
      ) : null}
      {section('prodrome')}
      {marker('start', t('tl.start'), draft.start, 'aura')}
      {startDetails ? <li className="ed-details">{startDetails}</li> : null}
      {section('aura')}
      {marker('auraEnd', t('tl.auraEnds'), draft.auraEnd, 'aura')}
      {phases.includes('seizure') ? section('seizure') : null}
      {phases.includes('seizure') ? marker('seizureEnd', t('tl.seizureEnds'), draft.seizureEnd, 'seizure') : null}
      {section('recovery')}
      {marker('recoveryEnd', t('rec.backToNormal'), draft.recoveryEnd, 'recovery')}
    </ol>
  );
}

const phaseColour = (phase: string): string =>
  ({
    prodrome: 'var(--phase-prodrome)',
    aura: 'var(--phase-aura)',
    seizure: 'var(--phase-seizure)',
    recovery: 'var(--phase-recovery)',
  })[phase] ?? 'var(--border)';

/** The whole seizure as one bar, shown above every tab so the full picture is always in view. */
export function OverviewStrip({ draft, now }: { draft: Draft; now?: number }) {
  const { t } = useApp();
  const end = draft.recoveryEnd ?? draft.seizureEnd ?? now ?? draft.start;
  const aura = draft.auraEnd !== null ? Math.max(0, draft.auraEnd - draft.start) : 0;
  const seizure = Math.max(0, (draft.seizureEnd ?? end) - (draft.auraEnd ?? draft.start));
  // While recording, recovery runs until now; on a saved seizure it is the recovery mark, or the older minutes field
  const recovery =
    draft.seizureEnd === null
      ? 0
      : draft.recoveryEnd === null && now !== undefined
        ? Math.max(0, now - draft.seizureEnd)
        : (recoverySecondsOf(draft) ?? 0) * 1000;
  return (
    <PhaseStrip
      aura={aura}
      seizure={seizure}
      recovery={recovery}
      label={t('tl.overview')}
      legend={{
        aura: `${t('rec.aura')} ${formatHms(aura / 1000)}`,
        seizure: `${t('rec.seizure')} ${formatHms(seizure / 1000)}`,
        recovery: `${t('rec.recovery')} ${formatHms(recovery / 1000)}`,
      }}
    />
  );
}
