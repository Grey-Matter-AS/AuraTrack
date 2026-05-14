import React from 'react';

export function EventCard({ event, onEdit, onDelete, onViewDetail }) {
  return (
    <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700/50 flex justify-between items-center shadow-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white font-bold">{event.type || 'Unknown'}</p>
          {event.isEdited && (
            <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">Edited</span>
          )}
        </div>
        <p className="text-slate-500 text-[11px] font-medium">{event.date} • {event.time}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-[#0f172a] px-3 py-1 rounded-lg border border-slate-800 mr-2">
          <span className="text-red-500 font-mono font-black text-lg">{event.duration}s</span>
        </div>

        <button
          onClick={() => onEdit(event)}
          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase px-2 py-1 border border-blue-900/50 rounded tracking-wider"
        >
          View / Edit
        </button>

        <button
          onClick={() => onDelete(event.id)}
          className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase px-2 py-1 border border-red-900/50 rounded tracking-wider"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
