import { localDateKey } from '@auratrack/model';

// Filming a seizure (F-209): the camera, with the start time and the time since it written onto every picture, so the
// recording shows when it was made. The page turns it into one clip when the recording ends; the store keeps it sealed.

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
] as const;

/** The best type this browser can record, or '' when it can record none. */
export function pickMime(isSupported: (type: string) => boolean): string {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? '';
}

/** "AuraTrack-seizure-2026-11-02-14-05.webm", from the local time the seizure began. */
export function videoFileName(startAt: number, mime: string): string {
  const d = new Date(startAt);
  const two = (n: number) => String(n).padStart(2, '0');
  return `AuraTrack-seizure-${localDateKey(d)}-${two(d.getHours())}-${two(d.getMinutes())}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
}

/** The time since the seizure began, as T+00:01:05. */
export function overlayElapsed(startAt: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - startAt) / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  return `T+${two(Math.floor(sec / 3600))}:${two(Math.floor((sec % 3600) / 60))}:${two(sec % 60)}`;
}

export type VideoStatus = 'off' | 'starting' | 'recording' | 'denied' | 'unavailable';

export interface Clip {
  blob: Blob;
  mime: string;
}

const FRAME_MS = 1000 / 24;
const VIDEO_BITS = 1_500_000;

/** The camera and the recorder. Everything it needs from the browser is looked up when it is used. */
export class VideoRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chunks: Blob[] = [];
  private mime = '';
  status: VideoStatus = 'off';

  static supported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      'captureStream' in HTMLCanvasElement.prototype
    );
  }

  /** The camera picture, for a small preview on screen (without the writing). */
  get preview(): MediaStream | null {
    return this.stream;
  }

  /** Opens the camera and starts recording. Never throws: a refused camera is a status, and the seizure recording goes on. */
  async start(options: {
    facing: 'back' | 'front';
    startAt: number;
    label: string;
    now: () => number;
  }): Promise<VideoStatus> {
    if (!VideoRecorder.supported()) return (this.status = 'unavailable');
    this.status = 'starting';
    try {
      const facingMode = { ideal: options.facing === 'back' ? 'environment' : 'user' };
      const camera = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode }, audio: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false }));
      this.stream = camera;
      const source = Object.assign(document.createElement('video'), { playsInline: true, muted: true });
      source.srcObject = camera;
      await source.play();
      const width = source.videoWidth || 640;
      const height = source.videoHeight || 480;
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      const draw = () => {
        ctx.drawImage(source, 0, 0, width, height);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
        ctx.fillRect(16, height - 84, 300, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 16px Arial, Helvetica, sans-serif';
        ctx.fillText(options.label, 28, height - 54);
        ctx.font = '700 22px Arial, Helvetica, sans-serif';
        ctx.fillText(overlayElapsed(options.startAt, options.now()), 28, height - 26);
      };
      draw();
      this.timer = setInterval(draw, FRAME_MS);
      const out = canvas.captureStream(24);
      for (const track of camera.getAudioTracks()) out.addTrack(track);
      this.mime = pickMime((t) => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(out, {
        ...(this.mime ? { mimeType: this.mime } : {}),
        videoBitsPerSecond: VIDEO_BITS,
      });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
      return (this.status = 'recording');
    } catch (e) {
      this.release();
      return (this.status = e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  /** Ends the recording and gives the clip, or null when nothing was recorded. */
  async stop(): Promise<Clip | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.release();
      return null;
    }
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await finished;
    const mime = this.mime || recorder.mimeType || 'video/webm';
    const blob = new Blob(this.chunks, { type: mime });
    this.release();
    return blob.size > 0 ? { blob, mime } : null;
  }

  private release() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.status = 'off';
  }
}

/** Hands a blob to the person as a file (a copy outside the app). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
