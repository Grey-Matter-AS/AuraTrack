import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { digests } from '@auratrack/sync';
import { Hub, HubError, LIMITS } from './hub';

const dirs: string[] = [];
const hubs: Hub[] = [];
afterEach(() => {
  for (const h of hubs.splice(0)) h.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function newHub(now = () => 1_000_000) {
  const dir = mkdtempSync(join(tmpdir(), 'hub-'));
  dirs.push(dir);
  const hub = new Hub(join(dir, 'hub.db'), { now, backupDir: join(dir, 'backups'), keepBackups: 2 });
  hubs.push(hub);
  return { hub, dir };
}
const stamp = (day: number, n = 0) => `${String(day * 86_400_000 + n).padStart(15, '0')}-00000-dev`;
const entry = (id: string, day: number, scope = 'p1') => ({ id, scope, stamp: stamp(day), sealed: `sealed-${id}` });

function household(hub: Hub) {
  const first = hub.setup({ adminCode: hub.adminCode(), deviceId: 'A', name: 'Kitchen', joinKeyHash: 'hash' });
  return first;
}

describe('setting the hub up', () => {
  it('needs the admin code, and gives the first device a token', () => {
    const { hub } = newHub();
    expect(hub.configured()).toBe(false);
    expect(() => hub.setup({ adminCode: 'WRONG', deviceId: 'A', name: 'x', joinKeyHash: 'h' })).toThrow(HubError);
    const { token } = household(hub);
    expect(hub.configured()).toBe(true);
    expect(hub.auth(token).id).toBe('A');
  });

  it('accepts the admin code in any case and with spaces around it', () => {
    const { hub } = newHub();
    expect(() =>
      hub.setup({ adminCode: ` ${hub.adminCode().toLowerCase()} `, deviceId: 'A', name: 'x', joinKeyHash: 'h' }),
    ).not.toThrow();
  });

  it('keeps the same admin code across restarts', () => {
    const { hub, dir } = newHub();
    const code = hub.adminCode();
    hub.close();
    hubs.splice(0);
    const again = new Hub(join(dir, 'hub.db'));
    hubs.push(again);
    expect(again.adminCode()).toBe(code);
  });
});

describe('devices joining the hub', () => {
  it('a device with the join key enrols itself; one without it cannot', async () => {
    const { hub } = newHub();
    const { createHash } = await import('node:crypto');
    hub.setup({
      adminCode: hub.adminCode(),
      deviceId: 'A',
      name: 'Kitchen',
      joinKeyHash: createHash('sha256').update('secret-key').digest('hex'),
    });
    const { token } = hub.enrol({ deviceId: 'B', name: 'Mum', joinKey: 'secret-key' });
    expect(hub.auth(token).name).toBe('Mum');
    expect(() => hub.enrol({ deviceId: 'C', name: 'x', joinKey: 'guess' })).toThrow(/wrong_join_key/);
  });

  it('cannot enrol before the hub is set up', () => {
    const { hub } = newHub();
    expect(() => hub.enrol({ deviceId: 'B', name: 'x', joinKey: 'k' })).toThrow(/not_configured/);
  });

  it('a removed device is cut off at once and cannot enrol again, also after the join key changes', async () => {
    const { hub } = newHub();
    const { createHash } = await import('node:crypto');
    const h = (k: string) => createHash('sha256').update(k).digest('hex');
    const a = hub.setup({ adminCode: hub.adminCode(), deviceId: 'A', name: 'A', joinKeyHash: h('k1') });
    const b = hub.enrol({ deviceId: 'B', name: 'B', joinKey: 'k1' });
    expect(hub.revoke(hub.auth(a.token), { deviceId: 'B' }).revoked).toBe(true);
    expect(() => hub.auth(b.token)).toThrow(/unauthorised/);
    expect(() => hub.enrol({ deviceId: 'B', name: 'B', joinKey: 'k1' })).toThrow(/revoked/);
    hub.rotateJoinKey(hub.auth(a.token), { joinKeyHash: h('k2') });
    expect(() => hub.enrol({ deviceId: 'D', name: 'D', joinKey: 'k1' })).toThrow(/wrong_join_key/);
    expect(hub.enrol({ deviceId: 'E', name: 'E', joinKey: 'k2' }).token).toBeTruthy();
  });

  it('a device cannot remove itself, and a wrong token is the same answer as none', () => {
    const { hub } = newHub();
    const { token } = household(hub);
    expect(() => hub.revoke(hub.auth(token), { deviceId: 'A' })).toThrow(/not_yourself/);
    expect(() => hub.auth('nope')).toThrow(/unauthorised/);
    expect(() => hub.auth(null)).toThrow(/unauthorised/);
  });

  it('only keeps a hash of the token', () => {
    const { hub } = newHub();
    const { token } = household(hub);
    expect(JSON.stringify(hub.db.devices())).not.toContain(token);
  });
});

describe('sealed entries', () => {
  it('stores them once, hands them back, and says what differs by day', async () => {
    const { hub } = newHub();
    const device = hub.auth(household(hub).token);
    expect(hub.put(device, { entries: [entry('e1', 10), entry('e2', 10), entry('e3', 11)] })).toEqual({
      stored: 3,
      duplicates: 0,
    });
    expect(hub.put(device, { entries: [entry('e1', 10)] })).toEqual({ stored: 0, duplicates: 1 });
    expect(hub.get({ ids: ['e1', 'e3', 'missing'] }).entries.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(hub.ids({ scope: 'p1', days: ['10', '11', '12'] })).toEqual({ '10': ['e1', 'e2'], '11': ['e3'], '12': [] });
    // the same digest a device makes, so the comparison works
    const mine = await digests([
      { id: 'e1', stamp: stamp(10) },
      { id: 'e2', stamp: stamp(10) },
      { id: 'e3', stamp: stamp(11) },
    ]);
    expect((await hub.summary({ scopes: ['p1'] })).p1).toEqual(mine);
    expect((await hub.summary({ scopes: ['other'] })).other).toEqual({});
  });

  it('never changes an entry once stored', () => {
    const { hub } = newHub();
    const device = hub.auth(household(hub).token);
    hub.put(device, { entries: [entry('e1', 10)] });
    hub.put(device, { entries: [{ ...entry('e1', 10), sealed: 'changed' }] });
    expect(hub.get({ ids: ['e1'] }).entries[0]?.sealed).toBe('sealed-e1');
  });

  it('refuses what is too big, badly formed or too many', () => {
    const { hub } = newHub();
    const device = hub.auth(household(hub).token);
    expect(() =>
      hub.put(device, { entries: [{ ...entry('e1', 1), sealed: 'x'.repeat(LIMITS.sealedChars + 1) }] }),
    ).toThrow(/bad_sealed/);
    expect(() => hub.put(device, { entries: [{ ...entry('e1', 1), stamp: 'yesterday' }] })).toThrow(/bad_stamp/);
    expect(() =>
      hub.put(device, { entries: Array.from({ length: LIMITS.entriesPerPut + 1 }, (_, i) => entry(`x${i}`, 1)) }),
    ).toThrow(/bad_entries/);
    expect(() => hub.put(device, { entries: 'no' })).toThrow(/bad_entries/);
    expect(() => hub.get({ ids: Array.from({ length: LIMITS.idsPerGet + 1 }, (_, i) => `i${i}`) })).toThrow(/bad_ids/);
    expect(hub.db.countEntries()).toBe(0);
  });

  it('tells listeners what arrived, and from whom', () => {
    const { hub } = newHub();
    const device = hub.auth(household(hub).token);
    const seen: unknown[] = [];
    const stop = hub.onNew((e) => seen.push(e));
    hub.put(device, { entries: [entry('e1', 1), entry('e2', 1), entry('e3', 2, 'p2')] });
    stop();
    hub.put(device, { entries: [entry('e4', 1)] });
    expect(seen).toEqual([
      { t: 'new', scope: 'p1', from: 'A', count: 2 },
      { t: 'new', scope: 'p2', from: 'A', count: 1 },
    ]);
  });

  it('holds nothing readable: only ids, scopes, stamps and the sealed text', () => {
    const { hub } = newHub();
    const device = hub.auth(household(hub).token);
    hub.put(device, { entries: [entry('e1', 10)] });
    const row = hub.db.entries(['e1'])[0];
    expect(Object.keys(row ?? {}).sort()).toEqual(['day', 'id', 'scope', 'sealed', 'stamp']);
  });
});

describe('the sealed state of each device', () => {
  it('keeps the latest per device, and drops it when the device is removed', () => {
    const { hub } = newHub();
    const a = hub.auth(household(hub).token);
    hub.putState(a, { sealed: 'one' });
    hub.putState(a, { sealed: 'two' });
    expect(hub.states().map((s) => s.sealed)).toEqual(['two']);
    hub.db.addDevice({ id: 'B', name: 'B', tokenHash: 'th', addedAt: 1 });
    hub.db.putState('B', 1, 'b-state');
    hub.revoke(a, { deviceId: 'B' });
    expect(hub.states().map((s) => s.deviceId)).toEqual(['A']);
  });
});

describe('daily copies', () => {
  it('copies the database into the backup folder by day and keeps only the newest', async () => {
    let t = Date.UTC(2026, 10, 1, 12);
    const { hub, dir } = newHub(() => t);
    const device = hub.auth(household(hub).token);
    hub.put(device, { entries: [entry('e1', 10)] });
    for (let i = 0; i < 4; i++) {
      await hub.backupNow();
      t += 86_400_000;
    }
    const files = readdirSync(join(dir, 'backups')).sort();
    expect(files).toHaveLength(2);
    expect(files[1]).toMatch(/2026-11-04/);
    expect(hub.status('x').lastBackupAt).not.toBeNull();
    // a copy opens and holds the entry
    const { DatabaseSync } = await import('node:sqlite');
    const copy = new DatabaseSync(join(dir, 'backups', files[1] as string));
    expect((copy.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number }).n).toBe(1);
    copy.close();
  });

  it('does nothing without a backup folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-'));
    dirs.push(dir);
    const hub = new Hub(join(dir, 'hub.db'), { backupDir: null });
    hubs.push(hub);
    expect(await hub.backupNow()).toBeNull();
  });
});

