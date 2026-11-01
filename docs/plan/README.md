# AuraTrack 7.0: a clean rebuild — overview

The detailed plan of each milestone is in its own file next to this one (M0.md … M7.md). Progress is tracked in [STATUS.md](STATUS.md).

## Context
AuraTrack 6.1 is committed. You are its only user. You want v7 rebuilt from scratch in a new repository (6.1's repo archived), with **no tech debt carried over from decisions made up to 6.1**:
- more extensible, more secure, faster
- looks and works exactly the same on every device (iPhone, Android phones and tablets, iPad, browsers, computers)
- the UI reflows gracefully, and nothing overlaps or covers anything else
- seizure logging rebuilt: easier to choose symptoms, the body parts affected, and the **order** they happened in
- a household of registered devices stays current **without a server**, even when devices aren't running; a household server is an optional extra, never needed to record
- the neurologist PDF stays central: the 6.1 layout kept, with more detail and better graphics. Integration with HelsaMi or Helsenorge is a distant possibility only.
- the optional "server" is one of the household's own devices that can run a real server program (a computer, Pi or NAS), not just the app

Every 6.1 feature is kept, but rewritten. The clinical rules decided in 6.x stay:
- emergency plan: alert at 5 min, clusters of 3 in 8 min, both settings
- 12-minute auto-stop
- no extra buttons on the recording screen
- grouped after-seizure findings with body areas and recovery time
- saved symptom sets per seizure type
- backups that contain everything
- careful, neutral wording

---

## Review: suggested changes (each needs your OK; folded into the sections below)
1. **Write the full 6.1 feature list first (M0)** and use it as the acceptance checklist for 7.0. "Every feature kept" is easy to get wrong in a rewrite. The list covers the less visible features too:
   - backup and update reminders
   - wake lock
   - haptics
   - install banner
   - wellbeing reminder
   - emergency contacts on the alert
   - EEG diary
   - video
   - Help and About
2. **Prototype the new logging before building it (start of M3).**
   - It's the biggest change to how you use the app, and it's used under stress.
   - Clickable screens of the body map and timeline get tried on your phone first, tested one-handed with large targets, before any real code.
3. **Cut-over uses the latest 6.1 backup on switch-over day,** not a fixed 31 October one. v7 will take a while, so 6.1 stays in daily use until then and nothing in between is lost. Keep the 31 October PDF as a record if you like.
4. **Repository names:** rename the 6.x repo to `AuraTrack-v6` and archive it, so the new repo can be called `AuraTrack`. Old links redirect.
5. **A recovery kit:** a printable sheet with a QR code holding the household keys, kept somewhere safe. With data encrypted on every device, losing all devices without it means the data can't be read. Encrypted backups stay protected by their own passphrase, independent of the device lock.
6. **What the lock screen shows during an emergency:** Start always works. The alert's rescue medication and emergency contacts are useful to whoever is helping, but are personal. A setting chooses what shows while locked; the default is rescue medication and contacts.
7. **Unlocking with Face ID / fingerprint needs newer systems** (passkey PRF: iOS 18, current Android and Chrome). Older devices fall back to a PIN.
8. **iPhone storage:** iOS can delete website data that hasn't been used for 7 days unless the app is installed to the home screen. v7 asks for installation and persistent storage on every device, and warns clearly if it's missing.
9. **Not everything is "newest edit wins."** Each record type gets its own merge rule:
   - dose logs: taken beats assumed beats missed, as in 6.1
   - medication changes and the audit trail: never overwritten, only added
   - seizure details: newest edit wins, field by field
10. **Internet phone-to-phone sync is best effort.** On mobile data, devices often can't connect directly, because the free broker has no relay. Same-Wi-Fi sync is reliable, and a hub makes internet sync reliable too.
11. **Videos stay on the device that recorded them.**
    - They're too large to sync or put in backups.
    - The record notes which device has the video.
    - Later option: store videos encrypted on the hub.
12. **Translation review:** medical wording in the 9 languages should be checked by a native speaker, at least for Norwegian, before 7.0.
13. **Strict privacy on the website:** strict security headers (CSP), no analytics, no third-party scripts, pinned dependencies.
14. **If you ever share AuraTrack with other families:** an app that gives emergency alerts may count as a medical device under EU rules. That doesn't affect personal use; the "not a medical device" notice stays.

## 1. Repositories and cut-over
- **New GitHub repository:** `AuraTrack7` (v7), GPL-3.0.
  - The 6.x repository is tagged `v6.1.0` and **archived** (read-only, still viewable).
  - You do the GitHub steps on github.com (decided).
- **Cut-over:**
  1. On switch-over day, make a full 6.1 backup (the 31 October PDF can be kept as a record). 6.1 stays in daily use until then.
  2. v7 imports that backup once (section 4.7), so the history continues: trends, medication history and cluster checks need it.
  3. The import is the **only** compatibility code in v7, kept apart in its own module and removable later.
- **Deploying:** the same static hosting as now (no data on the website), on a new address, or the same one once 7.0 replaces 6.x.

## 2. Stack and project layout (standardised)
- **TypeScript, strict.** Every record type is defined once as a schema (zod). The same definition checks data at runtime and gives compile-time types, shared by the app, sync and the server.
- **React 19, Vite, Tailwind 4:** what 6.x proved works, rebuilt cleanly.
- **IndexedDB through Dexie:** storage only; see the data model in section 4.
- **Monorepo** (pnpm workspaces), so features and the server plug in without touching the core:
  ```
  apps/web       the PWA
  apps/server    optional household server (Node, Docker)
  packages/model     schemas, codes (symptoms, body areas, seizure types), clinical rules
  packages/store     encrypted local storage + change log
  packages/sync      merge, device registry, transports
  packages/ui        design system (tokens, layout, components)
  packages/reports   report data, PDF, FHIR export
  packages/i18n      9 languages, typed keys
  ```
- **Feature modules:** recording, history, medications, wellbeing, EEG, video, reports, household. Each one registers its own screens, settings, report sections and backup data through one small interface, so a new feature never edits the core.
- **Navigation:** a typed screen stack, the same idea as 6.1 (state, not URLs, so nothing medical ends up in a URL).
- **Tooling, all required in CI:**
  - ESLint and Prettier
  - type check
  - Vitest
  - end-to-end tests with Playwright (decided by the M0 trial; WebKit runs in CI)
  - performance budgets
  - accessibility and contrast checks
  - Renovate for dependency updates

## 3. Design system: identical everywhere, nothing overlaps
- **Rebuilt from 6.1's kit and tokens** (fields, buttons, sheets, dialogs, cards, theming, accent colour, dark/light, text size), as typed components. Screens may only use kit components; a lint rule enforces this, as in 6.1.
- **One layout system:**
  - fluid spacing and type
  - container queries, so a component adapts to the space it actually has, not the screen size
  - safe areas
  - one overlay layer with z-order rules
  - nothing positioned over content except the kit's sheets, dialogs and toasts
- **The overlap and contrast audit becomes a permanent end-to-end test,** run in CI on every change:
  - checks: overlap, clipping, offscreen, tap targets of at least 44px, contrast of at least 4.5:1 for text
  - every screen and every open sheet
  - a device matrix: small iPhone, iPhone 15, Android small, Pixel, iPad portrait and landscape, Android tablet, laptop, and phone landscape
  - themes and text sizes

  A change that breaks layout on any of these can't be merged.
- **Own-drawn controls** where the platforms differ (date and time hints, chevrons, checkboxes), so they look the same on iOS, Android and desktop.

## 4. Data model, security, performance

### 4.1 Household-first identities
- Every record carries `householdId`, `patientId`, its own `id`, and `deviceId` (who wrote it).
- The IDs are created once and shared by every device, so the "same patient, different ID" problem can't exist.

### 4.2 Codes, not English text
- Seizure types, symptoms, body areas, triggers, after-seizure findings and moods are stored as **codes** from a versioned catalogue in `packages/model`.
- Labels come from the 9 languages, so the whole app and every report can be fully translated, and statistics never break when wording changes.
- ILAE 2017 classification is built in: onset, awareness, motor or non-motor, feature, and spread to both sides. The plain-language type stays the headline.
- The user's own symptoms are codes in a per-household custom catalogue.

### 4.3 One timing model per seizure
- Phase marks: `start`, `auraEnd`, `seizureEnd`, `recoveryEnd`, each with `source: timed | edited | entered-later`.
- Stored as UTC instants plus the **time zone at recording**, so travel and daylight-saving changes stay correct.
- No duplicate date or time strings.

### 4.4 Sync-safe records
- **Field-level merge:** each field carries a hybrid logical clock (HLC) timestamp, so two devices editing different fields of the same seizure both keep their edit, and a phone with a wrong clock can't overwrite newer data.
- **Audit trail:** every change is also written to an append-only **change log** (who, when, which fields). This is the audit trail, and it's what sync exchanges.
- **Deletions** are tombstones in the same log.

### 4.5 Encrypted at rest, app lock
- All records are stored encrypted with AES-GCM, under a key kept by WebCrypto as a non-extractable key.
- **App lock:** a PIN or Face ID / fingerprint (a passkey through WebAuthn, where the device supports it).
- **Recording never waits for the lock.** Start works from the lock screen and records into a write-only buffer, merged when unlocked.
- **Only non-sensitive fields are indexed,** such as timestamps and record type.

### 4.6 Fast by design
- **Decrypted working set in memory;** IndexedDB is only the store.
- **A Web Worker does the heavy work:** crypto, sync, PDF and report building, import. The interface never stalls.
- **Code splitting per feature module.** Languages load on demand, as in 6.1.
- **Budgets enforced in CI:** first load under about 180 KB gzipped JS, interactive under about 1.5 s on a mid-range phone, Start reacting in under 100 ms.
- **Recording is crash-proof:** the seizure is saved the moment Start is tapped, marked "in progress", and every phase tap and symptom is written immediately.

### 4.7 Importer from 6.1 (the only legacy code)
- Reads a 6.1 backup (plain or encrypted, single patient or all patients) and maps it:
  - English types and symptoms → codes (with a review screen for anything it can't map, which stays as the user's own symptom)
  - laps and manual durations → phase marks
  - post-ictal records → codes
  - medication history → change log
- **Tested against your real backup** before you switch over.

## 5. New seizure logging
Built around three questions: what, where, in what order. The recording screen stays minimal, and **no new buttons are added during the seizure**.

- **During recording,** an optional symptom strip under the phase buttons, which the user switches on in settings:
  - shows the usual symptoms for that patient and seizure type
  - one tap adds a symptom with its time automatically ("jerking 0:35")
  - carers capture order without typing
  - quick notes stay
- **After recording, a timeline editor replaces the old wizard:**
  - **What:** a searchable symptom list grouped by plain-language category. At the top: saved sets for this seizure type, and the most-used symptoms for it. Type to filter, in any language.
  - **Where:** a tappable **body map** (front, back, head close-up, left/right clearly marked) instead of three menu levels. Several areas can be tapped at once; "whole body", "both sides" and "started one side, then spread" are one tap each.
  - **Order:** symptoms sit on a timeline against the phases (aura, seizure, recovery).
    - Drag to reorder, or nudge with a time ("about 20 s in").
    - "First symptom" is clearly marked; it matters clinically for where the seizure started.
    - The timeline is accessible: buttons to move up and down as well as drag.
  - **ILAE classification** comes from guided questions with "Not sure" everywhere, and can be changed later.
  - **After-seizure findings, triggers and notes** are kept as in 6.1, rebuilt on codes and the body map.
- **Same editor for logging a past seizure and for edits.** Every edit lands in the audit trail.
- **Organised in tabs by phase (decided):** Before (prodrome and aura), During, After (post-ictal), Details. Every tab is always visible with its state, an overview strip shows the whole seizure on every tab, and a Review shows the full timeline before saving. See M3.md.
- **"Between seizures" log (interictal, decided):** its own quick entry, shown on the same timeline as seizures in History and in reports.

### 5.1 Graphical seizure timeline (your design, with suggested refinements)
**Your idea, kept:**
- a vertical line for the seizure, with the three phases in their colours
- each symptom as a tag (a box joined to the line by a leader line, like a comment on a PDF)
- symptoms happening at the same moment share one leader line
- the time between symptoms can be set

Vertical is the right choice for phones: it scrolls naturally and works at any width.

```
 START 14:02 ●
             │
   AURA      ┃━━━ ┌────────────────────────┐
  (amber)    ┃    │ Tingling · L hand      │
             ┃    └────────────────────────┘
             ┃  +20 s
             ┃━━━ ┌────────────────────────┐   ← two symptoms at the same moment
             ┃  ├─│ Déjà vu                │      share one leader line
             ┃  └─│ Nausea                 │
             ┃    └────────────────────────┘
  aura ends ─◆ 0:45
   SEIZURE   ┃━━━ ┌────────────────────────┐
   (red)     ┃    │ ★ Head turns · right   │   ← ★ first symptom of the seizure
             ┃    └────────────────────────┘
             ┃  ~10 s                          ← "~" = approximate
             ┃━━━ ┌────────────────────────┐
             ┃    │ Stiffening · whole body│
             ┃    └────────────────────────┘
 seizure ends ◆ 2:30
  RECOVERY   ┃━━━ ┌────────────────────────┐
   (blue)    ┃    │ Confused               │
             ┃    └────────────────────────┘
 back to normal ● ≈ 45 min
```

**Suggested refinements:**
1. **Spacing by order, not true scale.** A 30-second aura and a 45-minute recovery can't share a true time scale on a phone: one would be a dot and the other a wall. Instead:
   - each moment gets an equal step
   - the time between moments is written on the line ("+20 s", "~10 s", "time unknown")
   - each phase's real duration is shown at its marker

   A true-scale view is still offered as a toggle in the report and on wide screens.
2. **A moment is a node on the line, holding one or more symptoms.** This makes your "shared leader line" exact: one node, one leader line, several boxes. To make symptoms simultaneous, drag one box onto another node; drag it off again to separate them.
3. **Intervals with honest precision.**
   - Tap the gap between two nodes and choose: at the same time, a few seconds, about 10 s, about 30 s, about 1 min, a custom value, or unknown.
   - Each interval is stored as exact (tapped live during the recording), approximate ("~"), or unknown. Doctors can then tell measured from estimated.
4. **Phase boundaries are markers on the line** (start, aura ends, seizure ends, back to normal), with their times. A symptom box takes its phase colour, so the phase is clear even when the line is off-screen.
5. **The first symptom of the seizure gets a star.** It's clinically the most important for where the seizure started.
6. **Rounded rectangles, not hexagons.** Rectangles fit text in all 9 languages and at large text sizes without overlap. Each box holds: symptom name, a small body-area icon or side (L/R/both), and "~" when its time is approximate. Tapping a box edits it.
7. **Layout by space:**
   - phones: the line on the left, boxes on the right
   - tablets, computers and the PDF: boxes alternate left and right, to halve the height
   - long timelines continue in a second column in the PDF

   The layout audit checks that boxes and leader lines never overlap.
8. **Warning signs hours before** (prodrome, in the Before tab) get a broken-line section ("≈ 2 h before") instead of stretching the line.
9. **Editing, in the tabs or directly on the timeline:**
   - a "+" between nodes inserts a moment
   - drag or move up and down to reorder
   - a list view with the same content for screen readers
10. **One component everywhere:** the editor's overview (compact, labels shortened), Review (full), the seizure's detail page, and the PDF (vector, prints sharply).

**Data behind it:** each moment has a phase, an offset from the seizure's start, a precision (exact, approximate, unknown) and its symptom codes. Intervals are worked out from the offsets, so editing one interval shifts the later moments consistently.

## 6. Household: works without a server
- **Registered devices:**
  - the first device creates the household
  - other devices join by scanning a QR code and confirming a PIN
  - each device has a name, and can be removed (its key is replaced for future data)
- **Patients:** per-patient keys; each device chooses the patients it follows.
- **Without a server, data spreads by meeting:**
  - Every device keeps a full copy of every patient it follows. **Whenever any two registered devices are open at the same time,** they exchange what the other is missing (field-level merge from section 4.4):
    - over the internet, through the PeerJS signalling broker, which only passes connection details
    - or directly on the same Wi-Fi
  - So whichever device opens next catches up from any other open device, including updates that came from a third device it never met.
  - **On opening,** a device looks for other household devices for about a minute and syncs.
  - **After a seizure is saved,** the recording device stays reachable a little longer.
  - **A "Household up to date?" screen** shows each device's last sync and what it hasn't received yet.
  - **Last resort:** share an encrypted update by QR code or file.
- **The honest limit:** with no server, a device whose app is closed cannot be updated or alerted. The web doesn't let one closed app be woken by another phone. It is updated the next time it opens while another household device is open.
  - On installed Android, Periodic Background Sync lets it try now and then, but iOS has no equivalent.
  - This limit is explained in Settings.

## 7. Optional household hub: a household device that runs a real server (secondary)
- **The hub is one of the household's own devices, running a real server program, not just the app.** A web app can't take incoming connections or run in the background, so only a device that can run a program qualifies:
  - **A household computer (recommended):** **AuraTrack Hub**, a small installed program for macOS, Windows and Linux.
    - It starts with the computer, shows its status in the menu bar or system tray, and has a setup wizard (pairing QR code, private network check, test connection).
    - AuraTrack itself still runs on that computer as normal.
  - **A Raspberry Pi or NAS:** the same server in Docker, for households that have one.
  - **Phones and tablets are not hubs (decided).** iOS doesn't allow it at all. An Android hub would need a separate native app and is unreliable when the phone is carried around, so the hub is limited to devices built to run servers.
- **What the hub does:**
  - stores and forwards **only sealed change-log entries**, and knows nothing medical
  - runs the connection broker for internet sync, so phone-to-phone sync no longer depends on the public PeerJS service
  - sends the push alerts
  - keeps **automatic encrypted daily backups** of every patient, so a household with a hub always has a recent backup without anyone remembering
- **Which program form to use** (an installed desktop app around the Node server, or a plain Node service with a tray icon) is decided at M7, after a short prototype on your computer.
- **Reached securely:** over a private network such as Tailscale (secure, at home and away), or on home Wi-Fi only with its own certificate. **Never hosted on a public website.**
- **With a server:**
  - devices push and pull in the background whenever they run
  - **push alerts** (seizure started, past the alert time, recorded) reach devices whose app is closed, sealed end to end; iOS needs the app installed and iOS 16.4 or later
- **Turning the server off changes nothing** for recording or the no-server sync in section 6.

## 8. Reports for the neurologist
**The PDF stays the core.** The 6.1 neurologist report's layout and format are kept as the baseline and ported faithfully to the new base. It's already better than what doctors have access to today. On top of that:
- **More detail:**
  - seizure timelines showing the order of symptoms and the first symptom
  - body-map figures of where symptoms and after-seizure findings occurred
  - ILAE classification alongside the plain-language type
  - recovery times
  - seizures by time of day and by sleep or wake
  - clusters and long seizures against the patient's own emergency-plan rule
  - medication changes and adherence alongside seizure frequency
- **Better graphics:**
  - vector charts that print sharply: frequency, duration trend, phase breakdown, time-of-day heatmap, the medication timeline with seizures, and the wellbeing correlation
  - a clear summary page first, then detail
- **Generated in the background worker,** so the app stays responsive; same output on every device.
- **Saved as PDF exactly as now (Save to Files or Downloads),** plus a "Share" button that opens the phone's share sheet with the PDF, which can save one step when attaching it in HelsaMi.
- **Before changing anything,** I'll lay out the report section by section, 6.1 as it is next to the proposed additions, for your approval.

Direct integration with HelsaMi or Helsenorge is a **distant possibility only**: noted, nothing built. What exists today, from current documentation, for reference:
- **HelsaMi (Helseplattformen):** no public API for third-party apps to send documents to a clinician. It says it can *receive* data from third-party health apps but gives none back.
- **Helsenorge:**
  - a **DokumentAPI** lets an approved external system save a document into the citizen's *helsearkiv*, as the logged-in citizen through Helsenorge or ID-porten, or system to system with HelseID
  - NHN has FHIR-based patient-record APIs, also through HelseID
  - all of these need approval and agreements with Helsenorge or Norsk helsenett
- **OUS e-dialog:** runs inside Helsenorge, with no third-party API found.

The only preparation in v7 is that report data comes from the coded model, so a structured export (FHIR) could be added later without new data work. Nothing more is built for integration.

---

## Milestones (7.0 when M1–M6 are done; the server and push are 7.1)
- **M0:** new repo, CI, tooling, design tokens; 6.x archived; the full 6.1 feature list as the acceptance checklist.
- **M1:** model, codes catalogue, encrypted store, change log, HLC merge, and the 6.1 importer, tested on your real backup.
- **M2:** design system and the layout audit in CI across the device matrix.
- **M3 (ten gated slices, Argon2id first):** the PIN key moves to Argon2id; then a clickable prototype of the new logging, tried on your phone first; then recording (crash-proof, lock-screen Start, emergency plan, auto-stop) and the timeline logging with the body map.
- **M4:** history, event detail, medications (change history, doses, reminders), wellbeing, EEG diary, video, patients.
- **M5:** reports, starting from the 6.1 PDF layout, with the additions you approve (more detail, better graphics), generated in a worker; Save as PDF and Share; backup and restore.
- **M6:** household without a hub (registry, pairing, sync by meeting).
- **M7 (7.1):** AuraTrack Hub for a household computer (plus Docker for a Pi or NAS), with background sync and push alerts.

**Working milestone by milestone (decided):**
1. Every milestone's detailed plan is written now (M0.md … M7.md). Before each one starts, you approve it, or change it.
2. Each milestone ends with a working app you can try on your phone, with all its tests passing.
3. You check it on your devices and commit; then the next milestone starts.

The 6.x app stays in use until 7.0 passes your own check against real data.

## If the session or tokens run out (how work carries over)
Nothing depends on this conversation staying alive:
- **In the repo:** the first M0 task copies this plan into the new repository as `docs/plan/` (an overview plus one file per milestone) and keeps a **`docs/plan/STATUS.md`** updated after every working session. It records:
  - the current milestone
  - each task: done, in progress, or not started
  - decisions made, and open questions
  - the exact next step
- **Small steps:** work is committed in small, working steps (you commit), so at most one unfinished step is ever lost.
- **Memory:** the memory notes in Claude Code point to the plan and STATUS file.
- **Resuming:** any new session, even a fresh one, starts with "continue AuraTrack v7". It reads `docs/plan/STATUS.md` and the current milestone's file, and carries on.
- **Long conversations:** older parts are summarised automatically and work continues. Usage limits are the real stop; after one, simply start again later with the same sentence.

---

## Testing strategy (decided up front, enforced in CI)
Testing comes in layers, because unit tests alone can't show that a screen works on an iPhone.

| Layer | Tool | What it covers | Required |
|---|---|---|---|
| Unit | Vitest | All logic: clinical rules (alert, cluster, seizure time), medication schedule and doses, merge and HLC, encryption, importer, report data, codes and translations | Coverage **at least 90%** for `packages/*`; clinical rules, merge, crypto and importer **close to 100% of branches** |
| Property tests | fast-check (with Vitest) | Merge and sync: any order or duplication of changes gives the same result; the importer never loses a record | Part of unit |
| Mutation tests | Stryker (nightly) | The tests really catch mistakes in clinical rules and merge (they fail when the code is deliberately broken) | Score target at least 80% on those packages |
| Component | Vitest + Testing Library | Every UI kit component and every screen part: states, keyboard and screen reader, focus | Every component |
| End to end | **Playwright** (decided in M0) | Every feature on the 6.1 checklist as a real user flow, in Chromium, **WebKit** (Safari's engine) and Firefox, with phone and tablet emulation | Every checklist item |
| Layout and contrast | the end-to-end tool | No overlap, clipping or offscreen content; contrast; tap sizes, across the device matrix, themes and text sizes | Every screen and sheet |
| Visual | the end-to-end tool's screenshots | Pixel comparison per device, so unintended visual changes are caught | Key screens |
| Multi-device | Playwright contexts, or Vitest with simulated devices | Household sync: devices offline and online, edits, deletions, three devices meeting in different orders; hub on and off | All sync scenarios |
| Offline and PWA | the end-to-end tool | Works offline, update prompt never during recording, crash recovery, persistence | Yes |
| Performance | Lighthouse CI and bundle budgets | First load, interaction speed, bundle size | Budgets block merges |
| Real devices | You, once per milestone | iPhone, iPad, Android phone and tablet, computer | Before each release |

**End-to-end tool: Playwright (decided 2026-10-30 after the M0 trial, `docs/decisions/e2e-tool.md`).** Chromium and Firefox passed 10 of 10 on this computer. WebKit can't start on openSUSE (it's built against Ubuntu's libraries), so it runs in GitHub Actions on Ubuntu on every push, and a WebKit failure blocks the merge.

Why Playwright over Cypress: Cypress is fine for one browser tab, but v7 needs things it does poorly:
- **WebKit, Safari's engine:** essential for iPhone and iPad, and only experimental in Cypress.
- **Several devices in one test:** for household sync.
- **Phone and tablet emulation**, offline mode and service workers.
- **Parallel runs.**
- **Reliability:** the 6.x suite showed retry and seeding problems, and most of its tests had gone stale.

No automated tool runs real iOS Safari on an iPhone, so the per-milestone check on your devices stays. A cloud device lab can be added later if needed.

**Rule:** a feature isn't done until its unit, component and end-to-end tests exist and pass. No milestone is closed with tests skipped.

## Verification
- **In CI on every change:** type check, lint, unit tests, end-to-end tests (WebKit, Chromium and Firefox), the layout and contrast audit across the full device matrix, performance budgets, an accessibility scan.
- **Data:**
  - property tests for the HLC merge (any order of applying changes gives the same result)
  - encryption round trips
  - the importer run on your real 6.1 backup, with a report comparing seizures, durations, medication changes and doses with the 6.1 neurologist report up to 31 Oct
- **Household:** several simulated devices (Playwright contexts or Vitest). Device A records while B is closed; C opens later and gets A's data through B; deletions and edits converge.
- **On your devices, before cut-over:** iPhone, iPad, Android phone and tablet, and a computer. Run a recording, a past seizure, a report shared to HelsaMi, a backup and restore, and the lock screen.
