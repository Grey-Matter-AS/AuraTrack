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
  onPrimaryAction,
  primaryActionLabel,
  primaryActionIcon = null,
}) {
  return (
    <div className="app-page-shell flex flex-col h-full mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="app-icon-action app-icon-action--primary !px-5 !py-3"
          >
            ← BACK
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black uppercase text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
        <div className="w-10" />
      </div>

      <ScrollFade className="pr-2 pb-10">
        <div className="app-choice-grid">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => (multiSelect ? onToggleOption?.(opt) : onPick?.(opt))}
            className="app-action-tile border-[2px] text-sm font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={multiSelect && selectedOptions.includes(opt)
              ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '2px solid var(--action-blue-border)' }
              : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '2px solid var(--border)' }}
          >
            <span className="flex items-center justify-between gap-4 flex-wrap">
              <span className="app-chip-text flex-1 min-w-[7rem]">{opt}</span>
              {multiSelect && (
                <span className="text-xs shrink-0" style={{ color: selectedOptions.includes(opt) ? '#fff' : 'var(--text-secondary)' }}>
                  {selectedOptions.includes(opt) ? 'SELECTED' : 'TAP TO ADD'}
                </span>
              )}
            </span>
          </button>
        ))}
        </div>
        {multiSelect && onConfirmSelection && (
          <button
            onClick={onConfirmSelection}
            disabled={selectedOptions.length === 0}
            className="w-full mt-4 py-5 px-8 text-center rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg disabled:opacity-50 disabled:active:scale-100"
            style={{ backgroundColor: '#16a34a', color: '#fff', border: '2px solid #15803d' }}
          >
            {confirmLabel}
          </button>
        )}
        {onPrimaryAction && primaryActionLabel && (
          <button
            onClick={onPrimaryAction}
            className="w-full mt-4 py-5 px-8 text-center rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '2px solid var(--action-blue-border)' }}
          >
            {primaryActionIcon}
            <span className="app-chip-text">{primaryActionLabel}</span>
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full mt-4 py-5 px-8 text-center rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={{ backgroundColor: '#334155', color: '#facc15', border: '2px solid #f59e0b' }}
          >
            {skipLabel}
          </button>
        )}
      </ScrollFade>
    </div>
  );
}
