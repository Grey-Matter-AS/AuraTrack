import { addDevice, updateDevice, type HouseholdState } from './membership';
import type { Channel } from './session';
import { openJson, randomBytes, randomId, sealJson, sha256Hex, toB64, type KeyEntry } from './seal';

// Adding a device. The inviting device shows a one-time code (as a QR and as text). The new device uses it to find the
// inviter and to seal everything it says. Both then show the same six digits, and a person on each confirms they match,
// so a code seen over a shoulder is not enough. Only after both confirm does the household's state travel across.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1 or I, which are easy to mix up
export const INVITE_MINUTES = 5;
export const INVITE_PREFIX = 'auratrack:join:';

export interface Invite {
  /** Shown to a person: 16 letters and digits in groups of four. */
  code: string;
  secret: Uint8Array;
  expiresAt: number;
}

function secretToCode(secret: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of secret) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{1,4}/g)?.join('-') ?? out;
}

export function newInvite(now: number): Invite {
  const secret = randomBytes(10);
  return { code: secretToCode(secret), secret, expiresAt: now + INVITE_MINUTES * 60_000 };
}

/** Reads a typed code, or the text of a scanned QR. Null if it is not an invite. */
export function parseInvite(text: string): Uint8Array | null {
  const body = text.trim().startsWith(INVITE_PREFIX) ? text.trim().slice(INVITE_PREFIX.length) : text;
  const clean = body.toUpperCase().replace(/[\s-]/g, '');
  if (clean.length !== 16 || ![...clean].every((c) => ALPHABET.includes(c))) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return out.length === 10 ? new Uint8Array(out) : null;
}

export const inviteQrText = (invite: Invite): string => `${INVITE_PREFIX}${invite.code}`;

/** The name the inviter listens under on the signalling broker: it says nothing about the household. */
export async function inviteListenerId(secret: Uint8Array): Promise<string> {
  return `at-join-${(await sha256Hex(`listener:${toB64(secret)}`)).slice(0, 32)}`;
}

async function pairingKey(secret: Uint8Array): Promise<KeyEntry> {
  const base = await crypto.subtle.importKey('raw', new Uint8Array(secret), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('auratrack-pairing'),
      info: new TextEncoder().encode('v1'),
    },
    base,
    256,
  );
  return { id: 'pair', raw: toB64(new Uint8Array(bits)), createdAt: 0 };
}

async function confirmCode(secret: Uint8Array, joinerNonce: string, inviterNonce: string): Promise<string> {
  const hex = await sha256Hex(`${toB64(secret)}|${joinerNonce}|${inviterNonce}`);
  return String(Number(BigInt(`0x${hex.slice(0, 12)}`) % 1_000_000n)).padStart(6, '0');
}

export type PairOutcome = 'joined' | 'refused' | 'declined' | 'expired' | 'error';
export interface PairResult {
  outcome: PairOutcome;
  reason?: string;
}
export interface JoinResult extends PairResult {
  state?: HouseholdState;
}

type Inbox = {
  next(type: string, ms: number): Promise<Record<string, unknown>>;
  send(message: Record<string, unknown>): void;
};
function inbox(channel: Channel): Inbox {
  const queue: Record<string, unknown>[] = [];
  let waiter: ((m: Record<string, unknown>) => void) | null = null;
  let want = '';
  let closed = false;
  let fail: ((e: Error) => void) | null = null;
  const settle = () => {
    if (!waiter) return;
    const i = queue.findIndex((m) => m.t === want || m.t === 'no');
    if (i === -1) return;
    const [m] = queue.splice(i, 1) as [Record<string, unknown>];
    const w = waiter;
    waiter = null;
    w(m);
  };
  channel.onMessage((text) => {
    try {
      const m: unknown = JSON.parse(text);
      if (typeof m === 'object' && m !== null && typeof (m as { t?: unknown }).t === 'string')
        queue.push(m as Record<string, unknown>);
    } catch {
      return;
    }
    settle();
  });
  channel.onClose(() => {
    closed = true;
    fail?.(new Error('the connection closed'));
  });
  return {
    send: (m) => {
      if (closed) throw new Error('the connection closed');
      channel.send(JSON.stringify(m));
    },
    next: (type, ms) =>
      new Promise((resolve, reject) => {
        want = type;
        const timer = setTimeout(() => reject(new Error(`no answer to ${type}`)), ms);
        fail = (e) => {
          clearTimeout(timer);
          reject(e);
        };
        if (closed && !queue.some((m) => m.t === type || m.t === 'no')) return fail(new Error('the connection closed'));
        waiter = (m) => {
          clearTimeout(timer);
          resolve(m);
        };
        settle();
      }),
  };
}

export interface InviterArgs {
  secret: Uint8Array;
  expiresAt: number;
  state: HouseholdState;
  inviterId: string;
  /** The patients the new device will follow: all of them (also later ones), or only these. */
  follows?: 'all' | readonly string[];
  now: () => number;
  /** Shows the six digits and asks a person here whether they match. */
  confirm(code: string, deviceName: string): Promise<boolean>;
  /** Called with the state that now lists the new device, before the household's keys are sent. */
  save(state: HouseholdState): Promise<void>;
  timeoutMs?: number;
}

