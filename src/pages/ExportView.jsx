import React, { useState } from 'react';
import { db } from '../data/db';
import { ExportCard } from '../components/ExportCard';
import { exportToJSON, exportToCSV, exportToPDF, filterEventsByDateRange } from '../utils/exportHelpers';

const DATE_RANGES = [
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'All Time', days: null }
];

export default function ExportView({ onBack }) {
  const [selectedDays, setSelectedDays] = useState(30);

  const getEvents = async () => {
    const all = await db.events.orderBy('startTime').reverse().toArray();
    return filterEventsByDateRange(all, selectedDays);
  };

  const handleExport = async (fn) => {
    const events = await getEvents();
    fn(events);
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="bg-slate-800 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
        >
          ← BACK
        </button>
        <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Export Data</h2>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 shrink-0">
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-3">Date Range</p>
        <div className="flex gap-3">
          {DATE_RANGES.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setSelectedDays(days)}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                selectedDays === days
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        <ExportCard
          label="Export JSON"
          description="Full data export — all fields, suitable for backup or developer use."
          onExport={() => handleExport(exportToJSON)}
        />
        <ExportCard
          label="Export CSV"
          description="Spreadsheet-compatible format — date, type, duration, notes."
          onExport={() => handleExport(exportToCSV)}
        />
        <ExportCard
          label="Print / PDF"
          description="Opens a printable summary in a new tab."
          onExport={() => handleExport(exportToPDF)}
        />
      </div>

    </div>
  );
}
