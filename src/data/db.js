import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

function makeUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

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

db.version(7).stores({
  events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id',
  medicationLogs: '++id, medicationId, takenAt, scheduledTime'
});

db.version(8).stores({
  events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id, uuid',
  medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime'
}).upgrade(async tx => {
  const medsTable = tx.table('medications');
  const logsTable = tx.table('medicationLogs');
  const meds = await medsTable.toArray();
  const medUuidById = new Map();

  for (const med of meds) {
    const uuid = med.uuid || makeUUID();
    medUuidById.set(med.id, uuid);
    if (med.uuid !== uuid) await medsTable.update(med.id, { uuid });
  }

  const logs = await logsTable.toArray();
  for (const log of logs) {
    const updates = {};
    if (!log.uuid) updates.uuid = makeUUID();
    if (!log.medicationUuid && medUuidById.has(log.medicationId)) {
      updates.medicationUuid = medUuidById.get(log.medicationId);
    }
    if (Object.keys(updates).length) await logsTable.update(log.id, updates);
  }
});
