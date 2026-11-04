// What the tray icon shows: a colour, a line of words and a menu, worked out from what the hub says about itself. Pure, so it
// is tested without a desktop. The status page is the thing that always works; the tray is a shortcut to it.

export interface HubStatusJson {
  name: string;
  version: string;
  devices: { id: string; name: string; lastSeen: number | null; revokedAt: number | null }[];
  entries: number;
  bytes: number;
  configured: boolean;
  lastBackupAt: number | null;
  adminCode: string;
  port: number;
  tls: boolean;
}

export type TrayLight = 'ok' | 'waiting' | 'down';
export interface TrayItem {
  id: 'title' | 'code' | 'devices' | 'backup' | 'open' | 'quit';
  title: string;
  enabled: boolean;
}
export interface TrayModel {
  light: TrayLight;
  tooltip: string;
  items: TrayItem[];
}

const DAY = 86_400_000;
export const STALE_BACKUP_MS = 3 * DAY;

export function trayModel(status: HubStatusJson | null, now: number): TrayModel {
  if (!status)
    return {
      light: 'down',
      tooltip: 'AuraTrack Hub is not running',
      items: [
        { id: 'title', title: 'AuraTrack Hub is not running', enabled: false },
        { id: 'open', title: 'Open the status page', enabled: true },
        { id: 'quit', title: 'Quit the tray icon', enabled: true },
      ],
    };
  const active = status.devices.filter((d) => d.revokedAt === null);
  const backupStale = status.lastBackupAt === null || now - status.lastBackupAt > STALE_BACKUP_MS;
  const light: TrayLight = !status.configured ? 'waiting' : backupStale ? 'waiting' : 'ok';
  const title = !status.configured
    ? 'AuraTrack Hub: waiting for a household'
    : `AuraTrack Hub: ${active.length} device${active.length === 1 ? '' : 's'}`;
  const items: TrayItem[] = [{ id: 'title', title, enabled: false }];
  if (!status.configured) items.push({ id: 'code', title: `Setup code: ${status.adminCode}`, enabled: false });
  else items.push({ id: 'devices', title: `${status.entries} sealed entries held`, enabled: false });
  items.push({
    id: 'backup',
    title: status.lastBackupAt ? `Last backup: ${new Date(status.lastBackupAt).toLocaleDateString()}` : 'No backup yet',
    enabled: false,
  });
  items.push(
    { id: 'open', title: 'Open the status page', enabled: true },
    { id: 'quit', title: 'Quit the tray icon', enabled: true },
  );
  return { light, tooltip: title, items };
}
