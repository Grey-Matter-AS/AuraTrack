import { useState, useEffect } from 'react';
import { db } from '../data/db';
import { getScheduledDosesForDay } from '../utils/medicationSchedule';

function makeUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function useMedications() {
  const [medications, setMedications] = useState([]);
  const [lastError, setLastError] = useState(null);

  const load = async () => {
    try {
      const meds = await db.medications.orderBy('id').toArray();
      setMedications(meds);
      setLastError(null);
      return meds;
    } catch (err) {
      console.error('Failed to load medications:', err);
      setLastError({ scope: 'load_medications', message: 'Failed to load medications.' });
      throw err;
    }
  };

  const addMedication = async (med) => {
    await db.medications.add({ ...med, uuid: med.uuid || makeUUID(), active: true });
    setLastError(null);
    await load();
  };

  const updateMedication = async (id, changes) => {
    await db.medications.update(id, changes);
    await load();
  };

  const deleteMedication = async (id) => {
    const med = await db.medications.get(id).catch(() => null);
    await db.medications.delete(id);
    await db.medicationLogs.where('medicationId').equals(id).delete().catch(() => {});
    if (med?.uuid) await db.medicationLogs.where('medicationUuid').equals(med.uuid).delete().catch(() => {});
    await load();
  };

  const logDoseWithStatus = async (medicationId, scheduledHHMM, takenAt, status, note = '') => {
    const med = await db.medications.get(medicationId).catch(() => null);
    await db.medicationLogs.add({
      uuid: makeUUID(),
      medicationId,
      medicationUuid: med?.uuid ?? null,
      scheduledTime: scheduledHHMM ?? null,
      takenAt: takenAt ?? Date.now(),
      status: status ?? 'taken',
      note: typeof note === 'string' ? note.slice(0, 500) : '',
    });
  };

  const getLogsForDay = async (dateMs) => {
    try {
      const start = new Date(dateMs);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateMs);
      end.setHours(23, 59, 59, 999);
      return await db.medicationLogs.where('takenAt').between(start.getTime(), end.getTime(), true, true).toArray();
    } catch (err) {
      console.error('Failed to load medication logs for day:', err);
      setLastError({ scope: 'load_logs_day', message: 'Failed to load medication logs.' });
      throw err;
    }
  };

  const getLogsForPeriod = async (fromMs, toMs) => {
    try {
      return await db.medicationLogs.where('takenAt').between(fromMs, toMs, true, true).toArray();
    } catch (err) {
      console.error('Failed to load medication logs for period:', err);
      setLastError({ scope: 'load_logs_period', message: 'Failed to load medication logs.' });
      throw err;
    }
  };

  const updateLog = async (id, changes) => {
    await db.medicationLogs.update(id, {
      ...changes,
      isEdited: true,
      lastModified: Date.now(),
    });
  };

  // Idempotent: inserts 'missed' records for any scheduled dose that passed today without a log
  const markMissedDoses = async () => {
    try {
      const meds = await db.medications.toArray();
      const now = Date.now();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const todayLogs  = await db.medicationLogs
        .where('takenAt').between(todayStart.getTime(), todayEnd.getTime(), true, true)
        .toArray();

      const doses = getScheduledDosesForDay(meds, now);
      for (const dose of doses) {
        if (dose.scheduledTs > now) continue; // not yet due
        const existing = todayLogs.find((log) => {
          const matchesMedication = log.medicationUuid && dose.medicationUuid
            ? log.medicationUuid === dose.medicationUuid
            : log.medicationId === dose.medicationId;
          return matchesMedication && log.scheduledTime === dose.scheduledHHMM;
        });
        if (!existing) {
          await db.medicationLogs.add({
            uuid: makeUUID(),
            medicationId: dose.medicationId,
            medicationUuid: dose.medicationUuid ?? null,
            scheduledTime: dose.scheduledHHMM,
            takenAt: dose.scheduledTs,
            status: 'missed',
          });
        }
      }
      setLastError(null);
    } catch (err) {
      console.error('Failed to mark missed doses:', err);
      setLastError({ scope: 'mark_missed', message: 'Failed to record missed doses.' });
      throw err;
    }
  };

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, []);

  return {
    medications,
    load,
    addMedication,
    updateMedication,
    deleteMedication,
    logDoseWithStatus,
    getLogsForDay,
    getLogsForPeriod,
    updateLog,
    markMissedDoses,
    lastError,
    clearLastError: () => setLastError(null),
  };
}
