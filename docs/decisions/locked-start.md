# Design: the recording engine and Start from the PIN screen (M3, slice 5)

**Status: approved and built, 2026-11-01** (all of slice 5 in one go, at the user's request). Where the build differs from the draft, it says so under "As built" at the end.

Words used here:
- **PIN screen** means AuraTrack's own lock screen. The phone's lock screen is controlled by the operating system, and a web app cannot put buttons there.
- **Locked recording** means a recording started from the PIN screen.

## Decisions (made with the user, 2026-11-01)

1. The alert counts from Start, not from End aura.
2. A recording lost because the app closed asks: "Is it still happening, or did it end?" If it ended, it asks when. The default is the last tap, marked "entered later".
3. At the 12-minute auto-stop everything stops. There is no recovery timer.
   - The seizure end is stored as **unknown**, never as 12:00, so a guess does not become a medical fact.
   - The record says "auto-stopped at 12 min". The next time the record is opened, the screen asks when the seizure ended. The choices are a time, "I don't know", and "It was still going when emergency services arrived".
   - The wording is neutral: "the timer stopped itself".
   - A recording found after a closed app, with more than 12 minutes since Start, is treated the same way.
4. The patient's name is hidden on the PIN screen by default. A setting shows it.
5. The alert card on the PIN screen shows rescue medication and emergency contacts (the default). The other choices stay available in settings: rescue medication only, or nothing personal.
6. Cluster warning at Start is on. If the last 3 seizures fall inside 8 minutes, the recording screen warns at once.
7. An alert sound is an optional setting, off by default.
8. Cancelling a locked recording keeps it, flags it, and asks after unlock whether to delete or keep it. Nothing is lost silently.
9. Locked Start is a **setting that can be turned off** (`lockedStart`, default on). When it is off, the PIN screen has no Start button. Turning off the app lock (`appLockEnabled`) removes the PIN screen entirely.
10. **Locked Start must never stop anyone from recording or viewing.** After unlock, everything works as normal, whether or not a recording was made while locked.
    - Viewing existing records still needs the PIN. That is what the lock is for.
    - The locked recording itself can be watched and controlled on its own screen.

Unchanged clinical rules: alert at 5 min with a warning at 4, cluster of 3 in 8 min, auto-stop at 12 min, no extra buttons on the recording screen.

## Part A: the pure engine (`packages/model`)

- State: recording id, start, aura end, seizure end, recovery end, notes, symptoms (with phase and time), status, auto-stopped flag.
- Events: start, end aura, end seizure, back to normal, quick note, symptom, auto-stop, finish, cancel. Each has an id and a time.
- `reduce(state, event)` is pure.
  - End seizure before End aura sets the aura end to the start time.
  - A repeated End aura does nothing.
  - An event id already applied is ignored.
- `derive(state, now)` gives elapsed times and the alert state. It uses `recordingState()` and `emergencyPlan()` from `rules/emergency.ts` unchanged.
- Timers come from timestamps (`now - start`), never from counting ticks.
- Tests: unit tests, property tests (any order of taps gives a valid seizure; replaying the log equals the live result; times never go backwards) and mutation tests (target 80% or more).

## Part B: saving while unlocked, and crash recovery

- Start creates the seizure at once with status `in_progress` and `phases.start`.
- Every tap is one field-level write. The screen reacts from memory first, so Start responds in under 100 ms.
- If a write fails, the recording continues in memory with a visible warning and the write retries.
- On opening, a seizure still `in_progress` starts the recovery question from decision 2 (or decision 3 after 12 minutes).
- One recording at a time per device.

## Part C: the browser controller (`apps/web`)

- Ticks about four times a second and recomputes at once when the app returns to the foreground.
- Warning at 4:00, red full-screen alert at 5:00, auto-stop at 12:00.
- Wake lock requested at Start and again whenever the page becomes visible. A banner shows if the browser has none.
- Haptics where the browser allows it. iPhone Safari has no vibration API, so the setting says so.
- Optional alert sound, prepared at the Start tap because browsers need a tap first. Off by default.
- Limit: a web page cannot alert when the screen has been switched off by hand or the app is killed. Alerts to other phones need the hub in M7.
- Auto-lock is suspended while a recording runs.

## Part D: Start from the PIN screen

### Keys
- At store creation, or at the first unlock after this update for existing stores, create an **ECDH P-256** key pair with the browser's built-in crypto.
- The public key is stored plainly in `meta`. The private key is stored wrapped under the device key, so the PIN, the passkey and the recovery kit all open it. Changing the PIN does not touch it.
- Until the key pair exists, locked Start is unavailable.

### Posting an event while locked
- One entry per event. A fresh one-time key is made by ECDH with the public key, then HKDF, then AES-256-GCM.
- The entry holds a sequence number, the one-time public part, the IV and the ciphertext. The recording id, event time, note text and patient id are all inside the ciphertext.
- The locked app can only append entries. It cannot read any record, edit or delete.

### Stored in plain text while locked
1. A recovery marker: the recording id and the timestamps of start, aura end, seizure end and recovery end. This lets a locked recording resume with the right clock after a crash.
2. The alert card (rescue medication and contacts, or less, per the setting). It is written while unlocked and kept up to date. It is wiped when the setting is changed to "nothing personal".
3. The last-used patient's random id, with no name.
4. Seizure start times from the existing time index, so the cluster warning works.

### Screen
- The recording screen shown from the PIN screen is the same screen with the same buttons.
- After the recording ends, the PIN screen may show times only (start, seizure length, recovery). Details appear after unlock.
- Cancelling while locked marks the recording cancelled and keeps its entries.

## Part E: merging after unlock

1. Read the entries in order and decrypt them with the private key.
2. Check each one against a strict schema. Unknown kinds are quarantined, not dropped.
3. Replay with the same engine and create or update the seizure under the recording's id.
4. Delete the entries only after the store has confirmed the write.

- A crash in the middle is safe: replay is keyed by recording id and event id, so nothing doubles.
- A bad entry is kept, and the user gets a notice.
- The merged seizure is a normal record, flagged "recorded while locked". Home shows a card to add details.
- A locked recording that was cancelled shows "Delete it, or keep it?".

## What this protects, and what it does not

Protected: someone with the phone who opens the app without the PIN can start a recording but cannot read, change or delete any record. Someone reading the raw files sees ciphertext apart from the plain items above.

Not protected:
- The alert card is readable from the raw files. That is the user's decision (5) and it can be switched off.
- The times and the number of locked entries are visible.
- Anyone who can write to the app's storage can add a forged entry, because anyone can post. Merged entries are flagged "recorded while locked", and the strict schema limits what an entry can do. Preventing this completely would need a secret on the locked app, which defeats the purpose.

## Settings added
`lockedStart` (device, default true), `alertSound` (device, default false), `recordingHaptics` (device, default true), `lockedShowName` (device, default false). `lockedAlertContent`, `wakeLock`, `symptomStrip` and `quickNoteLabels` already exist.

## Tests
- Engine: unit, property and mutation tests.
- Store: create, lock, start locked, append, unlock, merged, drop box empty. Also: stop mid-way and resume; wrong key; tampered entry; repeated replay; crash between steps; old stores without a key pair.
- End to end on all three engines: locked Start, reload recovery, 12-minute auto-stop, wake lock, and the alert after a simulated background.
- A section on `/#/dev` to try lock, locked Start and unlock on a phone before any real screen exists.
- Start measured under 100 ms.

## Order of work
1. Approve this note.
2. 5a: the pure engine and tests.
3. 5b: unlocked saving and crash recovery.
4. 5c: the browser controller.
5. 5d: key pair, drop box, locked Start, merge.
6. The `/#/dev` section.

Each step ends with typecheck, lint and tests passing, and a report to the user.

## As built

- **Engine:** `packages/model/src/rules/recording.ts`. Added to the draft: a `late` flag on End aura, End seizure and Back to normal (a time typed in afterwards is saved as `entered-later`, decision 2); `endedAt`; `lastActivityAt` (the default time for "when did it end?"); `clusterWarningAtStart`; `settleRecording` (the 12-minute rule for a recording found later).
- **Seizure record:** three optional fields: `quickNotes`, `recordedWhileLocked`, `cancelled`. The auto-stop reuses `isEmergencyStop` with `seizureEnd: null` (end unknown). Cancel is the same flag for locked and unlocked recordings: a cancelled recording is kept and flagged, never deleted.
- **Posting:** each entry holds `{recording, event}`, so a recording that was merged earlier and locked again can carry on. The locked app also needs the user's own emergency plan (alert minutes, cluster rule) and the start times of recent seizures: both are kept in the clear (`lockedScreen.plan`, and the existing time index), nothing else.
- **Merge:** `Store.mergeDropBox`, at every unlock. A seizure the user deleted is not brought back. An entry that cannot be read is kept with the reason, not tried again, and counted once.
- **Browser side:** `apps/web/src/recording/controller.ts` (clock from timestamps, wake lock taken again when the page returns, vibration, optional beep prepared inside the Start tap, saves retried with growing waits). The real screens in slice 6 use it as it is.
- **Try it:** `/#/dev`, section "Recording check".
- **Not built here (later slices):** the screens' wording for the recovery question ("Is it still happening, or did it end?") and for the 12-minute notice; the PIN screen itself (slice 9). The engine and the store already return everything those screens need.
