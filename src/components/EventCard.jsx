import React from 'react';

export function EventCard({ event, onEdit, onDelete }) {
  return (
    <div
      className="p-4 rounded-2xl flex justify-between items-center shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{event.type || 'Unknown'}</p>
          {event.isEdited && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}
            >Edited</span>
          )}
        </div>
        <p className="text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>{event.date} • {event.time}</p>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="px-3 py-1 rounded-lg mr-2"
          style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}
        >
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
