import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ClockDriftError,
  DEFAULT_MAX_DRIFT_MS,
  HLC_MAX_COUNTER,
  HLC_MAX_WALL,
  compareHlc,
  decodeHlc,
  encodeHlc,
  initialHlc,
  receiveHlc,
  tickHlc,
  type Hlc,
} from './hlc';

const hlcArb = fc.record({
  wall: fc.integer({ min: 0, max: HLC_MAX_WALL }),
  counter: fc.integer({ min: 0, max: HLC_MAX_COUNTER }),
  node: fc.stringMatching(/^[a-z0-9-]{1,36}$/),
});

describe('encode and decode', () => {
  it('round-trips any stamp', () => {
    fc.assert(
      fc.property(hlcArb, (h) => {
        expect(decodeHlc(encodeHlc(h))).toEqual(h);
      }),
    );
  });

  it('writes a fixed, sortable form', () => {
    expect(encodeHlc({ wall: 1_700_000_000_000, counter: 255, node: 'dev-a' })).toBe('001700000000000-000ff-dev-a');
  });

  it('rejects values outside the range', () => {
    expect(() => encodeHlc({ wall: -1, counter: 0, node: 'a' })).toThrow(RangeError);
    expect(() => encodeHlc({ wall: HLC_MAX_WALL + 1, counter: 0, node: 'a' })).toThrow(RangeError);
    expect(() => encodeHlc({ wall: 1.5, counter: 0, node: 'a' })).toThrow(RangeError);
    expect(() => encodeHlc({ wall: 1, counter: -1, node: 'a' })).toThrow(RangeError);
    expect(() => encodeHlc({ wall: 1, counter: HLC_MAX_COUNTER + 1, node: 'a' })).toThrow(RangeError);
    expect(() => encodeHlc({ wall: 1, counter: 0, node: '' })).toThrow(RangeError);
  });

  it('refuses text that is not a stamp', () => {
    expect(() => decodeHlc('nope')).toThrow(SyntaxError);
    expect(() => decodeHlc('1-2-a')).toThrow(SyntaxError);
  });
});

describe('compareHlc', () => {
  it('matches the numeric order of wall, then counter, then node', () => {
    const a: Hlc = { wall: 10, counter: 0, node: 'a' };
    expect(compareHlc(a, { wall: 11, counter: 0, node: 'a' })).toBeLessThan(0);
    expect(compareHlc(a, { wall: 10, counter: 1, node: 'a' })).toBeLessThan(0);
    expect(compareHlc(a, { wall: 10, counter: 0, node: 'b' })).toBeLessThan(0);
    expect(compareHlc({ wall: 10, counter: 0, node: 'b' }, a)).toBeGreaterThan(0);
    expect(compareHlc(a, { ...a })).toBe(0);
  });

  it('accepts written stamps as well as objects', () => {
    const a: Hlc = { wall: 5, counter: 0, node: 'a' };
    expect(compareHlc(encodeHlc(a), a)).toBe(0);
  });

  it('is a total order: antisymmetric and transitive', () => {
    fc.assert(
      fc.property(hlcArb, hlcArb, hlcArb, (a, b, c) => {
        expect(Math.sign(compareHlc(a, b))).toBe(-Math.sign(compareHlc(b, a)));
        if (compareHlc(a, b) <= 0 && compareHlc(b, c) <= 0) expect(compareHlc(a, c)).toBeLessThanOrEqual(0);
      }),
    );
  });
});

describe('tickHlc', () => {
  it('uses the wall clock when it moved forward and resets the counter', () => {
    expect(tickHlc({ wall: 100, counter: 7, node: 'a' }, 200)).toEqual({ wall: 200, counter: 0, node: 'a' });
  });

  it('counts up when the wall clock stands still or runs backwards', () => {
    expect(tickHlc({ wall: 100, counter: 7, node: 'a' }, 100).counter).toBe(8);
    expect(tickHlc({ wall: 100, counter: 7, node: 'a' }, 50)).toEqual({ wall: 100, counter: 8, node: 'a' });
  });

  it('always produces a newer stamp, whatever the clock does', () => {
    fc.assert(
      fc.property(hlcArb, fc.integer({ min: 0, max: HLC_MAX_WALL - 1 }), (local, now) => {
        fc.pre(local.counter < HLC_MAX_COUNTER);
        expect(compareHlc(tickHlc(local, now), local)).toBeGreaterThan(0);
      }),
    );
  });

  it('throws instead of wrapping the counter', () => {
    expect(() => tickHlc({ wall: 100, counter: HLC_MAX_COUNTER, node: 'a' }, 100)).toThrow(RangeError);
  });

  it('starts from zero', () => {
    expect(initialHlc('a')).toEqual({ wall: 0, counter: 0, node: 'a' });
  });
});

describe('receiveHlc', () => {
  const local: Hlc = { wall: 100, counter: 2, node: 'a' };

  it('takes the larger counter when all three clocks agree', () => {
    expect(receiveHlc(local, { wall: 100, counter: 5, node: 'b' }, 100).counter).toBe(6);
    expect(receiveHlc({ ...local, counter: 9 }, { wall: 100, counter: 5, node: 'b' }, 100).counter).toBe(10);
  });

  it('follows the local clock when it is the newest', () => {
    expect(receiveHlc(local, { wall: 90, counter: 50, node: 'b' }, 80)).toEqual({ wall: 100, counter: 3, node: 'a' });
  });

  it('follows the remote clock when it is the newest', () => {
    expect(receiveHlc(local, { wall: 120, counter: 4, node: 'b' }, 110)).toEqual({ wall: 120, counter: 5, node: 'a' });
  });

  it('follows the wall clock when it is the newest', () => {
    expect(receiveHlc(local, { wall: 120, counter: 4, node: 'b' }, 130)).toEqual({ wall: 130, counter: 0, node: 'a' });
  });

  it('refuses a remote clock far in the future, and accepts one just inside the limit', () => {
    const now = 1_000;
    expect(() => receiveHlc(local, { wall: now + DEFAULT_MAX_DRIFT_MS + 1, counter: 0, node: 'b' }, now)).toThrow(
      ClockDriftError,
    );
    expect(receiveHlc(local, { wall: now + DEFAULT_MAX_DRIFT_MS, counter: 0, node: 'b' }, now).wall).toBe(
      now + DEFAULT_MAX_DRIFT_MS,
    );
    expect(() => receiveHlc(local, { wall: 50, counter: 0, node: 'b' }, 10, 5)).toThrow(/ahead/);
  });

  it('throws instead of wrapping the counter', () => {
    expect(() =>
      receiveHlc({ wall: 5, counter: HLC_MAX_COUNTER, node: 'a' }, { wall: 5, counter: 0, node: 'b' }, 5),
    ).toThrow(RangeError);
  });

  it('is newer than both inputs', () => {
    fc.assert(
      fc.property(hlcArb, hlcArb, fc.integer({ min: 0, max: HLC_MAX_WALL - 1 }), (a, b, now) => {
        fc.pre(a.counter < HLC_MAX_COUNTER && b.counter < HLC_MAX_COUNTER && b.wall - now <= DEFAULT_MAX_DRIFT_MS);
        const next = receiveHlc(a, b, now);
        expect(compareHlc(next, a)).toBeGreaterThan(0);
        expect(next.wall).toBeGreaterThanOrEqual(b.wall);
        expect(next.node).toBe(a.node);
      }),
    );
  });
});
