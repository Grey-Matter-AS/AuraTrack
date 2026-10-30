import { registerSW } from 'virtual:pwa-register';
// Offline support. A new version is downloaded in the background but only applied when the user
// taps "Update" (that prompt arrives with the app shell in M2; it is never shown mid-recording).
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
//# sourceMappingURL=serviceWorker.js.map
