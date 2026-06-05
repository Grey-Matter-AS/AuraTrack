import i18n from '../i18n';
import { phaseDurs } from '../utils/phaseCalculations';

const DAY_MS = 86400000;

export const DIARY_TYPE_COLORS = {
  'Tonic-Clonic': '#dc2626',
  'Focal Aware': '#f59e0b',
  'Focal Impaired': '#ef4444',
  'Absence': '#3b82f6',
  'Aura Only': '#a855f7',
  Uncategorized: '#6b7280',
};

export const DIARY_TYPE_ABBREV = {
  'Tonic-Clonic': 'TC',
  'Focal Aware': 'FA',
  'Focal Impaired': 'FI',
  Absence: 'Ab',
  'Aura Only': 'Au',
  Uncategorized: '?',
};

const FREQ_SHORT = {
  OD: 'Once daily',
  BD: 'Twice daily',
  TDS: 'Three times daily',
  QDS: 'Four times daily',
  PRN: 'As needed (rescue)',
};

export function getCurrentLocale() {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

export function getTranslator() {
  return (key, options) => i18n.t(key, options);
}

export function formatDurationLabel(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function describeSymptomPath(symptom = {}) {
  const path = [symptom.symptom, symptom.detail].filter(Boolean).join(' > ');
  const location = [symptom.region, symptom.subRegion, symptom.specificPart]
    .filter(part => part && part !== 'N/A' && part !== 'Internal/General')
    .join(' > ');
  return {
    path,
    location,
    combined: location ? `${path} @ ${location}` : path,
  };
}

export function buildEventLogData(events) {
  const locale = getCurrentLocale();
  const generatedDate = new Date().toLocaleDateString(locale);

  return {
    locale,
    generatedDate,
    events: events.map(event => ({
      id: event.id,
      date: event.date || '',
      time: event.time || '',
      type: event.type || '',
      durationSec: event.duration || 0,
      durationLabel: `${event.duration || 0}s`,
      notesHtml: (event.notes || '').replace(/\n/g, '<br>'),
      symptoms: (event.symptoms || []).map(describeSymptomPath),
    })),
  };
}

export function buildNeurologistReportData(events, settings = {}, medications = [], medicationLogs = []) {
  const locale = getCurrentLocale();
  const t = getTranslator();
  const now = Date.now();
  const periodStart = now - 30 * DAY_MS;
  const generatedDate = new Date(now).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  const periodStartStr = new Date(periodStart).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const periodEndStr = new Date(now).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

  const {
    personName = '',
    caretakerName = '',
    dateOfBirth = '',
    emergencyContact = '',
    neurologistName = '',
    neurologistInstitution = '',
    neurologistContact = '',
    includePatientDOB = true,
    reportNotes = '',
    userMode = 'CARETAKER',
  } = settings;

  const allSorted = [...events].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  const periodEvents = allSorted.filter(event => (event.startTime || 0) >= periodStart);
  const last10Events = allSorted.slice(0, 10);
  const last10DaysEvents = allSorted.filter(event => (event.startTime || 0) >= now - 10 * DAY_MS);
  const recentEvents = last10DaysEvents.length >= last10Events.length ? last10DaysEvents : last10Events;

  const byType = {};
  let totalDuration = 0;
  periodEvents.forEach(event => {
    const type = event.type || 'Uncategorized';
    byType[type] = (byType[type] || 0) + 1;
    totalDuration += event.duration || 0;
  });

  const totalEvents = periodEvents.length;
  const avgDurationSec = totalEvents ? Math.round(totalDuration / totalEvents) : 0;
  const daysCovered = new Set(periodEvents.map(event => event.date || '')).size;
  const reporterLabel = userMode === 'CARETAKER' ? caretakerName : personName;
  const subjectLabel = userMode === 'CARETAKER' ? personName : t('export.docs.self_subject');

  const awareness = { awake: 0, confused: 0, blackout: 0 };
  periodEvents.forEach(event => {
    (event.symptoms || []).forEach(symptom => {
      const value = (symptom.symptom || symptom.detail || '').toLowerCase();
      if (value.includes('awake') || value.includes('fully')) awareness.awake += 1;
      else if (value.includes('confused') || value.includes('dream')) awareness.confused += 1;
      else if (value.includes('blackout') || value.includes('loss')) awareness.blackout += 1;
    });
  });

  const detailMap = new Map();
  const addDetail = event => { if (event?.id != null) detailMap.set(event.id, event); };
  allSorted.slice(0, 3).forEach(addDetail);
  periodEvents.filter(event => (event.duration || 0) > 300 || event.isEdited).forEach(addDetail);
  const detailEvents = [...detailMap.values()].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

  const triggerCounts = {};
  periodEvents.forEach(event => {
    (event.triggers || []).forEach(trigger => {
      triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
    });
  });

  const longEvents = periodEvents.filter(event => (event.duration || 0) > 300);
  const flags = [];
  if (longEvents.length > 0) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_events_exceeding_5m', { count: longEvents.length }),
      detail: longEvents.map(event => `${event.date} ${event.time} (${formatDurationLabel(event.duration || 0)})`).join('; '),
    });
  }

  const midpoint = periodStart + 15 * DAY_MS;
  const firstHalf = periodEvents.filter(event => (event.startTime || 0) < midpoint).length;
  const secondHalf = periodEvents.filter(event => (event.startTime || 0) >= midpoint).length;
  if (secondHalf > firstHalf * 1.5 && secondHalf > 1) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_increasing_frequency'),
      detail: t('export.docs.flag_detail_recent_vs_prior', { recent: secondHalf, prior: firstHalf }),
    });
  }

  const ascendingEvents = [...periodEvents].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  if (ascendingEvents.length >= 4) {
    const half = Math.floor(ascendingEvents.length / 2);
    const avgEarly = ascendingEvents.slice(0, half).reduce((sum, event) => sum + (event.duration || 0), 0) / half;
    const avgRecent = ascendingEvents.slice(half).reduce((sum, event) => sum + (event.duration || 0), 0) / (ascendingEvents.length - half);
    if (avgRecent > avgEarly * 1.3) {
      flags.push({
        level: 'warning',
        label: t('export.docs.flag_increasing_duration'),
        detail: t('export.docs.flag_detail_recent_avg_vs_earlier_avg', {
          recent: formatDurationLabel(avgRecent),
          earlier: formatDurationLabel(avgEarly),
        }),
      });
    }
  }

  const autoStoppedCount = periodEvents.filter(event => event.isEmergencyStop).length;
  if (autoStoppedCount > 0) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_auto_terminated', { count: autoStoppedCount }),
      detail: t('export.docs.flag_detail_auto_terminated'),
    });
  }

  const editedCount = periodEvents.filter(event => event.isEdited).length;
  if (editedCount > 0) {
    flags.push({
      level: 'notice',
      label: t('export.docs.flag_edited_records', { count: editedCount }),
      detail: t('export.docs.flag_detail_edited_records'),
    });
  }

  const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTriggers.length > 0) {
    flags.push({
      level: 'notice',
      label: t('export.docs.flag_reported_triggers', {
        count: periodEvents.filter(event => (event.triggers || []).length > 0).length,
      }),
      detail: topTriggers.map(([trigger, count]) => `${trigger} (${count}x)`).join(', '),
    });
  }

  const fullyRecorded = periodEvents.filter(event => event.isComplete && event.laps?.aura && event.laps?.seizure && event.laps?.recovery).length;
  const partialRecorded = periodEvents.filter(event => event.isComplete && !(event.laps?.aura && event.laps?.seizure && event.laps?.recovery)).length;
  const untagged = periodEvents.filter(event => !event.isComplete).length;
  const fullyPct = totalEvents ? Math.round((fullyRecorded / totalEvents) * 100) : 0;
  const confidence = fullyPct >= 80
    ? { label: 'HIGH', color: '#059669', bg: '#d1fae5' }
    : fullyPct >= 50
      ? { label: 'MEDIUM', color: '#d97706', bg: '#fef3c7' }
      : { label: 'LOW', color: '#dc2626', bg: '#fee2e2' };

  const freqPerDay = { OD: 1, BD: 2, TDS: 3, QDS: 4, PRN: 0 };
  const expectedDoses = medications.reduce((sum, medication) => sum + (freqPerDay[medication.frequency] || 0) * 30, 0);

  return {
    locale,
    generatedDate,
    periodStartStr,
    periodEndStr,
    periodDays: 30,
    settings: {
      personName,
      caretakerName,
      dateOfBirth,
      emergencyContact,
      neurologistName,
      neurologistInstitution,
      neurologistContact,
      includePatientDOB,
      reportNotes,
      userMode,
      reporterLabel,
      subjectLabel,
    },
    stats: {
      totalEvents,
      avgDurationSec,
      avgDurationLabel: formatDurationLabel(avgDurationSec),
      daysCovered,
      seizureTypeCount: Object.keys(byType).length,
      byType,
      awareness,
      awarenessTotal: awareness.awake + awareness.confused + awareness.blackout,
      fullyRecorded,
      partialRecorded,
      untagged,
      autoStoppedCount,
      editedCount,
      fullyPct,
      confidence,
      medicationLogsCount: medicationLogs.length,
      expectedDoses,
    },
    medications: medications.map(medication => ({
      id: medication.id,
      name: medication.name,
      doseLabel: `${medication.dose}${medication.unit}`,
      frequency: medication.frequency,
      frequencyLabel: FREQ_SHORT[medication.frequency] || medication.frequency,
    })),
    flags,
    reportNotes,
    recentEvents: recentEvents.map((event, index) => {
      const phase = phaseDurs(event);
      const total = event.manualDurations?.total ?? event.duration ?? 0;
      return {
        index: index + 1,
        date: event.date || '-',
        time: event.time || '-',
        type: event.type || 'Uncategorized',
        totalSec: total,
        totalLabel: formatDurationLabel(total),
        auraLabel: formatDurationLabel(phase.aura),
        seizureLabel: formatDurationLabel(phase.seizure),
        recoveryLabel: formatDurationLabel(phase.recovery),
        hasNote: Boolean(event.notes && event.notes.trim()),
        isEdited: Boolean(event.isEdited),
        userModeAtTime: event.userModeAtTime || '',
      };
    }),
    detailEvents: detailEvents.map(event => {
      const phase = phaseDurs(event);
      const total = event.manualDurations?.total ?? event.duration ?? 0;
      return {
        id: event.id,
        date: event.date || '-',
        time: event.time || '-',
        type: event.type || 'Uncategorized',
        userModeAtTime: event.userModeAtTime || '',
        totalLabel: formatDurationLabel(total),
        auraLabel: formatDurationLabel(phase.aura),
        seizureLabel: formatDurationLabel(phase.seizure),
        recoveryLabel: formatDurationLabel(phase.recovery),
        notes: event.notes || '',
        badges: [
          (event.duration || 0) > 300 ? t('export.docs.detail_badge_over5') : '',
          event.isEmergencyStop ? t('export.docs.detail_badge_auto_stopped') : '',
          event.isEdited ? t('export.docs.detail_badge_edited') : '',
          ...(event.triggers || []),
        ].filter(Boolean),
        symptoms: (event.symptoms || []).map(symptom => ({
          ...describeSymptomPath(symptom),
          med: symptom.med || '-',
        })),
      };
    }),
    symptomLogRows: periodEvents
      .filter(event => (event.symptoms || []).length > 0)
      .flatMap(event => (event.symptoms || []).map(symptom => {
        const described = describeSymptomPath(symptom);
        return {
          date: event.date || '-',
          time: event.time || '-',
          type: event.type || '-',
          path: described.path,
          med: symptom.med || '-',
          location: described.location || '-',
        };
      })),
    charts: {
      periodEvents,
      byType,
      totalEvents,
    },
    version: pkgVersion(),
  };
}

