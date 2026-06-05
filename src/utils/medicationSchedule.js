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

// Returns true if the medication is scheduled for the given day.
// scheduledDays absent or all 7 days = daily (always true).
export function isMedScheduledForDay(med, dayMs) {
  const days = med.scheduledDays;
  if (!days || days.length === 0 || days.length === 7) return true;
  return days.includes(new Date(dayMs).getDay());
}

// Expand all active non-PRN meds × scheduled times for a given day
export function getScheduledDosesForDay(medications, dateMs) {
  const doses = [];
  for (const med of medications) {
    if (!med.active || med.isRescue) continue;
    if (!isMedScheduledForDay(med, dateMs)) continue;
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const hhMM of times) {
      doses.push({
        medicationId: med.id,
        medicationUuid: med.uuid ?? null,
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

// Returns groups for the dose panel: only upcoming slots + past slots that are unlogged (missed).
// Taken/late doses disappear from the panel once logged.
export function getVisibleDosesForPanel(medications, todayLogs, nowMs = Date.now()) {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const groups = {};
  for (const med of medications) {
    if (!med.active || med.isRescue) continue;
    if (!isMedScheduledForDay(med, todayMs)) continue;
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const hhMM of times) {
      const scheduledTs = scheduledTimestampForDay(hhMM, todayMs);
      if (scheduledTs <= nowMs) {
        // Past slot — hide if already successfully logged
        const logged = todayLogs.some(
          l => l.medicationId === med.id &&
               l.scheduledTime === hhMM &&
               l.status !== 'missed'
        );
        if (logged) continue;
      }
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

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns a short display string for scheduledDays, e.g. "Mon · Wed · Fri"
// Returns null when all 7 days are selected (daily — no need to display).
export function scheduledDaysLabel(scheduledDays) {
  if (!scheduledDays || scheduledDays.length === 0 || scheduledDays.length === 7) return null;
  return [...scheduledDays].sort((a, b) => a - b).map(d => DAY_ABBR[d]).join(' · ');
}
