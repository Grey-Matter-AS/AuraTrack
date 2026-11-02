import { addLocalDays, localDateKey, startOfLocalDay, type EegSession } from '@auratrack/model';
import type { Additions } from '@auratrack/reports';
import {
  AppHeader,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  ChoiceList,
  DateTimeField,
  Screen,
  Section,
  Select,
  Stack,
  useToast,
} from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { ADDITION_KEYS, NO_ADDITIONS, useReportMaker, type ReportKind, type ReportRequest } from '../reports/build';
import { reportsEnv } from '../reports/env';
import './screens.css';

type Range = '30' | '90' | '180' | '365' | 'custom';

export const monthKey = (ms: number): string => localDateKey(ms).slice(0, 7);

/** Saves a made report as a file (a PDF made in the worker, or the CSV text). Returns what happened, for a message. */
export async function saveReport(
  made: NonNullable<ReturnType<ReturnType<typeof useReportMaker>>>,
): Promise<'saved' | 'cancelled'> {
  if (made.type === 'csv') return reportsEnv.save(made.text, made.fileName, 'text/csv');
  const bytes = await reportsEnv.makePdf(made.job);
  return reportsEnv.save(bytes, made.fileName, 'application/pdf');
}

/** Reports (F-408, F-700 to F-707): the report, its period, then preview, save or share. */
export function Reports() {
  const app = useApp();
  const { t, fmt, settings, eegSessions } = app;
  const nav = useNav();
  const toast = useToast();
  const make = useReportMaker();
  const [now] = useState(() => app.controller.now());
  const [kind, setKind] = useState<ReportKind>('neurologist');
  const [range, setRange] = useState<Range>('90');
  const [from, setFrom] = useState(() => localDateKey(addLocalDays(startOfLocalDay(now), -89)));
  const [to, setTo] = useState(() => localDateKey(now));
  const [month, setMonth] = useState(() => monthKey(now));
  const sessions = [...eegSessions].sort((a, b) => b.startTime - a.startTime);
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [additions, setAdditions] = useState<Additions>(NO_ADDITIONS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  const choose = (r: Range) => {
    setRange(r);
    if (r !== 'custom') {
      setFrom(localDateKey(addLocalDays(startOfLocalDay(now), -(Number(r) - 1))));
      setTo(localDateKey(now));
    }
  };
  const request: ReportRequest = { kind, from, to, month, sessionId: sessionId || sessions[0]?.id || '', additions };
  const bad =
    kind === 'diary' ? month === '' : kind === 'eeg' ? request.sessionId === '' : from === '' || to === '' || from > to;
  const made = bad ? null : make(request);
  const kinds: { value: ReportKind; label: string; detail: string }[] = [
    { value: 'neurologist', label: t('reports.neuro'), detail: t('reports.neuroHelp') },
    { value: 'eventLog', label: t('reports.eventLog'), detail: t('reports.eventLogHelp') },
    { value: 'diary', label: t('reports.diary'), detail: t('reports.diaryHelp') },
    ...(settings.eegEnabled ? [{ value: 'eeg' as const, label: t('reports.eeg'), detail: t('reports.eegHelp') }] : []),
    { value: 'csv', label: t('reports.csv'), detail: t('reports.csvHelp') },
  ];
  const mime = made?.type === 'csv' ? 'text/csv' : 'application/pdf';
  const run = (work: () => Promise<string | null>) => {
    setBusy(true);
    setProblem(undefined);
    void work()
      .then((message) => message && toast(message, 'success'))
      .catch(() => setProblem(t('reports.failed')))
      .finally(() => setBusy(false));
  };

  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.reports')} onBack={() => nav.pop()} />
        <ChoiceList label={t('reports.which')} value={kind} onChange={setKind} options={kinds} />
        {kind === 'diary' ? (
          <DateTimeField label={t('reports.month')} type="month" value={month} onChange={setMonth} />
        ) : kind === 'eeg' ? (
          sessions.length === 0 ? (
            <p className="app-note">{t('reports.noSessions')}</p>
          ) : (
            <Select
              label={t('reports.session')}
              value={request.sessionId}
              onChange={setSessionId}
              options={sessions.map((s: EegSession) => ({
                value: s.id,
                label: `${s.title || t('eeg.untitled')} · ${fmt.date(s.startTime)}`,
              }))}
            />
          )
        ) : (
          <Section title={t('reports.period')}>
            <Stack>
              <ChipGroup
                label={t('reports.period')}
                value={range}
                onChange={choose}
                options={[
                  { value: '30', label: t('reports.days', { n: 30 }) },
                  { value: '90', label: t('reports.days', { n: 90 }) },
                  { value: '180', label: t('reports.months', { n: 6 }) },
                  { value: '365', label: t('reports.months', { n: 12 }) },
                  { value: 'custom', label: t('reports.custom') },
                ]}
              />
              {range === 'custom' ? (
                <>
                  <DateTimeField label={t('hist.from')} type="date" value={from} onChange={setFrom} />
                  <DateTimeField label={t('hist.to')} type="date" value={to} onChange={setTo} />
                </>
              ) : (
                <p className="app-note">{`${from} – ${to}`}</p>
              )}
              {from > to && from !== '' && to !== '' ? (
                <p role="alert" className="app-banner">
                  {t('reports.badRange')}
                </p>
              ) : null}
            </Stack>
          </Section>
        )}
        {kind === 'neurologist' ? (
          <Section title={t('reports.extra')}>
            <Card>
              <Stack gap="0.5rem">
                <p className="app-note">{t('reports.extraHelp')}</p>
                {ADDITION_KEYS.filter((k) => k !== 'trueScale').map((key) => (
                  <Stack gap="0.25rem" key={key}>
                    <Checkbox
                      checked={additions[key]}
                      onChange={(on) => setAdditions((a) => ({ ...a, [key]: on }))}
                      label={t(`reports.extra.${key}` as never)}
                      help={t(`reports.extra.${key}Help` as never)}
                    />
                    {key === 'seizureTimelines' && additions.seizureTimelines ? (
                      <Checkbox
                        checked={additions.trueScale}
                        onChange={(on) => setAdditions((a) => ({ ...a, trueScale: on }))}
                        label={t('reports.extra.trueScale')}
                        help={t('reports.extra.trueScaleHelp')}
                      />
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            </Card>
          </Section>
        ) : null}
        {problem ? (
          <p role="alert" className="app-banner">
            {problem}
          </p>
        ) : null}
        <Card>
          <Stack>
            {made?.type === 'pdf' ? (
              <Button
                fullWidth
                variant="primary"
                disabled={busy}
                onClick={() => nav.push('reportPreview', { request })}
              >
                {t('reports.preview')}
              </Button>
            ) : null}
            <Button
              fullWidth
              variant={made?.type === 'csv' ? 'primary' : 'secondary'}
              disabled={busy || made === null}
              onClick={() =>
                run(async () => {
                  if (!made) return null;
                  const result = await saveReport(made);
                  return result === 'saved' ? t('reports.saved') : null;
                })
              }
            >
              {made?.type === 'csv' ? t('reports.saveCsv') : t('reports.savePdf')}
            </Button>
            {made && reportsEnv.canShare(made.fileName, mime) ? (
              <Button
                fullWidth
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!made) return null;
                    const bytes =
                      made.type === 'csv' ? new TextEncoder().encode(made.text) : await reportsEnv.makePdf(made.job);
                    await reportsEnv.share(bytes, made.fileName, mime);
                    return null;
                  })
                }
              >
                {t('reports.share')}
              </Button>
            ) : null}
          </Stack>
        </Card>
        <p className="app-note">{t('reports.private')}</p>
      </Stack>
    </Screen>
  );
}
