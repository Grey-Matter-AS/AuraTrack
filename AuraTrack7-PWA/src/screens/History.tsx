import {
  NO_FILTERS,
  addLocalDays,
  buildDangerMap,
  endOfLocalDay,
  filterSeizures,
  filtersActive,
  frequencyBuckets,
  localDateKey,
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
  ChartLegend,
  DataTable,
  Disclosure,
  EventChart,
  IconButton,
  Screen,
  Section,
  Select,
  Stack,
  TimeSeriesChart,
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

const WINDOW_DAYS: Record<Zoom, number> = { day: 1, week: 7, month: 30, quarter: 91 };
/** What one bar counts for a period of this many days: days up to about six weeks, then weeks, then months. */
const sizeFor = (days: number): BucketSize => (days <= 45 ? 'day' : days <= 200 ? 'week' : 'month');

/**
 * The period a History view shows, shared by the chart and the timeline: zoom steps (− +), moving earlier and later (◀ ▶),
 * back to today, or a period of one's own from one date and time to another (the zoom steps clear it).
 */
function usePeriod(steps: readonly number[], initialStep: number) {
  const app = useApp();
  const [now] = useState(() => app.controller.now());
  const today = endOfLocalDay(now);
  const [step, setStep] = useState(initialStep);
  const [end, setEnd] = useState(today);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const cFrom = customFrom ? new Date(customFrom).getTime() : Number.NaN;
  const cTo = customTo ? new Date(customTo).getTime() : Number.NaN;
  const custom = Number.isFinite(cFrom) && Number.isFinite(cTo) && cTo > cFrom;
  const customBad = Number.isFinite(cFrom) && Number.isFinite(cTo) && cTo <= cFrom;
  const stepDays = steps[step] ?? 30;
  const span = custom ? (cTo - cFrom) / 86_400_000 : stepDays;
  const days = Math.max(1, Math.ceil(span));
  const from = custom ? cFrom : startOfLocalDay(addLocalDays(end, -days + 1));
  const until = custom ? cTo : end;
  const clear = () => {
    setCustomFrom('');
    setCustomTo('');
  };
  return {
    now,
    today,
    step,
    steps,
    custom,
    customBad,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    days,
    span,
    from,
    until,
    end,
    clear,
    zoom: (to: number) => {
      clear();
      setStep(Math.max(0, Math.min(steps.length - 1, to)));
    },
    move: (direction: -1 | 1) => {
      clear();
      setEnd((e) => Math.min(today, endOfLocalDay(addLocalDays(e, direction * Math.max(1, Math.round(days / 2))))));
    },
    goToday: () => {
      clear();
      setEnd(today);
    },
  };
}
type Period = ReturnType<typeof usePeriod>;

/** − + ◀ ▶ Today, and the From – To period, the same in every History view. */
function PeriodControls({ period: p, onChange }: { period: Period; onChange?: () => void }) {
  const { t, fmt } = useApp();
  const act = (f: () => void) => () => {
    f();
    onChange?.();
  };
  return (
    <Stack gap="0.75rem">
      <div className="app-chart-controls">
        <IconButton
          label={t('hist.zoomOut')}
          onClick={act(() => p.zoom(p.custom ? p.step : p.step + 1))}
          disabled={!p.custom && p.step === p.steps.length - 1}
        >
          −
        </IconButton>
        <IconButton
          label={t('hist.zoomIn')}
          onClick={act(() => p.zoom(p.custom ? p.step : p.step - 1))}
          disabled={!p.custom && p.step === 0}
        >
          +
        </IconButton>
        <IconButton label={t('hist.earlier')} onClick={act(() => p.move(-1))}>
          ◀
        </IconButton>
        <IconButton label={t('hist.later')} onClick={act(() => p.move(1))} disabled={!p.custom && p.end >= p.today}>
          ▶
        </IconButton>
        <Button size="md" onClick={act(p.goToday)} disabled={!p.custom && p.end >= p.today}>
          {t('hist.today')}
        </Button>
      </div>
      <Disclosure
        title={t('hist.customRange')}
        summary={p.custom ? `${fmt.when(p.from)} – ${fmt.when(p.until)}` : undefined}
      >
        <Stack gap="0.5rem">
          <DateTimeField type="datetime-local" label={t('hist.from')} value={p.customFrom} onChange={p.setCustomFrom} />
          <DateTimeField
            type="datetime-local"
            label={t('hist.to')}
            value={p.customTo}
            onChange={p.setCustomTo}
            error={p.customBad ? t('hist.rangeBad') : undefined}
          />
          {p.custom ? <Button onClick={act(p.clear)}>{t('hist.clearRange')}</Button> : null}
        </Stack>
      </Disclosure>
    </Stack>
  );
}

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

/**
 * Seizures over time, as a standard time-series chart: one bar per day, week or month with its count, long seizures marked,
 * an average line and an upper limit (as on a count chart in process control: the average plus three times its square
 * root, above which a count is unusual), medicine changes as markers. The period controls are shared with the timeline.
 * A tapped bar shows its numbers; the same numbers are in the table view.
 */
function TrendView() {
  const app = useApp();
  const { t, seizures, settings, fmt } = app;
  const changes = useRecordList<MedicationChange>('medicationChange');
  const [lines, setLines] = useState<string[]>(['average']);
  const [selected, setSelected] = useState<number | null>(null);
  const period = usePeriod([7, 14, 30, 91, 182, 365], 2);
  const { from, until, custom } = period;
  const size = sizeFor(period.span);
  const buckets = useMemo(
    () =>
      frequencyBuckets(
        seizures.filter((x) => x.phases.start.at >= from && x.phases.start.at <= until),
        from,
        until,
        size,
        settings.plan,
      ),
    [seizures, from, until, size, settings.plan],
  );
  const total = buckets.reduce((n, b) => n + b.count, 0);
  const long = buckets.reduce((n, b) => n + b.long, 0);
  const average = buckets.length > 0 ? total / buckets.length : 0;
  // The limit only means something with enough bars and some seizures
  const limit = buckets.length >= 7 && average > 0 ? average + 3 * Math.sqrt(average) : null;
  const one = (n: number) => (Math.round(n * 10) / 10).toLocaleString(app.language);
  const shownChanges = changes.filter((c) => !c.isBaseline && c.effectiveAt >= from && c.effectiveAt <= until);
  const unit = t(size === 'day' ? 'hist.unitDay' : size === 'week' ? 'hist.unitWeek' : 'hist.unitMonth');
  const events = shownChanges
    .map((c) => ({
      index: buckets.findLastIndex((b) => b.start <= c.effectiveAt),
      label: `${c.medicationName}: ${t(`med.change.${c.type}` as never)}`,
    }))
    .filter((m) => m.index >= 0);
  const weekday = new Intl.DateTimeFormat(app.language, { weekday: 'short' });
  const dayMonth = new Intl.DateTimeFormat(app.language, { day: 'numeric', month: 'short' });
  const monthYear = new Intl.DateTimeFormat(app.language, { month: 'short', year: '2-digit' });
  const longDay = new Intl.DateTimeFormat(app.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const points = buckets.map((b) => ({
    sub: size === 'day' ? weekday.format(b.start) : size === 'week' ? t('hist.weekOf') : '',
    label: size === 'month' ? monthYear.format(b.start) : dayMonth.format(b.start),
    value: b.count,
    marked: b.long,
  }));
  const whenOf = (i: number) => {
    const b = buckets[i];
    if (!b) return '';
    return size === 'day'
      ? longDay.format(b.start)
      : size === 'week'
        ? `${t('hist.weekOf')} ${longDay.format(b.start)}`
        : new Intl.DateTimeFormat(app.language, { month: 'long', year: 'numeric' }).format(b.start);
  };
  const chosen = selected !== null ? buckets[selected] : undefined;
  return (
    <Stack>
      <PeriodControls period={period} onChange={() => setSelected(null)} />
      <p className="app-banner">
        {custom ? `${fmt.when(from)} – ${fmt.when(until)}` : `${fmt.day(from)} – ${fmt.day(until)}`} ·{' '}
        {t('hist.trendSummary', { count: total, long })}
      </p>
      <Card>
        <Stack gap="0.5rem">
          <TimeSeriesChart
            label={t('hist.trendAria', { unit, count: total, long })}
            points={points}
            events={events}
            average={lines.includes('average') && total > 0 ? average : null}
            limit={lines.includes('limit') ? limit : null}
            selected={selected}
            onSelect={setSelected}
          />
          <ChartLegend
            items={[
              { label: t('hist.legendSeizures'), kind: 'bar' },
              { label: t('hist.legendLong', { minutes: settings.plan.alertMinutes }), kind: 'marked' },
              ...(lines.includes('average') && total > 0
                ? [{ label: t('hist.averageValue', { n: one(average), unit }), kind: 'average' as const }]
                : []),
              ...(lines.includes('limit') && limit !== null
                ? [{ label: t('hist.limitValue', { n: one(limit), unit }), kind: 'limit' as const }]
                : []),
            ]}
          />
        </Stack>
      </Card>
      <p className="app-note" aria-live="polite">
        {chosen
          ? t('hist.readout', { when: whenOf(selected ?? 0), count: chosen.count, long: chosen.long })
          : t('hist.tapBar')}
      </p>
      <ChipGroup
        multiple
        label={t('hist.refLines')}
        value={lines}
        onChange={setLines}
        options={[
          { value: 'average', label: t('hist.average') },
          { value: 'limit', label: t('hist.limit') },
        ]}
      />
      {lines.includes('limit') ? <p className="app-help">{t('hist.limitHelp')}</p> : null}
      <Disclosure title={t('hist.asTable')}>
        <DataTable
          caption={t('hist.trendAria', { unit, count: total, long })}
          columns={[
            { title: t('hist.colWhen') },
            { title: t('hist.colCount'), numeric: true },
            { title: t('hist.colLong'), numeric: true },
          ]}
          rows={buckets.map((b, i) => [whenOf(i), b.count, b.long])}
          footer={[t('hist.colTotal'), total, long]}
        />
      </Disclosure>
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
  // The same period controls as the chart: zoom steps of a day, a week, a month, three months, or From – To
  const period = usePeriod([1, 7, 30, 91], 1);
  const from = period.from;
  const to = period.until;
  const zoom: Zoom = period.span <= 1.5 ? 'day' : period.span <= 10 ? 'week' : period.span <= 45 ? 'month' : 'quarter';
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
          // Seizures on the same day share one circle with their number in it; a one-day view keeps each apart
          ...(zoom === 'day' ? {} : { day: localDateKey(i.at) }),
          open: i.seconds === null,
          long: i.long,
        }
      : {}),
  }));
  const ticks = timelineTicks(zoom, from, app.language, period.days)
    .map((x) => ({ at: position(x.at), label: x.label }))
    .filter((x) => x.at >= 0 && x.at <= 1);
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
      <PeriodControls period={period} />
      <p className="app-banner" role="status">
        {period.custom ? `${fmt.when(from)} – ${fmt.when(to)}` : `${fmt.day(from)} – ${fmt.day(to)}`}
      </p>
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
      <p className="app-note">
        {t('hist.legend')} {t('hist.legendCount')}
      </p>
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
export function timelineTicks(
  zoom: Zoom,
  from: number,
  language: string,
  /** The days shown, when not the zoom step's own (a From – To period). */
  shown?: number,
): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  if (zoom === 'day') {
    for (const hour of [0, 6, 12, 18]) {
      const d = new Date(from);
      d.setHours(hour, 0, 0, 0);
      out.push({ at: d.getTime(), label: String(hour).padStart(2, '0') });
    }
    return out;
  }
  const days = shown ?? WINDOW_DAYS[zoom];
  // About seven labels, never more than one a day
  const every = Math.max(zoom === 'week' ? 1 : zoom === 'month' ? 5 : 14, Math.ceil(days / 7));
  for (let i = 0; i < days; i += every) {
    const at = startOfLocalDay(addLocalDays(from, i));
    out.push({
      at,
      label:
        zoom === 'week'
          ? new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric' }).format(at) // day and date: "Sat 31"
          : new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(at),
    });
  }
  return out;
}
