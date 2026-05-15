import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'pwa_install_dismissed';

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible]           = useState(false);

  const ios = isIOSDevice();

  useEffect(() => {
    if (isInstalled()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (ios) {
      const t = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(t);
    }

    let delayTimer;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      delayTimer = setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(delayTimer);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setIsVisible(false);
  };

  // True even after banner is dismissed — lets Settings show the install option as a fallback.
  const canInstallManually = !isInstalled() && (!!deferredPrompt || ios);

  return {
    isVisible,
    isIOS: ios && !deferredPrompt,
    install,
    dismiss,
    canInstallManually,
  };
}