describe('mail sealed to one device', () => {
  const withJoinKey = () => {
    const { hub } = newHub();
    // the join key hash used by household(): enrol needs the key whose hash is 'hash'
    hub.db.setMeta('joinKeyHash', createHash('sha256').update('jk').digest('hex'));
    return hub;
  };

  it('is handed only to the device it is for, and gone once that device says it has it', () => {
    const hub = withJoinKey();
    const a = hub.auth(
      hub.setup({
        adminCode: hub.adminCode(),
        deviceId: 'A',
        name: 'A',
        joinKeyHash: createHash('sha256').update('jk').digest('hex'),
      }).token,
    );
    const b = hub.auth(hub.enrol({ deviceId: 'B', name: 'B', joinKey: 'jk' }).token);
    const c = hub.auth(hub.enrol({ deviceId: 'C', name: 'C', joinKey: 'jk' }).token);
    hub.mailPut(a, { to: 'B', sealed: 'for-b' });
    expect(hub.inbox(b).mail.map((m) => [m.from, m.sealed])).toEqual([['A', 'for-b']]);
    expect(hub.inbox(c).mail).toEqual([]);
    expect(hub.inbox(a).mail).toEqual([]);
    const id = hub.inbox(b).mail[0]?.id as number;
    expect(hub.ack(c, { ids: [id] })).toEqual({ removed: 0 }); // C cannot take B's mail
    expect(hub.ack(b, { ids: [id] })).toEqual({ removed: 1 });
    expect(hub.inbox(b).mail).toEqual([]);
  });

  it('refuses mail to oneself, to a removed device, that is too big or too much, and badly formed acks', () => {
    const hub = withJoinKey();
    const a = hub.auth(
      hub.setup({
        adminCode: hub.adminCode(),
        deviceId: 'A',
        name: 'A',
        joinKeyHash: createHash('sha256').update('jk').digest('hex'),
      }).token,
    );
    hub.enrol({ deviceId: 'B', name: 'B', joinKey: 'jk' });
    expect(() => hub.mailPut(a, { to: 'A', sealed: 'x' })).toThrow(/not_yourself/);
    expect(() => hub.mailPut(a, { to: 'B', sealed: 'x'.repeat(LIMITS.mailChars + 1) })).toThrow(/bad_sealed/);
    for (let i = 0; i < LIMITS.mailPerDevice; i++) hub.mailPut(a, { to: 'B', sealed: `m${i}` });
    expect(() => hub.mailPut(a, { to: 'B', sealed: 'one more' })).toThrow(/mailbox_full/);
    expect(() => hub.ack(a, { ids: ['a'] })).toThrow(/bad_ids/);
    hub.revoke(a, { deviceId: 'B' });
    expect(hub.db.countMail('B')).toBe(0); // a removed device's mail is dropped with it
    expect(() => hub.mailPut(a, { to: 'B', sealed: 'x' })).toThrow(/revoked/);
  });
});
