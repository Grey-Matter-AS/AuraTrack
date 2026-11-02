import { describe, expect, it } from 'vitest';
import { buildUpdate, collectFrames, openUpdate, toFrames, UpdateError } from './update';
import { stampAt, TestNode } from './testNode';

describe('an update file', () => {
  it('carries what one device has to another that holds the keys, and skips what it has no key for', async () => {
    const a = TestNode.first('h', 'A', ['p1', 'p2']);
    const b = a.invite('B', ['p1']);
    const e1 = a.add('p1', 'plain-record-name', stampAt(1));
    const e2 = a.add('p2', 'r2', stampAt(1));
    const e3 = a.add(null, 's1', stampAt(1));
    const file = await buildUpdate(
      a.state,
      'A',
      [
        { scope: 'p1', entries: [e1] },
        { scope: 'p2', entries: [e2] },
        { scope: 'household', entries: [e3] },
      ],
      5,
    );
    expect(file).not.toContain('plain-record-name');
    const opened = await openUpdate(file, b.state);
    expect(opened.scopes.map((s) => s.scope).sort()).toEqual(['household', 'p1']);
    expect(opened.skipped).toEqual(['p2']);
    expect(opened.from).toBe('A');
  });

  it('is refused by another household, and when it is not an update or is damaged', async () => {
    const a = TestNode.first('h', 'A', []);
    const x = TestNode.first('other', 'X', []);
    const file = await buildUpdate(a.state, 'A', [], 1);
    await expect(openUpdate(file, x.state)).rejects.toMatchObject({ reason: 'other_household' });
    await expect(openUpdate('hello', a.state)).rejects.toBeInstanceOf(UpdateError);
    await expect(openUpdate('AURA-UPDATE-1\n{broken', a.state)).rejects.toMatchObject({ reason: 'damaged' });
  });

  it('drops entries that do not belong to their scope', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const e = a.add('p1', 'r1', stampAt(1));
    const file = await buildUpdate(
      a.state,
      'A',
      [{ scope: 'p1', entries: [e, { ...e, id: 'x', patientId: 'p9' }] }],
      1,
    );
    expect((await openUpdate(file, a.state)).scopes[0]?.entries).toHaveLength(1);
  });
});

describe('QR frames', () => {
  it('split and join again in any order, ignoring repeats and strangers', () => {
    const text = 'x'.repeat(2000) + 'end';
    const frames = toFrames(text, 700);
    expect(frames).toHaveLength(3);
    const collector = collectFrames();
    expect(collector.add('not a frame')).toBeNull();
    for (const f of [frames[2], frames[0], frames[0], frames[1]] as string[]) collector.add(f);
    expect(collector.text()).toBe(text);
  });
  it('does not give a text until every frame is in', () => {
    const c = collectFrames();
    c.add(toFrames('a'.repeat(1500), 700)[0] as string);
    expect(c.text()).toBeNull();
  });
  it('refuses frames of a different set', () => {
    const c = collectFrames();
    c.add('AU1/1/3/a');
    expect(c.add('AU1/2/4/b')).toBeNull();
  });
});
