import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../data/db';
import { EventCard } from '../components/EventCard';
import { SEIZURE_TYPES } from '../data/constants';
import SeizureTrendChart from '../components/SeizureTrendChart';
import { buildDangerMap } from '../utils/dangerFlags';

export default function HistoryView({ onBack, onEdit, onDelete, onViewDetail, onExport, historyPageSize = 10 }) {
  const [allEvents, setAllEvents] = useState([]);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    db.events.orderBy('startTime').reverse().toArray().then(setAllEvents);
  }, []);

  const filtered = allEvents.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (dateFilter && e.date !== dateFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / historyPageSize);
  const paged = filtered.slice(page * historyPageSize, (page + 1) * historyPageSize);

  // Danger flags computed once against the full unfiltered list for accurate cluster detection
  const dangerMap = useMemo(() => buildDangerMap(allEvents), [allEvents]);

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Event History</h2>
        <span className="ml-auto text-[9px] font-bold px-2 py-1 rounded" style={{ color: 'var(--text-faint)', backgroundColor: 'var(--bg-card)' }}>{filtered.length} EVENTS</span>
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="w-full py-3 rounded-2xl font-black uppercase text-xs tracking-widest mb-4 shrink-0 active:scale-[0.98] transition-transform"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        Export &amp; Reports →
      </button>

      {/* Trend Chart */}
      <SeizureTrendChart allEvents={allEvents} />

      {/* Filters */}
      <div className="flex gap-2 mb-4 shrink-0">
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <option value="">All Types</option>
          {SEIZURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(0); }}
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        />
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {paged.length === 0 ? (
          <div className="border-2 border-dashed rounded-3xl py-8 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>No events found.</p>
          </div>
        ) : (
          paged.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetail={onViewDetail}
              dangerFlags={dangerMap[event.id]}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
          >
            ← Prev
          </button>
          <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-faint)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
          >
            Next →
          </button>
        </div>
      )}

    </div>
  );
}
