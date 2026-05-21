import { useRef, useCallback } from 'react';

export function useWakeLock() {
  const lockRef = useRef(null);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const acquire = useCallback(async () => {
    if (!supported) return false;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
      lockRef.current.addEventListener('release', () => { lockRef.current = null; });
      return true;
    } catch {
      return false;
    }
  }, [supported]);

  const release = useCallback(async () => {
    if (lockRef.current) {
      await lockRef.current.release().catch(() => {});
      lockRef.current = null;
    }
  }, []);

  return { supported, acquire, release };
}
