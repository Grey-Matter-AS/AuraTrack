import { emergencyPlan, newId, type RecordingEvent, type RecordingState } from '@auratrack/model';
import { describe, expect, it, vi } from 'vitest';
import {
  RecordingController,
  browserRecordingEnv,
  defaultRecordingSettings,
  type RecordingSettings,
  type RecordingTransport,
  type WakeLockLike,
} from './controller';
import { fakeEnv } from './fakeEnv';

const T0 = 1_760_000_000_000;
const S = 1000;

function transport(fail = () => false) {
  const sent: RecordingEvent[] = [];
  const t: RecordingTransport = {
    send: async (_id, event) => {
      if (fail()) throw new Error('offline');
      sent.push(event);
    },
  };
  return { t, sent };
}

const settings = (over: Partial<RecordingSettings> = {}): RecordingSettings => ({
  ...defaultRecordingSettings(),
  ...over,
});
const patientId = newId();
const begin = (c: RecordingController) => c.start({ patientId, recordedBy: 'carer', timeZone: 'Europe/Oslo' });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('starting', () => {
  it('shows the recording at once, before anything is saved', () => {
    const f = fakeEnv();
    const hanging: RecordingTransport = { send: () => new Promise(() => {}) }; // a save that has not finished
    const c = new RecordingController(hanging, f.env, settings());
    const id = begin(c);
    const snap = c.getSnapshot();
    expect(snap.session).toMatchObject({ seizureId: id, start: T0, status: 'running' });
    expect(snap.view).toMatchObject({ stage: 'aura', elapsedSec: 0 });
    expect(snap.save).toBe('saving');
  });

  it('saves every event in the order tapped', async () => {
    const f = fakeEnv();
    const { t, sent } = transport();
    const c = new RecordingController(t, f.env, settings());
    begin(c);
    f.advance(5 * S);
    c.tap('end_aura');
    c.quickNote('Calm');
    c.symptom('symptom.a', 'seizure');
    f.advance(S);
    c.tap('end_seizure');
    c.tap('back_to_normal');
    await flush();
    expect(sent.map((e) => e.kind)).toEqual([
      'start',
      'end_aura',
      'quick_note',
      'symptom',
      'end_seizure',
      'back_to_normal',
    ]);
    expect(c.getSnapshot().save).toBe('saved');
    expect(c.getSnapshot().view?.stage).toBe('done');
  });

  it('keeps the clock from timestamps: a page that was asleep catches up in one step', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    f.jump(T0 + 250 * S); // no ticks ran at all
    f.hide();
    f.show();
    expect(c.getSnapshot().view).toMatchObject({ elapsedSec: 250, alert: 'warning' });
  });
});

describe('the emergency plan', () => {
  it("warns a minute before, alerts at the user's time, and tells the screen each time", () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    const raised: RecordingState[] = [];
    c.onAlert((s) => raised.push(s));
    begin(c);
    f.advance(239 * S);
    expect(raised).toEqual([]);
    f.advance(S);
    expect(raised).toEqual(['warning']);
    f.advance(60 * S);
    expect(raised).toEqual(['warning', 'alert']);
    expect(c.getSnapshot().view?.alert).toBe('alert');
  });

  it('uses a shorter alert time when the user set one', () => {
    const f = fakeEnv();
    const c = new RecordingController(
      transport().t,
      f.env,
      settings({ plan: emergencyPlan({ emergencyAlertMinutes: 2 }) }),
    );
    const raised: RecordingState[] = [];
    c.onAlert((s) => raised.push(s));
    begin(c);
    f.advance(120 * S);
    expect(raised).toEqual(['warning', 'alert']);
  });

  it('counts from Start through the aura (decision 1)', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    f.advance(10 * S);
    c.tap('end_aura');
    f.advance(290 * S);
    expect(c.getSnapshot().view).toMatchObject({ elapsedSec: 300, alert: 'alert', stage: 'seizure' });
  });

  it('stops by itself at 12 minutes, leaves the seizure end unknown, and stays quiet afterwards', async () => {
    const f = fakeEnv();
    const { t, sent } = transport();
    const c = new RecordingController(t, f.env, settings());
    const raised: RecordingState[] = [];
    c.onAlert((s) => raised.push(s));
    begin(c);
    f.advance(721 * S);
    await flush();
    const session = c.getSnapshot().session;
    expect(session).toMatchObject({ status: 'finished', autoStopped: true, seizureEnd: null, recoveryEnd: null });
    const stop = sent.find((e) => e.kind === 'auto_stop');
    expect(stop?.at).toBe(T0 + 720 * S);
    expect(raised).toEqual(['warning', 'alert', 'auto_stop']);
    expect(f.intervals.size).toBe(0); // the clock stopped
    f.advance(600 * S);
    expect(raised).toHaveLength(3);
  });

  it('stops at the minute it was due when the page only notices later', async () => {
    const f = fakeEnv();
    const { t, sent } = transport();
    const c = new RecordingController(t, f.env, settings());
    begin(c);
    f.jump(T0 + 3000 * S);
    f.hide();
    f.show();
    await flush();
    expect(sent.find((e) => e.kind === 'auto_stop')?.at).toBe(T0 + 720 * S);
    expect(c.getSnapshot().view).toMatchObject({ stage: 'done', elapsedSec: 720 });
  });

  it('does not auto-stop once the seizure has ended', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    f.advance(30 * S);
    c.tap('end_seizure');
    f.advance(900 * S);
    expect(c.getSnapshot().session?.autoStopped).toBe(false);
    expect(c.getSnapshot().view?.stage).toBe('recovery');
  });
});

