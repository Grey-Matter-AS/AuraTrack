import { z } from 'zod';

// Hybrid logical clock (HLC). Every field edit carries one, so two devices that edit different fields of the
// same record both keep their edit, and a device with a wrong clock cannot overwrite newer data
// (a remote clock too far ahead is refused, a local clock that runs behind is carried forward by the counter).
//
// Written form: `<wall ms, 15 digits>-<counter, 5 hex digits>-<deviceId>`. Plain string comparison orders
// two stamps correctly, and the device id breaks ties, so the order is total and the same on every device.

export interface Hlc {
  /** Largest wall-clock time seen so far, in ms since the epoch. */
  readonly wall: number;
  /** Counts events that share the same `wall`. */
  readonly counter: number;
  /** The device that issued the stamp. */
  readonly node: string;
}

export const HLC_MAX_WALL = 999_999_999_999_999;
export const HLC_MAX_COUNTER = 0xfffff;
/** A remote stamp more than this far ahead of the local clock is refused. */
export const DEFAULT_MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

const HLC_PATTERN = /^(\d{15})-([0-9a-f]{5})-(.+)$/;

export const HlcStringSchema = z.string().regex(HLC_PATTERN);
export type HlcString = z.infer<typeof HlcStringSchema>;

export class ClockDriftError extends Error {
  constructor(
    readonly remoteWall: number,
    readonly localNow: number,
  ) {
    super(`Remote clock is ${remoteWall - localNow} ms ahead of this device`);
    this.name = 'ClockDriftError';
  }
}

export function encodeHlc(hlc: Hlc): HlcString {
  if (!Number.isInteger(hlc.wall) || hlc.wall < 0 || hlc.wall > HLC_MAX_WALL)
    throw new RangeError('HLC wall time out of range');
  if (!Number.isInteger(hlc.counter) || hlc.counter < 0 || hlc.counter > HLC_MAX_COUNTER)
    throw new RangeError('HLC counter out of range');
  if (hlc.node.length === 0) throw new RangeError('HLC node is empty');
  return `${String(hlc.wall).padStart(15, '0')}-${hlc.counter.toString(16).padStart(5, '0')}-${hlc.node}`;
}

export function decodeHlc(text: string): Hlc {
  const match = HLC_PATTERN.exec(text);
  if (!match) throw new SyntaxError(`Not an HLC stamp: ${text}`);
  return { wall: Number(match[1]), counter: parseInt(match[2] as string, 16), node: match[3] as string };
}

/** Total order: negative if a is older than b, positive if newer, 0 only for identical stamps. */
export function compareHlc(a: Hlc | HlcString, b: Hlc | HlcString): number {
  const left = typeof a === 'string' ? a : encodeHlc(a);
  const right = typeof b === 'string' ? b : encodeHlc(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export const initialHlc = (node: string): Hlc => ({ wall: 0, counter: 0, node });

/** Stamp for a local event (an edit made on this device). */
export function tickHlc(local: Hlc, now: number): Hlc {
  const wall = Math.max(local.wall, now);
  const counter = wall === local.wall ? local.counter + 1 : 0;
  if (counter > HLC_MAX_COUNTER) throw new RangeError('HLC counter overflow');
  return { wall, counter, node: local.node };
}

/** New local clock after seeing a stamp from another device. Refuses stamps from a clock far in the future. */
export function receiveHlc(local: Hlc, remote: Hlc, now: number, maxDrift = DEFAULT_MAX_DRIFT_MS): Hlc {
  if (remote.wall - now > maxDrift) throw new ClockDriftError(remote.wall, now);
  const wall = Math.max(local.wall, remote.wall, now);
  let counter: number;
  if (wall === local.wall && wall === remote.wall) counter = Math.max(local.counter, remote.counter) + 1;
  else if (wall === local.wall) counter = local.counter + 1;
  else if (wall === remote.wall) counter = remote.counter + 1;
  else counter = 0;
  if (counter > HLC_MAX_COUNTER) throw new RangeError('HLC counter overflow');
  return { wall, counter, node: local.node };
}
