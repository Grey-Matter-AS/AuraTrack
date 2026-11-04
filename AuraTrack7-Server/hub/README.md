# AuraTrack Hub

A program for a household computer (or a Raspberry Pi or NAS) that stays on. It keeps the household's records in step while phones are
closed, makes a daily backup, and helps devices find each other. **It only ever holds sealed data and has no key to read it.** It is never
put on a public website.

Without a hub everything still works: devices update each other when two of them are open at the same time (see `docs/plan/M6-signoff.md`).

## Run it

- `pnpm build` (builds the app and `AuraTrack7-Server/hub/dist/hub.mjs`), then `node AuraTrack7-Server/hub/dist/hub.mjs` (Node 24 or newer), or `pnpm hub`.
- Open `http://localhost:8420/status` on that computer: it shows the setup code, the devices, what the hub holds and how to reach it.
- In the app: More, Household, Hub, Connect a hub: the hub's address and the setup code.
- Start with the computer: the script for your system in `scripts/boot/` (systemd user service, launchd agent, Windows scheduled task).
- Tray icon: `AuraTrack7-Server/tray` (a coloured dot, a few facts, a shortcut to the status page). The status page always works without it.
- One folder to hand out: `pnpm --filter @auratrack/server package`. A single executable (no Node needed): `pnpm --filter @auratrack/server sea`
  (built for the system it runs on; `.github/workflows/hub-release.yml` builds all three). Docker: `AuraTrack7-Server/hub/Dockerfile`.

## Settings (environment)

`HUB_PORT` (8420), `HUB_DATA` (folder for the database, default `~/.auratrack-hub`), `HUB_BACKUPS` (daily copies, 14 kept),
`HUB_CERT` and `HUB_KEY` (https), `HUB_APP` (a folder with the built app to serve at `/`, so the household can open the app from the hub).

## Reaching it from phones: https

Browsers only let an app talk to an **https** address. You choose how:

- **Tailscale** (works at home and away; needs a free account): install Tailscale here and on each phone, run `tailscale cert <machine>.ts.net`,
  start the hub with that certificate and key. Address: `https://<machine>.ts.net:8420`.
- **Home Wi-Fi only** (no account, only at home): make a certificate for this computer's name with `openssl`, start the hub with it and
  install the certificate on each phone so it is trusted.
  **Open the app from the hub's own address** (set `HUB_APP` to the `app/` folder of the package, or use the Docker image, which does). The app on its
  usual address (for example on Vercel) is not allowed by its Content Security Policy to call a hub: that was kept strict on purpose, so nothing
  in the page can send data to an address we do not control. The cost is that the hub computer serves the app's code, so it must be a
  computer you fully trust and keep up to date, and that a different address is a different browser storage (decide before you start, or
  move records with backup and restore). Why: `docs/decisions/m7-hub-reach-csp-keys.md`.

## What it holds

Sealed entries (random ids, the id of the person, a time stamp, sealed text), a sealed note from each device about the household's device
list and keys, and a hash of each device's token. Never a key, a name, a note or any field of a record.
