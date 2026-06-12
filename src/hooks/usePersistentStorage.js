import { useCallback, useEffect, useState } from 'react';

const INITIAL_STATE = {
  browserLabel: null,
  engine: 'unknown',
  platformLabel: null,
  supported: false,
  status: 'checking',
  persisted: false,
  promptBehavior: 'unknown',
};

function detectPersistenceEnvironment() {
  const ua = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Win/i.test(platform);
  const isMac = /Mac/i.test(platform) && !isIOS;
  const isLinux = /Linux/i.test(platform) && !isAndroid;

  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isOpera = /OPR\//i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge && !isOpera && !isSamsung;
  const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge && !isOpera && !isFirefox;

  let browserLabel = 'This browser';
  let engine = 'unknown';

  if (isFirefox) {
    browserLabel = 'Firefox';
    engine = 'gecko';
  } else if (isEdge) {
    browserLabel = 'Edge';
    engine = 'chromium';
  } else if (isSamsung) {
    browserLabel = 'Samsung Internet';
    engine = 'chromium';
  } else if (isOpera) {
    browserLabel = 'Opera';
    engine = 'chromium';
  } else if (isChrome) {
    browserLabel = 'Chrome';
    engine = 'chromium';
  } else if (isSafari) {
    browserLabel = 'Safari';
    engine = 'webkit';
  }

  let platformLabel = 'Unknown device';
  if (isIOS) platformLabel = 'iPhone or iPad';
  else if (isAndroid) platformLabel = 'Android';
  else if (isWindows) platformLabel = 'Windows';
  else if (isMac) platformLabel = 'macOS';
  else if (isLinux) platformLabel = 'Linux';

  return {
    browserLabel,
    engine,
    platformLabel,
    promptBehavior: isFirefox ? 'user-prompt-possible' : 'automatic',
  };
}

export function usePersistentStorage() {
  const [state, setState] = useState(INITIAL_STATE);
  const requestPersistence = useCallback(async ({ userInitiated = true } = {}) => {
    const environment = detectPersistenceEnvironment();

    if (!navigator.storage?.persist) {
      setState({
        ...environment,
        supported: false,
        status: 'unsupported',
        persisted: false,
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      ...environment,
      supported: true,
      status: 'checking',
    }));

    try {
      const alreadyPersistent = navigator.storage.persisted
        ? await navigator.storage.persisted()
        : false;
      if (alreadyPersistent) {
        setState({
          ...environment,
          supported: true,
          status: 'granted',
          persisted: true,
        });
        return true;
      }

      if (!userInitiated && environment.promptBehavior === 'user-prompt-possible') {
        setState({
          ...environment,
          supported: true,
          status: 'not_requested',
          persisted: false,
        });
        return false;
      }

      const granted = await navigator.storage.persist();
      setState({
        ...environment,
        supported: true,
        status: granted ? 'granted' : 'denied',
        persisted: granted,
      });
      return granted;
    } catch (error) {
      console.error('Persistent storage request failed:', error);
      setState({
        ...environment,
        supported: true,
        status: 'error',
        persisted: false,
      });
      return false;
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      requestPersistence({ userInitiated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [requestPersistence]);

  return { ...state, requestPersistence };
}
