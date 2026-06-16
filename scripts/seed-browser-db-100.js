/*
 * AuraTrack 100-record randomized browser DB seed.
 *
 * Usage:
 * 1. Open AuraTrack in the browser/profile you want to test.
 * 2. Open DevTools Console.
 * 3. Paste this whole file and press Enter.
 * 4. Reload AuraTrack after the script reports success.
 *
 * This updates IndexedDB for the current AuraTrack origin. It removes only
 * prior records with the "seed100-" UUID prefix, then inserts plausible random
 * allowed data: 100 seizure events, medications, dose logs, wellbeing entries,
 * and an EEG diary session.
 */
(async function seedAuraTrackBrowserDb100() {
  const DB_NAME = 'AuraTrackDB';
  const DB_VERSION = 10;
  const SEED_PREFIX = 'seed100-';
  const EVENT_COUNT = 100;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const rangeStart = new Date(now - 90 * DAY_MS);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const runId = Math.random().toString(36).slice(2, 8);

  const stores = {
    events: {
      options: { keyPath: 'id', autoIncrement: true },
      indexes: ['uuid', 'startTime', 'date', 'type', 'isComplete', 'isEdited', 'notes', 'eegSessionId', 'videoAttached'],
    },
    settings: { options: { keyPath: 'key' }, indexes: [] },
    medications: { options: { keyPath: 'id', autoIncrement: true }, indexes: ['uuid'] },
    medicationLogs: {
      options: { keyPath: 'id', autoIncrement: true },
      indexes: ['uuid', 'medicationId', 'medicationUuid', 'takenAt', 'scheduledTime'],
    },
    eegSessions: { options: { keyPath: 'id', autoIncrement: true }, indexes: ['uuid', 'startTime', 'status', 'actualEndTime'] },
    eegActivities: { options: { keyPath: 'id', autoIncrement: true }, indexes: ['uuid', 'sessionId', 'kind', 'startTime', 'endTime', 'linkedEventId', 'isEdited'] },
    wellbeingEntries: { options: { keyPath: 'id', autoIncrement: true }, indexes: ['uuid', 'recordedAt', 'dayKey', 'primaryMood', 'intensity', 'isEdited'] },
  };

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.entries(stores).forEach(([name, definition]) => {
        const store = db.objectStoreNames.contains(name)
          ? request.transaction.objectStore(name)
          : db.createObjectStore(name, definition.options);
        definition.indexes.forEach((indexName) => {
          if (!store.indexNames.contains(indexName)) store.createIndex(indexName, indexName, { unique: false });
        });
      });
    };
    request.onsuccess = () => resolve(request.result);
  });

  const requestPromise = (request) => new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  const txDone = (tx) => new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    tx.oncomplete = () => resolve();
  });

  const randomId = (suffix) => `${SEED_PREFIX}${runId}-${suffix}`;
  const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
  const timeLabel = (ms) => new Date(ms).toTimeString().slice(0, 8);
  const rand = (min, max) => min + Math.random() * (max - min);
  const int = (min, max) => Math.floor(rand(min, max + 1));
  const chance = (p) => Math.random() < p;
  const pick = (items) => items[int(0, items.length - 1)];
  const sample = (items, maxCount, minCount = 0) => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, int(minCount, Math.min(maxCount, shuffled.length)));
  };
  const weightedPick = (items) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let target = rand(0, total);
    for (const item of items) {
      target -= item.weight;
      if (target <= 0) return item.value;
    }
    return items[items.length - 1].value;
  };
  const randomDateMs = () => {
    const day = int(0, Math.floor((rangeEndMs - rangeStartMs) / DAY_MS));
    const hour = weightedPick([
      { value: int(6, 10), weight: 3 },
      { value: int(11, 17), weight: 4 },
      { value: int(18, 23), weight: 3 },
      { value: int(0, 5), weight: 1 },
    ]);
    return rangeStartMs + day * DAY_MS + hour * 60 * 60 * 1000 + int(0, 59) * 60 * 1000 + int(0, 59) * 1000;
  };

  const symptomPool = [
    { symptom: 'Eyes', detail: 'Rapid Blinking', region: 'Head & Face', subRegion: 'Eyes', specificPart: 'Right Eye', med: 'Eyelid myoclonia' },
    { symptom: 'Eyes', detail: 'Staring', region: 'Head & Face', subRegion: 'Eyes', specificPart: 'Both Eyes', med: 'Behavioral arrest' },
    { symptom: 'Movement', detail: 'Jerking', region: 'Arms', subRegion: 'Left Arm', specificPart: 'Upper Arm', med: 'Clonic movement' },
    { symptom: 'Movement', detail: 'Stiffening', region: 'Legs', subRegion: 'Both Legs', specificPart: '', med: 'Tonic posturing' },
    { symptom: 'Awareness', detail: 'Confused', region: 'Internal/General', subRegion: '', specificPart: '', med: 'Impaired awareness' },
    { symptom: 'Awareness', detail: 'Blackout', region: 'Internal/General', subRegion: '', specificPart: '', med: 'Loss of awareness' },
    { symptom: 'Skin & Temperature', detail: 'Turned Pale', region: 'Internal/General', subRegion: '', specificPart: '', med: 'Pallor' },
    { symptom: 'Stomach & Chest', detail: 'Racing Heart', region: 'Internal/General', subRegion: '', specificPart: '', med: 'Tachycardia' },
    { symptom: 'Stomach & Chest', detail: 'Nausea/Sick feeling', region: 'Internal/General', subRegion: '', specificPart: '', med: 'Autonomic aura' },
    { symptom: 'Speech', detail: 'Unable to Speak', region: 'Head & Face', subRegion: 'Mouth', specificPart: '', med: 'Speech arrest' },
  ];
  const triggerPool = ['Poor sleep', 'Stress', 'Missed Medication', 'Illness', 'Flashing lights', 'Heat', 'Menstruation', 'Alcohol', 'Skipped meal'];
  const postIctalFindings = ['Sleepiness', 'Headache', 'Confusion', 'Nausea', 'Muscle soreness', 'Emotional distress'];
  const paralysisLocations = [
    { region: 'Arms', subRegion: 'Left Arm', specificPart: 'Upper Arm' },
    { region: 'Arms', subRegion: 'Right Arm', specificPart: 'Hand' },
    { region: 'Legs', subRegion: 'Left Leg', specificPart: 'Foot' },
  ];

  const events = Array.from({ length: EVENT_COUNT }, (_, index) => {
    const startTime = randomDateMs();
    const duration = weightedPick([
      { value: int(8, 45), weight: 22 },
      { value: int(46, 120), weight: 34 },
      { value: int(121, 240), weight: 22 },
      { value: int(241, 300), weight: 10 },
      { value: int(301, 540), weight: 8 },
      { value: int(541, 720), weight: 4 },
    ]);
    const type = weightedPick([
      { value: 'Focal Aware', weight: 28 },
      { value: 'Focal Impaired', weight: 32 },
      { value: 'Tonic-Clonic', weight: 13 },
      { value: 'Absence', weight: 16 },
      { value: 'Aura Only', weight: 11 },
    ]);
    const hasPhaseData = chance(0.78);
    const aura = hasPhaseData ? Math.max(1, Math.round(duration * rand(0.08, 0.28))) : 0;
    const seizure = hasPhaseData ? Math.max(1, Math.round(duration * rand(0.35, 0.68))) : 0;
    const recovery = hasPhaseData ? Math.max(0, duration - aura - seizure) : 0;
    const symptomCount = type === 'Aura Only' ? int(1, 2) : int(1, 5);
    const symptoms = sample(symptomPool, symptomCount, symptomCount);
    const isEdited = chance(0.16);
    const postIctal = chance(0.55)
      ? {
          findings: sample(postIctalFindings, int(1, 3), 1),
          paralysisLocations: chance(0.22) ? sample(paralysisLocations, 1, 1) : [],
        }
      : { findings: [], paralysisLocations: [] };
    return {
      uuid: randomId(`event-${index + 1}`),
      startTime,
      date: isoDate(startTime),
      time: timeLabel(startTime),
      duration,
      manualDurations: hasPhaseData ? { total: duration, aura, seizure, recovery } : { total: duration },
      laps: hasPhaseData
        ? {
            aura: startTime + aura * 1000,
            seizure: startTime + (aura + seizure) * 1000,
            recovery: startTime + duration * 1000,
          }
        : {},
      type,
      symptoms,
      triggers: sample(triggerPool, int(0, 3), chance(0.45) ? 1 : 0),
      notes: chance(0.22) ? pick([
        'Short recovery after resting in a quiet room.',
        'Reported aura before the event.',
        'Caregiver observed color change and fatigue afterward.',
        'Seed note with longer wording to exercise report wrapping and pagination in the PDF.',
      ]) : '',
      postIctal,
      isComplete: hasPhaseData && chance(0.86),
      isEdited,
      isManualEntry: chance(0.2),
      isEmergencyStop: duration >= 720 || chance(0.04),
      userModeAtTime: chance(0.66) ? 'CARETAKER' : 'SELF',
      deferredTagging: chance(0.08),
      editLog: isEdited ? [{ editedAt: startTime + int(1, 72) * 60 * 60 * 1000, changedFields: sample(['duration', 'symptoms', 'triggers', 'notes', 'type'], 3, 1) }] : [],
      videoAttached: chance(0.12),
    };
  }).sort((a, b) => a.startTime - b.startTime);

  const wellbeingEntries = Array.from({ length: 90 }, (_, index) => {
    const recordedAt = rangeStartMs + index * DAY_MS + int(18, 22) * 60 * 60 * 1000 + int(0, 59) * 60 * 1000;
    return {
      uuid: randomId(`wellbeing-${index + 1}`),
      recordedAt,
      dayKey: isoDate(recordedAt),
      primaryMood: weightedPick([
        { value: 'Calm', weight: 23 },
        { value: 'Good', weight: 21 },
        { value: 'Anxious / Worried', weight: 22 },
        { value: 'Low', weight: 18 },
        { value: 'Irritable', weight: 10 },
        { value: 'Confused', weight: 6 },
      ]),
      intensity: weightedPick([{ value: 1, weight: 45 }, { value: 2, weight: 38 }, { value: 3, weight: 17 }]),
      factors: {
        sleepQuality: { label: 'Sleep quality', type: 'scale', unit: '', help: 'How restful sleep was.', active: true, value: int(0, 3), saveZero: true },
        stress: { label: 'Stress', type: 'scale', unit: '', help: 'Pressure, overload, or conflict.', active: true, value: int(0, 3), saveZero: true },
        hydration: { label: 'Hydration', type: 'number', unit: 'L', help: 'Approximate fluids.', active: true, value: Number(rand(0.8, 3.4).toFixed(1)) },
        screenTime: { label: 'Screen time', type: 'number', unit: 'h', help: 'Approximate screen exposure.', active: true, value: Number(rand(0.5, 9.5).toFixed(1)) },
        missedMeal: { label: 'Missed meal', type: 'boolean', unit: '', help: '', active: true, value: chance(0.16) },
      },
      notes: chance(0.12) ? 'Random seed wellbeing note.' : '',
      isEdited: chance(0.04),
      editLog: [],
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };
  });

  const settings = [
    ['userMode', 'CARETAKER'],
    ['personName', 'Random Seed Patient'],
    ['caretakerName', 'Random Seed Caretaker'],
    ['dateOfBirth', '1995-04-12'],
    ['includePatientDOB', true],
    ['emergencyContact', '+47 123 45 678'],
    ['neurologistName', 'Dr. Random Example'],
    ['neurologistInstitution', 'AuraTrack Test Clinic'],
    ['neurologistContact', '+47 555 11 222'],
    ['language', 'en'],
    ['dateFormat', 'ISO'],
    ['timeFormat', '24h'],
    ['durationFormat', 'human'],
    ['historyPageSize', 25],
    ['wellbeingEnabled', true],
    ['medicationStartDate', isoDate(rangeStartMs)],
  ].map(([key, value]) => ({ key, value }));

  const db = await openDb();
  try {
    const cleanupTx = db.transaction(Object.keys(stores), 'readwrite');
    await Promise.all(Object.keys(stores).map(async (storeName) => {
      const store = cleanupTx.objectStore(storeName);
      const rows = await requestPromise(store.getAll());
      rows
        .filter((row) => typeof row?.uuid === 'string' && row.uuid.startsWith(SEED_PREFIX))
        .forEach((row) => store.delete(row.id));
    }));
    await txDone(cleanupTx);

    const tx = db.transaction(Object.keys(stores), 'readwrite');
    const eventStore = tx.objectStore('events');
    const medStore = tx.objectStore('medications');
    const logStore = tx.objectStore('medicationLogs');
    const sessionStore = tx.objectStore('eegSessions');
    const activityStore = tx.objectStore('eegActivities');

    settings.forEach((row) => tx.objectStore('settings').put(row));
    const medDefs = [
      { uuid: randomId('med-levetiracetam'), name: 'Levetiracetam', dose: 500, unit: 'mg', frequency: 'BD', scheduledTimes: ['08:00', '20:00'], isRescue: false, showInEmergency: false },
      { uuid: randomId('med-lamotrigine'), name: 'Lamotrigine', dose: 100, unit: 'mg', frequency: 'BD', scheduledTimes: ['09:00', '21:00'], isRescue: false, showInEmergency: false },
      { uuid: randomId('med-clobazam'), name: 'Clobazam', dose: 10, unit: 'mg', frequency: 'OD', scheduledTimes: ['21:00'], isRescue: false, showInEmergency: false },
      { uuid: randomId('med-diazepam'), name: 'Diazepam', dose: 10, unit: 'mg', frequency: 'PRN', scheduledTimes: [], isRescue: true, showInEmergency: true },
    ];
    const medRows = [];
    for (const med of medDefs) {
      const id = await requestPromise(medStore.add({
        ...med,
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        reminderEnabled: false,
        active: true,
      }));
      medRows.push({ ...med, id });
    }

    const eventIdByUuid = new Map();
    for (const event of events) {
      const id = await requestPromise(eventStore.add(event));
      eventIdByUuid.set(event.uuid, id);
    }
    wellbeingEntries.forEach((entry) => tx.objectStore('wellbeingEntries').add(entry));

    medRows.filter(med => !med.isRescue).forEach((med) => {
      for (let day = 0; day < 91; day += 1) {
        med.scheduledTimes.forEach((scheduledTime) => {
          if (!chance(0.9)) return;
          const [hour, minute] = scheduledTime.split(':').map(Number);
          const takenAt = rangeStartMs + day * DAY_MS + hour * 60 * 60 * 1000 + minute * 60 * 1000 + int(-12, 35) * 60 * 1000;
          logStore.add({
            uuid: randomId(`med-log-${med.name}-${day}-${scheduledTime}`),
            medicationId: med.id,
            medicationUuid: med.uuid,
            scheduledTime,
            takenAt,
            status: chance(0.12) ? 'late' : 'taken',
            note: '',
            isEdited: chance(0.04),
          });
        });
      }
    });
    const rescueMed = medRows.find(med => med.isRescue);
    events.filter(event => event.duration > 240 || event.isEmergencyStop).slice(0, int(8, 18)).forEach((event, index) => {
      logStore.add({
        uuid: randomId(`rescue-log-${index + 1}`),
        medicationId: rescueMed.id,
        medicationUuid: rescueMed.uuid,
        scheduledTime: null,
        takenAt: event.startTime + int(4, 18) * 60 * 1000,
        status: 'taken',
        note: 'Random seed rescue dose.',
        isEdited: false,
      });
    });

    const eegStart = events[int(5, 20)]?.startTime || rangeStartMs + 10 * DAY_MS;
    const eegSessionUuid = randomId('eeg-session-1');
    const eegSessionId = await requestPromise(sessionStore.add({
      uuid: eegSessionUuid,
      startTime: eegStart,
      plannedEndTime: eegStart + 24 * 60 * 60 * 1000,
      actualEndTime: eegStart + 24 * 60 * 60 * 1000,
      durationPreset: '24h',
      customHours: null,
      title: 'Random Seed Home EEG Session',
      notes: 'Randomized EEG diary session for report testing.',
      status: 'COMPLETED',
      createdAt: eegStart,
      updatedAt: eegStart + 24 * 60 * 60 * 1000,
    }));
    const activities = ['Sleeping', 'Breakfast', 'Reading', 'Screen time', 'Walking', 'Resting', 'Dinner', 'Preparing for bed'];
    activities.forEach((activity, index) => {
      const startTime = eegStart + index * 2.5 * 60 * 60 * 1000;
      activityStore.add({
        uuid: randomId(`eeg-activity-${index + 1}`),
        sessionId: eegSessionId,
        sessionUuid: eegSessionUuid,
        kind: 'ACTIVITY',
        activityLabel: activity,
        customActivityText: chance(0.25) ? 'Random seed context detail.' : '',
        moodLabel: pick(['Calm', 'Tired', 'Anxious', 'Good', 'Low']),
        notes: chance(0.2) ? 'Random EEG activity note.' : '',
        startTime,
        endTime: startTime + rand(30, 150) * 60 * 1000,
        durationSec: int(1800, 9000),
        linkedEventId: null,
        linkedEventUuid: '',
        isEdited: chance(0.08),
        editLog: [],
        createdAt: startTime,
        updatedAt: startTime,
      });
    });
    const eegEvent = events.find(event => event.startTime >= eegStart && event.startTime <= eegStart + 24 * 60 * 60 * 1000);
    if (eegEvent) {
      activityStore.add({
        uuid: randomId('eeg-seizure-reference-1'),
        sessionId: eegSessionId,
        sessionUuid: eegSessionUuid,
        kind: 'SEIZURE_REFERENCE',
        activityLabel: eegEvent.type,
        customActivityText: '',
        moodLabel: '',
        notes: 'Linked random seed seizure.',
        startTime: eegEvent.startTime,
        endTime: eegEvent.startTime + eegEvent.duration * 1000,
        durationSec: eegEvent.duration,
        linkedEventId: eventIdByUuid.get(eegEvent.uuid),
        linkedEventUuid: eegEvent.uuid,
        isEdited: false,
        editLog: [],
        createdAt: eegEvent.startTime,
        updatedAt: eegEvent.startTime,
      });
    }

    await txDone(tx);
  } finally {
    db.close();
  }

  console.info(`AuraTrack random seed complete (${runId}): inserted ${EVENT_COUNT} events, ${wellbeingEntries.length} wellbeing entries, randomized medications/logs, and EEG diary data. Reload AuraTrack, then export a Neurologist Report for ${isoDate(rangeStartMs)} to ${isoDate(now)}.`);
})();
