import { registerSW } from 'virtual:pwa-register';
import { updates } from './app/updates';

// Offline support. A new version is downloaded in the background but only applied when the user taps "Update now" on Home;
// the card is never shown during a recording or while a seizure is being edited (app/updates.ts).
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh: () => updates.ready(() => update(true)),
  });
}
