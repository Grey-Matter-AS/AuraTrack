const DB_NAME = 'AuraTrackDB';
const DB_VERSION = 9;

const STORE_DEFINITIONS = {
  events: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['uuid', 'uuid'],
      ['startTime', 'startTime'],
      ['date', 'date'],
      ['type', 'type'],
      ['isComplete', 'isComplete'],
      ['isEdited', 'isEdited'],
      ['notes', 'notes'],
      ['eegSessionId', 'eegSessionId'],
      ['videoAttached', 'videoAttached'],
    ],
  },
  settings: {
    options: { keyPath: 'key' },
    indexes: [],
  },
  medications: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [['uuid', 'uuid']],
  },
  medicationLogs: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['uuid', 'uuid'],
      ['medicationId', 'medicationId'],
      ['medicationUuid', 'medicationUuid'],
      ['takenAt', 'takenAt'],
      ['scheduledTime', 'scheduledTime'],
    ],
  },
  eegSessions: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['uuid', 'uuid'],
      ['startTime', 'startTime'],
      ['status', 'status'],
      ['actualEndTime', 'actualEndTime'],
    ],
  },
  eegActivities: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['uuid', 'uuid'],
      ['sessionId', 'sessionId'],
      ['kind', 'kind'],
      ['startTime', 'startTime'],
      ['endTime', 'endTime'],
      ['linkedEventId', 'linkedEventId'],
      ['isEdited', 'isEdited'],
    ],
  },
};

export async function resetAuraTrackState(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async ({ dbName, version, stores }) => {
    localStorage.clear();
    sessionStorage.clear();

    const openDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.entries(stores).forEach(([storeName, definition]) => {
          const store = db.objectStoreNames.contains(storeName)
            ? request.transaction.objectStore(storeName)
            : db.createObjectStore(storeName, definition.options);

          definition.indexes.forEach(([indexName, keyPath]) => {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, keyPath, { unique: false });
            }
          });
        });
      };
      request.onsuccess = () => resolve(request.result);
    });

    const db = await openDatabase();
    const storeNames = Object.keys(stores);

    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      storeNames.forEach((storeName) => {
        tx.objectStore(storeName).clear();
      });
    });

    db.close();
  }, { dbName: DB_NAME, version: DB_VERSION, stores: STORE_DEFINITIONS });
}

export async function seedAuraTrackState(page, seed = {}) {
  await resetAuraTrackState(page);

  const normalizedSeed = {
    events: seed.events ?? [],
    settings: seed.settings ?? [],
    medications: seed.medications ?? [],
    medicationLogs: seed.medicationLogs ?? [],
    eegSessions: seed.eegSessions ?? [],
    eegActivities: seed.eegActivities ?? [],
  };

  await page.evaluate(async ({ dbName, version, stores, payload }) => {
    const openDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.entries(stores).forEach(([storeName, definition]) => {
          const store = db.objectStoreNames.contains(storeName)
            ? request.transaction.objectStore(storeName)
            : db.createObjectStore(storeName, definition.options);

          definition.indexes.forEach(([indexName, keyPath]) => {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, keyPath, { unique: false });
            }
          });
        });
      };
      request.onsuccess = () => resolve(request.result);
    });

    const db = await openDatabase();
    const storeNames = Object.keys(stores);

    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      storeNames.forEach((storeName) => {
        const objectStore = tx.objectStore(storeName);
        objectStore.clear();
        payload[storeName].forEach((row) => objectStore.add(row));
      });
    });

    db.close();
  }, {
    dbName: DB_NAME,
    version: DB_VERSION,
    stores: STORE_DEFINITIONS,
    payload: normalizedSeed,
  });
}

export async function countStoreRows(page, storeName) {
  return page.evaluate(async ({ dbName, storeName }) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve(0);
          return;
        }

        const tx = db.transaction(storeName, 'readonly');
        const countRequest = tx.objectStore(storeName).count();
        countRequest.onsuccess = () => {
          db.close();
          resolve(countRequest.result);
        };
        countRequest.onerror = () => reject(countRequest.error);
      };
    });
  }, { dbName: DB_NAME, storeName });
}

export { DB_NAME, DB_VERSION };
