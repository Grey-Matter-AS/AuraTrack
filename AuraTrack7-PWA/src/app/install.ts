// Installing the app (F-108). Chrome and Edge offer an install prompt through an event that arrives early; iPhone Safari has
// no prompt, only the Share menu, so Home shows the steps there. This keeps the event until the card asks for it.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let saved: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const install = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Can the browser show its install prompt now? */
  getSnapshot: (): boolean => saved !== null,
  /** Starts listening for the browser's offer. Called once, early. */
  listen(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      saved = event as InstallPromptEvent;
      notify();
    });
    window.addEventListener('appinstalled', () => {
      saved = null;
      notify();
    });
  },
  /** Shows the browser's own prompt. */
  async prompt(): Promise<void> {
    const event = saved;
    if (!event) return;
    saved = null;
    notify();
    await event.prompt();
  },
};

/** Is the app running as an installed app (from the Home Screen), not in a browser tab? */
export function isInstalled(): boolean {
  const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
  return globalThis.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true;
}

/** iPhone and iPad Safari (an iPad can say it is a Mac). */
export function isIos(): boolean {
  const nav = globalThis.navigator;
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}
