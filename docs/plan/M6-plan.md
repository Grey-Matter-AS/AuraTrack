# M6 in detail: household without a hub, then 7.0 (draft for approval)

**Status: approved and built 2026-11-02 (see `M6-signoff.md`).** Decisions: per-patient keys; keep the public PeerJS broker; file and QR last resort. It builds on `M6.md` (the requirements) and README sections 4.4 and 6. Branch `7.0.5---M6`. You bump the version and commit.

## Already in place
- Field-level merge with HLC stamps (`packages/store/src/merge.ts`, commutative, associative, idempotent), tombstones, the append-only change log, `changesSince`, `allVersioned`, `applyRemote`-style merging used by backup restore and the 6.1 import.
- Every record carries `householdId` and `deviceId`. Recovery kit, backup, one-person backup.
- `packages/sync` is an empty stub. No networking exists yet.

## Decisions I need from you (asked before building)
1. **Per-patient keys or one household key.** README says per-patient keys. Today the store has one data key. Per-patient keys mean a device that does not follow a patient never gets that patient's key. One household key is simpler but a device that does not follow a patient could still read it if it received the data (it would not, but only by our code's choice).
2. **The public signalling broker (PeerJS).** It never sees medical data (WebRTC is end to end, and our messages are sealed on top), but it does see that two IP addresses asked to meet, and the random peer ids. That is the one outside service in the design, as README section 6 already says. Confirm it stays.
3. **Offline last resort:** encrypted update by file and by QR, both in M6, or file only first.

## Order of work

| # | Slice | What |
|---|---|---|
| 1 | **Sync engine, pure** (`packages/sync`) | Protocol with no network: a device summary (its change-log ids by stamp range, compact), "what do you lack" exchange, batches, resend, idempotent apply through the existing merge. Devices pass on what they got from others. Tested with in-memory pipes: three devices meeting in every order, offline edits, deletes, duplicated and dropped messages, interrupted exchanges, a device that was away for months |
| 2 | **Household identity and keys** (`packages/store`) | Household id and key, device records (id, name, added by, added at), a signed device list that merges like any record, per-patient keys if you choose them (decision 1). Removing a device replaces the household key for future data and re-seals nothing old (the removed device keeps what it had; the screen says so plainly). Backups and the recovery kit include the household keys. Existing single-device stores become a household of one at the next unlock, no record rewritten |
| 3 | **Pairing** | Create household; "Add a device" shows a QR with a one-time secret and the first device's meeting address; the new device scans (or types a code), both show a short confirmation code and the user confirms a PIN on both (so a photographed QR is not enough). The household key travels sealed under a key from that secret. Expiry (5 minutes), one use. QR drawing already exists (`recoveryKitMatrix`); scanning uses the camera with `BarcodeDetector` where present and a small bundled decoder otherwise (no third-party script at run time) |
| 4 | **Transport** | WebRTC data channels. Meeting through PeerJS signalling (the `peerjs` package bundled, pointed at the public broker; address configurable for M7), direct on the same Wi-Fi where the browser allows it. Peer ids derived from the household key so only members can compute where to look, rotated daily. All messages sealed with the household key on top of the channel's own encryption. Runs in the page (WebRTC is not in workers on all engines); the store stays in its worker and exchanges batches through the existing RPC |
| 5 | **When and how devices meet** | Open device advertises; on opening a device looks for others for about a minute, then keeps listening while open. After a save the recording device stays reachable for 5 more minutes. Never during a recording: sync waits so the recording screen is untouched (rule: nothing new on that screen, no network work on its frame). Background sync (Periodic Background Sync) on installed Android where granted; iOS and others say so |
| 6 | **Screens** | Household (More): name, devices with last sync, add a device, rename, remove; follow patients per device; **Household up to date?** (each device, last sync, what it still lacks, "Look for devices now"); quiet note after a merge ("2 changes from Mia's phone", opens the list; the audit trail already records who) ; conflict handling is automatic per merge rule, shown only as that note; settings text on the honest limit (closed apps cannot be updated or alerted without the hub); messages in 9 languages (drafted by me) |
| 7 | **Last resort** | Export the update the other device lacks as an encrypted file (and QR chunks if you choose, decision 3); import it on the other device through the same apply path; counts shown, nothing changes until confirmed |
| 8 | **Multi-device tests** | Engine tests as in slice 1; store-level tests with three real stores through a fake transport (field edits on two devices, delete vs edit, a removed device's later data is ignored, a device joining late receives everything, key replacement); component tests of the screens; e2e with three browser contexts in Playwright talking through a local signalling stand-in (the public broker is never used in tests) |
| 9 | **Release 7.0 work I can do** | Layout audit with the new screens (Household, Up to date, Add a device, Remove a device), performance budgets re-checked (first load stays within 180 KB gz: `peerjs` is loaded only when a household has two or more devices or a device is being added), `M6-signoff.md`, STATUS.md, release notes draft |

## What stays yours
- Using two or more of your own devices together for some days (the done-when).
- Translation review (at least Norwegian), your real-device check, switching over from 6.1 with the latest backup, the version bump (7.0.x to 7.0), tagging 7.0, commit and push.
- iPhone behaviour of WebRTC, camera scanning and the background limit: I cannot test it; Playwright WebKit is not an iPhone.

## Limits stated plainly
- Two closed apps never sync; it happens when two household devices are open at the same time. The hub (M7) is what removes this.
- A removed device keeps everything it already has. Removing it only stops it receiving new data.
- Some networks (strict corporate Wi-Fi, some mobile carriers) block direct connections; then there is no relay (a relay would be a server). The file or QR update is the fallback.

## Rules held throughout
- No change to the clinical rules. Nothing added to the recording screen. Recording never waits for sync.
- No third-party scripts; the only outside contact is the signalling broker, sealed payloads only.
- Medical data integrity: sync only adds or merges by the existing rules; nothing is deleted except by a tombstone someone made; every applied change lands in the audit trail.
- Tests before done: unit, component and e2e must pass.
