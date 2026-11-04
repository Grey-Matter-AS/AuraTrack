import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';

// Reads QR codes from the camera. The browser's own reader where it has one (BarcodeDetector); otherwise a small reader
// (jsQR) that is loaded only here. The picture never leaves the page.

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

export function QrScanner({ onText }: { onText: (text: string) => void }) {
  const { t } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  });
  const [problem, setProblem] = useState<'denied' | 'unsupported' | null>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem('unsupported');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        return setProblem('denied');
      }
      if (stopped) return stream.getTracks().forEach((track) => track.stop());
      const el = video.current;
      if (!el) return;
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const jsQr = native ? null : (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const look = async () => {
        if (stopped) return;
        const w = el.videoWidth;
        const h = el.videoHeight;
        if (w > 0 && h > 0) {
          try {
            if (native) {
              const found = await native.detect(el);
              const first = found[0];
              if (first) callback.current(first.rawValue);
            } else if (jsQr) {
              const scale = Math.min(1, 640 / w);
              canvas.width = Math.round(w * scale);
              canvas.height = Math.round(h * scale);
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
                const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQr(image.data, image.width, image.height);
                if (code) callback.current(code.data);
              }
            }
          } catch {
            /* a frame that could not be read: the next one will do */
          }
        }
        timer = window.setTimeout(() => void look(), 150);
      };
      void look();
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (problem) return <p className="app-note">{problem === 'denied' ? t('hh.scanDenied') : t('hh.scanUnsupported')}</p>;
  return (
    <div>
      <video ref={video} className="app-preview" muted playsInline aria-label={t('hh.scanTitle')} />
      <p className="app-note">{t('hh.scanHelp')}</p>
    </div>
  );
}
