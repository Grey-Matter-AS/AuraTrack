import { buildCodeList, csvTemplate } from '@auratrack/reports';
import type { CsvImportReport } from '@auratrack/store';
import { Button, ButtonRow, Card, FilePicker, Section, Stack, useToast } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { reportsEnv } from '../reports/env';
import './screens.css';

const SHOWN_PROBLEMS = 20;

/**
 * Records from a spreadsheet (F-807): the template is the export with no rows, so an export edited in a spreadsheet comes
 * back too. The file is checked as soon as it is chosen; nothing is added until Import is pressed.
 */
export function ImportCsv() {
  const { t, api, actions, label, patient, settings } = useApp();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [check, setCheck] = useState<CsvImportReport | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const options = () => ({
    patientId: patient?.id ?? '',
    dateOrder: settings.dateFormat,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const save = (text: string, name: string) =>
    void reportsEnv.save(text, name, 'text/csv').catch(() => toast(t('csv.failed'), 'error'));
  const examine = (picked: { name: string; text: string }) => {
    setFile(picked);
    setCheck(null);
    setDone(null);
    setProblem(undefined);
    setBusy(true);
    void Promise.resolve(api.csvCheck({ text: picked.text, ...options() }))
      .then(setCheck)
      .catch(() => setProblem(t('csv.failed')))
      .finally(() => setBusy(false));
  };
  return (
    <Section title={t('csv.title')}>
      <Card>
        <Stack>
          <p className="app-help">{t('csv.help')}</p>
          <ButtonRow>
            <Button onClick={() => save(csvTemplate(label), 'auratrack-template.csv')}>{t('csv.template')}</Button>
            <Button onClick={() => save(buildCodeList(), 'auratrack-codes.csv')}>{t('csv.codeList')}</Button>
          </ButtonRow>
          <FilePicker
            label={file ? t('restore.otherFile') : t('csv.choose')}
            accept=".csv,text/csv,text/plain"
            disabled={!patient}
            onPick={(f) => void f.text().then((text) => examine({ name: f.name, text }))}
          />
          {file ? <p className="app-note">{file.name}</p> : null}
          {problem ? (
            <p role="alert" className="app-banner">
              {problem}
            </p>
          ) : null}
          {check && done === null ? (
            <Card compact {...(check.totals.rejected > 0 || check.unaccounted > 0 ? { tone: 'danger' as const } : {})}>
              <Stack gap="0.25rem">
                <p className="app-banner" role="status">
                  {t('csv.checked', {
                    ready: check.totals.ready,
                    found: check.totals.found,
                    duplicates: check.totals.duplicates,
                    rejected: check.totals.rejected,
                  })}
                </p>
                {check.examples.map((e) => (
                  <p key={`${e.section}-${e.line}`} className="app-note">
                    {t('csv.example', { line: e.line, read: e.read })}
                  </p>
                ))}
                {check.problems.slice(0, SHOWN_PROBLEMS).map((p) => (
                  <p key={`${p.section}-${p.line}-${p.reason}`} className="app-note">
                    {t('csv.problem', { section: p.section, line: p.line, reason: p.reason })}
                  </p>
                ))}
                {check.problems.length > SHOWN_PROBLEMS ? (
                  <p className="app-note">{t('csv.more', { count: check.problems.length - SHOWN_PROBLEMS })}</p>
                ) : null}
                {check.unknownSections.length > 0 ? (
                  <p className="app-note">{t('csv.unknown', { names: check.unknownSections.join(', ') })}</p>
                ) : null}
              </Stack>
            </Card>
          ) : null}
          {check && done === null && check.totals.ready > 0 ? (
            <>
              <p className="app-help">{t('csv.backupFirst')}</p>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  if (!file) return;
                  setBusy(true);
                  void Promise.resolve(api.csvImport({ text: file.text, ...options() }))
                    .then(async (r) => {
                      setDone(r.applied);
                      await actions.refresh();
                    })
                    .catch(() => setProblem(t('csv.failed')))
                    .finally(() => setBusy(false));
                }}
              >
                {t('csv.import', { count: check.totals.ready })}
              </Button>
            </>
          ) : null}
          {done !== null ? (
            <p className="app-banner" role="status">
              {t('csv.done', { count: done })}
            </p>
          ) : null}
        </Stack>
      </Card>
    </Section>
  );
}