describe('when saving fails', () => {
  it('carries on in memory, says so, retries, and loses nothing', async () => {
    const f = fakeEnv();
    let down = true;
    const { t, sent } = transport(() => down);
    const c = new RecordingController(t, f.env, settings());
    begin(c);
    await flush();
    expect(c.getSnapshot().save).toBe('failing');
    c.tap('end_aura');
    c.quickNote('Calm');
    await f.advanceAsync(5 * S);
    expect(c.getSnapshot().session?.quickNotes).toHaveLength(1);
    down = false;
    await f.advanceAsync(10 * S);
    expect(c.getSnapshot().save).toBe('saved');
    expect(sent.map((e) => e.kind)).toEqual(['start', 'end_aura', 'quick_note']);
  });

  it('waits longer between tries, up to a limit', async () => {
    const f = fakeEnv();
    const attempts: number[] = [];
    const t: RecordingTransport = {
      send: async () => {
        attempts.push(f.env.now());
        throw new Error('offline');
      },
    };
    const c = new RecordingController(t, f.env, settings());
    begin(c);
    await f.advanceAsync(40 * S);
    const gaps = attempts.slice(1).map((at, i) => at - (attempts[i] as number));
    // the fake clock moves in quarter-second steps, so each wait is at most one step longer than asked
    [1000, 2000, 4000, 8000].forEach((wait, i) => {
      expect(gaps[i]).toBeGreaterThanOrEqual(wait);
      expect(gaps[i]).toBeLessThanOrEqual(wait + 250);
    });
    expect(Math.max(...gaps)).toBeLessThanOrEqual(8250);
  });

  it('settles when asked', async () => {
    const f = fakeEnv();
    const { t, sent } = transport();
    const c = new RecordingController(t, f.env, settings());
    begin(c);
    await c.settled();
    expect(sent).toHaveLength(1);
  });
});

describe('the wake lock', () => {
  const lockEnv = () => {
    const released: (() => void)[] = [];
    const requests: string[] = [];
    const lock: WakeLockLike = {
      release: async () => {},
      addEventListener: (_t, l) => void released.push(l),
    };
    return { requests, released, wakeLock: { request: async (type: 'screen') => (requests.push(type), lock) } };
  };

  it('is taken at Start and let go when the recording ends', async () => {
    const w = lockEnv();
    const release = vi.fn(async () => {});
    w.wakeLock.request = async () => ({ release, addEventListener: () => {} });
    const f = fakeEnv({ wakeLock: w.wakeLock });
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    await flush();
    expect(c.getSnapshot().wakeLock).toBe('active');
    c.finish();
    await flush();
    expect(release).toHaveBeenCalled();
    expect(c.getSnapshot().wakeLock).toBe('off');
  });

  it('is taken again when the page comes back (the browser lets go of it when hidden)', async () => {
    const w = lockEnv();
    const f = fakeEnv({ wakeLock: w.wakeLock });
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    await flush();
    expect(w.requests).toHaveLength(1);
    w.released[0]?.(); // the browser released it
    expect(c.getSnapshot().wakeLock).toBe('off');
    f.hide();
    f.show();
    await flush();
    expect(w.requests).toHaveLength(2);
    expect(c.getSnapshot().wakeLock).toBe('active');
  });

  it('says when the browser has none, or refuses', async () => {
    const f = fakeEnv();
    const none = new RecordingController(transport().t, f.env, settings());
    begin(none);
    await flush();
    expect(none.getSnapshot().wakeLock).toBe('unsupported');
    const refuse = fakeEnv({ wakeLock: { request: async () => Promise.reject(new Error('no')) } });
    const c = new RecordingController(transport().t, refuse.env, settings());
    begin(c);
    await flush();
    expect(c.getSnapshot().wakeLock).toBe('denied');
  });

  it('is left alone when the setting is off, and follows the setting when it changes', async () => {
    const w = lockEnv();
    const f = fakeEnv({ wakeLock: w.wakeLock });
    const c = new RecordingController(transport().t, f.env, settings({ wakeLock: false }));
    begin(c);
    await flush();
    expect(w.requests).toHaveLength(0);
    c.setSettings(settings({ wakeLock: true }));
    await flush();
    expect(w.requests).toHaveLength(1);
    c.setSettings(settings({ wakeLock: false }));
    await flush();
    expect(c.getSnapshot().wakeLock).toBe('off');
  });
});

