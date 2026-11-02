# M6 sign-off: household without a hub

Written 2026-11-02, after the one-run build (plan: `M6-plan.md`). Test kinds as in `M4-signoff.md`. **7.0 is not tagged:** that needs your use of two devices together for some days, your real-device checks, the translation review and the version bump.

| Slice | What | Where it is tested |
|---|---|---|
| 1 Sync engine | `packages/sync`: a meeting between two devices as steps both sides run the same way: hello, proof of the household key (both nonces), device lists, keys, day digests, ids on the days that differ, entries, done. Finds an old entry that arrived late (it compares ids per day, not "newer than"). Devices pass on what they got from others | unit `sync/session.test.ts` (two and three devices in every meeting order, a long log in batches, a device away for months, dropped, repeated and cut messages, refusing a stranger, a removed device, wrong scope or household, timeout) |
| 2 Household and keys | Device list and keys, merged by union (a removal is final; the newest name or "who I keep" wins); a key for each person; removing a device replaces the household key and every person's key and marks the old household keys as no longer proving membership; a device that held only the old keys is still let in if it is a member of record, which is how it hears about the new keys. The store keeps all this sealed under the device key (`getSecret`/`putSecret`); a store with records cannot join another household (`adoptHousehold`) | unit `sync/session.test.ts`; store-level `sync/household.test.ts` (real encrypted stores: new device gets the person and every seizure; edits to different fields on three devices both survive; a deletion is not undone by an older edit; a device's own settings stay on it; a second person reaches a device that keeps everyone; a device that keeps one person never gets the other or its key; a removed device gets nothing after) |
| 3 Pairing | One-time code (16 letters and digits, QR or typed, 5 minutes, once), sealed with a key made from it; six digits shown on both phones and confirmed by a person on each; only then does the household state travel; the person who adds chooses who the new device keeps and only those keys are sent | unit `sync/pairing.test.ts` (same digits, declined on either side, expired, wrong code, the new device can then meet the first); component `screens/household.test.tsx` |
| 4 Transport | WebRTC data channels through the PeerJS signalling broker (loaded only when needed); each device is reachable under an id made from the household key and the day (so only members can work it out); everything is sealed with the household key on top; a transport can be swapped (in-memory for tests; a hub address in M7 through the `auratrack.broker` setting) | e2e `household.spec.ts` (two real browsers, our own signalling server, WebRTC for real, Chromium and Firefox) |
| 5 When devices meet | Reachable while the app is open; looks for the others for a minute when opening, when asked, and for five minutes after something was saved; one meeting at a time; **a device that connects during a recording is turned away, and nothing is done on the recording screen**; retry only every 20 seconds per device | component `household/service.test.ts` (finds the other device by itself, passes on a save, turns away during a recording, carries on without the broker, a removed device learns it and stops) |
| 6 Screens | More, Household: start, devices (last met), rename, who this device keeps, remove (says what it means), leave; Add a device (code, QR, digits); Join (at set-up and from More while empty); Household up to date? (each device, last meeting, "look now", the honest limit); a quiet note on Home for changes from another device; the wait for the first meeting after joining. 113 messages in 9 languages | component `screens/household.test.tsx` (15 tests); `messages.test.ts`; layout audit (below) |
| 7 Last resort | An update as a sealed file (and as up to 25 QR codes shown in turn, read with the camera) made on one device and opened on another: checked first, adds only what is missing, refuses another household's file or a damaged one | unit `sync/update.test.ts`; component `household.test.tsx` |
| 8 Multi-device tests | See slices 1, 2 and 4 | as above |

## Numbers (2026-11-02)
- Unit and component tests: 1,013 pass (74 files). Typecheck, lint and formatting clean.
- End to end (Chromium and Firefox): the household spec passes on both; the older M3 end-to-end tests that still looked for settings and symptom sets on Home were updated for the new places (More) and pass; the rest passed as before.
- First load: the page that opens the app is 77 KB gzipped; PeerJS (23 KB) and the QR reader (48 KB) are separate chunks loaded only when used.
- Layout audit: see the line at the end of this file.

## What changed outside the plan, and what to know
- **`vercel.json` (CSP):** `connect-src` now also allows `https://0.peerjs.com` and `wss://0.peerjs.com` (the signalling broker). Nothing else was widened. The plan said you would see this first; it is one line and easy to revert.
- **Who sees what:** the broker sees that two IP addresses asked to meet, and random ids that change daily. The one STUN server (Google's) sees an IP address. There is **no relay** (PeerJS's default relay servers are switched off): on a network that blocks direct connections two devices cannot meet, and the update by file or QR is the fallback. No medical data goes to either.
- **Per-person keys protect what travels between devices.** What is stored on a device is still under that device's own key, as before.
- **Keys are not part of backups or the recovery kit** (the plan had them in). A restored backup on a new phone is a phone on its own; to share it, make a household there and add the others. This keeps a backup file from ever being the way into a household.
- **Joining needs a phone with no records.** A phone that has some must be backed up and restored on the household device first (the screen says so). This is the safe reading of "never lose or silently change a record".
- **Background sync on installed Android is not built.** Browsers do not allow WebRTC in the background, so a woken app cannot meet anyone. This is what the hub in M7 is for. The Household screen says so in plain words.
- **A removed device keeps what it has** (the screen says so), and until a device that has not heard of the removal meets it, that device may still take its changes. Once any device that knows meets a device, the knowledge spreads.
- **The six digits are the check against a photographed code.** The code itself works once and runs out in five minutes.
- Scanning: the browser's own reader where it has one, otherwise a small bundled one; both are in the page, nothing is sent anywhere.

## Still yours
- Use two or more of your own devices together for some days (the done-when).
- iPhone: WebRTC between two phones, the camera scan, the install card and keeping the app open long enough to meet. I cannot test iPhone.
- Translation review (at least Norwegian); the nine languages are drafted by me.
- Version bump (the app still says 7.0.2), tagging 7.0, the switch-over from 6.1 with your latest backup, commit and push.

## Layout audit (2026-11-02, after the last change; you asked for the full build, so I ran it)
Chromium, 10 devices: kit parts, the M3 and M4 screens (now also Reports, the report preview, Backup and the new Household screens: none yet, start, one device, rename, who it keeps, add a device (choose, code), up to date, update by file) and the join form (bad code, not found): 40 of 40. Firefox, the same M4 and M6 audits: 30 of 30. WebKit runs in CI. Not covered: the six-digit confirmation dialog with a second phone (it is the kit's own Dialog, audited there).
