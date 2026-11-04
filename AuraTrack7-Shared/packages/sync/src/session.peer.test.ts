import { describe, expect, it } from 'vitest';
import { removeDevice } from './membership';
import { memoryPipe } from './memory';
import { newestKey, sealJson, type KeyEntry } from './seal';
import { runSession, type Channel, type SessionReport } from './session';
import { stampAt, TestNode } from './testNode';

// A meeting with a peer written out by hand, to show what each device does when the other side is wrong, late or hostile.

type Msg = Record<string, unknown> & { t: string };

class Peer {
  private inbox: Msg[] = [];
  private wake: (() => void) | null = null;
  constructor(readonly channel: Channel) {
    channel.onMessage((text) => {
      this.inbox.push(JSON.parse(text) as Msg);
      this.wake?.();
    });
  }
  put(message: Msg): void {
    this.channel.send(JSON.stringify(message));
  }
  raw(text: string): void {
    this.channel.send(text);
  }
  async take(type: string): Promise<Msg> {
    for (let i = 0; i < 200; i++) {
      const at = this.inbox.findIndex((m) => m.t === type);
      if (at !== -1) return this.inbox.splice(at, 1)[0] as Msg;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
        setTimeout(resolve, 20);
      });
    }
    throw new Error(`never got ${type}`);
  }
}

/** The real device `a`, and a peer called `B` that holds the same household key. */
function start(a: TestNode, options: { timeoutMs?: number; prepare?: (a: TestNode) => void } = {}) {
  const b = a.invite('B', ['p1']);
  options.prepare?.(a);
  const [x, y] = memoryPipe();
  const report = runSession(x, a.context(), { timeoutMs: options.timeoutMs ?? 400 });
  const peer = new Peer(y);
  const key = newestKey(a.state.keyring.household) as KeyEntry;
  return { a, b, peer, report, key };
}

type Started = ReturnType<typeof start>;
const hello = (s: Started, over: Record<string, unknown> = {}) =>
  s.peer.put({ t: 'hello', v: 1, hid: s.a.householdId, did: 'B', nonce: 'nb', held: [s.key.id], ...over });

/** Both hellos and the proof, as a member would send them. */
async function prove(s: Started, over: { proof?: Record<string, unknown> } = {}) {
  const first = await s.peer.take('hello');
  hello(s);
  await s.peer.take('auth');
  s.peer.put({
    t: 'auth',
    p: await sealJson(s.key, { did: 'B', mine: 'nb', yours: first.nonce, key: s.key.id, ...over.proof }, 'auth:B>A'),
  });
}

const sealed = (s: Started, aad: string, value: unknown) => sealJson(s.key, value, aad);

/** Carries on to the point where the real device wants the lists of devices. */
async function toMembers(s: Started) {
  await prove(s);
  await s.peer.take('members');
}

/** Carries on to the point where the real device wants the keys. */
async function toKeys(s: Started) {
  await toMembers(s);
  s.peer.put({ t: 'members', p: await sealed(s, 'members', s.b.state.membership) });
  await s.peer.take('keys');
}

async function toSummary(s: Started, keys: unknown) {
  await toKeys(s);
  s.peer.put({ t: 'keys', p: await sealed(s, 'keys', keys) });
  await s.peer.take('summary');
}

async function toIds(s: Started, summary: unknown) {
  await toSummary(s, { household: s.a.state.keyring.household, revoked: [], patients: {} });
  s.peer.put({ t: 'summary', p: await sealed(s, 'summary', summary) });
  await s.peer.take('ids');
}

const outcomeOf = async (s: Started): Promise<SessionReport> => s.report;
const nodeA = () => {
  const a = TestNode.first('h', 'A', ['p1']);
  a.add('p1', 'r1', stampAt(1));
  a.add(null, 's1', stampAt(1, 5));
  return a;
};

