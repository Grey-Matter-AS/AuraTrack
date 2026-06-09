import { useEffect, useRef } from 'react';
import { exportToJSON } from '../utils/exportHelpers';
import { db } from '../data/db';

export function useAutoBackup({ settings, updateSettings, status, events, medications, medicationLogs, onBackupComplete, onBackupError }) {
  const checkingRef = useRef(false);

  const checkAndBackup = async () => {
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

    try {
      const [eegSessions, eegActivities] = await Promise.all([
        db.eegSessions.toArray().catch(() => []),
        db.eegActivities.toArray().catch(() => []),
      ]);
      const result = await exportToJSON({
        settings,
        events,
        medications,
        medicationLogs,
        eegSessions,
        eegActivities,
      });
      if (result?.ok) {
        await updateSettings('lastAutoBackupAt', Date.now());
        onBackupComplete?.();
      }
    } catch (error) {
      console.error('Auto-backup failed:', error);
      onBackupError?.(error);
    } finally {
      checkingRef.current = false;
    }
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
