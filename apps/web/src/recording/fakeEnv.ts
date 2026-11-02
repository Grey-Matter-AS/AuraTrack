// A browser that only moves when a test says so: a clock, intervals, timeouts and page visibility. For tests only.
import type { RecordingEnv } from './controller';

export const T0 = 1_760_000_000_000;

/** A browser that only moves when the test says so. */
export function fakeEnv(over: Partial<RecordingEnv> = {}, startAt = T0) {
  let clock = startAt;
  let visible = true;
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, { at: number; run: () => void }>();
  const watchers = new Set<() => void>();
  let next = 1;
  const env: RecordingEnv = {
    now: () => clock,
    setInterval: (handler) => {
      intervals.set(next, handler);
      return next++;
    },
    clearInterval: (handle) => void intervals.delete(handle as number),
    setTimeout: (handler, ms) => {
      timeouts.set(next, { at: clock + ms, run: handler });
      return next++;
    },
    clearTimeout: (handle) => void timeouts.delete(handle as number),
    visible: () => visible,
    onVisibility: (listener) => {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },
    ...over,
  };
  return {
    env,
    intervals,
    watchers,
    advance(ms: number, step = 250) {
      const end = clock + ms;
      while (clock < end) {
        clock = Math.min(end, clock + step);
        for (const run of [...intervals.values()]) run();
        for (const [id, t] of [...timeouts]) {
          if (t.at > clock) continue;
          timeouts.delete(id);
          t.run();
        }
      }
    },
    /** Moves the clock in small steps, letting saves finish between steps (they are asynchronous). */
    async advanceAsync(ms: number, step = 250) {
      const end = clock + ms;
      while (clock < end) {
        this.advance(Math.min(step, end - clock), step);
        for (let i = 0; i < 20; i++) await Promise.resolve();
      }
    },
    jump(to: number) {
      clock = to;
    },
    hide() {
      visible = false;
      for (const w of [...watchers]) w();
    },
    show() {
      visible = true;
      for (const w of [...watchers]) w();
    },
  };
}
