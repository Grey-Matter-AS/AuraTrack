/* Alerts from the household's hub. Loaded by the app's service worker (workbox importScripts).
   The message is encrypted for this browser by the hub; all that arrives is which kind of event it is and the person's id.
   By default the notification says nothing about health: "AuraTrack" and a line asking to open the app, in the language the
   app wrote into this browser's small settings store. Nothing here reads the app's records or keys. */
const DB = 'auratrack-push';

function readDisplay() {
  return new Promise((resolve) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const get = open.result.transaction('kv', 'readonly').objectStore('kv').get('display');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        data = {};
      }
      const display = (await readDisplay()) || { title: 'AuraTrack', body: 'Open AuraTrack' };
      const urgent = data.event === 'alert';
      await self.registration.showNotification(display.title, {
        body: display.body,
        tag: 'auratrack-alert-' + (data.patientId || 'any'),
        renotify: true,
        requireInteraction: urgent,
        vibrate: urgent ? [300, 150, 300, 150, 600] : [150],
        data: { event: data.event || null },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })(),
  );
});
