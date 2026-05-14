import { useState, useEffect } from 'react';
import { db } from '../data/db';

const DEFAULTS = {
  userMode: 'CARETAKER',
  patientName: '',
  caretakerName: '',
  historyPageSize: 10,
  dateFormat: 'locale',
  emergencyContact: '',
  quickNoteLabels: ['FELL', 'RESCUE MED', 'NOT RESPONDING', 'FULL BODY', 'LEFT SIDE', 'RIGHT SIDE']
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    const loadSettings = async () => {
      const rows = await db.settings.toArray();
      const merged = { ...DEFAULTS };
      rows.forEach(row => { merged[row.key] = row.value; });
      setSettings(merged);
    };
    loadSettings();
  }, []);

  const updateSettings = async (key, value) => {
    await db.settings.put({ key, value });
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, updateSettings };
}
