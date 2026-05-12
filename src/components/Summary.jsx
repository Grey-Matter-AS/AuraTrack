import React from 'react';

function Summary({ 
  tempSymptomList,
  setTempSymptomList,  
  notes, 
  setNotes,
  elapsed, 
  laps,
  startTime,
  onAddAnother,
  onSave, 
  onCancel
}) {

  // --- PHASE DURATION CALCULATIONS ---
  // Calculates seconds between two timestamps specifically for the Summary view
  const auraDur = laps?.aura ? Math.floor((laps.aura - startTime) / 1000) : 0;
  
  const seizureDur = (laps?.aura && laps?.seizure) 
    ? Math.floor((laps.seizure - laps.aura) / 1000) 
    : 0;
    
  const recoveryDur = (laps?.seizure && laps?.recovery) 
    ? Math.floor((laps.recovery - laps.seizure) / 1000) 
    : 0;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1. CLINICAL DURATION BREAKDOWN */}
      <div className="bg-slate-800/30 p-5 rounded-[2rem] border border-slate-700/50 mb-6 shadow-inner">
        <div className="flex justify-between items-end mb-4 px-2">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Duration</p>
            <p className="text-3xl font-mono font-black text-white">{elapsed}<span className="text-sm text-slate-500 ml-1 font-sans">S</span></p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Status</p>
            <p className="text-xs font-bold text-green-500 uppercase tracking-tighter">Verified Log</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-700/50">
           <div className="text-center">
             <p className="text-[8px] text-amber-500 font-bold uppercase mb-1">Aura</p>
             <p className="text-sm font-mono font-bold text-white">{auraDur}s</p>
           </div>
           <div className="text-center">
             <p className="text-[8px] text-red-500 font-bold uppercase mb-1">Seizure</p>
             <p className="text-sm font-mono font-bold text-white">{seizureDur}s</p>
           </div>
           <div className="text-center">
             <p className="text-[8px] text-blue-400 font-bold uppercase mb-1">Recovery</p>
             <p className="text-sm font-mono font-bold text-white">{recoveryDur}s</p>
           </div>
        </div>
      </div>

      {/* 2. SYMPTOM LIST */}
      <p className="text-center font-bold text-slate-400 uppercase text-[10px] tracking-widest">Logged Symptoms</p>
      
      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {tempSymptomList.length === 0 ? (
          <div className="py-4 text-center border border-dashed border-slate-800 rounded-xl">
             <p className="text-slate-600 italic text-xs">No symptoms tagged yet.</p>
          </div>
        ) : (
          tempSymptomList.map((s, i) => (
            <div key={i} className="bg-[#0f172a] p-3 rounded-xl border border-blue-500/20 text-xs flex justify-between items-center">
              <div>
                <p className="text-blue-400 font-bold">{s.symptom}: {s.detail}</p>
                <p className="text-slate-500">{s.region} › {s.specificPart}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. NOTES AREA */}
      <div className="mt-6 w-full">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Clinical Notes</p>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Triggers, missed meds, observations..."
          className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl p-4 text-sm text-slate-300 h-24 focus:border-blue-500 outline-none transition-all resize-none"
        />
      </div>

      {/* 4. ACTIONS */}
      <div className="flex flex-col gap-3 mt-6">
        <button 
          onClick={onAddAnother} 
          className="w-full py-4 bg-[#334155] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          + Add Another Symptom
        </button>

        <button 
          onClick={onSave} 
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          Finish & Save
        </button>

        <button 
          onClick={onCancel}
          className="w-full py-4 bg-red-500/10 border-2 border-red-500/50 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          Cancel & Discard
        </button>
      </div>

    </div>
  );
}

export default Summary;
