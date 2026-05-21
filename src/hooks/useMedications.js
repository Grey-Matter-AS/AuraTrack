import { useState, useEffect } from 'react';
import { db } from '../data/db';

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

  const logDose = async (medicationId) => {
    await db.medicationLogs.add({ medicationId, takenAt: Date.now() });
  };

  const getLogsForPeriod = async (fromMs, toMs) => {
    try {
      return await db.medicationLogs.where('takenAt').between(fromMs, toMs, true, true).toArray();
    } catch { return []; }
  };

  useEffect(() => { load(); }, []);

  return { medications, load, addMedication, updateMedication, deleteMedication, logDose, getLogsForPeriod };
}
