import { useEffect, useRef, useState } from 'react';
import i18n from '../i18n';

function supportedMimeType() {
  if (!globalThis.MediaRecorder) return '';
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionForMimeType(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

async function saveBlob(blob, suggestedName) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Video recording', accept: { [blob.type || 'video/webm']: [`.${extensionForMimeType(blob.type || 'video/webm')}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, cancelled: false, fileName: suggestedName };
    } catch (error) {
      if (error.name === 'AbortError') return { ok: false, cancelled: true, fileName: suggestedName };
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return { ok: true, cancelled: false, fileName: suggestedName };
}

export function useVideoRecorder() {
  const [isSupported] = useState(() => Boolean(
    navigator.mediaDevices?.getUserMedia &&
    globalThis.MediaRecorder &&
    HTMLCanvasElement.prototype.captureStream
  ));
  const [isRecording, setIsRecording] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const [error, setError] = useState('');
  const [savedVideo, setSavedVideo] = useState(null);
  const [permissionState, setPermissionState] = useState('idle');
  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceVideoRef = useRef(null);
  const animationRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const clearPreview = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    recorderRef.current = null;
    canvasRef.current = null;
    sourceVideoRef.current = null;
    setPreviewStream(null);
  };

  const reset = () => {
    clearPreview();
    chunksRef.current = [];
    startedAtRef.current = 0;
    setIsRecording(false);
    setError('');
    setPermissionState('idle');
    setSavedVideo(null);
  };

  const start = async ({ seizureStartTime, seizureStartLabel }) => {
    if (!isSupported || isRecording) return { ok: false };
    try {
      setError('');
      setSavedVideo(null);
      setPermissionState('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setPermissionState('granted');
      mediaStreamRef.current = stream;
      setPreviewStream(stream);
      const sourceVideo = document.createElement('video');
      sourceVideo.playsInline = true;
      sourceVideo.muted = true;
      sourceVideo.srcObject = stream;
      await sourceVideo.play();

      const width = sourceVideo.videoWidth || 640;
      const height = sourceVideo.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const overallStartTime = seizureStartTime || Date.now();
      const startLabel = seizureStartLabel || new Date(overallStartTime).toLocaleString();

      const formatElapsed = (seconds) => {
        const safe = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const secs = safe % 60;
        return `T+${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };

      const draw = () => {
        if (!ctx) return;
        ctx.drawImage(sourceVideo, 0, 0, width, height);
        const elapsedSeconds = Math.floor((Date.now() - overallStartTime) / 1000);
        const lineOne = startLabel;
        const lineTwo = formatElapsed(elapsedSeconds);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
        ctx.fillRect(16, height - 84, 300, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 16px Arial, Helvetica, sans-serif';
        ctx.fillText(lineOne, 28, height - 54);
        ctx.font = '700 22px Arial, Helvetica, sans-serif';
        ctx.fillText(lineTwo, 28, height - 26);
        animationRef.current = requestAnimationFrame(draw);
      };
      draw();

      const mimeType = supportedMimeType();
      const streamForRecording = canvas.captureStream(24);
      const recorder = new MediaRecorder(streamForRecording, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.start(1000);
      sourceVideoRef.current = sourceVideo;
      canvasRef.current = canvas;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setIsRecording(true);
      return { ok: true };
    } catch (err) {
      console.error('Video recording failed to start:', err);
      setPermissionState('denied');
      setError(i18n.t('recording.video_error_unavailable', 'Camera permission or video recording is not available on this device.'));
      clearPreview();
      return { ok: false, error: err };
    }
  };

  const stop = async () => {
    if (!isRecording || !recorderRef.current) return savedVideo;
    const recorder = recorderRef.current;
    const mimeType = recorder.mimeType || supportedMimeType() || 'video/webm';
    const stoppedAt = Date.now();
    const stopped = await new Promise(resolve => {
      recorder.onstop = () => resolve(true);
      recorder.stop();
    });
    if (!stopped) return null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const stamp = new Date(startedAtRef.current || Date.now()).toISOString().replace(/[:.]/g, '-');
    const fileName = `auratrack-seizure-${stamp}.${extensionForMimeType(mimeType)}`;
    const saveResult = await saveBlob(blob, fileName);
    const metadata = saveResult.ok ? {
      videoAttached: true,
      videoFileName: saveResult.fileName,
      videoMimeType: mimeType,
      videoSavedAt: Date.now(),
      videoDurationSec: Math.max(1, Math.floor((stoppedAt - startedAtRef.current) / 1000)),
      videoReferenceNote: `${i18n.t('event_detail.associated_video', 'Associated video')}: ${saveResult.fileName}`,
    } : null;
    clearPreview();
    setIsRecording(false);
    setSavedVideo(metadata);
    return metadata;
  };

  return {
    isSupported,
    isRecording,
    previewStream,
    error,
    savedVideo,
    permissionState,
    start,
    stop,
    reset,
  };
}
