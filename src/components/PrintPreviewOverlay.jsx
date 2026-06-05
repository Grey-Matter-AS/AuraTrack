import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function PrintPreviewOverlay({ title, styles, html, onClose }) {
  const { t } = useTranslation();
  const showAppleMobileHint = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="auratrack-print-preview">
      <style>{styles}</style>
      <div className="auratrack-print-preview-toolbar no-print">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: '#1f2937', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          {t('nav.back')}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            {title}
          </p>
          {showAppleMobileHint && (
            <p className="mt-1 text-[11px] text-slate-400">
              {t('export.ios_pdf_hint')}
            </p>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid transparent' }}
        >
          {t('export.print_save_pdf')}
        </button>
      </div>
      <div className="auratrack-print-preview-document">
        <div
          className="auratrack-print-preview-sheet"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
