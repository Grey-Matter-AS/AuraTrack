import { describe, expect, it } from 'vitest';
import {
  ClockDriftError,
  DEFAULT_MAX_DRIFT_MS,
  HLC_MAX_COUNTER,
  HLC_MAX_WALL,
  compareHlc,
  decodeHlc,
  encodeHlc,
  receiveHlc,
  tickHlc,
} from './hlc';

// Exact edges and messages of the clock, so a change to any of them is noticed.
describe('clock edges', () => {
  it('accepts the largest wall time and counter exactly, and refuses one more', () => {
    expect(() => encodeHlc({ wall: HLC_MAX_WALL, counter: HLC_MAX_COUNTER, node: 'a' })).not.toThrow();
    expect(() => encodeHlc({ wall: 0, counter: 0, node: 'a' })).not.toThrow();
    expect(() => encodeHlc({ wall: HLC_MAX_WALL + 1, counter: 0, node: 'a' })).toThrow('HLC wall time out of range');
    expect(() => encodeHlc({ wall: 1, counter: HLC_MAX_COUNTER + 1, node: 'a' })).toThrow('HLC counter out of range');
    expect(() => encodeHlc({ wall: 1, counter: 0, node: '' })).toThrow('HLC node is empty');
  });

  it('refuses text that is not exactly a stamp, with a message that shows it', () => {
    expect(() => decodeHlc('nope')).toThrow('Not an HLC stamp: nope');
    expect(() => decodeHlc('001700000000000-000ff-dev-a\n')).toThrow(SyntaxError);
    expect(() => decodeHlc('x001700000000000-000ff-dev-a')).toThrow(SyntaxError);
  });

  it('the drift limit is one day, and the error says how far ahead the clock was', () => {
    expect(DEFAULT_MAX_DRIFT_MS).toBe(86_400_000);
    const error = (() => {
      try {
        receiveHlc({ wall: 0, counter: 0, node: 'a' }, { wall: 1_000_000_000, counter: 0, node: 'b' }, 100);
      } catch (e) {
        return e as ClockDriftError;
      }
      throw new Error('no error');
    })();
    expect(error).toBeInstanceOf(ClockDriftError);
    expect(error.name).toBe('ClockDriftError');
    expect(error.message).toBe('Remote clock is 999999900 ms ahead of this device');
    expect([error.remoteWall, error.localNow]).toEqual([1_000_000_000, 100]);
  });

  it('compares a written stamp with an object on either side', () => {
    const a = { wall: 5, counter: 1, node: 'a' };
    expect(compareHlc(a, encodeHlc(a))).toBe(0);
    expect(compareHlc(encodeHlc(a), { ...a, counter: 2 })).toBe(-1);
    expect(compareHlc({ ...a, counter: 2 }, encodeHlc(a))).toBe(1);
  });

  it('the counter may reach its limit, and only going past it is an error', () => {
    expect(tickHlc({ wall: 5, counter: HLC_MAX_COUNTER - 1, node: 'a' }, 5).counter).toBe(HLC_MAX_COUNTER);
    expect(() => tickHlc({ wall: 5, counter: HLC_MAX_COUNTER, node: 'a' }, 5)).toThrow('HLC counter overflow');
    expect(
      receiveHlc({ wall: 5, counter: HLC_MAX_COUNTER - 1, node: 'a' }, { wall: 5, counter: 0, node: 'b' }, 5).counter,
    ).toBe(HLC_MAX_COUNTER);
    expect(() =>
      receiveHlc({ wall: 5, counter: HLC_MAX_COUNTER, node: 'a' }, { wall: 5, counter: 0, node: 'b' }, 5),
    ).toThrow('HLC counter overflow');
    expect(() =>
      receiveHlc({ wall: 5, counter: 0, node: 'a' }, { wall: 5, counter: HLC_MAX_COUNTER, node: 'b' }, 5),
    ).toThrow('HLC counter overflow');
  });

  it('when only the remote clock has the newest wall time, its counter plus one is used', () => {
    expect(receiveHlc({ wall: 5, counter: 9, node: 'a' }, { wall: 9, counter: 2, node: 'b' }, 7)).toEqual({
      wall: 9,
      counter: 3,
      node: 'a',
    });
    // all three equal: the larger counter plus one, even when the local one is smaller
    expect(receiveHlc({ wall: 5, counter: 1, node: 'a' }, { wall: 5, counter: 4, node: 'b' }, 5).counter).toBe(5);
  });
});
