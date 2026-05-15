import { useState, useEffect } from 'react';
import { db } from '../data/db';

const DEFAULTS = {
  // Identity & Mode
  userMode: 'CARETAKER',       // 'CARETAKER' | 'PATIENT' (displayed as "Self")
  personName: '',               // patient name or self name — used in reports
  caretakerName: '',
  dateOfBirth: '',
  emergencyContact: '',

  // Neurologist / Reports
  neurologistName: '',
  neurologistInstitution: '',
  neurologistContact: '',
  includePatientDOB: true,
  reportNotes: '',

  // Appearance
  theme: 'dark',               // 'dark' | 'light' | 'system'
  accentColor: 'red',          // 'red' | 'blue' | 'green' | 'purple' | 'amber'
  fontSize: 'normal',          // 'small' | 'normal' | 'large' | 'xlarge'

  // Display
  historyPageSize: 10,
  dateFormat: 'locale',        // 'locale' | 'ISO' | 'US' | 'EU'
  durationFormat: 'seconds',   // 'seconds' | 'human'
  timeFormat: '12h',           // '12h' | '24h'

  // Recording
  hapticFeedback: true,
  quickNoteLabels: ['FELL', 'RESCUE MED', 'NOT RESPONDING', 'FULL BODY', 'LEFT SIDE', 'RIGHT SIDE'],

  // Data & Backup
  autoBackupFrequency: 'never', // 'never' | 'weekly' | 'monthly'
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

  const resetSettings = async () => {
    await db.settings.clear();
    setSettings(DEFAULTS);
  };

  return { settings, updateSettings, resetSettings };
}
