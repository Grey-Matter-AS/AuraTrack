import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

db.version(3).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes'
});

db.version(4).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key'
});
