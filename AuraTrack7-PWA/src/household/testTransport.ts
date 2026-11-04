import { memoryPipe, type Channel } from '@auratrack/sync';
import type { Listener, PeerTransport } from './transport';

// A broker in memory, for tests: devices listen under an id and others connect to it. Nothing leaves the process.

export function memoryBroker(): PeerTransport & { listening(): string[]; down: boolean } {
  const listeners = new Map<string, (c: Channel) => void>();
  const broker = {
    down: false,
    listening: () => [...listeners.keys()],
    async listen(id: string, onChannel: (c: Channel) => void): Promise<Listener> {
      if (broker.down) throw new Error('the broker is not answering');
      listeners.set(id, onChannel);
      return { close: () => listeners.delete(id) };
    },
    async connect(id: string): Promise<Channel> {
      const accept = listeners.get(id);
      if (broker.down || !accept) throw new Error('no answer');
      const [mine, theirs] = memoryPipe();
      queueMicrotask(() => accept(theirs));
      return mine;
    },
  };
  return broker;
}
