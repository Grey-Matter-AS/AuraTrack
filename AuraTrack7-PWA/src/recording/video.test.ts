import { describe, expect, it } from 'vitest';
import { overlayElapsed, pickMime, videoFileName } from './video';

describe('video helpers', () => {
  it('picks the first type the browser can record, and nothing when it can record none', () => {
    expect(pickMime(() => true)).toBe('video/webm;codecs=vp9,opus');
    expect(pickMime((t) => t === 'video/mp4')).toBe('video/mp4');
    expect(pickMime((t) => t.startsWith('video/webm') && !t.includes('codecs'))).toBe('video/webm');
    expect(pickMime(() => false)).toBe('');
  });

  it('names the file from the local time the seizure began, with the right ending', () => {
    const at = new Date(2026, 10, 2, 14, 5, 30).getTime();
    expect(videoFileName(at, 'video/webm;codecs=vp9')).toBe('AuraTrack-seizure-2026-11-02-14-05.webm');
    expect(videoFileName(at, 'video/mp4')).toBe('AuraTrack-seizure-2026-11-02-14-05.mp4');
  });

  it('uses the local day just after midnight, not the UTC day', () => {
    const at = new Date(2026, 10, 2, 0, 3).getTime();
    expect(videoFileName(at, 'video/webm')).toBe('AuraTrack-seizure-2026-11-02-00-03.webm');
  });

  it('writes the time since the start as T+hh:mm:ss, never below zero', () => {
    expect(overlayElapsed(1000, 1000)).toBe('T+00:00:00');
    expect(overlayElapsed(0, 65_900)).toBe('T+00:01:05');
    expect(overlayElapsed(0, 3_725_000)).toBe('T+01:02:05');
    expect(overlayElapsed(5000, 1000)).toBe('T+00:00:00');
  });
});
