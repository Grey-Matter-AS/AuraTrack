import {
  NO_FILTERS,
  addLocalDays,
  buildDangerMap,
  endOfLocalDay,
  filterSeizures,
  filtersActive,
  frequencyBuckets,
  paginate,
  startOfLocalDay,
  timelineItems,
  type BucketSize,
  type DoseLog,
  type HistoryFilters,
  type InterictalEvent,
  type Medication,
  type MedicationChange,
  type TimelineItem,
} from '@auratrack/model';
import {
  AppHeader,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  DateTimeField,
  EventChart,
  Screen,
  Section,
  Select,
  Stack,
  TrendChart,
  type ChartEvent,
} from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { seizureKinds, seizureName, seriesOf } from '../app/seizureName';
import { useRecordList } from '../app/records';
import { useNav } from '../editor/nav';
import { MainNav } from './MainNav';
import { SeizureCard } from './SeizureCard';
import './screens.css';

type View = 'list' | 'trend' | 'timeline';
type Zoom = 'day' | 'week' | 'month' | 'quarter';
type Range = '30d' | '12w' | '12m';

const WINDOW_DAYS: Record<Zoom, number> = { day: 1, week: 7, month: 30, quarter: 91 };
const RANGE: Record<Range, { days: number; size: BucketSize }> = {
  '30d': { days: 30, size: 'day' },
  '12w': { days: 84, size: 'week' },
  '12m': { days: 365, size: 'month' },
};

/** History (F-401, F-402, F-315): the list with filters, the frequency chart, and the timeline over days and weeks. */
export function History() {
  const { t } = useApp();
  const [view, setView] = useState<View>('list');
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('nav.history')} />
        <MainNav current="history" />
        <ChipGroup
          label={t('hist.view')}
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: t('hist.list') },
            { value: 'trend', label: t('hist.trend') },
            { value: 'timeline', label: t('hist.timeline') },
          ]}
        />
        {view === 'list' ? <ListView /> : null}
        {view === 'trend' ? <TrendView /> : null}
        {view === 'timeline' ? <TimelineView /> : null}
      </Stack>
    </Screen>
  );
}

