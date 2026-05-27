import { useEffect, useRef } from 'react';
import { exportToJSON } from '../utils/exportHelpers';

export function useAutoBackup({ settings, updateSettings, status, events, medications, medicationLogs, onBackupComplete }) {
  const checkingRef = useRef(false);

  const checkAndBackup = () => {
    const { autoBackupFrequency: freq, autoBackupDays: days = [], lastAutoBackupAt } = settings;

    if (status !== 'IDLE') return;
    if (freq !== 'weekly') return;
    if (!days.length) return;

    const todayIndex = new Date().getDay();
    if (!days.includes(todayIndex)) return;

    const alreadyDoneToday =
      lastAutoBackupAt &&
      new Date(lastAutoBackupAt).toDateString() === new Date().toDateString();
    if (alreadyDoneToday) return;

    if (checkingRef.current) return;
    checkingRef.current = true;

    exportToJSON(events, medications, medicationLogs);
    updateSettings('lastAutoBackupAt', Date.now());
    onBackupComplete?.();

    checkingRef.current = false;
  };

  useEffect(() => {
    checkAndBackup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoBackupFrequency, settings.autoBackupDays, settings.lastAutoBackupAt, status]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') checkAndBackup();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoBackupFrequency, settings.autoBackupDays, settings.lastAutoBackupAt, status, events, medications, medicationLogs]);
}