describe('vibration and sound', () => {
  it('buzzes on taps and with the alert, only where the browser can and the setting is on', () => {
    const vibrate = vi.fn(() => true);
    const f = fakeEnv({ vibrate });
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    expect(vibrate).toHaveBeenCalledWith(25);
    f.advance(300 * S);
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200, 100, 400]);
    expect(c.getSnapshot().vibration).toBe('supported');
  });

  it('stays silent on a browser with no vibration, and says so', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    expect(c.getSnapshot().vibration).toBe('unsupported');
  });

  it('does not buzz when the setting is off', () => {
    const vibrate = vi.fn(() => true);
    const f = fakeEnv({ vibrate });
    const c = new RecordingController(transport().t, f.env, settings({ haptics: false }));
    begin(c);
    f.advance(300 * S);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('prepares the sound inside the Start tap and beeps with the alert only when the setting is on', () => {
    const prepareSound = vi.fn();
    const beep = vi.fn();
    const f = fakeEnv({ prepareSound, beep });
    const c = new RecordingController(transport().t, f.env, settings({ sound: true }));
    begin(c);
    expect(prepareSound).toHaveBeenCalledOnce();
    f.advance(240 * S);
    expect(beep).not.toHaveBeenCalled(); // the warning is quiet
    f.advance(60 * S);
    expect(beep).toHaveBeenCalledOnce();
    const quiet = fakeEnv({ prepareSound, beep });
    const q = new RecordingController(transport().t, quiet.env, settings({ sound: false }));
    begin(q);
    quiet.advance(300 * S);
    expect(beep).toHaveBeenCalledOnce();
  });
});

describe('carrying on', () => {
  it('adopts a recording found again and keeps its clock', () => {
    const f = fakeEnv();
    const first = new RecordingController(transport().t, f.env, settings());
    begin(first);
    f.advance(100 * S);
    const session = first.getSnapshot().session;
    first.dispose();
    const second = new RecordingController(transport().t, f.env, settings());
    if (session) second.adopt(session);
    expect(second.getSnapshot().view).toMatchObject({ elapsedSec: 100, stage: 'aura' });
    second.tap('end_seizure');
    expect(second.getSnapshot().session?.seizureEnd).toBe(T0 + 100 * S);
  });

  it('does not repeat an alert that was already shown before the recording was adopted', () => {
    const f = fakeEnv();
    const first = new RecordingController(transport().t, f.env, settings());
    begin(first);
    f.advance(310 * S);
    const session = first.getSnapshot().session;
    const second = new RecordingController(transport().t, f.env, settings());
    const raised: RecordingState[] = [];
    second.onAlert((s) => raised.push(s));
    if (session) second.adopt(session);
    f.advance(5 * S);
    expect(raised).toEqual([]);
    expect(second.getSnapshot().view?.alert).toBe('alert');
  });

  it('can switch to the other transport, for a recording that moves from the PIN screen to the store', async () => {
    const f = fakeEnv();
    const locked = transport();
    const open = transport();
    const c = new RecordingController(locked.t, f.env, settings());
    begin(c);
    await flush();
    c.setTransport(open.t);
    c.tap('end_aura');
    await flush();
    expect(locked.sent.map((e) => e.kind)).toEqual(['start']);
    expect(open.sent.map((e) => e.kind)).toEqual(['end_aura']);
  });

  it('ignores a second Start, taps with no recording, and taps after the end', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    c.tap('end_aura');
    expect(c.getSnapshot().session).toBeNull();
    begin(c);
    c.finish();
    c.tap('end_seizure');
    expect(c.getSnapshot().session?.seizureEnd).toBeNull();
  });

  it('cancels a recording and keeps it, flagged', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    c.cancel();
    expect(c.getSnapshot().session?.status).toBe('cancelled');
    expect(c.getSnapshot().view?.stage).toBe('cancelled');
  });
});

describe('telling the screen', () => {
  it('only when something visible changes: not on a tick inside the same second', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    const listener = vi.fn();
    c.subscribe(listener);
    f.advance(750); // three ticks, still second 0
    expect(listener).not.toHaveBeenCalled();
    f.advance(250);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops telling a screen that has gone away, and stops everything on dispose', () => {
    const f = fakeEnv();
    const c = new RecordingController(transport().t, f.env, settings());
    begin(c);
    const listener = vi.fn();
    const off = c.subscribe(listener);
    off();
    f.advance(2 * S);
    expect(listener).not.toHaveBeenCalled();
    c.dispose();
    expect(f.intervals.size).toBe(0);
    expect(f.watchers.size).toBe(0);
  });
});

describe('the real browser', () => {
  it('builds an environment from whatever the browser has', () => {
    const env = browserRecordingEnv();
    expect(typeof env.now()).toBe('number');
    expect(env.visible()).toBe(true);
    const off = env.onVisibility(() => {});
    off();
    const handle = env.setInterval(() => {}, 1000);
    env.clearInterval(handle);
    env.clearTimeout(env.setTimeout(() => {}, 1000));
    env.prepareSound?.(); // no AudioContext in Node: it must not throw
    env.beep?.();
  });
});
