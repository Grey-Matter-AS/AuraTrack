
import { useTranslation } from 'react-i18next';
import { CloseIcon, InstallIcon } from './AppIcons';

export function PWAInstallBanner({ isVisible, isIOS, install, dismiss, showManualInstructions, dismissManual }) {
  const { t } = useTranslation();
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
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)' }}
        >
          <InstallIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {showManualInstructions ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {t('install.add_to_home')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {t('install.manual_prefix')} <strong style={{ color: 'var(--text-primary)' }}>...</strong> {t('install.manual_suffix')}
              </p>
            </>
          ) : isIOS ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {t('install.add_to_home')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {t('install.ios_hint')}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {t('install.title')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {t('install.offline_hint')}
              </p>
            </>
          )}
        </div>

        {!isIOS && !showManualInstructions && (
          <button
            onClick={install}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--action-blue)', border: '1px solid var(--action-blue-border)' }}
          >
            <InstallIcon className="w-4 h-4" />
            {t('install.install')}
          </button>
        )}

        <button
          onClick={showManualInstructions ? dismissManual : dismiss}
          className="app-icon-action app-icon-action--primary shrink-0 !w-7 !h-7 !min-w-0 !min-h-0 !p-0 !rounded-full"
          aria-label={t('install.dismiss')}
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
