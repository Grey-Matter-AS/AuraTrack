import React from 'react';
import { ScrollFade } from './ScrollFade';

export function WizardMenu({ title, options, onPick, onBack }) {
  return (
    <div className="flex flex-col h-full w-full max-w-md sm:max-w-xl md:max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            ← BACK
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black uppercase text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
        <div className="w-10" />
      </div>

      <ScrollFade className="space-y-4 pr-2 pb-10">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            className="w-full py-7 px-8 text-left rounded-[2rem] text-sm font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '2px solid var(--border)' }}
          >
            {opt}
          </button>
        ))}
      </ScrollFade>
    </div>
  );
}
