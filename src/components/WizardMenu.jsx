import { ScrollFade } from './ScrollFade';

export function WizardMenu({
  title,
  options,
  onPick,
  onBack,
  onSkip,
  skipLabel,
  multiSelect = false,
  selectedOptions = [],
  onToggleOption,
  onConfirmSelection,
  confirmLabel = 'Confirm Selection',
}) {
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
            onClick={() => (multiSelect ? onToggleOption?.(opt) : onPick?.(opt))}
            className="w-full py-7 px-8 text-left rounded-[2rem] text-sm font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={multiSelect && selectedOptions.includes(opt)
              ? { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--bg-raised))', color: 'var(--text-primary)', border: '2px solid var(--accent)' }
              : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '2px solid var(--border)' }}
          >
            <span className="flex items-center justify-between gap-4">
              <span>{opt}</span>
              {multiSelect && (
                <span className="text-xs" style={{ color: selectedOptions.includes(opt) ? 'var(--accent)' : 'var(--text-faint)' }}>
                  {selectedOptions.includes(opt) ? 'SELECTED' : 'TAP TO ADD'}
                </span>
              )}
            </span>
          </button>
        ))}
        {multiSelect && onConfirmSelection && (
          <button
            onClick={onConfirmSelection}
            disabled={selectedOptions.length === 0}
            className="w-full py-5 px-8 text-center rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg disabled:opacity-50 disabled:active:scale-100"
            style={{ backgroundColor: 'var(--accent)', color: '#fff', border: '2px solid color-mix(in srgb, var(--accent) 65%, white 0%)' }}
          >
            {confirmLabel}
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full py-5 px-8 text-center rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={{ backgroundColor: 'rgba(245,158,11,0.16)', color: '#f59e0b', border: '2px solid rgba(245,158,11,0.45)' }}
          >
            {skipLabel}
          </button>
        )}
      </ScrollFade>
    </div>
  );
}
