import { useTranslation } from 'react-i18next';
import { CloseIcon, DownloadIcon } from './AppIcons';

export function BackupReminderModal({ isOpen, overdueDays = 7, onBackupNow, onSnooze, onDisable }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <div
        className="w-full max-w-md rounded-[2rem] border p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-faint)' }}>
              {t('backup.reminder.eyebrow', 'Recovery reminder')}
            </p>
            <h3 className="text-base font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              {t('backup.reminder.title', 'Create a fresh backup')}
            </h3>
          </div>
          <button
            onClick={onSnooze}
            className="app-icon-action app-icon-action--primary !rounded-full !p-2"
            aria-label={t('backup.reminder.dismiss', 'Dismiss')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        >
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
            <DownloadIcon className="w-5 h-5" />
            {t('backup.reminder.panel_title', 'Protect against PWA data loss')}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t(
              'backup.reminder.body',
              'It has been more than {{days}} days since the last successful backup. A new encrypted backup helps recover data after browser resets, site-data deletion, or device migration.',
              { days: overdueDays }
            )}
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={onBackupNow}
            className="w-full rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {t('backup.reminder.backup_now', 'Back up now')}
          </button>
          <button
            onClick={onSnooze}
            className="w-full rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('backup.reminder.snooze', 'Remind me later')}
          </button>
          <button
            onClick={onDisable}
            className="w-full rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: '#334155', color: '#facc15', border: '1px solid #f59e0b' }}
          >
            {t('backup.reminder.turn_off', 'Turn off backup reminders')}
          </button>
        </div>
      </div>
    </div>
  );
}
