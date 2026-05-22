const DEFAULT_TIMES = {
  OD:  ['08:00'],
  BD:  ['08:00', '20:00'],
  TDS: ['08:00', '14:00', '20:00'],
  QDS: ['08:00', '12:00', '16:00', '20:00'],
  PRN: [],
};

export function defaultScheduledTimes(frequency) {
  return DEFAULT_TIMES[frequency] ?? [];
}

export function scheduledTimestampForDay(hhMM, dateMs) {
  const base = dateMs != null ? new Date(dateMs) : new Date();
  const [h, m] = hhMM.split(':').map(Number);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return d.getTime();
}

export function scheduledTimestampForToday(hhMM) {
  return scheduledTimestampForDay(hhMM, Date.now());
}

// Returns 'taken' (within 90 min), 'late' (after 90 min), or 'missed' (no log)
export function getDoseStatus(scheduledHHMM, loggedAtMs, dayMs) {
  if (loggedAtMs == null) return 'missed';
  const scheduledTs = scheduledTimestampForDay(scheduledHHMM, dayMs ?? loggedAtMs);
  const diffMin = (loggedAtMs - scheduledTs) / 60000;
  return diffMin <= 90 ? 'taken' : 'late';
}

// Expand all active non-PRN meds × scheduled times for a given day
export function getScheduledDosesForDay(medications, dateMs) {
  const doses = [];
  for (const med of medications) {
    if (!med.active || med.isRescue) continue;
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const hhMM of times) {
      doses.push({
        medicationId: med.id,
        medicationName: med.name,
        dose: med.dose,
        unit: med.unit,
        scheduledHHMM: hhMM,
        scheduledTs: scheduledTimestampForDay(hhMM, dateMs),
      });
    }
  }
  doses.sort((a, b) => a.scheduledTs - b.scheduledTs);
  return doses;
}

// Group active non-PRN meds by their scheduled time slots → { 'HH:MM': [med, ...] }
export function groupByScheduledTime(medications) {
  const groups = {};
  for (const med of medications) {
    if (!med.active || med.isRescue) continue;
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const hhMM of times) {
      if (!groups[hhMM]) groups[hhMM] = [];
      groups[hhMM].push(med);
    }
  }
  const sorted = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = groups[key];
  return sorted;
}

export function slotLabel(hhMM) {
  const [h] = hhMM.split(':').map(Number);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}
