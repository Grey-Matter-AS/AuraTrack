import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Hub } from './hub';
import { serve } from './http';

// AuraTrack Hub: `node hub.mjs`. Settings by environment: HUB_PORT (8420), HUB_DATA (folder for the database),
// HUB_BACKUPS (folder for the daily copies), HUB_CERT and HUB_KEY (https), HUB_APP (a folder with the built app to serve).
export const VERSION = '7.0.7';

async function main() {
  const port = Number(process.env.HUB_PORT ?? 8420);
  const data = process.env.HUB_DATA ?? join(homedir(), '.auratrack-hub');
  mkdirSync(data, { recursive: true });
  const backups = process.env.HUB_BACKUPS ?? join(data, 'backups');
  const hub = new Hub(join(data, 'hub.db'), { backupDir: backups });
  const tls =
    process.env.HUB_CERT && process.env.HUB_KEY ? { cert: process.env.HUB_CERT, key: process.env.HUB_KEY } : null;
  const running = await serve(hub, { port, tls, appDir: process.env.HUB_APP ?? null, version: VERSION });
  process.on('SIGHUP', () => console.log(running.reloadTls() ? 'certificate reloaded' : 'no certificate to reload'));
  console.log(`AuraTrack Hub ${VERSION} on port ${running.port}${tls ? ' (https)' : ' (http)'}`);
  console.log(`Status page (this computer only): http://localhost:${running.port}/status`);
  console.log(`Code to set up a household: ${hub.adminCode()}`);
  // A copy of the database once a day (what it holds is sealed already)
  const daily = () => void hub.backupNow().catch((e) => console.error('backup failed', e));
  daily();
  setInterval(daily, 24 * 3_600_000).unref();
  const bye = () =>
    void running.close().then(() => {
      hub.close();
      process.exit(0);
    });
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}

void main();