export function buildSeizureDiaryData(allEvents, settings = {}, medications = [], month, year) {
  const locale = getCurrentLocale();
  const patientName = settings.personName || settings.caretakerName || '';
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const monthName = new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const eventsByDay = {};
  allEvents.forEach(event => {
    const date = new Date(event.startTime || 0);
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      const day = date.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  });

  const totalEvents = Object.values(eventsByDay).reduce((count, dayEvents) => count + dayEvents.length, 0);
  const legendTypes = [...new Set(Object.values(eventsByDay).flat().map(event => event.type || 'Uncategorized'))];
  const totalCells = firstDayOfWeek + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const cells = [];

  for (let cellIndex = 0; cellIndex < rows * 7; cellIndex += 1) {
    const dayNum = cellIndex - firstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ kind: 'empty' });
      continue;
    }

    const dayEvents = eventsByDay[dayNum] || [];
    const typeCounts = {};
    dayEvents.forEach(event => {
      const type = event.type || 'Uncategorized';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    cells.push({
      kind: 'day',
      dayNum,
      eventCount: dayEvents.length,
      hasTriggers: dayEvents.some(event => (event.triggers || []).length > 0),
      types: Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count,
        abbrev: DIARY_TYPE_ABBREV[type] || type.slice(0, 2),
        color: DIARY_TYPE_COLORS[type] || DIARY_TYPE_COLORS.Uncategorized,
      })),
    });
  }

  return {
    locale,
    year,
    month,
    monthName,
    patientName,
    totalEvents,
    firstDayOfWeek,
    daysInMonth,
    rows,
    cells,
    weekdayLabels: buildWeekdayLabels(locale),
    legendTypes: legendTypes.map(type => ({
      type,
      abbrev: DIARY_TYPE_ABBREV[type] || type.slice(0, 2),
      color: DIARY_TYPE_COLORS[type] || DIARY_TYPE_COLORS.Uncategorized,
    })),
    medicationsLine: medications.length > 0
      ? medications.map(medication => `${medication.name} ${medication.dose}${medication.unit} ${medication.frequency}`).join(' | ')
      : '',
    generatedDate: new Date().toLocaleDateString(locale),
  };
}

function buildWeekdayLabels(locale) {
  const sunday = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) =>
    new Date(sunday.getTime() + index * DAY_MS).toLocaleDateString(locale, { weekday: 'short' })
  );
}

function pkgVersion() {
  return '4.1.0';
}
