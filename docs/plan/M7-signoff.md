# M7 sign-off: the household hub and push alerts (7.1)

Written 2026-11-02, after the two build runs (plan `M7-plan.md`, log `M7-log.md`, decisions `docs/decisions/m7-hub-reach-csp-keys.md`). Test kinds as in `M4-signoff.md`. **7.1 is not tagged:** that needs your own trial of the hub on your computer and phones, the desktop pieces I could not run here, push on real phones, and the version bump.

| Slice | What | Where it is tested |
|---|---|---|
| 1 Server core | `apps/server`: Node + SQLite (`node:sqlite`), device tokens (only a hash is stored), revocation, size and rate limits, `/v1` API, WebSocket "something new", status page (this computer only, no scripts), PeerJS-compatible connection finder at `/peer`, optional serving of the app (`HUB_APP`), https (`HUB_CERT`/`HUB_KEY`) with reload on renewal (SIGHUP and hourly), daily backup copies by day, 14 kept | unit `hub.test.ts`, `http.test.ts`, `tls.test.ts` (real TLS; a renewed certificate is picked up without a restart; a broken one is ignored) |
| 2 Hub protocol | `packages/sync/src/hub.ts`: entries sealed per person on the device, compared by day digests, pushed and pulled; a sealed note of the device list and household keys from each device; tampered entries rejected; entries sealed with a key not yet held counted apart ("cannot be opened yet") | unit `apps/server/src/hubSync.test.ts` (real encrypted stores through the real hub: in process and over HTTP; three devices in any order; edits merge; deletion not undone; person not kept never received; removal; tamper; hub away) |
| 3 Pairing the hub | The hub's address and a join key are part of the household (newest setting wins; empty = switched off); the first device sets the hub up with the code on its status page; the others enrol themselves; removing a device cuts it off at the hub and changes the join key; a removal made while the hub is away is queued | unit `hubLink.test.ts` |
| 4 App side | A round with the hub when the app opens, every minute, shortly after a save and when the hub says something arrived (never during a recording); the hub's own connection finder replaces the public broker for a household with a hub; Household screen: Hub section (connect with https check and a hint to open the app from the hub, status, sync now, switch off), Up to date shows the hub; Home note "Changes from the hub" | component `household.test.tsx` (20); e2e `household.spec.ts` (two phones with the real built hub: a seizure reaches the second phone with the first closed; Chromium and Firefox) |
| 5 Status page, tray, boot scripts | Status page; tray helper `apps/tray` (a dot, a few facts, a shortcut to the status page, `systray2`); start-on-boot scripts for Linux, macOS, Windows | unit `tray.test.ts` (what the tray shows, real PNG/ICO icons), `boot.test.ts`; **the tray on a desktop and the scripts on the three systems were not run** |
| 6 Alerts | Hub: VAPID keys, `/v1/push/*`, `/v1/alert` fan-out by each device's own choice of event and person; Web Push written out (RFC 8291 encryption matches the RFC's own example byte for byte; VAPID verified); only the browser makers' push services accepted, https only; a gone subscription is dropped. App: Alerts section (permission, events, people, plain requirements and limits), the recording tells the hub when it starts, passes the alert time and ends (once each, after the recording itself, never waited for, a hub that is away is skipped), service-worker handler `public/push-sw.js` | unit `push.test.ts`, `alert.test.ts` (incl. over HTTP to a push service of our own), `alerts.test.ts`; component (alerts sent; a hub that is away does not hold up a recording; the plain words); **the service-worker handler and real push delivery were not run** |
| Key delivery | Each device has a key pair (private half stays on it, public half in the device list); a person's key is sealed to the one device that keeps that person and left in its mailbox at the hub; the receiver checks the sender is active and the person is one it keeps | unit `hubSync.test.ts` (rotation reaches the others through the hub alone; sealed to one device; not for a person not kept; forged grant from a removed device ignored), `hub.test.ts` (mailbox) |
| 7 Packaging | One-folder package (`package.mjs`), single executable with Node's SEA (`sea.mjs`; the Linux one was built and answered its health check), Dockerfile, CI workflow for all three systems | **Docker image, macOS and Windows builds and the CI workflow were not run** |

## Numbers (2026-11-02)
- Unit and component tests: 1,106 pass (6 full runs in a row after the fixes below). Typecheck, lint and formatting clean. First load 75.3 KB gzipped (budget 180 KB).
- End to end (Chromium and Firefox, everything except the audits): 70 pass, 2 skipped (a Chromium-only test in Firefox).
- Layout audit of the new Household screens (Hub, Alerts, connect sheet) on three phone sizes, Chromium: pass.
- The hub bundle is 2.2 MB (the single executable 125 MB).

## What the hub knows
Device ids and names, token hashes, entry ids, the id of the person each entry belongs to and its time stamp, sealed text, sealed notes, mail sealed to a device, push subscriptions (address and keys the browser gave), and for an alert the person's id and the kind (started, alert, recorded). It cannot read a record, a name, a note, a symptom or a key. The kind of alert and the person's id are visible to it because it must route the alert; the same facts can already be read from when entries arrive.

## Found and fixed on the way
- A VAPID key was made with a fixed-length wrapper: one key in 256 has a shorter private number and the hub would have failed to start the first time (it showed up as random test failures). Fixed and tested with a short number.
- The invite code was shown before the device was listening (a fast scan could find nobody). Now shown once listening.
- Several timing-sensitive tests were made to wait for what they check (and the test run uses 6 of 12 cores).

## Outside the plan, or different from it
- **Alerts show no health text on the lock screen, ever (this version).** The notification says "AuraTrack" and asks to open the app; the option "show the person's name" from the plan is not built (it would need a key readable by the service worker, i.e. stored in the clear on the phone).
- **A recording started from the PIN screen sends its alert only once the app is unlocked.** The hub token lives in the encrypted store. This matters in exactly the emergency the alert is for; fixing it needs an alert-only token kept in the clear on the device. Open decision for you (it trades a small privacy cost for a faster alert).
- The app on its usual address cannot call a hub (CSP kept strict on purpose): open the app from the hub. See the decision note.
- A household member can forge a key for a person a device keeps (members hold the household key). Accepted, same trust as any member.

## Still yours
- Try the hub on your computer (`pnpm hub`), its status page, the Tailscale certificate route, the start-on-boot script and the tray icon on your desktop.
- Run the CI workflow `hub-release.yml` and try the macOS and Windows results; try the Docker image on a Pi or NAS.
- Alerts on real phones (Android, and iPhone from the Home Screen on iOS 16.4 or later) with the app closed; set `HUB_PUSH_SUBJECT` to your email address on the hub.
- Decide the alert-from-the-PIN-screen question above.
- Translation review (the 51 new messages are drafted by me), version bump, tag 7.1, commit and push.
