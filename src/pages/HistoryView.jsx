import React, { useState, useEffect } from 'react';
import { db } from '../data/db';
import { EventCard } from '../components/EventCard';
import { SEIZURE_TYPES } from '../data/constants';

export default function HistoryView({ onBack, onEdit, onDelete, onViewDetail, historyPageSize = 10 }) {
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

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="bg-slate-800 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
        >
          ← BACK
        </button>
        <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Event History</h2>
        <span className="ml-auto text-[9px] text-slate-600 font-bold bg-slate-900 px-2 py-1 rounded">{filtered.length} EVENTS</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 shrink-0">
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
        >
          <option value="">All Types</option>
          {SEIZURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(0); }}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
        />
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {paged.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-3xl py-8 text-center">
            <p className="text-slate-600 italic text-sm">No events found.</p>
          </div>
        ) : (
          paged.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetail={onViewDetail}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 shrink-0 border-t border-slate-800/50">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
          >
            ← Prev
          </button>
          <span className="text-slate-600 text-[10px] font-black uppercase">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
          >
            Next →
          </button>
        </div>
      )}

    </div>
  );
}
