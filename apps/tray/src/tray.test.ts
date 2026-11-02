import { describe, expect, it } from 'vitest';
import { ico, png, iconFor } from './icons';
import { STALE_BACKUP_MS, trayModel, type HubStatusJson } from './model';

const NOW = 1_800_000_000_000;
const status = (over: Partial<HubStatusJson> = {}): HubStatusJson => ({
  name: 'AuraTrack Hub',
  version: '7.0.6',
  devices: [
    { id: 'a', name: 'Kitchen', lastSeen: NOW, revokedAt: null },
    { id: 'b', name: 'Old', lastSeen: null, revokedAt: NOW },
  ],
  entries: 120,
  bytes: 4096,
  configured: true,
  lastBackupAt: NOW - 3600_000,
  adminCode: 'ABCDE12345',
  port: 8420,
  tls: false,
  ...over,
});

describe('what the tray shows', () => {
  it('green with the count of devices that are not removed, when set up and backed up', () => {
    const m = trayModel(status(), NOW);
    expect(m.light).toBe('ok');
    expect(m.items[0]?.title).toBe('AuraTrack Hub: 1 device');
    expect(m.items.map((i) => i.id)).toEqual(['title', 'devices', 'backup', 'open', 'quit']);
    expect(m.items.filter((i) => i.enabled).map((i) => i.id)).toEqual(['open', 'quit']);
  });

  it('amber with the setup code while there is no household yet', () => {
    const m = trayModel(status({ configured: false, devices: [] }), NOW);
    expect(m.light).toBe('waiting');
    expect(m.items.find((i) => i.id === 'code')?.title).toBe('Setup code: ABCDE12345');
  });

  it('amber when the last backup is old or there never was one', () => {
    expect(trayModel(status({ lastBackupAt: NOW - STALE_BACKUP_MS - 1 }), NOW).light).toBe('waiting');
    const none = trayModel(status({ lastBackupAt: null }), NOW);
    expect(none.light).toBe('waiting');
    expect(none.items.find((i) => i.id === 'backup')?.title).toBe('No backup yet');
  });

  it('red, with a way to the status page and a way out, when the hub does not answer', () => {
    const m = trayModel(null, NOW);
    expect(m.light).toBe('down');
    expect(m.items.map((i) => i.id)).toEqual(['title', 'open', 'quit']);
  });

  it('says "devices" for more than one', () => {
    const m = trayModel(
      status({
        devices: [
          { id: 'a', name: 'A', lastSeen: 1, revokedAt: null },
          { id: 'c', name: 'C', lastSeen: 1, revokedAt: null },
        ],
      }),
      NOW,
    );
    expect(m.items[0]?.title).toBe('AuraTrack Hub: 2 devices');
  });
});

describe('the icons', () => {
  it('are real PNG files, one colour for each light', () => {
    const seen = new Set<string>();
    for (const light of ['ok', 'waiting', 'down'] as const) {
      const p = png(light);
      expect([...p.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(p.subarray(p.length - 8, p.length - 4).toString('ascii')).toBe('IEND');
      seen.add(p.toString('base64'));
    }
    expect(seen.size).toBe(3);
  });

  it('are wrapped as an ICO for Windows and left as PNG elsewhere', () => {
    const i = ico('ok');
    expect(i.readUInt16LE(2)).toBe(1);
    expect(i.readUInt16LE(4)).toBe(1);
    expect(i.subarray(22, 26).toString('hex')).toBe('89504e47');
    expect(iconFor('ok', 'win32')).toBe(i.toString('base64'));
    expect(iconFor('ok', 'linux')).toBe(png('ok').toString('base64'));
  });
});
