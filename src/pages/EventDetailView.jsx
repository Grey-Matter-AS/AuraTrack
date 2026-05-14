import React, { useState, useEffect } from 'react';
import { db } from '../data/db';

export default function EventDetailView({ eventId, onEdit, onClose }) {
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (eventId) db.events.get(eventId).then(setEvent);
  }, [eventId]);

  if (!event) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600 italic text-sm">Loading...</p>
      </div>
    );
  }

  const auraDur = event.laps?.aura ? Math.floor((event.laps.aura - event.startTime) / 1000) : 0;
  const seizureDur = (event.laps?.aura && event.laps?.seizure) ? Math.floor((event.laps.seizure - event.laps.aura) / 1000) : 0;
  const recoveryDur = (event.laps?.seizure && event.laps?.recovery) ? Math.floor((event.laps.recovery - event.laps.seizure) / 1000) : 0;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onClose}
          className="bg-slate-800 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
        >
          ← BACK
        </button>
        <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Event Detail</h2>
        <button
          onClick={() => onEdit(event)}
          className="ml-auto text-[10px] font-bold text-blue-400 px-3 py-1.5 border border-blue-900/50 rounded tracking-wider uppercase"
        >
          Edit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">

        {/* Duration Summary */}
        <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 shadow-lg">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">TOTAL DURATION</p>
              <p className="text-4xl font-mono font-black text-white leading-none">{event.duration}<span className="text-lg text-slate-500 ml-1 font-sans">S</span></p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">TYPE</p>
              <p className="text-xs font-black text-white uppercase tracking-tighter">{event.type || 'Unknown'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/50">
            <div className="text-center">
              <p className="text-[9px] text-amber-500 font-black uppercase mb-1">AURA</p>
              <p className="text-lg font-mono font-black text-white">{auraDur}s</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-red-500 font-black uppercase mb-1">SEIZURE</p>
              <p className="text-lg font-mono font-black text-white">{seizureDur}s</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-blue-400 font-black uppercase mb-1">RECOVERY</p>
              <p className="text-lg font-mono font-black text-white">{recoveryDur}s</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="text-slate-200 font-medium">{event.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time</span>
              <span className="text-slate-200 font-medium">{event.time}</span>
            </div>
            {event.isEdited && (
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-slate-400 font-medium text-xs uppercase">Edited</span>
              </div>
            )}
          </div>
        </div>

        {/* Symptoms */}
        {event.symptoms && event.symptoms.length > 0 && (
          <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Symptoms</p>
            <div className="space-y-3">
              {event.symptoms.map((s, i) => (
                <div key={i} className="border-b border-slate-700/50 pb-3 last:border-0 last:pb-0">
                  <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none mb-1">{s.symptom}</p>
                  <p className="text-slate-400 text-[11px] font-medium">{s.region} › {s.specificPart}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Clinical Observations</p>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}
