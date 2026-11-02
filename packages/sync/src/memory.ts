import type { Channel } from './session';

// Two ends of a pipe in memory, for tests: each message arrives later (in order), and can be dropped, copied or cut off.

export interface PipeOptions {
  /** Drop the nth message sent by either side (counted from 1). */
  dropAt?: number;
  /** Close the pipe after this many messages. */
  cutAfter?: number;
  /** Deliver every message twice. */
  duplicate?: boolean;
}

export function memoryPipe(options: PipeOptions = {}): [Channel, Channel] {
  let sent = 0;
  let closed = false;
  const ends: { listener: ((t: string) => void) | null; closeListener: (() => void) | null; backlog: string[] }[] = [
    { listener: null, closeListener: null, backlog: [] },
    { listener: null, closeListener: null, backlog: [] },
  ];
  const closeAll = () => {
    if (closed) return;
    closed = true;
    for (const end of ends) queueMicrotask(() => setTimeout(() => end.closeListener?.(), 0));
  };
  const make = (me: 0 | 1): Channel => ({
    send(text) {
      if (closed) return;
      sent++;
      if (options.cutAfter !== undefined && sent > options.cutAfter) return closeAll();
      if (options.dropAt === sent) return;
      const other = ends[me === 0 ? 1 : 0] as (typeof ends)[number];
      const deliver = () =>
        setTimeout(() => {
          if (other.listener) other.listener(text);
          else other.backlog.push(text);
        }, 0);
      deliver();
      if (options.duplicate) deliver();
    },
    onMessage(listener) {
      const end = ends[me] as (typeof ends)[number];
      end.listener = listener;
      for (const text of end.backlog.splice(0)) listener(text);
    },
    onClose(listener) {
      (ends[me] as (typeof ends)[number]).closeListener = listener;
      if (closed) setTimeout(listener, 0);
    },
    close: closeAll,
  });
  return [make(0), make(1)];
}
