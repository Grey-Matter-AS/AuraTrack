import { describe, expect, it } from 'vitest';
import { createHousehold, isActive } from './membership';
import { memoryPipe } from './memory';
import { inviteQrText, newInvite, parseInvite, runInviter, runJoiner, type InviterArgs } from './pairing';
import { runSession } from './session';
import { TestNode } from './testNode';

const state = () =>
  createHousehold({
    householdId: 'h',
    name: 'Home',
    deviceId: 'A',
    deviceName: 'Kitchen',
    patientIds: ['p1'],
    now: 1000,
  });

function setup(
  opts: { joinerConfirm?: boolean; inviterConfirm?: boolean; expiredBy?: number; wrongSecret?: boolean } = {},
) {
  const invite = newInvite(10_000);
  let saved = state();
  const shown: string[] = [];
  const [x, y] = memoryPipe();
  const inviterArgs: InviterArgs = {
    secret: invite.secret,
    expiresAt: invite.expiresAt,
    state: saved,
    inviterId: 'A',
    now: () => 10_000 + (opts.expiredBy ?? 0),
    confirm: async (code) => {
      shown.push(code);
      return opts.inviterConfirm ?? true;
    },
    save: async (s) => {
      saved = s;
    },
    timeoutMs: 500,
  };
  const inviter = runInviter(x, inviterArgs);
  const joiner = runJoiner(y, {
    secret: opts.wrongSecret ? newInvite(0).secret : invite.secret,
    deviceId: 'B',
    deviceName: 'Phone',
    now: () => 10_000,
    confirm: async (code) => {
      shown.push(code);
      return opts.joinerConfirm ?? true;
    },
    timeoutMs: 500,
  });
  return { inviter, joiner, shown, saved: () => saved };
}

describe('invite codes', () => {
  it('make a code of sixteen letters and digits that reads back, typed or scanned', () => {
    const invite = newInvite(0);
    expect(invite.code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(parseInvite(invite.code)).toEqual(invite.secret);
    expect(parseInvite(invite.code.toLowerCase().replaceAll('-', ' '))).toEqual(invite.secret);
    expect(parseInvite(inviteQrText(invite))).toEqual(invite.secret);
  });
  it('refuse anything else', () => {
    for (const bad of ['', 'hello', 'AAAA-AAAA-AAAA', 'AAAA-AAAA-AAAA-AAA0', 'auratrack:join:short'])
      expect(parseInvite(bad)).toBeNull();
  });
  it('are different each time', () => {
    expect(newInvite(0).code).not.toBe(newInvite(0).code);
  });
});

describe('adding a device', () => {
  it('shows the same six digits on both, and then the new device holds the household', async () => {
    const run = setup();
    const [inviter, joiner] = await Promise.all([run.inviter, run.joiner]);
    expect(inviter.outcome).toBe('joined');
    expect(joiner.outcome).toBe('joined');
    expect(run.shown[0]).toMatch(/^\d{6}$/);
    expect(run.shown[0]).toBe(run.shown[1]);
    expect(isActive(run.saved().membership, 'B')).toBe(true);
    expect(joiner.state?.membership.devices.B?.followAll).toBe(true);
    expect(joiner.state?.keyring.patients.p1?.length).toBe(1);
    expect(joiner.state?.keyring.household).toEqual(run.saved().keyring.household);
  });

  it('then the new device can meet the first one', async () => {
    const run = setup();
    const [, joiner] = await Promise.all([run.inviter, run.joiner]);
    const a = new TestNode('A', 'h', run.saved());
    const b = new TestNode('B', 'h', joiner.state!);
    a.add('p1', 'r1', '000000000086400-00000-A');
    const [x, y] = memoryPipe();
    const [ra, rb] = await Promise.all([runSession(x, a.context()), runSession(y, b.context())]);
    expect([ra.outcome, rb.outcome]).toEqual(['done', 'done']);
    expect(b.entries.size).toBe(1);
  });

  it('adds nothing if the person on either phone says the digits differ', async () => {
    for (const opts of [{ joinerConfirm: false }, { inviterConfirm: false }]) {
      const run = setup(opts);
      const [inviter, joiner] = await Promise.all([run.inviter, run.joiner]);
      expect([inviter.outcome, joiner.outcome]).toContain('declined');
      expect(isActive(run.saved().membership, 'B')).toBe(false);
      expect(joiner.state).toBeUndefined();
    }
  });

  it('refuses a code that has run out', async () => {
    const run = setup({ expiredBy: 6 * 60_000 });
    const [inviter, joiner] = await Promise.all([run.inviter, run.joiner]);
    expect(inviter.outcome).toBe('expired');
    expect(joiner.outcome).toBe('expired');
    expect(isActive(run.saved().membership, 'B')).toBe(false);
  });

  it('refuses a device that does not know the code', async () => {
    const run = setup({ wrongSecret: true });
    const [inviter, joiner] = await Promise.all([run.inviter, run.joiner]);
    expect(inviter.outcome).toBe('refused');
    expect(joiner.outcome).not.toBe('joined');
    expect(isActive(run.saved().membership, 'B')).toBe(false);
  });
});
