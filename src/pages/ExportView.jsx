import React, { useState } from 'react';
import { db } from '../data/db';
import { ExportCard } from '../components/ExportCard';
import { exportToJSON, exportToCSV, exportToPDF, exportNeurologistReport, filterEventsByDateRange } from '../utils/exportHelpers';
import { useMedications } from '../hooks/useMedications';

export default function ExportView({ onBack, settings = {} }) {
  const [fromDate, setFromDate] = useState(
    () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const today = new Date().toISOString().slice(0, 10);
  const { medications, getLogsForPeriod } = useMedications();

  const getEvents = async () => {
    const all = await db.events.orderBy('startTime').reverse().toArray();
    return filterEventsByDateRange(all, fromDate, toDate);
  };

  const handleExport = async (fn) => {
    const events = await getEvents();
    fn(events);
  };

  const handleNeurologistReport = async () => {
    const events = await getEvents();
    const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
    const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    exportNeurologistReport(events, settings, medications, medLogs);
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          Export &amp; Reports
        </h2>
      </div>

      {/* Date Range Pickers */}
      <div className="mb-6 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
          Date Range
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>From</p>
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
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>To</p>
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

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">

        {/* ── Raw Data Exports ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1" style={{ color: 'var(--text-faint)' }}>
          Raw Data
        </p>

        <ExportCard
          label="Backup JSON"
          description="Full data export — all fields and metadata. Use for backup or restoring on another device."
          onExport={() => handleExport(exportToJSON)}
        />
        <ExportCard
          label="Spreadsheet CSV"
          description="Date, time, seizure type, duration, and notes in comma-separated format. Opens in Excel / Sheets."
          onExport={() => handleExport(exportToCSV)}
        />
        <ExportCard
          label="Simple Print / PDF"
          description="Quick printable event table — opens in a new tab and triggers the print dialog."
          onExport={() => handleExport(exportToPDF)}
        />

        {/* ── Clinical Report ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          Clinical Report
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
                Neurologist Report
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                Purpose-built clinical PDF — patient info, phase timings, symptom breakdown, and full event log.
                Formatted for presenting to a neurologist or specialist.
              </p>
              {!settings.personName && (
                <p className="text-[10px] mt-2 font-bold" style={{ color: 'var(--accent)' }}>
                  ⚠ Add patient name in Settings → Identity for a complete report.
                </p>
              )}
            </div>
          </div>
          <div
            className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-center"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Generate &amp; Print Report
          </div>
        </div>

      </div>
    </div>
  );
}
