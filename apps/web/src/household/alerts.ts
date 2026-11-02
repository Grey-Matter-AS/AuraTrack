import { hubAlert, hubLocalOf, type HubLocalApi } from '@auratrack/sync';

// Telling the household's other devices that a seizure is being recorded. This only ever happens after the recording is on its
// way: nothing here is waited for, nothing here can fail a recording, and a hub that does not answer is simply skipped.

export type AlertEvent = 'started' | 'alert' | 'recorded';

export interface WatchedRecording {
  seizureId: string;
  status: 'running' | 'finished' | 'cancelled';
  /** The recording screen's emergency state ('recording', 'warning', 'alert', 'auto_stop'). */
  alert: string;
}

/**
 * What changed between two looks at the recording: started when a new one runs, alert when it passes the alert time (or is
 * stopped by the 12-minute rule), recorded when it ends. A cancelled recording says nothing more. Each event is given once.
 */
export function alertEvents(before: WatchedRecording | null, after: WatchedRecording | null): AlertEvent[] {
  if (!after) return [];
  const out: AlertEvent[] = [];
  const sameOne = before?.seizureId === after.seizureId;
  if (!sameOne && after.status === 'running') out.push('started');
  const wasAlert = sameOne && (before?.alert === 'alert' || before?.alert === 'auto_stop');
  if (after.status === 'running' && (after.alert === 'alert' || after.alert === 'auto_stop') && !wasAlert)
    out.push('alert');
  if (sameOne && before?.status === 'running' && after.status === 'finished') out.push('recorded');
  return out;
}

export interface AlertSenderDeps {
  api: HubLocalApi;
  fetch?: typeof fetch;
  /** For tests: do not wait between tries. */
  wait?: (ms: number) => Promise<void>;
}

/** Sends one event to the hub, if this device has one. Three tries over half a minute for an alert; never throws. */
export async function sendAlert(
  deps: AlertSenderDeps,
  event: AlertEvent,
  patientId: string,
): Promise<'sent' | 'no_hub' | 'failed'> {
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    const local = await hubLocalOf(deps.api).load();
    if (!local) return 'no_hub';
    const conn = { url: local.url, token: local.token, timeoutMs: 8000, ...(deps.fetch ? { fetch: deps.fetch } : {}) };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await hubAlert(conn, { event, patientId });
        return 'sent';
      } catch (error) {
        const status = (error as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500 && status !== 429) return 'failed'; // refused: asking again will not help
        await wait(5000 * (attempt + 1));
      }
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
