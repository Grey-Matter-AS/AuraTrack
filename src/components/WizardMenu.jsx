import React from 'react';

export function WizardMenu({ title, options, onPick, onBack }) {
  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="bg-slate-800 text-blue-400 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
          >
            ← BACK
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black text-slate-500 uppercase text-[11px] tracking-[0.3em]">{title}</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-10">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            className="w-full py-7 px-8 bg-[#334155] text-left text-white rounded-[2rem] text-sm font-black uppercase tracking-widest border-2 border-slate-600/50 hover:bg-slate-700 active:scale-[0.97] transition-all shadow-lg"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
