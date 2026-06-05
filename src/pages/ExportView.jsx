import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { ScrollFade } from '../components/ScrollFade';
import { ExportCard } from '../components/ExportCard';
import { PrintPreviewOverlay } from '../components/PrintPreviewOverlay';
import { exportToJSON, exportToCSV, buildEventTablePreview, buildNeurologistReportPreview, buildSeizureDiaryPreview, filterEventsByDateRange } from '../utils/exportHelpers';
import { useMedications } from '../hooks/useMedications';

export default function ExportView({ onBack, settings = {}, isEmbedded = false }) {
  const { t } = useTranslation();
  const [printPreview, setPrintPreview] = useState(null);
  const [fromDate, setFromDate] = useState(
    () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const today = new Date().toISOString().slice(0, 10);
  const { medications, getLogsForPeriod } = useMedications();
  const [diaryMonth, setDiaryMonth] = useState(
    () => new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
  );

  const getEvents = async () => {
    const all = await db.events.orderBy('startTime').reverse().toArray();
    return filterEventsByDateRange(all, fromDate, toDate);
  };

  const handleSimplePdfReport = async () => {
    const events = await getEvents();
    setPrintPreview(buildEventTablePreview(events));
  };

  const handleSeizureDiary = async () => {
    const all = await db.events.orderBy('startTime').toArray();
    const [year, month] = diaryMonth.split('-').map(Number);
    setPrintPreview(buildSeizureDiaryPreview(all, settings, medications, month, year));
  };

  const handleNeurologistReport = async () => {
    const events = await getEvents();
    const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
    const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    setPrintPreview(buildNeurologistReportPreview(events, settings, medications, medLogs));
  };

  const ContentWrapper = isEmbedded ? 'div' : ScrollFade;
  const contentWrapperProps = isEmbedded
    ? { className: 'space-y-3' }
    : { className: 'space-y-3', wrapperClassName: 'flex-1' };

  return (
    <div className={isEmbedded ? 'w-full pb-10 space-y-0' : 'flex-1 flex flex-col w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden'}>
      {printPreview && (
        <PrintPreviewOverlay
          title={printPreview.title}
          styles={printPreview.styles}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}

      {/* Header — hidden when embedded in History tab */}
      {!isEmbedded && (
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('nav.back')}
          </button>
          <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('export.title')}
          </h2>
        </div>
      )}

      {/* Date Range Pickers */}
      <div className="mb-6 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
          {t('export.date_range')}
        </p>
        <div className="flex gap-3 date-time-row">
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.from')}</p>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.to')}</p>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={e => setToDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      <ContentWrapper {...contentWrapperProps}>

        {/* ── Raw Data Exports ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1" style={{ color: 'var(--text-faint)' }}>
          {t('export.raw_data')}
        </p>

        <ExportCard
          label={t('export.backup_json_label')}
          description={t('export.backup_json_desc')}
          onExport={async () => {
            const events = await getEvents();
            const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
            const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
            const logs   = await getLogsForPeriod(fromMs, toMs);
	            await exportToJSON(events, medications, logs);
          }}
        />
        <ExportCard
          label={t('export.csv_label')}
          description={t('export.csv_desc')}
          onExport={async () => {
            const events = await getEvents();
            const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
            const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
            const logs   = await getLogsForPeriod(fromMs, toMs);
	            await exportToCSV(events, medications, logs);
          }}
        />
        <ExportCard
          label={t('export.pdf_label')}
          description={t('export.pdf_desc')}
          onExport={handleSimplePdfReport}
        />

        {/* ── Clinical Report ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          {t('export.clinical_report')}
        </p>

        <div
          className="rounded-2xl p-6 space-y-3 active:scale-[0.98] transition-transform cursor-pointer"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent)', boxShadow: `0 0 20px color-mix(in srgb, var(--accent) 15%, transparent)` }}
          onClick={handleNeurologistReport}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
            >
              🩺
            </div>
            <div className="flex-1">
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('export.neuro_report_label')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {t('export.neuro_report_desc')}
              </p>
              {!settings.personName && (
                <p className="text-[10px] mt-2 font-bold" style={{ color: 'var(--accent)' }}>
                  {t('export.neuro_report_warning')}
                </p>
              )}
            </div>
          </div>
          <div
            className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-center"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {t('export.open_preview')}
          </div>
        </div>

        {/* ── Seizure Diary ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          {t('export.diary_title')}
        </p>

        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'var(--bg-raised)' }}
            >
              📅
            </div>
            <div className="flex-1">
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('export.diary_label')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {t('export.diary_desc')}
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.month')}</p>
              <input
                type="month"
                value={diaryMonth}
                max={today.slice(0, 7)}
                onChange={e => setDiaryMonth(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={handleSeizureDiary}
              className="mt-5 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {t('export.open_preview')}
            </button>
          </div>
        </div>

      </ContentWrapper>
    </div>
  );
}
