import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (notify: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    media.removeEventListener('change', notify);
    observer.disconnect();
  };
};

/** True when the phone asks for reduced motion, or the app's own setting (data-motion="reduce" on the root) does. */
export const prefersReducedMotion = (): boolean =>
  document.documentElement.dataset.motion === 'reduce' ||
  (document.documentElement.dataset.motion !== 'full' && window.matchMedia(QUERY).matches);

export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
