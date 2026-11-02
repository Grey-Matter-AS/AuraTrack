import { useEffect, useRef } from 'react';
import { useApp } from '../app/AppContext';
import './screens.css';

/** The camera picture while filming, small, with nothing to press: it only shows what the camera sees. */
export function VideoPreview() {
  const { video, t } = useApp();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.srcObject = video.stream;
  }, [video.stream]);
  if (video.status === 'denied') return <p className="app-note">{t('video.denied')}</p>;
  if (video.status === 'unavailable') return <p className="app-note">{t('video.unavailable')}</p>;
  if (video.status === 'starting') return <p className="app-note">{t('video.starting')}</p>;
  if (video.status !== 'recording' || !video.stream) return null;
  return (
    <div>
      <video ref={ref} className="app-preview" muted autoPlay playsInline aria-label={t('video.recording')} />
      <p className="app-note">{t('video.recording')}</p>
    </div>
  );
}