function ListView() {
  const { t, label, seizures, settings, profiles } = useApp();
  const nav = useNav();
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const danger = useMemo(() => buildDangerMap(seizures, settings.plan), [seizures, settings.plan]);
  const filtered = useMemo(() => filterSeizures(seizures, filters), [seizures, filters]);
  const shown = paginate(filtered, page, settings.historyPageSize);
  const change = (next: Partial<HistoryFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };
  const types = [{ value: 'none', label: t('hist.noType') }, ...seizureKinds(seizures, profiles, t, label)];
  return (
    <Stack>
      <Section title={t('hist.filters')}>
        <Stack>
          <Select
            label={t('hist.type')}
            value={filters.type ?? ''}
            onChange={(v) => change({ type: v === '' ? null : v })}
            placeholder={t('hist.allTypes')}
            options={types}
          />
          <DateTimeField
            label={t('hist.from')}
            type="date"
            value={filters.from}
            onChange={(from) => change({ from })}
          />
          <DateTimeField label={t('hist.to')} type="date" value={filters.to} onChange={(to) => change({ to })} />
          <Checkbox
            checked={filters.needsDetails}
            onChange={(needsDetails) => change({ needsDetails })}
            label={t('hist.needsDetails')}
          />
          {filtersActive(filters) ? (
            <Button
              onClick={() => {
                setFilters(NO_FILTERS);
                setPage(1);
              }}
            >
              {t('hist.clear')}
            </Button>
          ) : null}
        </Stack>
      </Section>
      <p className="app-note" role="status">
        {seizures.length === 0
          ? t('hist.empty')
          : filtered.length === 0
            ? t('hist.none')
            : t('hist.count', { count: filtered.length })}
      </p>
      {shown.items.map((s) => (
        <SeizureCard
          key={s.id}
          seizure={s}
          flags={danger[s.id]}
          action={{ label: t('hist.open'), onClick: () => nav.push('detail', { id: s.id }) }}
        />
      ))}
      {shown.pages > 1 ? (
        <div className="app-row">
          <Button size="md" disabled={shown.page <= 1} onClick={() => setPage(shown.page - 1)}>
            {t('hist.prev')}
          </Button>
          <p className="app-note">{t('hist.page', { page: shown.page, pages: shown.pages })}</p>
          <Button size="md" disabled={shown.page >= shown.pages} onClick={() => setPage(shown.page + 1)}>
            {t('hist.next')}
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}

function TrendView() {
  const app = useApp();
  const { t, seizures, settings, fmt } = app;
  const [range, setRange] = useState<Range>('12w');
  const changes = useRecordList<MedicationChange>('medicationChange');
  const [now] = useState(() => app.controller.now());
  const { days, size } = RANGE[range];
  const from = startOfLocalDay(addLocalDays(now, -days + 1));
  const buckets = useMemo(
    () => frequencyBuckets(seizures, from, now, size, settings.plan),
    [seizures, from, now, size, settings.plan],
  );
  const total = buckets.reduce((n, b) => n + b.count, 0);
  const long = buckets.reduce((n, b) => n + b.long, 0);
  const shownChanges = changes.filter((c) => !c.isBaseline && c.effectiveAt >= from && c.effectiveAt <= now);
  const unit = t(size === 'day' ? 'hist.unitDay' : size === 'week' ? 'hist.unitWeek' : 'hist.unitMonth');
  const markers = shownChanges
    .map((c) => ({
      index: buckets.findLastIndex((b) => b.start <= c.effectiveAt),
      label: `${c.medicationName}: ${t(`med.change.${c.type}` as never)}`,
    }))
    .filter((m) => m.index >= 0);
  return (
    <Stack>
      <ChipGroup
        label={t('hist.range')}
        value={range}
        onChange={setRange}
        options={[
          { value: '30d', label: t('hist.range30') },
          { value: '12w', label: t('hist.range12w') },
          { value: '12m', label: t('hist.range12m') },
        ]}
      />
      <Card>
        <TrendChart
          label={t('hist.trendAria', { unit, count: total, long })}
          bars={buckets.map((b) => ({
            label: new Intl.DateTimeFormat(app.language, { day: 'numeric', month: 'short' }).format(b.start),
            value: b.count,
            marked: b.long,
          }))}
          markers={markers}
        />
      </Card>
      <p className="app-note">{t('hist.trendSummary', { count: total, long })}</p>
      {shownChanges.length > 0 ? (
        <Section title={t('hist.medChanges')}>
          <Stack gap="0.25rem">
            {shownChanges.map((c) => (
              <p className="app-note" key={c.id}>
                {fmt.day(c.effectiveAt)} · {c.medicationName}: {t(`med.change.${c.type}` as never)}
              </p>
            ))}
          </Stack>
        </Section>
      ) : null}
    </Stack>
  );
}

function TimelineView() {
  const app = useApp();
  const nav = useNav();
  const { t, label, seizures, settings, fmt, between, profiles } = app;
  const kinds = useMemo(() => seizureKinds(seizures, profiles, t, label), [seizures, profiles, t, label]);
  const seizureById = useMemo(() => new Map(seizures.map((s) => [s.id, s])), [seizures]);
  const changes = useRecordList<MedicationChange>('medicationChange');
  const doses = useRecordList<DoseLog>('doseLog', { all: true });
  const meds = useRecordList<Medication>('medication');
  const [zoom, setZoom] = useState<Zoom>('week');
  const [now] = useState(() => app.controller.now());
  const [end, setEnd] = useState(() => endOfLocalDay(now));
  const length = WINDOW_DAYS[zoom];
  const from = startOfLocalDay(addLocalDays(end, -length + 1));
  const to = end;
  const names = useMemo(() => new Map(meds.map((m) => [m.id, m.name])), [meds]);
  const own = useMemo(() => new Set(meds.map((m) => m.id)), [meds]);
  const items = useMemo(
    () =>
      timelineItems({
        seizures,
        between: between as InterictalEvent[],
        changes,
        doses: doses.filter((d) => own.has(d.medicationId)),
        medicationNames: names,
        from,
        to,
        plan: settings.plan,
      }),
    [seizures, between, changes, doses, own, names, from, to, settings.plan],
  );
  const span = to - from;
  const position = (at: number) => (at - from) / span;
  const events: ChartEvent[] = items.map((i) => ({
    id: i.id,
    at: position(i.at),
    kind: i.kind,
    ...(i.kind === 'seizure'
      ? {
          size: Math.min(1, (i.seconds ?? 0) / 720),
          series: seriesOf(i.kindKey, kinds),
          open: i.seconds === null,
          long: i.long,
        }
      : {}),
  }));
  const ticks = timelineTicks(zoom, from, app.language).map((x) => ({ at: position(x.at), label: x.label }));
  const open = (item: TimelineItem) => {
    if (item.kind === 'seizure') nav.push('detail', { id: item.id });
    else if (item.kind === 'medication' || item.kind === 'missed') nav.push('medDetail', { id: item.medicationId });
  };
  const text = (item: TimelineItem): string => {
    // A seizure's time is always shown to the second; medicines and the rest to the minute
    const exact = item.kind === 'seizure';
    const when =
      zoom === 'day'
        ? exact
          ? fmt.timeSec(item.at)
          : fmt.time(item.at)
        : exact
          ? fmt.whenSec(item.at)
          : fmt.when(item.at);
    if (item.kind === 'seizure') {
      const seizure = seizureById.get(item.id);
      const name = seizure ? seizureName(seizure, t, label) : t('home.untyped');
      return `${when} · ${name}${item.seconds !== null ? ` · ${fmt.duration(item.seconds)}` : ''}`;
    }
    if (item.kind === 'between') return `${when} · ${t('hist.between', { name: label(item.code) })}`;
    if (item.kind === 'medication')
      return `${when} · ${t('hist.medChange', { name: item.name, change: t(`med.change.${item.change}` as never) })}`;
    return `${when} · ${t('hist.missed', { name: item.name })}`;
  };
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <Stack>
      <ChipGroup
        label={t('hist.zoom')}
        value={zoom}
        onChange={(z) => {
          setZoom(z);
          setEnd(endOfLocalDay(now));
        }}
        options={[
          { value: 'day', label: t('hist.zoomDay') },
          { value: 'week', label: t('hist.zoomWeek') },
          { value: 'month', label: t('hist.zoomMonth') },
          { value: 'quarter', label: t('hist.zoom3m') },
        ]}
      />
      <div className="app-row">
        <Button size="md" onClick={() => setEnd(endOfLocalDay(addLocalDays(end, -length)))}>
          {t('hist.prev')}
        </Button>
        <p className="app-note" role="status">
          {fmt.day(from)} – {fmt.day(to)}
        </p>
        <Button
          size="md"
          disabled={end >= endOfLocalDay(now)}
          onClick={() => setEnd(Math.min(endOfLocalDay(now), endOfLocalDay(addLocalDays(end, length))))}
        >
          {t('hist.next')}
        </Button>
      </div>
      <Card>
        <EventChart
          label={t('hist.timelineAria', { count: items.length })}
          events={events}
          ticks={ticks}
          onOpen={(id) => {
            const item = byId.get(id);
            if (item) open(item);
          }}
        />
      </Card>
      <p className="app-note">{t('hist.legend')}</p>
      <Section title={t('hist.items')}>
        {items.length === 0 ? (
          <p className="app-note">{t('hist.nothing')}</p>
        ) : (
          <Stack gap="0.5rem">
            {items.map((item) =>
              item.kind === 'between' ? (
                <Card compact key={item.id}>
                  <p className="app-note">{text(item)}</p>
                </Card>
              ) : (
                <Button key={item.id} fullWidth onClick={() => open(item)}>
                  {text(item)}
                </Button>
              ),
            )}
          </Stack>
        )}
      </Section>
    </Stack>
  );
}

/** The labels under the axis: hours for a day, days for a week, about every fifth day for a month, months for a quarter. */
export function timelineTicks(zoom: Zoom, from: number, language: string): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  if (zoom === 'day') {
    for (const hour of [0, 6, 12, 18]) {
      const d = new Date(from);
      d.setHours(hour, 0, 0, 0);
      out.push({ at: d.getTime(), label: String(hour).padStart(2, '0') });
    }
    return out;
  }
  const days = WINDOW_DAYS[zoom];
  const every = zoom === 'week' ? 1 : zoom === 'month' ? 5 : 14;
  for (let i = 0; i < days; i += every) {
    const at = startOfLocalDay(addLocalDays(from, i));
    out.push({
      at,
      label:
        zoom === 'week'
          ? new Intl.DateTimeFormat(language, { weekday: 'short' }).format(at)
          : new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(at),
    });
  }
  return out;
}
