import { useState, useCallback } from 'react';
import { defaultScheduledTimes, scheduledTimestampForToday } from '../utils/medicationSchedule';

// Module-level timer store so timers survive component re-renders
const pendingTimers = new Map();

function clearAllTimers() {
  for (const id of pendingTimers.values()) clearTimeout(id);
  pendingTimers.clear();
}

async function fireNotification(med, hhMM) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title = `Time to take ${med.name}`;
  const body = `${med.dose}${med.unit} — tap to confirm in AuraTrack`;
  const tag = `med-${med.id}-${hhMM}`;
  try {
    const sw = await navigator.serviceWorker?.ready;
    if (sw?.showNotification) {
      await sw.showNotification(title, { body, tag, icon: '/favicon.svg', badge: '/favicon.svg' });
    } else {
      new Notification(title, { body, tag });
    }
  } catch {
    try { new Notification(title, { body, tag }); } catch { /* not supported */ }
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const scheduleForToday = useCallback((medications) => {
    clearAllTimers();
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const now = Date.now();
    for (const med of medications) {
      if (!med.active || med.isRescue || !med.reminderEnabled) continue;
      const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
      for (const hhMM of times) {
        const targetMs = scheduledTimestampForToday(hhMM);
        const delay = targetMs - now;
        if (delay < 60_000) continue; // already past or less than 1 min away
        const key = `${med.id}-${hhMM}`;
        const timerId = setTimeout(() => fireNotification(med, hhMM), delay);
        pendingTimers.set(key, timerId);
      }
    }
  }, []);

  const cancelAll = useCallback(() => {
    clearAllTimers();
  }, []);

  return { permission, requestPermission, scheduleForToday, cancelAll };
}
