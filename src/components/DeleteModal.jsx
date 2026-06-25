import { useTranslation } from 'react-i18next';
import { WarningIcon } from './AppIcons';

export function DeleteModal({ onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1e293b] w-full max-w-sm p-10 rounded-[3rem] border border-slate-700 shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-6">
          <WarningIcon className="w-10 h-10" />
        </div>
        <h3 className="text-white text-2xl font-black mb-3 tracking-tight">{t('delete_modal.title')}</h3>
        <p className="text-sm mb-10 leading-relaxed font-medium px-2" style={{ color: '#e2e8f0' }}>
          {t('delete_modal.body')}
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={onConfirm}
            className="w-full py-6 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
          >
            {t('delete_modal.confirm')}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: '#334155', color: '#fff', border: '1px solid #64748b' }}
          >
            {t('delete_modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
