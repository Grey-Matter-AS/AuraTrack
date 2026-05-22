import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

db.version(3).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes'
});

db.version(4).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key'
});

db.version(5).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id',
  medicationLogs: '++id, medicationId, takenAt'
});

db.version(6).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id',
  medicationLogs: '++id, medicationId, takenAt, scheduledTime'
});
