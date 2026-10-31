// A small typed message interface between the page and the Web Worker that does the heavy work (crypto, merge, import).
// The worker holds the keys and the decrypted working set; the page only sends requests and gets plain answers.
// It runs over any message port, so the same code is tested with a MessageChannel and used with a real Worker.

export interface PortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  start?(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers take any structured-cloneable argument
export type Handlers = Record<string, (arg: any) => unknown>;

type Request = { kind: 'request'; id: number; method: string; arg: unknown };
type Response =
  | { kind: 'response'; id: number; ok: true; result: unknown }
  | { kind: 'response'; id: number; ok: false; error: { name: string; message: string } };

/** What the page sees: every handler becomes an async method. */
type ArgsOf<F> = F extends () => unknown ? [] : F extends (arg: infer A) => unknown ? [arg: A] : never;
export type Client<H extends Handlers> = {
  [K in keyof H]: (...args: ArgsOf<H[K]>) => Promise<Awaited<ReturnType<H[K]>>>;
};

export class RemoteError extends Error {
  constructor(
    readonly remoteName: string,
    message: string,
  ) {
    super(message);
    this.name = remoteName;
  }
}

const isRequest = (data: unknown): data is Request =>
  typeof data === 'object' && data !== null && (data as Request).kind === 'request';
const isResponse = (data: unknown): data is Response =>
  typeof data === 'object' && data !== null && (data as Response).kind === 'response';

/** Runs in the worker: answers requests with the matching handler. Returns a function that stops listening. */
export function serve(port: PortLike, handlers: Handlers): () => void {
  const listener = (event: { data: unknown }) => {
    const data = event.data;
    if (!isRequest(data)) return;
    const reply = (response: Response) => port.postMessage(response);
    const handler = Object.hasOwn(handlers, data.method) ? handlers[data.method] : undefined;
    if (!handler)
      return reply({
        kind: 'response',
        id: data.id,
        ok: false,
        error: { name: 'UnknownMethod', message: `No method ${data.method}` },
      });
    Promise.resolve()
      .then(() => handler(data.arg))
      .then(
        (result) => reply({ kind: 'response', id: data.id, ok: true, result }),
        (error: unknown) => {
          const e = error instanceof Error ? error : new Error(String(error));
          reply({ kind: 'response', id: data.id, ok: false, error: { name: e.name, message: e.message } });
        },
      );
  };
  port.addEventListener('message', listener);
  port.start?.();
  return () => port.removeEventListener('message', listener);
}

/** Runs in the page: `client.method(arg)` sends a request and resolves with the worker's answer. */
export function connect<H extends Handlers>(port: PortLike): Client<H> & { close(): void } {
  let next = 1;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const listener = (event: { data: unknown }) => {
    const data = event.data;
    if (!isResponse(data)) return;
    const waiting = pending.get(data.id);
    if (!waiting) return;
    pending.delete(data.id);
    if (data.ok) waiting.resolve(data.result);
    else waiting.reject(new RemoteError(data.error.name, data.error.message));
  };
  port.addEventListener('message', listener);
  port.start?.();
  const close = () => {
    port.removeEventListener('message', listener);
    for (const waiting of pending.values()) waiting.reject(new RemoteError('Closed', 'The connection was closed'));
    pending.clear();
  };
  return new Proxy({} as Client<H> & { close(): void }, {
    get(_target, method) {
      if (typeof method !== 'string' || method === 'then') return undefined; // not a thenable: `await client` must not hang
      if (method === 'close') return close;
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          const id = next++;
          pending.set(id, { resolve, reject });
          const request: Request = { kind: 'request', id, method, arg: args[0] };
          port.postMessage(request);
        });
    },
  });
}
