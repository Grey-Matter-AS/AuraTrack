import { BODY_REGIONS } from '@auratrack/model';
import { Button, ChipGroup, Stack } from '@auratrack/ui';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Area } from './draft';
import { useApp } from '../app/AppContext';

// Where on the body, in labelled steps: what is chosen so far at the top; the whole-body choices (one tap each); then the
// figure (front or back, left and right marked) or the list of areas; the side or part, and the detail, only appear once an
// area that has them is chosen.

const QUICK: { value: string; area: Area }[] = [
  { value: 'whole', area: { region: 'body.whole_body', subRegion: null, part: null } },
  {
    value: 'both',
    area: {
      region: 'body.whole_body',
      subRegion: 'body.whole_body.general',
      part: 'body.whole_body.general.both_sides_equally',
    },
  },
  {
    value: 'spread',
    area: {
      region: 'body.whole_body',
      subRegion: 'body.whole_body.general',
      part: 'body.whole_body.general.starts_one_side_spreads',
    },
  },
];
const QUICK_KEY = { whole: 'map.whole', both: 'map.both', spread: 'map.spread' } as const;

function Shape({
  label,
  pressed,
  onSelect,
  children,
}: {
  label: string;
  pressed: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <g role="button" tabIndex={0} aria-label={label} aria-pressed={pressed} onClick={onSelect} onKeyDown={onKeyDown}>
      {children}
    </g>
  );
}

export function BodyMap({ value, onChange }: { value: Area | null; onChange: (area: Area | null) => void }) {
  const { label, t } = useApp();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const region = BODY_REGIONS.find((r) => r.code === value?.region);
  const sub = region?.subRegions.find((s) => s.code === value?.subRegion);
  const set = (next: Area) => onChange(next);
  const on = (r: string, s: string | null = null) => value?.region === r && (s === null || value?.subRegion === s);
  // In the front view the person's left is on the viewer's right; in the back view it is on the viewer's left
  const leftX = side === 'front' ? 86 : 14;
  const rightX = side === 'front' ? 14 : 86;
  const leftLegX = side === 'front' ? 62 : 38;
  const rightLegX = side === 'front' ? 38 : 62;
  const L = side === 'front' ? t('map.right') : t('map.left');
  const R = side === 'front' ? t('map.left') : t('map.right');
  const chosen = value ? areaText(value, label) : '';
  return (
    <Stack>
      <p className="app-banner" aria-live="polite">
        {chosen ? t('map.chosen', { area: chosen }) : t('map.nothing')}
      </p>
      <ChipGroup
        showLabel
        label={t('map.whole')}
        value={QUICK.find((q) => JSON.stringify(q.area) === JSON.stringify(value))?.value ?? null}
        onChange={(v) =>
          set(QUICK.find((q) => q.value === v)?.area ?? { region: 'body.whole_body', subRegion: null, part: null })
        }
        options={QUICK.map((q) => ({ value: q.value, label: t(QUICK_KEY[q.value as keyof typeof QUICK_KEY]) }))}
      />
      <ChipGroup
        showLabel
        label={t('map.tap')}
        value={side}
        onChange={setSide}
        options={[
          { value: 'front', label: t('map.front') },
          { value: 'back', label: t('map.back') },
        ]}
      />
      <svg className="ed-map" viewBox="0 0 120 232" role="group" aria-label={t('map.aria')}>
        <Shape
          label={label('body.head_and_face')}
          pressed={on('body.head_and_face')}
          onSelect={() => set({ region: 'body.head_and_face', subRegion: null, part: null })}
        >
          <circle cx="60" cy="22" r="17" />
        </Shape>
        <Shape
          label={label('body.torso')}
          pressed={on('body.torso')}
          onSelect={() => set({ region: 'body.torso', subRegion: 'body.torso.front_back', part: null })}
        >
          <rect x="38" y="44" width="44" height="72" rx="12" />
        </Shape>
        <Shape
          label={label('body.arms.left_arm')}
          pressed={on('body.arms', 'body.arms.left_arm')}
          onSelect={() => set({ region: 'body.arms', subRegion: 'body.arms.left_arm', part: null })}
        >
          <rect x={leftX} y="48" width="20" height="78" rx="10" />
        </Shape>
        <Shape
          label={label('body.arms.right_arm')}
          pressed={on('body.arms', 'body.arms.right_arm')}
          onSelect={() => set({ region: 'body.arms', subRegion: 'body.arms.right_arm', part: null })}
        >
          <rect x={rightX} y="48" width="20" height="78" rx="10" />
        </Shape>
        <Shape
          label={label('body.legs.left_leg')}
          pressed={on('body.legs', 'body.legs.left_leg')}
          onSelect={() => set({ region: 'body.legs', subRegion: 'body.legs.left_leg', part: null })}
        >
          <rect x={leftLegX} y="120" width="20" height="104" rx="10" />
        </Shape>
        <Shape
          label={label('body.legs.right_leg')}
          pressed={on('body.legs', 'body.legs.right_leg')}
          onSelect={() => set({ region: 'body.legs', subRegion: 'body.legs.right_leg', part: null })}
        >
          <rect x={rightLegX} y="120" width="20" height="104" rx="10" />
        </Shape>
        <text x="2" y="42">
          {L}
        </text>
        <text x="106" y="42">
          {R}
        </text>
      </svg>
      <ChipGroup
        showLabel
        label={t('map.area')}
        value={value?.region ?? null}
        onChange={(v) => set({ region: v, subRegion: null, part: null })}
        options={BODY_REGIONS.filter((r) => r.code !== 'body.whole_body').map((r) => ({
          value: r.code,
          label: label(r.code),
        }))}
      />
      {region && region.code !== 'body.whole_body' && region.subRegions.length > 1 ? (
        <ChipGroup
          showLabel
          label={t('map.sideOrPart')}
          value={value?.subRegion ?? null}
          onChange={(v) => set({ region: region.code, subRegion: v, part: null })}
          options={region.subRegions.map((s) => ({ value: s.code, label: label(s.code) }))}
        />
      ) : null}
      {sub && sub.parts.length > 0 && region?.code !== 'body.whole_body' ? (
        <ChipGroup
          showLabel
          label={t('map.detail')}
          value={value?.part ?? null}
          onChange={(v) => set({ region: value?.region ?? '', subRegion: sub.code, part: v })}
          options={sub.parts.map((p) => ({ value: p.code, label: label(p.code) }))}
        />
      ) : null}
      <Button variant="ghost" onClick={() => onChange(null)} disabled={value === null}>
        {t('map.none')}
      </Button>
    </Stack>
  );
}

export function areaText(area: Area | null, label: (code: string) => string): string {
  if (!area) return '';
  return [area.region, area.subRegion, area.part]
    .filter((c): c is string => c !== null)
    .slice(1)
    .map(label)
    .concat(area.subRegion === null && area.part === null ? [label(area.region)] : [])
    .join(' · ');
}
