import { describe, expect, it } from 'vitest';
import { removeDevice } from './membership';
import { meet, stampAt, TestNode } from './testNode';

const sorted = (n: TestNode) => [...n.entries.keys()].sort();

describe('a meeting between two devices', () => {
  it('gives each the entries the other lacks, for the household and for a patient both follow', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    a.add('p1', 'r1', stampAt(1));
    a.add(null, 's1', stampAt(1, 5));
    b.add('p1', 'r2', stampAt(2));
    const [ra, rb] = await meet(a, b);
    expect(ra.outcome).toBe('done');
    expect(rb.outcome).toBe('done');
    expect(sorted(a)).toEqual(sorted(b));
    expect(a.entries.size).toBe(3);
    expect(ra.applied).toBe(1);
    expect(rb.applied).toBe(2);
    expect(ra.sent).toBe(2);
  });

  it('does nothing the second time', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    a.add('p1', 'r1', stampAt(1));
    await meet(a, b);
    const [ra, rb] = await meet(a, b);
    expect([ra.applied, ra.sent, rb.applied, rb.sent]).toEqual([0, 0, 0, 0]);
  });

  it('records when it last met each device', async () => {
    const a = TestNode.first('h', 'A', []);
    const b = a.invite('B', []);
    await meet(a, b);
    expect(a.state.lastMet.B).toBeGreaterThan(0);
    expect(b.state.lastMet.A).toBeGreaterThan(0);
  });

  it('does not give a patient to a device that does not follow them, nor its key', async () => {
    const a = TestNode.first('h', 'A', ['p1', 'p2']);
    const b = a.invite('B', ['p1']);
    a.add('p1', 'r1', stampAt(1));
    a.add('p2', 'r2', stampAt(1));
    await meet(a, b);
    expect([...b.entries.values()].map((e) => e.patientId)).toEqual(['p1']);
    expect(Object.keys(b.state.keyring.patients)).toEqual(['p1']);
  });

  it('finds an old entry that arrived late (not just anything newer)', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const c = a.invite('C', ['p1']);
    b.add('p1', 'r1', stampAt(1)); // old stamp
    a.add('p1', 'r2', stampAt(9)); // newer, so a "since" watermark on A would skip r1
    await meet(a, c); // C is now ahead of B's old entry
    await meet(b, c);
    await meet(a, c);
    expect(sorted(a)).toEqual(sorted(b));
    expect(sorted(a)).toEqual(sorted(c));
  });

  it('passes on what a device got from a third one it never met', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const c = a.invite('C', ['p1']);
    a.add('p1', 'r1', stampAt(1));
    await meet(a, b);
    await meet(b, c);
    expect(c.entries.size).toBe(1);
  });

  it.each([
    ['A B, B C, A C', [0, 1, 1, 2, 0, 2]],
    ['C B, A C, A B', [2, 1, 0, 2, 0, 1]],
    ['A C, A B, B C', [0, 2, 0, 1, 1, 2]],
  ])('three devices end the same whatever the order they meet in (%s)', async (_name, order) => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const c = a.invite('C', ['p1']);
    const nodes = [a, b, c];
    a.add('p1', 'r1', stampAt(3));
    b.add('p1', 'r2', stampAt(2));
    c.add(null, 's1', stampAt(1));
    c.add('p1', 'r3', stampAt(5));
    for (let i = 0; i < order.length; i += 2)
      await meet(nodes[order[i] as number] as TestNode, nodes[order[i + 1] as number] as TestNode);
    // one more round so what was passed on reaches everyone
    await meet(a, b);
    await meet(b, c);
    expect(sorted(a)).toEqual(sorted(b));
    expect(sorted(b)).toEqual(sorted(c));
    expect(a.entries.size).toBe(4);
  });

  it('copes with a dropped message, a repeated message and a cut connection, and finishes at the next meeting', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    for (let i = 0; i < 30; i++) a.add('p1', `r${i}`, stampAt(1 + i));
    const [cut] = await meet(a, b, { cutAfter: 9 }, { timeoutMs: 300 });
    expect(cut.outcome).not.toBe('done');
    const [dup] = await meet(a, b, { duplicate: true });
    expect(dup.outcome).toBe('done');
    expect(sorted(a)).toEqual(sorted(b));
    const c = a.invite('C', ['p1']);
    const [dropped] = await meet(a, c, { dropAt: 7 }, { timeoutMs: 300 });
    expect(dropped.outcome).toBe('error');
    await meet(a, c);
    expect(sorted(a)).toEqual(sorted(c));
  });

  it('sends a long log in several batches', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    for (let i = 0; i < 300; i++) a.add('p1', `r${i}`, stampAt(1 + (i % 40), i));
    const [ra] = await meet(a, b, {}, { timeoutMs: 2000, batchChars: 2000 });
    expect(ra.sent).toBe(300);
    expect(b.entries.size).toBe(300);
  });

  it('catches up a device that was away for months', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    await meet(a, b);
    for (let i = 0; i < 60; i++) a.add('p1', `r${i}`, stampAt(100 + i * 3));
    await meet(a, b);
    expect(b.entries.size).toBe(60);
  });
});

