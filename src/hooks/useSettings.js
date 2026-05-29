import { useState, useEffect } from 'react';
import { db } from '../data/db';
import i18n from '../i18n';

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
  autoBackupFrequency: 'never', // 'never' | 'weekly'
  autoBackupDays: [],           // number[] — day indices 0–6 (Date.getDay())
  lastAutoBackupAt: 0,          // Unix timestamp of last successful auto-backup

  // Medication tracking
  medicationStartDate: '',      // ISO date string — first day to show in medication history

  // Localisation
  language: 'en',               // ISO 639-1 language code
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const rows = await db.settings.toArray();
        const merged = { ...DEFAULTS };
        rows.forEach(row => { merged[row.key] = row.value; });
        if (merged.language && merged.language !== i18n.language) {
          i18n.changeLanguage(merged.language);
        }
        setSettings(merged);
      } catch (err) {
        console.error('Failed to load settings, using defaults:', err);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = async (key, value) => {
    try {
      await db.settings.put({ key, value });
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error('Failed to save setting:', err);
    }
  };

  const resetSettings = async () => {
    try {
      await db.settings.clear();
      setSettings(DEFAULTS);
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  };

  return { settings, updateSettings, resetSettings };
}
