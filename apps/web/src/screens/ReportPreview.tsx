import { drawJob } from '@auratrack/reports';
import { AppHeader, Button, ButtonRow, Screen, Stack, useToast } from '@auratrack/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { useReportMaker, type ReportRequest } from '../reports/build';
import { reportsEnv } from '../reports/env';
import { saveReport } from './Reports';
import './screens.css';

/** The print preview (F-706): the pages as they will be saved, then Save or Share. */
export function ReportPreview({ request }: { request: ReportRequest }) {
  const { t } = useApp();
  const nav = useNav();
  const toast = useToast();
  const make = useReportMaker();
  const made = make(request);
  const host = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const pages = useMemo(() => {
    if (!made || made.type !== 'pdf') return null;
    const surface = reportsEnv.previewSurface(made.landscape);
    drawJob(made.job, surface);
    return surface.pages;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the preview is drawn once for this request
  }, [request.kind, request.from, request.to, request.month, request.sessionId]);
  useEffect(() => {
    const el = host.current;
    if (!el || !pages) return;
    el.replaceChildren(...pages);
    for (const page of Array.from(el.children)) page.className = 'app-page';
  }, [pages]);
  const act = (work: () => Promise<string | null>) => {
    setBusy(true);
    setProblem(undefined);
    void work()
      .then((m) => m && toast(m, 'success'))
      .catch(() => setProblem(t('reports.failed')))
      .finally(() => setBusy(false));
  };
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('reports.previewTitle')} onBack={() => nav.pop()} />
        <ButtonRow>
          <Button
            variant="primary"
            disabled={busy || !made}
            onClick={() =>
              act(async () => {
                if (!made) return null;
                return (await saveReport(made)) === 'saved' ? t('reports.saved') : null;
              })
            }
          >
            {t('reports.savePdf')}
          </Button>
          {made && made.type === 'pdf' && reportsEnv.canShare(made.fileName, 'application/pdf') ? (
            <Button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const bytes = await reportsEnv.makePdf(made.job);
                  await reportsEnv.share(bytes, made.fileName, 'application/pdf');
                  return null;
                })
              }
            >
              {t('reports.share')}
            </Button>
          ) : null}
        </ButtonRow>
        {problem ? (
          <p role="alert" className="app-banner">
            {problem}
          </p>
        ) : null}
        <p className="app-note">{pages ? t('reports.pages', { pages: pages.length }) : ''}</p>
        <div ref={host} className="app-pages" role="img" aria-label={t('reports.previewLabel')} />
      </Stack>
    </Screen>
  );
}
