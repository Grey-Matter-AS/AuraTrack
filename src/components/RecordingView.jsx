import React, { useState } from 'react';

function RecordingView({ 
  elapsed, 
  startTime, 
  laps, 
  onLap, 
  onStop,
  onQuickNote, 
  userMode 
}) {
  const [showMarkers, setShowMarkers] = useState(false);
  
  const getDiff = (start, end) => {
    if (!start) return 0;
    const finish = end || Date.now();
    return Math.floor((finish - start) / 1000);
  };

  const auraDuration = getDiff(startTime, laps.aura);
  const seizureDuration = laps.aura ? getDiff(laps.aura, laps.seizure) : 0;
  const recoveryDuration = laps.seizure ? getDiff(laps.seizure, null) : 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-between w-full max-w-md mx-auto px-4 py-6 h-screen max-h-screen overflow-hidden animate-in fade-in">
      
      {/* 1. TOP: Persistent Phase Breakdown (Compact but clear) */}
      {userMode === 'CARETAKER' && (
        <div className="grid grid-cols-3 gap-3 w-full mb-2 shrink-0">
          <div className="bg-slate-800/50 py-3 rounded-2xl border border-slate-700 text-center">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Aura</p>
            <p className="text-2xl font-mono font-bold text-white leading-none">{auraDuration}s</p>
          </div>
          <div className="bg-slate-800/50 py-3 rounded-2xl border border-slate-700 text-center">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Seizure</p>
            <p className="text-2xl font-mono font-bold text-white leading-none">{seizureDuration}s</p>
          </div>
          <div className="bg-slate-800/50 py-3 rounded-2xl border border-slate-700 text-center">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Recovery</p>
            <p className="text-2xl font-mono font-bold text-white leading-none">{recoveryDuration}s</p>
          </div>
        </div>
      )}

      {/* 2. MAIN TIMER (Dynamic sizing) */}
      <div className="flex-1 flex flex-col justify-center text-center py-4">
        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Total Elapsed</p>
        <div className="text-[11vh] font-mono font-black tracking-tighter tabular-nums text-white leading-none">
          {elapsed}<span className="text-[4vh] text-slate-600 ml-2 font-sans font-bold">S</span>
        </div>
      </div>

      {/* 3. DYNAMIC ACTION AREA (Flex-Grow to fill space) */}
      <div className="w-full flex gap-4 min-h-[35vh] items-stretch transition-all duration-500 mb-6">
        
        {/* LEFT COLUMN: Phase Buttons */}
        <div className={`flex flex-col gap-4 transition-all duration-500 ${showMarkers ? 'w-[48%]' : 'w-full'}`}>
          {userMode === 'CARETAKER' && (
            <>
              <button 
                disabled={!!laps.aura}
                onClick={() => onLap('aura')}
                className={`flex-1 rounded-[2rem] font-black uppercase text-sm tracking-[0.15em] leading-tight transition-all border-[3px] px-2 ${
                  laps.aura 
                  ? 'bg-slate-900 border-slate-800 text-slate-700' 
                  : 'bg-amber-600 border-amber-400 text-white shadow-xl shadow-amber-900/40 active:scale-95'
                }`}
              >
                {laps.aura ? 'AURA ENDED ✓' : 'END AURA'}
              </button>

              <button 
                disabled={!laps.aura || !!laps.seizure}
                onClick={() => onLap('seizure')}
                className={`flex-1 rounded-[2rem] font-black uppercase text-sm tracking-[0.15em] leading-tight transition-all border-[3px] px-2 ${
                  laps.seizure 
                  ? 'bg-slate-900 border-slate-800 text-slate-700' 
                  : (!laps.aura ? 'opacity-20 border-slate-800' : 'bg-red-600 border-red-400 text-white shadow-xl shadow-red-900/40 active:scale-95')
                }`}
              >
                {laps.seizure ? 'SEIZURE ENDED ✓' : 'END SEIZURE'}
              </button>
            </>
          )}

          <button 
            onClick={() => setShowMarkers(!showMarkers)}
            className={`py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-2 transition-all ${
              showMarkers 
              ? 'bg-blue-600 border-blue-400 text-white' 
              : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {showMarkers ? 'CLOSE NOTES' : '+ EVENT NOTE'}
          </button>
        </div>

        {/* RIGHT COLUMN: Marker Sidebar */}
        {showMarkers && (
          <div className="w-[52%] grid grid-cols-1 gap-3 animate-in slide-in-from-right fade-in duration-300">
            {[
              'FELL', 'RESCUE MED', 
              'NOT RESPONDING', 'FULL BODY', 
              'LEFT SIDE', 'RIGHT SIDE'
            ].map(label => (
              <button
                key={label}
                onClick={() => onQuickNote(label)}
                className="bg-slate-800 border-2 border-slate-700 text-white rounded-2xl text-[11px] font-black tracking-tight uppercase active:bg-blue-600 transition-all px-3 shadow-lg leading-tight"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. BOTTOM: Persistent STOP Button (Anchored at the very bottom) */}
      <div className="w-full shrink-0">
        <button 
          onClick={onStop}
          className="w-full py-10 bg-white text-[#0f172a] text-5xl font-black rounded-[3rem] shadow-[0_0_60px_rgba(255,255,255,0.15)] active:scale-95 transition-transform uppercase border-[10px] border-[#0f172a]"
        >
          STOP
        </button>
        {userMode === 'PATIENT' && (
          <p className="text-center text-slate-500 text-xs mt-4 uppercase font-black tracking-[0.2em]">Patient Mode Enabled</p>
        )}
      </div>

    </div>
  );
}

export default RecordingView;
