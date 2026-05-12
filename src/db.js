import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

db.version(3).stores({
  // We added 'notes' and 'isEdited' to the index so you can search them later
  events: '++id, startTime, date, type, isComplete, isEdited, notes' 
});
