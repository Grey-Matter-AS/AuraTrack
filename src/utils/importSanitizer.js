export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SYNC_PAYLOAD_CHARS = 5 * 1024 * 1024;

const MAX_EVENTS = 5000;
const MAX_MEDICATIONS = 500;
const MAX_LOGS = 20000;
const MAX_TEXT = 120;
const MAX_NOTES = 5000;
const MAX_ARRAY = 200;

const FREQS = new Set(['OD', 'BD', 'TDS', 'QDS', 'PRN']);
const LOG_STATUSES = new Set(['taken', 'missed', 'late']);

const asString = (value, max = MAX_TEXT) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const asBool = (value, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const asFiniteNumber = (value, fallback = null) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asNonNegativeInt = (value, fallback = 0, max = 86400) => {
  const n = asFiniteNumber(value, fallback);
  if (n == null) return fallback;
  return Math.min(max, Math.max(0, Math.floor(n)));
};

const validTime = (value) =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const sanitizeTextArray = (arr, maxItems = MAX_ARRAY) =>
  Array.isArray(arr)
    ? arr.map(v => asString(v)).filter(Boolean).slice(0, maxItems)
    : [];

const sanitizeSymptoms = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_ARRAY).map(s => {
    if (!s || typeof s !== 'object') return null;
    const out = {
      symptom: asString(s.symptom),
      detail: asString(s.detail),
      region: asString(s.region),
      subRegion: asString(s.subRegion),
      specificPart: asString(s.specificPart),
      med: asString(s.med),
    };
    return Object.values(out).some(Boolean) ? out : null;
  }).filter(Boolean);
};

const sanitizeNumberMap = (obj, keys, max = 24 * 60 * 60) => {
  if (!obj || typeof obj !== 'object') return {};
  return keys.reduce((acc, key) => {
    const n = asFiniteNumber(obj[key]);
    if (n != null && n >= 0) acc[key] = Math.min(max, n);
    return acc;
  }, {});
};

const sanitizeEditLog = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 100).map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    return {
      editedAt: asFiniteNumber(entry.editedAt, Date.now()),
      changedFields: sanitizeTextArray(entry.changedFields, 20),
    };
  }).filter(Boolean);
};

export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startTime = asFiniteNumber(raw.startTime);
  const duration = asFiniteNumber(raw.duration);
  if (startTime == null || duration == null || duration < 0) return null;

  const startDate = new Date(startTime);
  const validStart = !Number.isNaN(startDate.getTime());
  if (!validStart) return null;

  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    startTime,
    date: asString(raw.date, 80) || startDate.toLocaleDateString(),
    time: asString(raw.time, 80) || startDate.toLocaleTimeString(),
    duration: asNonNegativeInt(duration),
    manualDurations: sanitizeNumberMap(raw.manualDurations, ['aura', 'seizure', 'recovery', 'total']),
    laps: sanitizeNumberMap(raw.laps, ['aura', 'seizure', 'recovery'], Number.MAX_SAFE_INTEGER),
    type: asString(raw.type) || 'Uncategorized',
    symptoms: sanitizeSymptoms(raw.symptoms),
    triggers: sanitizeTextArray(raw.triggers),
    notes: asString(raw.notes, MAX_NOTES),
    isComplete: asBool(raw.isComplete),
    isEdited: asBool(raw.isEdited),
    isManualEntry: asBool(raw.isManualEntry),
    isEmergencyStop: asBool(raw.isEmergencyStop),
    userModeAtTime: asString(raw.userModeAtTime, 20),
    deferredTagging: asBool(raw.deferredTagging),
    editLog: sanitizeEditLog(raw.editLog),
  };
}

export function sanitizeMedication(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = asString(raw.name);
  if (!name) return null;
  const frequency = FREQS.has(raw.frequency) ? raw.frequency : 'OD';
  return {
    name,
    dose: asFiniteNumber(raw.dose, 0),
    unit: asString(raw.unit, 20) || 'mg',
    frequency,
    isRescue: asBool(raw.isRescue, frequency === 'PRN'),
    scheduledTimes: Array.isArray(raw.scheduledTimes)
      ? raw.scheduledTimes.filter(validTime).slice(0, 8)
      : [],
    scheduledDays: Array.isArray(raw.scheduledDays)
      ? [...new Set(raw.scheduledDays.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
      : [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: asBool(raw.reminderEnabled),
    showInEmergency: asBool(raw.showInEmergency),
    active: asBool(raw.active, true),
  };
}

export function sanitizeMedicationLog(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const medicationId = asFiniteNumber(raw.medicationId);
  const takenAt = asFiniteNumber(raw.takenAt);
  if (medicationId == null || takenAt == null) return null;
  return {
    medicationId,
    scheduledTime: validTime(raw.scheduledTime) ? raw.scheduledTime : null,
    takenAt,
    status: LOG_STATUSES.has(raw.status) ? raw.status : 'taken',
    note: asString(raw.note, 500),
    isEdited: asBool(raw.isEdited),
    ...(asFiniteNumber(raw.lastModified) ? { lastModified: asFiniteNumber(raw.lastModified) } : {}),
  };
}

export function sanitizeImportPayload(parsed) {
  const rawEvents = Array.isArray(parsed) ? parsed : (parsed?.events || []);
  const events = Array.isArray(rawEvents)
    ? rawEvents.map(sanitizeEvent).filter(Boolean).slice(0, MAX_EVENTS)
    : [];
  const medications = Array.isArray(parsed?.medications)
    ? parsed.medications.map(sanitizeMedication).filter(Boolean).slice(0, MAX_MEDICATIONS)
    : [];
  const medicationLogs = Array.isArray(parsed?.medicationLogs)
    ? parsed.medicationLogs.map(sanitizeMedicationLog).filter(Boolean).slice(0, MAX_LOGS)
    : [];

  return { events, medications, medicationLogs };
}

export function assertImportFileSafe(file) {
  if (file?.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Backup file is too large.');
  }
}
