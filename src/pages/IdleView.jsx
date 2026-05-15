import React, { useMemo } from 'react';
import { EventCard } from '../components/EventCard';
import { buildDangerMap } from '../utils/dangerFlags';

export default function IdleView({ history, fullHistory, onStart, onEdit, onDelete, onViewDetail }) {
  const dangerMap = useMemo(() => buildDangerMap(fullHistory?.length ? fullHistory : history), [fullHistory, history]);

  return (
    <div className="flex-1 flex flex-col items-center w-full max-w-md overflow-hidden">
      <div className="py-10 shrink-0">
        <button
          onClick={onStart}
          className="w-60 h-60 bg-red-600 active:scale-95 active:bg-red-500 transition-all rounded-full shadow-[0_0_60px_rgba(225,29,72,0.4)] flex items-center justify-center text-white text-4xl font-black border-[12px] border-[#1e293b] ring-4 ring-red-900/20"
        >
          START
        </button>
      </div>

      <div className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2 shrink-0">
          <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recent Events</h3>
          {history.length > 0 && (
            <span className="text-[9px] text-slate-600 font-bold bg-slate-900 px-2 py-1 rounded">LAST 5</span>
          )}
        </div>

        <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
          {history.length === 0 ? (
            <div className="border-2 border-dashed border-slate-800 rounded-3xl py-8 text-center">
              <p className="text-slate-600 italic text-sm">No events recorded yet.</p>
            </div>
          ) : (
            history.map(event => (
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
      </div>
    </div>
  );
}
