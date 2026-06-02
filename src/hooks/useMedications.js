import { useState, useEffect } from 'react';
import { db } from '../data/db';
import { getScheduledDosesForDay } from '../utils/medicationSchedule';

export function useMedications() {
  const [medications, setMedications] = useState([]);

  const load = async () => {
    try {
      const meds = await db.medications.orderBy('id').toArray();
      setMedications(meds);
    } catch { /* ignore — table may not exist in older DB versions */ }
  };

  const addMedication = async (med) => {
    await db.medications.add({ ...med, active: true });
    await load();
  };

  const updateMedication = async (id, changes) => {
    await db.medications.update(id, changes);
    await load();
  };

  const deleteMedication = async (id) => {
    await db.medications.delete(id);
    await db.medicationLogs.where('medicationId').equals(id).delete().catch(() => {});
    await load();
  };

  const logDoseWithStatus = async (medicationId, scheduledHHMM, takenAt, status, note = '') => {
    await db.medicationLogs.add({
      medicationId,
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
    } catch { return []; }
  };

  const getLogsForPeriod = async (fromMs, toMs) => {
    try {
      return await db.medicationLogs.where('takenAt').between(fromMs, toMs, true, true).toArray();
    } catch { return []; }
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
        const existing = todayLogs.find(
          l => l.medicationId === dose.medicationId && l.scheduledTime === dose.scheduledHHMM
        );
        if (!existing) {
          await db.medicationLogs.add({
            medicationId: dose.medicationId,
            scheduledTime: dose.scheduledHHMM,
            takenAt: dose.scheduledTs,
            status: 'missed',
          });
        }
      }
    } catch { /* silent */ }
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
  };
}