describe('who may meet', () => {
  it('refuses a device of another household', async () => {
    const a = TestNode.first('h', 'A', []);
    const x = TestNode.first('other', 'X', []);
    const [ra, rx] = await meet(a, x);
    expect(ra.outcome).toBe('refused');
    expect(rx.outcome).toBe('refused');
  });

  it('refuses a device that does not hold the household key, even with the right household id', async () => {
    const a = TestNode.first('h', 'A', []);
    const stranger = TestNode.first('h', 'S', []); // same id, its own key
    const [ra, rs] = await meet(a, stranger);
    expect(ra.outcome).toBe('refused');
    expect(rs.outcome).toBe('refused');
    expect(stranger.entries.size).toBe(0);
  });

  it('refuses a removed device and tells it it was removed, and later data is never sent to it', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const c = a.invite('C', ['p1']);
    await meet(a, b);
    await meet(a, c);
    a.state = removeDevice(a.state, 'C', 5000);
    a.add('p1', 'secret', stampAt(50));
    const [ra, rc] = await meet(a, c);
    expect(ra.outcome).toBe('refused');
    expect(rc.outcome === 'removed' || rc.outcome === 'refused').toBe(true);
    expect([...c.entries.values()].some((e) => e.recordId === 'secret')).toBe(false);
  });

  it('a removed device that meets a device which has not heard yet gets nothing new, and the others still sync', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const c = a.invite('C', ['p1']);
    await meet(a, b);
    await meet(a, c);
    a.state = removeDevice(a.state, 'C', 5000);
    a.add('p1', 'after', stampAt(60));
    // B has not heard of the removal or the new keys. B and A still meet: B hears of both and gets the new keys.
    const [ra, rb] = await meet(a, b);
    expect(ra.outcome).toBe('done');
    expect(rb.outcome).toBe('done');
    expect(b.state.membership.devices.C?.removedAt).not.toBeNull();
    expect(b.state.keyring.household.length).toBe(a.state.keyring.household.length);
    // Now B knows too: C is refused by B as well, and never sees 'after'
    const [, rc] = await meet(b, c);
    expect(rc.outcome === 'removed' || rc.outcome === 'refused').toBe(true);
    expect([...c.entries.values()].some((e) => e.recordId === 'after')).toBe(false);
  });

  it('a device that was removed learns it at the next meeting with a device that knows', async () => {
    const a = TestNode.first('h', 'A', []);
    const c = a.invite('C', []);
    const b = a.invite('B', []);
    await meet(a, b);
    a.state = removeDevice(a.state, 'C', 5000);
    const [, rc] = await meet(a, c);
    expect(rc.outcome === 'removed' || rc.outcome === 'refused').toBe(true);
  });

  it('refuses entries that do not belong to the scope they came in', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const b = a.invite('B', ['p1']);
    const bad = a.add('p1', 'r1', stampAt(1));
    a.entries.set(bad.id, { ...bad, householdId: 'someone-else' });
    const [, rb] = await meet(a, b);
    expect(rb.rejected).toBe(1);
    expect(b.entries.size).toBe(0);
  });

  it('times out when the other side says nothing', async () => {
    const a = TestNode.first('h', 'A', []);
    const [x] = (await import('./memory')).memoryPipe();
    const { runSession } = await import('./session');
    const report = await runSession(x, a.context(), { timeoutMs: 30 });
    expect(report.outcome).toBe('error');
  });
});
