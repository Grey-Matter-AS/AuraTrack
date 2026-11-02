// A new version of the app waiting to be applied. The service worker tells this store; Home shows a card. It is never shown
// while a recording runs or a seizure is being edited, because only Home reads it (see UpdateCard).
let waiting = false;
let apply: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const updates = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): boolean => waiting,
  /** The service worker found a new version and has it ready; `applyNow` activates it and reloads. */
  ready(applyNow: () => Promise<void>): void {
    waiting = true;
    apply = applyNow;
    notify();
  },
  /** The user chose Update. */
  async apply(): Promise<void> {
    await apply?.();
  },
  /** The user chose Later: hide the card until the next visit. */
  dismiss(): void {
    waiting = false;
    notify();
  },
};
