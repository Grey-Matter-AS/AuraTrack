// Puts everything a household needs for the hub in one folder: dist/package/auratrack-hub-<version>/
//   hub.mjs, tray.mjs, the start-on-boot scripts, a short README, and (if apps/web/dist exists) the app itself in app/, so
//   the hub can serve the app from its own address (HUB_APP=app). Run after `pnpm build`.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const out = join('dist', 'package', `auratrack-hub-${version}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist/hub.mjs', join(out, 'hub.mjs'));
if (existsSync('../tray/dist/tray.mjs')) cpSync('../tray/dist/tray.mjs', join(out, 'tray.mjs'));
cpSync('scripts/boot', join(out, 'boot'), { recursive: true });
if (existsSync('../web/dist')) cpSync('../web/dist', join(out, 'app'), { recursive: true });
writeFileSync(
  join(out, 'README.txt'),
  `AuraTrack Hub ${version}

What it is: a program for a household computer (or a Raspberry Pi or NAS) that stays on. It keeps the household's records in sync
while phones are closed. It holds only sealed data and cannot read it. It is never put on a public website.

Start it:      node hub.mjs        (needs Node 24 or newer)
Status page:   http://localhost:8420/status   (this computer only: it shows the setup code)
Start with the computer: run the script for your system in boot/
Tray icon:     node tray.mjs       (see boot/tray.md)
Settings (environment): HUB_PORT (8420), HUB_DATA (database folder), HUB_BACKUPS (daily copies), HUB_CERT and HUB_KEY (https),
                        HUB_APP (a folder with the app to serve; the folder app/ here)

Phones and the app only talk to an https address: use Tailscale (tailscale cert <name>.ts.net) or a certificate of your own that
each phone trusts. The status page explains both.
`,
);
console.log(`packaged ${out}`);