describe('a meeting with a peer that is not right', () => {
  it('ignores text that is not a message, one that is far too long, and one with no type', async () => {
    const s = start(nodeA());
    await s.peer.take('hello');
    s.peer.raw('not json at all');
    s.peer.raw('[1,2]');
    s.peer.raw('{"x":1}');
    s.peer.raw('x'.repeat(2_000_001));
    hello(s, { v: 2 });
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('refused'); // it went on to read the hello that was a message
    expect(r.reason).toMatch(/version/);
  });

  it('refuses another version of the protocol, another household, and a hello with no device or its own id', async () => {
    for (const [over, reason] of [
      [{ v: 2 }, /version/],
      [{ hid: 'elsewhere' }, /another household/],
      [{ did: '' }, /not another device/],
      [{ did: 'A' }, /not another device/],
      [{ did: 7 }, /not another device/],
    ] as const) {
      const s = start(nodeA());
      await s.peer.take('hello');
      hello(s, over);
      const r = await outcomeOf(s);
      expect(r.outcome).toBe('refused');
      expect(r.reason).toMatch(reason);
    }
  });

  it('refuses a peer that shares no household key with it, or that says nothing about its keys', async () => {
    for (const held of [[], ['unknown-key'], 'not a list']) {
      const s = start(nodeA());
      await s.peer.take('hello');
      hello(s, { held });
      const r = await outcomeOf(s);
      expect(r.outcome).toBe('refused');
      expect(r.reason).toBe('no common key');
    }
  });

  it('refuses at once when it is not in this household, or has been removed from it', async () => {
    const wrong = nodeA();
    wrong.state = { ...wrong.state, membership: { ...wrong.state.membership, householdId: 'another' } };
    const [x] = memoryPipe();
    expect((await runSession(x, wrong.context(), { timeoutMs: 100 })).reason).toBe('no household');

    const gone = nodeA();
    gone.state = removeDevice(gone.state, 'A', 5000);
    const [y] = memoryPipe();
    expect((await runSession(y, gone.context(), { timeoutMs: 100 })).outcome).toBe('removed');
  });

  it('ends with removed or refused when the peer says goodbye, with the reason it gives', async () => {
    for (const [reason, outcome] of [
      ['removed', 'removed'],
      ['something else', 'refused'],
      [undefined, 'refused'],
    ] as const) {
      const s = start(nodeA());
      await s.peer.take('hello');
      s.peer.put({ t: 'bye', ...(reason ? { reason } : {}) });
      const r = await outcomeOf(s);
      expect(r.outcome).toBe(outcome);
    }
  });

  it('reports a closed connection as an error', async () => {
    const s = start(nodeA());
    await s.peer.take('hello');
    s.peer.channel.close();
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('error');
  });

  it('refuses a proof that cannot be opened, or that answers another meeting', async () => {
    const garbage = start(nodeA());
    await garbage.peer.take('hello');
    hello(garbage);
    await garbage.peer.take('auth');
    garbage.peer.put({ t: 'auth', p: 'not sealed' });
    expect((await outcomeOf(garbage)).reason).toMatch(/prove/);

    for (const proof of [{ mine: 'wrong' }, { yours: 'wrong' }, { did: 'Z' }]) {
      const s = start(nodeA());
      await prove(s, { proof });
      expect((await outcomeOf(s)).reason).toMatch(/prove/);
    }
  });

  it('refuses a device that is known to be removed, and one that comes with a key that was replaced', async () => {
    const s = start(nodeA(), { prepare: (a) => void (a.state = removeDevice(a.state, 'B', 5000)) });
    await prove(s);
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('refused');
    expect(r.reason).toBe('removed device');

    // B is not a member of record on A, and the key it shows has been replaced
    const t = start(nodeA(), {
      prepare: (a) => {
        const rest = Object.fromEntries(Object.entries(a.state.membership.devices).filter(([id]) => id !== 'B'));
        a.state = {
          membership: { ...a.state.membership, devices: rest },
          keyring: { ...a.state.keyring, revoked: a.state.keyring.household.map((k) => k.id) },
          lastMet: {},
        };
      },
    });
    await prove(t);
    expect((await outcomeOf(t)).reason).toBe('an old key');
  });

  it('refuses a list of devices from another household, or one that says this device was removed', async () => {
    const other = start(nodeA());
    await toMembers(other);
    other.peer.put({
      t: 'members',
      p: await sealed(other, 'members', { ...other.b.state.membership, householdId: 'another' }),
    });
    expect((await outcomeOf(other)).reason).toBe('not the same household');

    const a = nodeA();
    const s = start(a);
    await toMembers(s);
    s.peer.put({ t: 'members', p: await sealed(s, 'members', removeDevice(s.b.state, 'A', 9000).membership) });
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('removed');
    expect(a.state.membership.devices.A?.removedAt).not.toBeNull(); // it kept what it was told
  });

  it('refuses a peer that the list of devices says is removed', async () => {
    const a = nodeA();
    const s = start(a);
    await toMembers(s);
    s.peer.put({ t: 'members', p: await sealed(s, 'members', removeDevice(s.b.state, 'B', 9000).membership) });
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('refused');
    expect(r.reason).toBe('removed device');
  });

  it('keeps only the patient keys it follows, and copes with keys sent in the wrong shape', async () => {
    const a = nodeA();
    const s = start(a);
    await toKeys(s);
    s.peer.put({ t: 'keys', p: await sealed(s, 'keys', { household: 'x', revoked: 'y', patients: 'z' }) });
    await s.peer.take('summary');
    s.peer.put({ t: 'summary', p: await sealed(s, 'summary', null) });
    await s.peer.take('ids');
    s.peer.put({ t: 'ids', p: await sealed(s, 'ids', null) });
    await s.peer.take('done'); // nothing was offered, so nothing is sent
    s.peer.put({ t: 'done' });
    expect((await outcomeOf(s)).outcome).toBe('done');

    const t = start(nodeA());
    await toKeys(t);
    t.peer.put({ t: 'keys', p: await sealed(t, 'keys', 'not a keyring') });
    await t.peer.take('summary');
    t.peer.put({ t: 'summary', p: await sealed(t, 'summary', { summary: 'no' }) });
    await t.peer.take('ids');
    t.peer.put({ t: 'ids', p: await sealed(t, 'ids', { household: 'no' }) });
    await t.peer.take('done');
    t.peer.put({ t: 'done' });
    expect((await outcomeOf(t)).outcome).toBe('done');
  });

  it('refuses a list with far too many ids', async () => {
    const s = start(nodeA());
    await toIds(s, { summary: { household: {} } });
    s.peer.put({
      t: 'ids',
      p: await sealed(s, 'ids', { household: { '2026-01-01': Array.from({ length: 200_001 }, () => 'a') } }),
    });
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('refused');
    expect(r.reason).toBe('too many ids');
  });

  it('turns away entries for a scope it is not comparing, sealed with the wrong key, or of the wrong shape', async () => {
    const s = start(nodeA());
    await toIds(s, { summary: { household: {} } });
    s.peer.put({ t: 'ids', p: await sealed(s, 'ids', { household: { '2026-01-01': ['x'] }, nonsense: 5 }) });
    await s.peer.take('entries');
    await s.peer.take('done');
    const ok = {
      id: 'in1',
      householdId: 'h',
      patientId: null,
      deviceId: 'B',
      stamp: stampAt(3),
      at: 0,
      recordType: 'seizure',
      recordId: 'q',
      kind: 'update',
      fields: {},
    };
    s.peer.put({ t: 'entries', scope: 'unknown', p: 'x' }); // not a scope in this meeting
    s.peer.put({ t: 'entries', scope: 7, p: 'x' }); // no scope at all
    s.peer.put({ t: 'entries', scope: 'household', p: 'cannot be opened' });
    s.peer.put({ t: 'entries', scope: 'household', p: await sealed(s, 'entries:household', { not: 'a list' }) });
    s.peer.put({
      t: 'entries',
      scope: 'household',
      p: await sealed(s, 'entries:household', [
        ok,
        5,
        { ...ok, id: 'in2', householdId: 'other' },
        { ...ok, id: 'in3', patientId: 'p1' },
      ]),
    });
    s.peer.put({ t: 'done' });
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('done');
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(6); // two scopes, one unopenable, a non-entry, another household, another patient
    expect(s.a.entries.has('in1')).toBe(true);
  });

  it('times out when the peer stops answering partway through', async () => {
    const s = start(nodeA(), { timeoutMs: 80 });
    await toKeys(s);
    const r = await outcomeOf(s);
    expect(r.outcome).toBe('error');
    expect(r.reason).toMatch(/no answer/);
  });
});
