import React from 'react';

export function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e293b] w-full max-w-xs p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold">!</span>
        </div>
        <h3 className="text-white text-xl font-bold mb-2">DELETE RECORD?</h3>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          This action cannot be undone. This medical entry will be permanently removed.
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            YES, DELETE
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 bg-transparent text-slate-500 font-bold uppercase text-xs tracking-widest"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export function WizardMenu({ title, options, onPick, onBack }) {
  return (
    <div className="animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-6">
        {onBack ? <button onClick={onBack} className="text-blue-400 text-xs font-bold uppercase">← Back</button> : <div/>}
        <p className="text-center font-bold text-slate-400 uppercase text-[10px] tracking-widest">{title}</p>
        <div className="w-8"/>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => (
          <button key={opt} onClick={() => onPick(opt)}
            className="py-4 px-4 bg-[#334155] text-left text-white rounded-xl text-sm font-medium border border-slate-600/50 hover:bg-slate-700 active:scale-[0.98] transition-all">
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
