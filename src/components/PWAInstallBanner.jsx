
export function PWAInstallBanner({ isVisible, isIOS, install, dismiss, showManualInstructions, dismissManual }) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          pointerEvents: 'auto',
        }}
      >
        <div className="text-xl shrink-0">📲</div>

        <div className="flex-1 min-w-0">
          {showManualInstructions ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                Add to Home Screen
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Tap <strong style={{ color: 'var(--text-primary)' }}>⋮</strong> in your browser, then select <strong style={{ color: 'var(--text-primary)' }}>"Add to Home screen"</strong>
              </p>
            </>
          ) : isIOS ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                Add to Home Screen
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Tap the Share menu (□↑) then "Add to Home Screen"
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                Install AuraTrack
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Add to your home screen for offline access
              </p>
            </>
          )}
        </div>

        {!isIOS && !showManualInstructions && (
          <button
            onClick={install}
            className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Install
          </button>
        )}

        <button
          onClick={showManualInstructions ? dismissManual : dismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-black active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
