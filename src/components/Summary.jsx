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
  onCancel,
  onRemoveSymptom,
  onMoveSymptom
}) {

  // --- PHASE DURATION CALCULATIONS ---
  const auraDur = laps?.aura ? Math.floor((laps.aura - startTime) / 1000) : 0;
  
  const seizureDur = (laps?.aura && laps?.seizure) 
    ? Math.floor((laps.seizure - laps.aura) / 1000) 
    : 0;
    
  const recoveryDur = (laps?.seizure && laps?.recovery) 
    ? Math.floor((laps.recovery - laps.seizure) / 1000) 
    : 0;

  return (
    /* h-full and overflow-hidden lock the component to the screen glass */
    <div className="flex flex-col h-full w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-6 px-1 overflow-hidden">
      
      {/* 1. CLINICAL DURATION BREAKDOWN (Fixed Top) */}
      <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 mb-4 shrink-0 shadow-lg">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">TOTAL DURATION</p>
            <p className="text-4xl font-mono font-black text-white leading-none">{elapsed}<span className="text-lg text-slate-500 ml-1 font-sans">S</span></p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">LOG STATUS</p>
            <p className="text-xs font-black text-green-500 uppercase tracking-tighter">VERIFIED</p>
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

      {/* 2. SCROLLABLE MIDDLE AREA (Symptoms & Notes) */}
      <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar pb-6">
        <div>
          <p className="text-center font-black text-slate-600 uppercase text-[11px] tracking-[0.3em] mb-4">LOGGED SYMPTOMS</p>
          <div className="space-y-3">
            {tempSymptomList.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-[2rem]">
                 <p className="text-slate-600 italic text-sm">No symptoms tagged yet.</p>
              </div>
            ) : (
              tempSymptomList.map((s, i) => (
                <div key={i} className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700 flex justify-between items-center shadow-md animate-in fade-in slide-in-from-right duration-200">
                  <div className="flex gap-4 items-center flex-1">
                    
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button 
                        onClick={() => onMoveSymptom(i, 'UP')}
                        disabled={i === 0}
                        className={`w-8 h-7 flex items-center justify-center rounded-t-lg bg-slate-800 border-x border-t border-slate-700 text-[10px] font-black ${i === 0 ? 'opacity-5' : 'text-blue-400 active:bg-blue-500 active:text-white'}`}
                      >
                        ▲
                      </button>
                      
                      <span className="w-8 h-8 bg-slate-900 text-slate-500 font-black flex items-center justify-center text-xs border-x border-slate-800">
                        {i + 1}
                      </span>

                      <button 
                        onClick={() => onMoveSymptom(i, 'DOWN')}
                        disabled={i === tempSymptomList.length - 1}
                        className={`w-8 h-7 flex items-center justify-center rounded-b-lg bg-slate-800 border-x border-b border-slate-700 text-[10px] font-black ${i === tempSymptomList.length - 1 ? 'opacity-5' : 'text-blue-400 active:bg-blue-500 active:text-white'}`}
                      >
                        ▼
                      </button>
                    </div>

                    <div>
                      <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none mb-1">
                        {s.symptom}
                      </p>
                      <p className="text-slate-400 text-[11px] font-medium">
                        {s.region} › {s.specificPart}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => onRemoveSymptom(i)}
                    className="text-[10px] font-black text-red-500 uppercase px-3 py-2 bg-red-500/10 rounded-xl border border-red-500/20 active:bg-red-500 active:text-white transition-all"
                  >
                    REMOVE
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-full">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">CLINICAL OBSERVATIONS</p>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-[2rem] p-6 text-base text-slate-200 min-h-[160px] focus:border-blue-500 outline-none transition-all resize-none shadow-inner"
            placeholder="Add triggers, medication info, or post-ictal signs..."
          />
        </div>
      </div>

      {/* 3. FIXED BOTTOM ACTIONS (Anchored) */}
      <div className="flex flex-col gap-3 py-4 shrink-0 border-t border-slate-800/50 bg-[#0f172a]">
        <button 
          onClick={onAddAnother} 
          className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-slate-700 active:bg-slate-700"
        >
          + ADD ANOTHER SYMPTOM
        </button>

        <button 
          onClick={onSave} 
          className="w-full py-6 bg-green-600 text-white rounded-[2.2rem] font-black uppercase text-sm tracking-[0.2em] shadow-xl active:scale-95 transition-transform"
        >
          FINISH & SAVE LOG
        </button>

        <button 
          onClick={onCancel}
          className="w-full py-4 bg-red-900/10 border-2 border-red-500/50 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest active:bg-red-600 active:text-white transition-all"
        >
          CANCEL & DISCARD
        </button>
      </div>

    </div>
  );
}

export default Summary;
