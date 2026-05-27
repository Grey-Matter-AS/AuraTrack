import { db } from '../data/db.js';

export async function checkFeatures() {
  const blocked = [];

  // IndexedDB — critical: all seizure/medication/settings data lives here
  try {
    await db.open();
  } catch {
    blocked.push({
      name: 'Local Data Storage',
      detail: 'Seizure records, medications, and settings cannot be saved.',
      critical: true,
    });
  }

  // localStorage — crash recovery during active recordings
  try {
    localStorage.setItem('__at_chk__', '1');
    localStorage.removeItem('__at_chk__');
  } catch {
    blocked.push({
      name: 'Session Recovery',
      detail: 'Recording state cannot be preserved if the app is interrupted mid-seizure.',
      critical: false,
    });
  }

  // Notifications API — medication reminders
  if (!('Notification' in window)) {
    blocked.push({
      name: 'Medication Reminders',
      detail: 'Notification API is not available — scheduled dose alerts will not fire.',
      critical: false,
    });
  }

  // Service Worker — offline support
  if (!('serviceWorker' in navigator)) {
    blocked.push({
      name: 'Offline Access',
      detail: 'Service workers are unavailable — the app will require an internet connection.',
      critical: false,
    });
  }

  return blocked;
}
