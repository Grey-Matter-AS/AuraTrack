import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

// We add 'date' and 'type' to the index list
// This allows us to filter or sort by these specific fields later
db.version(2).stores({
  events: '++id, startTime, date, type, isComplete, isEdited'
});
