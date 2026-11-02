import { DatabaseSync } from 'node:sqlite';

// The hub's storage: one SQLite file. It holds sealed bytes it cannot open, and the little it needs to run (device tokens as
// hashes, the sealed state of each device). Entry ids, scope ids and stamps are in the clear because the hub compares days.

export interface EntryRow {
  id: string;
  scope: string;
  stamp: string;
  day: string;
  sealed: string;
}
export interface DeviceRow {
  id: string;
  name: string;
  tokenHash: string;
  addedAt: number;
  lastSeen: number | null;
  revokedAt: number | null;
}

export class HubDb {
  readonly sql: DatabaseSync;
  constructor(path: string) {
    this.sql = new DatabaseSync(path);
    this.sql.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, tokenHash TEXT NOT NULL UNIQUE,
        addedAt INTEGER NOT NULL, lastSeen INTEGER, revokedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY, scope TEXT NOT NULL, stamp TEXT NOT NULL, day TEXT NOT NULL, sealed TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS entries_scope_day ON entries (scope, day);
      CREATE TABLE IF NOT EXISTS mailbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, toDevice TEXT NOT NULL, fromDevice TEXT NOT NULL, at INTEGER NOT NULL, sealed TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS mailbox_to ON mailbox (toDevice);
      CREATE TABLE IF NOT EXISTS push_subs (
        deviceId TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, prefs TEXT NOT NULL, at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS states (deviceId TEXT PRIMARY KEY, at INTEGER NOT NULL, sealed TEXT NOT NULL);
    `);
  }

  close(): void {
    this.sql.close();
  }

  getMeta(key: string): string | null {
    const row = this.sql.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
  setMeta(key: string, value: string): void {
    this.sql
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  addDevice(d: Omit<DeviceRow, 'lastSeen' | 'revokedAt'>): void {
    this.sql
      .prepare(
        'INSERT INTO devices (id, name, tokenHash, addedAt) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, tokenHash = excluded.tokenHash, revokedAt = NULL',
      )
      .run(d.id, d.name, d.tokenHash, d.addedAt);
  }
  deviceByToken(tokenHash: string): DeviceRow | null {
    return (
      (this.sql.prepare('SELECT * FROM devices WHERE tokenHash = ?').get(tokenHash) as DeviceRow | undefined) ?? null
    );
  }
  device(id: string): DeviceRow | null {
    return (this.sql.prepare('SELECT * FROM devices WHERE id = ?').get(id) as DeviceRow | undefined) ?? null;
  }
  devices(): DeviceRow[] {
    return this.sql.prepare('SELECT * FROM devices ORDER BY addedAt, id').all() as unknown as DeviceRow[];
  }
  touch(id: string, at: number): void {
    this.sql.prepare('UPDATE devices SET lastSeen = ? WHERE id = ?').run(at, id);
  }
  revoke(id: string, at: number): boolean {
    const r = this.sql.prepare('UPDATE devices SET revokedAt = ? WHERE id = ? AND revokedAt IS NULL').run(at, id);
    return Number(r.changes) > 0;
  }

  /** Stores an entry; false if the id was already there (entries never change once stored). */
  putEntry(e: EntryRow): boolean {
    const r = this.sql
      .prepare('INSERT OR IGNORE INTO entries (id, scope, stamp, day, sealed) VALUES (?, ?, ?, ?, ?)')
      .run(e.id, e.scope, e.stamp, e.day, e.sealed);
    return Number(r.changes) > 0;
  }
  entries(ids: readonly string[]): EntryRow[] {
    const out: EntryRow[] = [];
    const stmt = this.sql.prepare('SELECT * FROM entries WHERE id = ?');
    for (const id of ids) {
      const row = stmt.get(id) as EntryRow | undefined;
      if (row) out.push(row);
    }
    return out;
  }
  idsOnDay(scope: string, day: string): string[] {
    return (
      this.sql.prepare('SELECT id FROM entries WHERE scope = ? AND day = ? ORDER BY id').all(scope, day) as {
        id: string;
      }[]
    ).map((r) => r.id);
  }
  daysOf(scope: string): string[] {
    return (this.sql.prepare('SELECT DISTINCT day FROM entries WHERE scope = ?').all(scope) as { day: string }[]).map(
      (r) => r.day,
    );
  }
  countEntries(): number {
    return Number((this.sql.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number | bigint }).n);
  }
  bytesStored(): number {
    return Number(
      (this.sql.prepare('SELECT COALESCE(SUM(LENGTH(sealed)), 0) AS n FROM entries').get() as { n: number | bigint }).n,
    );
  }

  putState(deviceId: string, at: number, sealed: string): void {
    this.sql
      .prepare(
        'INSERT INTO states (deviceId, at, sealed) VALUES (?, ?, ?) ON CONFLICT(deviceId) DO UPDATE SET at = excluded.at, sealed = excluded.sealed',
      )
      .run(deviceId, at, sealed);
  }
  states(): { deviceId: string; at: number; sealed: string }[] {
    return this.sql.prepare('SELECT deviceId, at, sealed FROM states ORDER BY at').all() as {
      deviceId: string;
      at: number;
      sealed: string;
    }[];
  }
  dropState(deviceId: string): void {
    this.sql.prepare('DELETE FROM states WHERE deviceId = ?').run(deviceId);
  }

  /** Mail for one device: sealed to that device's own key, so the hub only carries it. */
  putMail(toDevice: string, fromDevice: string, at: number, sealed: string): void {
    this.sql
      .prepare('INSERT INTO mailbox (toDevice, fromDevice, at, sealed) VALUES (?, ?, ?, ?)')
      .run(toDevice, fromDevice, at, sealed);
  }
  countMail(toDevice: string): number {
    return Number(
      (this.sql.prepare('SELECT COUNT(*) AS n FROM mailbox WHERE toDevice = ?').get(toDevice) as { n: number | bigint })
        .n,
    );
  }
  mailFor(toDevice: string): { id: number; from: string; at: number; sealed: string }[] {
    return this.sql
      .prepare('SELECT id, fromDevice AS "from", at, sealed FROM mailbox WHERE toDevice = ? ORDER BY id')
      .all(toDevice) as { id: number; from: string; at: number; sealed: string }[];
  }
  dropMail(toDevice: string, ids: readonly number[]): number {
    const stmt = this.sql.prepare('DELETE FROM mailbox WHERE toDevice = ? AND id = ?');
    let n = 0;
    for (const id of ids) n += Number(stmt.run(toDevice, id).changes);
    return n;
  }
  dropMailOf(device: string): void {
    this.sql.prepare('DELETE FROM mailbox WHERE toDevice = ? OR fromDevice = ?').run(device, device);
  }

  putPush(deviceId: string, endpoint: string, p256dh: string, auth: string, prefs: string, at: number): void {
    this.sql
      .prepare(
        'INSERT INTO push_subs (deviceId, endpoint, p256dh, auth, prefs, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(deviceId) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs, at = excluded.at',
      )
      .run(deviceId, endpoint, p256dh, auth, prefs, at);
  }
  dropPush(deviceId: string): void {
    this.sql.prepare('DELETE FROM push_subs WHERE deviceId = ?').run(deviceId);
  }
  pushes(): { deviceId: string; endpoint: string; p256dh: string; auth: string; prefs: string }[] {
    return this.sql
      .prepare('SELECT deviceId, endpoint, p256dh, auth, prefs FROM push_subs ORDER BY deviceId')
      .all() as never;
  }
}