export async function runInviter(channel: Channel, args: InviterArgs): Promise<PairResult> {
  const io = inbox(channel);
  const wait = args.timeoutMs ?? 120_000;
  try {
    const key = await pairingKey(args.secret);
    const joinMsg = await io.next('join', wait);
    if (args.now() > args.expiresAt) {
      io.send({ t: 'no', reason: 'expired' });
      return { outcome: 'expired' };
    }
    let join: unknown;
    try {
      join = await openJson([key], String(joinMsg.p), 'join');
    } catch {
      io.send({ t: 'no', reason: 'refused' });
      return { outcome: 'refused', reason: 'wrong code' };
    }
    const j = join as { deviceId?: unknown; deviceName?: unknown; nonce?: unknown };
    if (
      typeof j.deviceId !== 'string' ||
      typeof j.deviceName !== 'string' ||
      typeof j.nonce !== 'string' ||
      j.deviceId === '' ||
      j.deviceName.length > 80
    ) {
      io.send({ t: 'no', reason: 'refused' });
      return { outcome: 'refused', reason: 'not a valid request' };
    }
    if (args.state.membership.devices[j.deviceId]) {
      io.send({ t: 'no', reason: 'refused' });
      return { outcome: 'refused', reason: 'already a device here' };
    }
    const mine = randomId();
    const code = await confirmCode(args.secret, j.nonce, mine);
    io.send({ t: 'offer', p: await sealJson(key, { nonce: mine }, 'offer') });
    const ok = await args.confirm(code, j.deviceName);
    if (!ok) {
      io.send({ t: 'no', reason: 'declined' });
      return { outcome: 'declined' };
    }
    const confirmed = await io.next('confirmed', wait);
    const answer = (await openJson([key], String(confirmed.p), 'confirmed')) as { code?: unknown };
    if (answer.code !== code) {
      io.send({ t: 'no', reason: 'declined' });
      return { outcome: 'declined', reason: 'the codes did not match' };
    }
    let next = addDevice(args.state, {
      deviceId: j.deviceId,
      name: j.deviceName.trim() || 'Device',
      addedBy: args.inviterId,
      now: args.now(),
    });
    const chosen = args.follows ?? 'all';
    next = updateDevice(
      next,
      j.deviceId,
      chosen === 'all' ? { followAll: true } : { followAll: false, follows: chosen },
      args.now(),
    );
    // The new device is given the keys of the patients it follows, and no others
    const given =
      chosen === 'all' ? Object.keys(next.keyring.patients) : chosen.filter((id) => id in next.keyring.patients);
    const keyring = {
      ...next.keyring,
      patients: Object.fromEntries(given.map((id) => [id, next.keyring.patients[id] ?? []])),
    };
    await args.save(next);
    io.send({
      t: 'welcome',
      p: await sealJson(key, { membership: next.membership, keyring }, 'welcome'),
    });
    return { outcome: 'joined' };
  } catch (error) {
    return { outcome: 'error', reason: error instanceof Error ? error.message : 'unknown' };
  } finally {
    channel.close();
  }
}

export interface JoinerArgs {
  secret: Uint8Array;
  deviceId: string;
  deviceName: string;
  confirm(code: string): Promise<boolean>;
  now: () => number;
  timeoutMs?: number;
}

export async function runJoiner(channel: Channel, args: JoinerArgs): Promise<JoinResult> {
  const io = inbox(channel);
  const wait = args.timeoutMs ?? 120_000;
  try {
    const key = await pairingKey(args.secret);
    const nonce = randomId();
    io.send({
      t: 'join',
      p: await sealJson(key, { deviceId: args.deviceId, deviceName: args.deviceName, nonce }, 'join'),
    });
    const offer = await io.next('offer', wait);
    if (offer.t === 'no')
      return { outcome: offer.reason === 'expired' ? 'expired' : 'refused', reason: String(offer.reason) };
    const inviterNonce = ((await openJson([key], String(offer.p), 'offer')) as { nonce?: unknown }).nonce;
    if (typeof inviterNonce !== 'string') return { outcome: 'refused', reason: 'not a valid answer' };
    const code = await confirmCode(args.secret, nonce, inviterNonce);
    if (!(await args.confirm(code))) {
      io.send({ t: 'no', reason: 'declined' });
      return { outcome: 'declined' };
    }
    io.send({ t: 'confirmed', p: await sealJson(key, { code }, 'confirmed') });
    const welcome = await io.next('welcome', wait);
    if (welcome.t === 'no') return { outcome: 'declined', reason: String(welcome.reason) };
    const body = (await openJson([key], String(welcome.p), 'welcome')) as Pick<
      HouseholdState,
      'membership' | 'keyring'
    >;
    if (
      !body.membership?.householdId ||
      !body.membership.devices?.[args.deviceId] ||
      !Array.isArray(body.keyring?.household)
    )
      return { outcome: 'refused', reason: 'not a valid welcome' };
    return { outcome: 'joined', state: { membership: body.membership, keyring: body.keyring, lastMet: {} } };
  } catch (error) {
    return { outcome: 'error', reason: error instanceof Error ? error.message : 'unknown' };
  } finally {
    channel.close();
  }
}
