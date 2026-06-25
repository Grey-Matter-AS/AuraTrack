import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, DownloadIcon, EyeIcon, UploadIcon } from './AppIcons';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  collectCanonicalBackupPayload,
  decryptEncryptedBackup,
  encryptBackupPayload,
  hasBackupContent,
  parseBackupFileText,
  suggestedEncryptedBackupName,
  summarizeBackupPayload,
} from '../utils/backupFiles';
import { saveTextFile } from '../utils/exportHelpers';
import { mergeRemoteData } from '../utils/syncHelpers';

function StepText({ children }) {
  return <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}

function Label({ children }) {
  return <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>{children}</p>;
}

export function BackupTransferModal({
  isOpen,
  mode,
  settings = null,
  fileName = '',
  fileText = '',
  onClose,
  onExportSuccess,
  onImportSuccess,
}) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isExport = mode === 'export';
  const title = isExport
    ? t('backup.modal.export_title', 'Create Encrypted Backup')
    : t('backup.modal.import_title', 'Import Encrypted Backup');
  const submitLabel = isExport
    ? t('backup.modal.export_cta', 'Create backup')
    : t('backup.modal.import_cta', 'Decrypt and import');
  const icon = isExport ? <DownloadIcon className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />;

  const guidance = useMemo(() => {
    if (passphrase.length === 0) return '';
    if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
      return t(
        'backup.modal.passphrase_short_hint',
        `Use at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters. A few memorable words works well.`
      );
    }
    return t(
      'backup.modal.passphrase_ok_hint',
      'Keep this passphrase somewhere safe. AuraTrack cannot recover it later.'
    );
  }, [passphrase, t]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
      setError(
        t(
          'backup.modal.passphrase_short_error',
          `Passphrase must be at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`
        )
      );
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError(t('backup.modal.passphrase_mismatch', 'Passphrases do not match.'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = await collectCanonicalBackupPayload(settings);
      if (!hasBackupContent(payload)) {
        setError(t('backup.modal.no_data', 'No health data available to back up.'));
        setBusy(false);
        return;
      }

      const encrypted = await encryptBackupPayload(payload, passphrase);
      const result = await saveTextFile(
        JSON.stringify(encrypted, null, 2),
        suggestedEncryptedBackupName(),
        t('backup.modal.file_description', 'AuraTrack encrypted backup'),
        ['.atbak'],
      );
      if (!result?.ok) {
        if (!result?.cancelled) {
          setError(t('backup.modal.export_failed', 'Encrypted backup could not be saved.'));
        }
        setBusy(false);
        return;
      }
      await onExportSuccess?.(summarizeBackupPayload(payload));
      onClose?.();
    } catch (exportError) {
      console.error('Encrypted backup export failed:', exportError);
      setError(exportError?.message || t('backup.modal.export_failed', 'Encrypted backup could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!fileText) {
      setError(t('backup.modal.file_missing', 'Backup file is unavailable.'));
      return;
    }
    if (!passphrase) {
      setError(t('backup.modal.passphrase_required', 'Enter the backup passphrase to continue.'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const parsed = parseBackupFileText(fileText);
      if (parsed.kind !== 'encrypted') {
        throw new Error(t('backup.modal.not_encrypted', 'Selected file is not an encrypted backup.'));
      }
      const decrypted = await decryptEncryptedBackup(parsed.parsed, passphrase);
      const result = await mergeRemoteData(decrypted);
      await onImportSuccess?.(result);
      onClose?.();
    } catch (importError) {
      console.error('Encrypted backup import failed:', importError);
      setError(
        importError?.code === 'decrypt_failed'
          ? t('backup.modal.import_bad_passphrase', 'Incorrect passphrase or damaged backup file.')
          : importError?.message || t('backup.modal.import_failed', 'Backup import failed.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <div
        className="w-full max-w-md rounded-[2rem] border p-5 shadow-2xl sm:p-6"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-faint)' }}>
              {isExport ? t('backup.modal.export_eyebrow', 'Encrypted backup') : t('backup.modal.import_eyebrow', 'Secure restore')}
            </p>
            <h3 className="text-base font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="app-icon-action app-icon-action--primary !rounded-full !p-2"
            aria-label={t('backup.modal.close', 'Close')}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              {icon}
              {isExport ? t('backup.modal.export_panel_title', 'Portable encrypted file') : t('backup.modal.import_panel_title', 'Decrypt in memory only')}
            </div>
            {isExport ? (
              <>
                <StepText>{t('backup.modal.export_body', 'AuraTrack will encrypt the backup before saving it. The file name can be changed in the save dialog.')}</StepText>
                <StepText>{t('backup.modal.export_warning', 'If you forget this passphrase, the backup cannot be recovered.')}</StepText>
              </>
            ) : (
              <>
                <StepText>{t('backup.modal.import_body', 'AuraTrack will decrypt this backup in memory, import it, and will not write a plaintext copy to device storage.')}</StepText>
                <StepText>{t('backup.modal.import_file', 'Selected file: {{fileName}}', { fileName: fileName || t('backup.modal.file_unknown', 'unknown file') })}</StepText>
              </>
            )}
          </div>

          <div>
            <Label>{t('backup.modal.passphrase_label', 'Passphrase')}</Label>
            <input
              type={showSecret ? 'text' : 'password'}
              value={passphrase}
              onChange={event => setPassphrase(event.target.value)}
              autoComplete={isExport ? 'new-password' : 'current-password'}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              placeholder={t('backup.modal.passphrase_placeholder', 'Enter backup passphrase')}
            />
          </div>

          {isExport && (
            <div>
              <Label>{t('backup.modal.confirm_label', 'Confirm passphrase')}</Label>
              <input
                type={showSecret ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={event => setConfirmPassphrase(event.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder={t('backup.modal.confirm_placeholder', 'Re-enter backup passphrase')}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowSecret(value => !value)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              <EyeIcon className="w-4 h-4" />
              {showSecret ? t('backup.modal.hide', 'Hide') : t('backup.modal.show', 'Show')}
            </button>
            <p className="text-right text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {guidance}
            </p>
          </div>

          {error && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-sm font-bold">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={isExport ? handleExport : handleImport}
              disabled={busy}
              className="flex-1 rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
            >
              {busy ? t('backup.modal.working', 'Working...') : submitLabel}
            </button>
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              {t('backup.modal.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
