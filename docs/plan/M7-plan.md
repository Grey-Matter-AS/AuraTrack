# M7 in detail: the household hub and push alerts (draft for approval)

**Status: draft, written 2026-11-02, not yet approved.** It builds on `M7.md` (requirements) and README section 7. Branch `7.1.0---M7`. You bump the version and commit.

Decided with you: **no Docker needed.** The hub is a plain Node program that starts with the computer, with a **tray icon and a status page**. Docker stays an optional add-on for a Pi or NAS.

## Already in place (M0 to M6)
- Sealed change-log entries and the meeting protocol (`packages/sync`): what two devices exchange is already sealed with the household's keys. The hub can speak the same protocol as "a device that never sleeps", and it never needs a key it can read.
- A transport seam (`householdEnv.transport`, the `auratrack.broker` setting): where a hub address plugs in.
- Device list with removal and key replacement.

## What the hub is
One Node program (`apps/server`), run by `node` on a household computer (or in Docker on a Pi or NAS):
- **Stores and forwards only sealed entries.** SQLite file; it holds bytes it cannot open. It knows device ids and sizes and times, nothing medical.
- **Is a device that is always open.** Phones meet it like any other device, so a phone that opens at 3 a.m. catches up without another phone being open (the limit M6 states goes away).
- **Runs the connection broker** (a PeerJS-compatible signalling server on the same port), so phone-to-phone sync no longer depends on the public broker.
- **Sends push alerts** (slice 6).
- **Keeps encrypted daily backups** of what it holds (sealed already; a copy of the database file, rotated, in a folder you choose).
- **Reached over a private network** (Tailscale, or home Wi-Fi with its own certificate). Never a public website.

## Order of work

| # | Slice | What |
|---|---|---|
| 1 | **Server core** (`apps/server`) | Node, SQLite (`node:sqlite`, no native add-on). Tables: devices (id, token hash, added, revoked), entries (sealed, by scope and day), backups. HTTP + WebSocket on one port. Device tokens issued at joining and checked on every call; revocation. Limits on sizes and rates. Logs without content |
| 2 | **Hub protocol** | The meeting protocol reused: the hub is the other end of `runSession` with a store of sealed entries instead of a Store. Devices push their new entries when they save (hub on) and pull on opening; the hub tells connected devices an entry arrived. The hub holds no household key: it compares day digests of **sealed-entry ids** (ids are random, so nothing leaks) and forwards the sealed bytes. Authentication is the device token, not the household key, so a revoked device is cut off at once |
| 3 | **Pairing the hub** | In the app: Household, Hub address. The hub shows a pairing code (QR, in the status page and the tray menu); the app enrols the household to it (the first device gives the hub the list of devices and each device gets a token). A device removed from the household has its token revoked on the hub. Hub address saved in the household state, so every device gets it |
| 4 | **App side** | Hub mode in the service: when a hub is set, connect to it first (replaces the public broker for signalling; direct phone-to-phone stays as the fallback), push on save, pull on open, and keep a connection while the app is open. Turning the hub off or being away changes nothing for recording or for M6 sync. "Household up to date?" shows the hub as a device |
| 5 | **Status page and tray icon** | **Status page** (served by the hub on `localhost` only): is it running, address, devices (names, last seen, revoke), disk used, last backup, the pairing code and QR, a private-network check (is Tailscale or a LAN address reachable?), a test connection, a plain "what to do if…" list. **Tray icon** (small helper program that talks to the hub over localhost): status colour, open the status page, pairing code, pause, quit. Start-on-boot scripts for Linux (systemd user service), macOS (launchd) and Windows (scheduled task) |
| 6 | **Push alerts** | Web Push from the hub with VAPID keys made on the hub. The app subscribes (permission asked in the app, with the iOS 16.4 and home-screen requirement said plainly). Alerts are **sealed end to end**: the recording phone seals the event with the household key, the hub forwards it, the service worker opens it and shows it. Events: seizure started, past the alert time, recorded. Settings per device and per patient; lock-screen text private by default (no name or detail). Requirements and limits stated in the app |
| 7 | **Packaging** | Docker image (optional, one Dockerfile). The Node program as one file. Single-file executables per system built in CI (Node's single-executable feature): Linux built and tested here; macOS and Windows built in CI and **tried by you** |
| 8 | **Tests and sign-off** | Server unit tests (tokens, revocation, limits, sealed storage, backups); protocol tests through the real `runSession` with the hub in the middle; multi-device e2e (three browsers, hub on and off, hub restarted, a revoked device cut off); push to a test endpoint; layout audit for the new screens; `M7-signoff.md`, STATUS.md |

## What stays yours
- Trying the hub on your own computer and Windows or macOS builds, the tray icon on your desktop, the start-on-boot scripts.
- Tailscale or certificate setup on your network.
- **iPhone and Android push with the app closed**, which I cannot test (a push service and real phones are needed).
- Version bump, tag 7.1, commit.

## Limits to state plainly
- Push needs a push service from the browser maker (Google, Apple, Mozilla). It carries a sealed, opaque message, but the maker sees that a message was sent and to which device. This is how every web push works; it is stated in the app.
- iPhone: web push only works for an app added to the home screen, iOS 16.4 or later.
- The hub being on does not make recording wait for it: Start and saving are local first, always.
- If the computer is off, devices fall back to meeting each other (M6).

## Decisions I need from you
1. **Tray technology.** A tray needs an operating-system piece. Options: a small helper using an existing library (works on macOS and Windows, on Linux only on desktops with a tray), or a tiny native-looking helper per system. I recommend the library helper, with the status page as the thing that always works.
2. **Private network to recommend first:** Tailscale (works at home and away, needs an account) or home Wi-Fi only with the hub's own certificate (no account, no use away from home).
3. **Lock-screen alert text:** private by default (just "AuraTrack: open the app"), with an option to show the person's name. Confirm.
4. **One run or two.** Slices 1 to 5, 7 (core, tray, status page, packaging) in the first run; slice 6 (push) in a second run after you have tried the core. Or everything at once.

## Rules held throughout
- No change to the clinical rules; nothing added to the recording screen. Recording never waits for the hub.
- The hub never holds a key that opens medical data. No third-party scripts. Medical data integrity: the hub only stores and forwards what devices sealed; devices still merge by the existing rules and audit trail.
- Tests before done: unit, component and end-to-end tests must pass.
