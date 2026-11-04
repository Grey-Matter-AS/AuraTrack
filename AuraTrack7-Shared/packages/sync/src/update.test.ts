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

describe('an update that is wrong in other ways', () => {
  const file = (head: unknown) => `AURA-UPDATE-1\n${JSON.stringify(head)}`;

  it('is damaged when its header is missing a part or has parts of the wrong type', async () => {
    const a = TestNode.first('h', 'A', []);
    for (const head of [
      { hid: 'h', at: 1, parts: {} },
      { hid: 'h', from: 'A', parts: {} },
      { hid: 'h', from: 'A', at: 1 },
      { hid: 'h', from: 'A', at: 1, parts: null },
    ])
      await expect(openUpdate(file(head), a.state)).rejects.toMatchObject({ reason: 'damaged' });
  });

  it('skips a part that is not text or is for a patient this device has no key for, and damaged or forged parts', async () => {
    const a = TestNode.first('h', 'A', ['p1']);
    const opened = await openUpdate(
      file({ hid: 'h', from: 'B', at: 1, parts: { household: 5, nobody: 'x.y.z', p1: 'not sealed' } }),
      a.state,
    );
    expect(opened.scopes).toEqual([]);
    expect(opened.skipped.sort()).toEqual(['household', 'nobody', 'p1']);
  });

  it('is damaged when what a part holds is not a list of entries', async () => {
    const a = TestNode.first('h', 'A', []);
    const { sealJson, newestKey } = await import('./seal');
    const key = newestKey(a.state.keyring.household);
    if (!key) throw new Error('no key');
    const parts = { household: await sealJson(key, { not: 'a list' }, 'update:household') };
    await expect(openUpdate(file({ hid: 'h', from: 'B', at: 1, parts }), a.state)).rejects.toMatchObject({
      reason: 'damaged',
    });
  });

  it('is left out of a built file when this device has no key for a scope', async () => {
    const a = TestNode.first('h', 'A', []);
    const text = await buildUpdate(a.state, 'A', [{ scope: 'nobody', entries: [] }], 1);
    expect(JSON.parse(text.split('\n')[1] as string).parts).toEqual({});
  });
});
