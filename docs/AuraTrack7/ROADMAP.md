# AuraTrack7 roadmap (iOS, iPadOS, watchOS, Android, tablets, Wear OS)

**Name (decided 2026-11-03):** the native apps are called **AuraTrack7** on every platform (home-screen name, store listings, watch app). All roadmap files live in one folder, `docs/AuraTrack7/`, isolated from the PWA's `docs/plan/`.

## Context
AuraTrack v7 is a working, tested PWA (M0–M7 built). Families told us they want **native apps**: iPhone and iPad with an Apple Watch app, and an Android phone and tablet app with Wear OS. Over a long discussion (2026-11-03) we agreed the apps are **fully native**, **open source**, **free forever with no ads**, **as secure as possible**, with **core feature parity** plus each platform's own strengths. The PWA is paused now and later shrinks to desktop use (possibly a clinician or household admin view).

This is the **permanent roadmap**: the base document every coding session (on WSL and on the Mac) works from, so multi-session work never loses track. Approved by you on 2026-11-03. No milestone starts until you approve its own `N<n>.md` (same rule as the PWA milestones). Current state: `STATUS.md` in this folder.

---

# Part A: The settled decisions (binding)

## A1. Platforms and tools
| | Apple | Android |
|---|---|---|
| Devices | iPhone, iPad, Apple Watch | Phone, tablet, foldable, Wear OS watch |
| Minimum OS | iOS/iPadOS 18, watchOS 11 | Android 12 (API 31); Wear OS 4 (API 33) |
| Build with | Newest stable Xcode (26.x), Swift 6 language mode, strict concurrency | Newest stable Android Studio, AGP, Kotlin 2.x (K2), compile/target SDK = latest |
| UI | SwiftUI, Observation (`@Observable`), SF Symbols, Human Interface Guidelines | Jetpack Compose, Material 3 (Expressive where stable), Material guidelines, Compose for Wear OS |
| Architecture | Apple's recommended patterns: feature modules as local Swift packages, value types, `async/await`, actors | Google's official architecture guide: one-way data flow, ViewModel, Hilt, coroutines and Flow, version catalogs |
| Storage | SwiftData (file protection `.complete`), our per-record AES-GCM sealing on top | Room, DataStore; our per-record AES-GCM sealing on top |
| Keys | Secure Enclave and Keychain (`ThisDeviceOnly`), LocalAuthentication (Face ID, Touch ID) | Android Keystore (StrongBox where available), BiometricPrompt |
| Crypto | CryptoKit (AES-GCM, P-256 ECDH, HKDF, SHA-256), CommonCrypto PBKDF2 (v7 backups) | `javax.crypto` / platform JCA (AES-GCM, ECDH P-256, PBKDF2WithHmacSHA256), HKDF over HmacSHA256 |
| Background, alerts | UserNotifications (time-sensitive, Critical Alerts), ActivityKit, BackgroundTasks | Foreground service (types `health`/`specialUse`), notification channels, AlarmManager exact alarms, WorkManager |
| Tests | Swift Testing, XCTest/XCUITest (incl. `performAccessibilityAudit`) | JUnit, Compose UI tests, Robolectric (Google), Accessibility Test Framework, Compose Preview Screenshot Testing |
| Lint/format | swift-format (Apple) | Android Lint, Kotlin compiler warnings as errors |
| Shipped third-party code | **None** | **AndroidX/Jetpack only**; Firebase Messaging only in the Play build |

**Promise (binding):** features are copied, the PWA's look is not. Each app uses its platform's standard components, navigation and idioms, and the most widely approved coding practices, so it feels made for that platform.

## A2. Repository
One monorepo (`AuraTrack7`). The TypeScript packages are the **reference implementation**; a written **specification plus test vectors** is the contract both native apps must pass byte for byte.
**Layout (decided 2026-11-03), made first, in N0 Part A:**
```
AuraTrack7/                    (repository root)
├── AuraTrack7-PWA/            the PWA (today apps/web), paused
├── AuraTrack7-Apple/          iPhone, iPad, Apple Watch, widgets, extensions: one Xcode project + local Swift packages
├── AuraTrack7-Android/        phone, tablet, Wear OS: one Gradle project (:app, :wear, :core:*, :feature:*), flavours play / fdroid
├── AuraTrack7-Server/         the generic household hub (today apps/server) + tray (today apps/tray)
├── AuraTrack7-Relay/          the push relay (TypeScript, Node built-ins only), Cloud Run
├── AuraTrack7-Shared/
│   ├── spec/                  protocol and data specification (Markdown) + vectors/*.json
│   ├── packages/              the TS reference (model, store, sync, i18n, reports, ui) + vectors (generator)
│   └── scripts/i18n-native/   generates String Catalogs (.xcstrings) and strings.xml from packages/i18n
├── docs/AuraTrack7/           roadmap, STATUS, parity, extras, decisions (PWA history stays in docs/plan/)
├── .github/workflows/         one workflow per folder, each running only when its folder (or Shared) changes
└── LICENSE, README.md, CLAUDE.md, package.json, pnpm-workspace.yaml
```
Root scripts (`pnpm dev`, `build`, `test`, `lint`, `typecheck`) keep working over the TS folders.

## A3. Privacy and security (binding)
- **No data collection by us or by anyone we let in.** Medical data and user ids stay on the household's devices. No analytics, no crash SDKs, no ads, no tracking, ever.
- **New wording of the hosted-server rule:** "No records on any hosted server. The only hosted part is the push relay: opt-in at household setup, it passes on sealed alerts it cannot read and keeps nothing."
- iCloud Backup only ever holds unreadable data (keys are `ThisDeviceOnly`); Android cloud backup and device transfer are switched off (`dataExtractionRules`). Moving to a new phone goes through the household or our backup file.
- **HealthKit and Health Connect: read only, never write.**
- No Siri, Spotlight or suggestion donations with content; lock-screen surfaces show neutral text, no names by default.
- iOS: third-party keyboards refused; app-switcher snapshot covered. Android: `IME_FLAG_NO_PERSONALIZED_LEARNING` on all text; screenshot blocking (`FLAG_SECURE`) as a setting.
- Firebase: Messaging only, Analytics never included, automatic collection off. (FCM itself needs a Firebase installation id: documented, contains no medical data.)
- Every release has an SBOM and a threat-model check; F-Droid builds are reproducible.

## A4. Data and migration
- **Main way in:** the encrypted **v7 backup file** from the PWA (lossless), followed by a comparison report.
- **Also:** CSV import in the v7 format (for spreadsheets; lossy by nature).
- 6.1 users go through the PWA first. No 6.1 importer in the native apps.
- No Argon2id natively (keys sit in hardware). v7 backups stay PBKDF2-SHA256 (600,000 rounds) + AES-GCM, so any backup opens on any platform.

## A5. Household, hub, alerts
- One household with iPhone, Android and PWA devices as members, using **one protocol**.
- Native ↔ native on the same Wi-Fi: Bonjour/mDNS (Network.framework / NsdManager) + TLS with the household keys.
- **Native ↔ PWA:** through the hub, or the update file/QR. (The PWA's direct link is WebRTC, which isn't native on either platform; the PWA is being phased down.) Recorded as decision D-11.
- **The hub:** the existing Node hub is the single, generic hub for every computer (Mac, Windows, Linux single executable; Docker for Pi/NAS). A written hub protocol that all apps speak.
- **Alert routes, layered:**
  1. the recording phone or watch: its own alarms (local notifications, scheduled at Start)
  2. at home: the hub (iOS Local Push Connectivity on named Wi-Fi networks; Android foreground connection)
  3. anywhere: the **sealed relay** (one shared relay for all households, opt-in asked during household setup)
  4. people without the app: SMS (Android sends automatically; iPhone prepares it, the user taps Send; never on the recording screen)
- **Relay design:** sealed addresses (push token sealed to the relay's key, plus a per-recipient household secret, so only household members can send to a phone); alerts signed by a household member and sealed to the receiving device; constant size; no database, no logs; least-privilege keys; GitHub Actions deploy with OIDC; budget alert; max instances. Hosted on **Google Cloud Run, `europe-north1`**. F-Droid build gets alerts through **UnifiedPush** (ntfy).

## A6. Watches, health data, detection
- Apple Watch and Wear OS are built **together with** the phone apps (Wear OS in the Play build only, since the Wearable Data Layer needs Play Services).
- Health data read: heart rate and HRV; sleep; activity, SpO2, breathing rate, wrist temperature; menstrual cycle (opt-in only).
- Correlations: views plus simple statistics, neutral wording ("shown together"), with the amount of data shown. Subject to your regulatory adviser.
- **Seizure detection is in the plan:** generalized tonic-clonic seizures, monitoring whenever the wearer chooses. A detection starts a countdown on the wrist; if not cancelled, **a recording starts automatically, counting from the estimated onset** (marked approximate). It's built early, beside the watch apps, **hidden in released apps until you confirm regulatory approval**, and off by default when it does ship.

## A7. Licence, regulation, distribution, CI
- **GPL-3.0-or-later with an app-store exception** (GPLv3 §7 additional permission), added now while you hold all copyright, plus a **name policy** for AuraTrack, AuraTrack7 and the logo (forks must rename): the names are used with ™ (no registration needed), the licence carries a GPLv3 §7(e) term declining rights to the names, and `TRADEMARKS.md` states the policy. **Registration is optional and later** (Patentstyret or EUIPO, with a fee), when the project is bigger.
- **MDR Class I, self-declared**, with its own regulatory track (below). The adviser work is yours.
- Distribution: App Store (Grey-Matter AS, $99/yr), Google Play (organisation account, $25 once), F-Droid (free).
- **CI: GitHub Actions only** (free for public repositories, incl. macOS). Apple signing via an App Store Connect API key with cloud-managed signing; the key in a GitHub *environment* limited to release tags with you as required approver. Android: Play App Signing; upload key in a protected environment.

## A8. Way of working (binding, carried over)
- Milestone by milestone; you approve each milestone's `N<n>.md` before it starts; **you commit**.
- **Parallel platforms:** each feature milestone delivers on Apple **and** Android before it's closed (a platform may lag by one slice inside a milestone, never across milestones).
- Medical data integrity first; codes, not English text, in stored data; 9 languages; careful, neutral wording.
- A feature isn't done until its unit, UI and audit tests pass on both platforms and the shared vectors pass.
- Full device-matrix audits only when you ask (as now); targeted audits otherwise.

---

# Part B: What we need to start (yours)

## B1. Accounts (order matters: some take weeks)
1. **D-U-N-S number** for Grey-Matter AS (free; needed for an Apple organisation account; can take 1–2 weeks).
2. **Apple Developer Program**, organisation enrolment ($99/yr). Then in App Store Connect: app record, bundle ids (`no.greymatter.auratrack7` or your choice, plus watch, widget, notification service and push extension ids), **App Store Connect API key** for CI.
3. **Apple entitlement requests** (start early, approval takes time):
   - Critical Alerts (`com.apple.developer.usernotifications.critical-alerts`)
   - Local Push Connectivity (`com.apple.developer.networking.networkextension` app-push-provider)
   - HealthKit (standard; capability only)
   - A written question to App Review about workout sessions for seizure monitoring (detection)
4. **Google Play Console**, organisation account ($25 once) with developer identity verification. Organisation accounts are exempt from the "12 testers for 14 days" rule.
5. **Firebase project** (Messaging only, Analytics never enabled), linked to a **Google Cloud project** with billing, a **€1 budget alert**, region `europe-north1`.
6. **F-Droid**: nothing until the first release (they build from the public repo).
7. **Trademark registration: not now.** We use the names with ™ and the policy in A7. Registering later at Patentstyret or EUIPO (fee) is your call.
8. **Regulatory adviser** engaged (your track).

## B2. Hardware
- **Mac** with Apple silicon (you have one). At least 16 GB RAM is comfortable for Xcode and simulators.
- **Test devices:** a small iPhone (SE or mini size), a large iPhone, an iPad, an Apple Watch (ideally one with cellular); an Android phone (ideally one older mid-range, Android 12 or 13), an Android tablet, a Wear OS watch (Galaxy Watch or Pixel Watch).

## B3. Software
- **Mac:** Xcode 26.x (App Store), Command Line Tools, Git, Node 24 and pnpm (to run the TS reference and vector generator), **Claude Code**, the monorepo cloned. Simulator runtimes: iOS 18 + latest, watchOS 11 + latest.
- **Windows side:** Android Studio (latest stable) for emulators (phone, tablet, foldable, Wear OS) and device debugging.
- **WSL:** JDK 21, Android command-line tools and SDK (for Gradle builds and unit tests from Claude Code), the existing Node toolchain.

## B4. Preparation decisions to confirm in N0 (small)
- Bundle and package ids (proposed `no.greymatter.auratrack7` and its extensions); display name **AuraTrack7**; version scheme (the same version on both platforms for the same feature set; whether the first store release is 1.0 or continues 7.x is settled in N0).
- Who receives security reports (`SECURITY.md` contact address).

---

# Part C: Milestones

Sizes: S (days), M (1–2 weeks), L (2–4 weeks), XL (more). Each milestone gets its own `N<n>.md` with slices, written and approved just before it starts, and a sign-off file at the end mapping every item to its tests.

## Phase 0: Preparation

### N0 · The move to six folders, then accounts, machines, decisions (M)
- **First, Part A: the move to the six folders (A2).** `git mv` everything so history is kept; update paths in `pnpm-workspace.yaml`, tsconfig files, Vitest, Playwright, Stryker, ESLint, the Dockerfile, every CI workflow (incl. `hub-release.yml`, `mutation.yml`), scripts, `vercel.json`, `CLAUDE.md` and the docs. All checks green before and after; the PWA runs on Vercel from the new layout (preview first, then production) and you've committed, before Part B starts.
- **Then, Part B:** B1–B4 above; I write checklists and verify the toolchains on both machines (a "hello" SwiftUI app and Compose app built and tested locally and in CI).
- **Done when:** the PWA runs on Vercel from the six folders; both toolchains build an empty app on device; CI runs macOS and Android jobs green; the entitlement requests are sent.

### N1 · Governance and rules (M)
- Licence exception text in `LICENSE` header and `COPYING-EXCEPTION`; `TRADEMARKS.md`; `CONTRIBUTING.md` (DCO sign-off); `SECURITY.md`; `CODE_OF_CONDUCT.md`.
- `CLAUDE.md` updated with the native binding rules (A1–A8), the relay wording, the detection rule.
- `docs/AuraTrack7/` files, threat model v1 (`docs/AuraTrack7/threat-model.md`).
- Skeletons of `AuraTrack7-Apple`, `AuraTrack7-Android`, `AuraTrack7-Relay`, `AuraTrack7-Shared/spec`; CI path filters so each folder runs only when it (or Shared) changes.
- **Done when:** you've approved the rules text; CI skeleton green.

### N2 · Specification and test vectors (L, WSL)
The contract. Written from the TS reference, generated vectors checked by the TS tests themselves.
- `AuraTrack7-Shared/spec/data-model.md`: every record type (from `packages/model/src/schemas/`), canonical JSON, ids, HLC.
- `AuraTrack7-Shared/spec/codes.md` + `AuraTrack7-Shared/spec/vectors/catalogue.json`: the codes catalogue.
- `AuraTrack7-Shared/spec/crypto.md`: per-record AES-GCM with AAD, device key, the v7 backup format, recovery kit, dropbox (locked start), sealing for sync.
- `AuraTrack7-Shared/spec/merge.md`: field-level merge, dose rank, tombstones, change log.
- `AuraTrack7-Shared/spec/rules.md`: emergency plan (alert 5 min, cluster 3 in 8 min), 12-minute auto-stop, seizure time from phase marks, clusters, regimen history, scheduled/missed/assumed doses, local-date rules.
- `AuraTrack7-Shared/spec/recording.md`: the recording reducer's events and states (`rules/recording.ts`).
- `AuraTrack7-Shared/spec/sync.md`, `AuraTrack7-Shared/spec/hub-protocol.md`: pairing, membership, session protocol, hub `/v1` API.
- `AuraTrack7-Shared/spec/csv.md`: the CSV format (`model/src/rules/csvFormat.ts`).
- `AuraTrack7-Shared/packages/vectors`: generator → `AuraTrack7-Shared/spec/vectors/*.json` (crypto, merge cases incl. property-test seeds, rules cases, recording event sequences, backup files, CSV files, report numbers).
- `AuraTrack7-Shared/scripts/i18n-native`: String Catalog and `strings.xml` generation, checked in CI (placeholders, no empty strings, clinical wording kept).
- **Done when:** every spec section has vectors; the TS reference passes them; you've read the spec summaries.

## Phase 1: Native foundations (both platforms in parallel)

### N3 · Project skeletons and design system (L)
- **Apple:** Xcode project with targets: iOS/iPadOS app, watchOS app, widget extension (widgets, Live Activities, controls), Notification Service Extension, App Intents, push provider extension (later). Local packages: `AuraModel`, `AuraRules`, `AuraCrypto`, `AuraStore`, `AuraSync`, `AuraKit` (UI), `AuraReports`, `AuraDetect`.
- **Android:** `:app`, `:wear`, `:core:model`, `:core:rules`, `:core:crypto`, `:core:store`, `:core:sync`, `:core:designsystem`, `:feature:*`, `:detect`; flavours `play` and `fdroid`.
- **Design system:** tokens from `AuraTrack7-Shared/packages/ui/src/tokens.css` (colours, the 5 accents, darkened action colour for 4.5:1), mapped onto the platform's own type scale (Dynamic Type / Material type scale). `AuraKit` and `:core:designsystem` hold only what the platforms lack (body map, timeline, recording buttons, emergency screen tone). Everything else is a platform component.
- **The layout and accessibility audit, native edition:**
  - XCUITest and Compose UI tests that open every screen across the matrix and check element frames (no overlap, nothing off screen, nothing clipped), plus `performAccessibilityAudit` (iOS) and the Accessibility Test Framework (Android): contrast, hit areas (44 pt / 48 dp), text clipping, labels.
  - Matrix: iPhone SE-size, 6.1", 6.9", landscape, iPad mini, 11", 13", Split View; Apple Watch 41/46/49 mm. Android 360 dp phone, 411 dp phone, large phone, foldable inner/outer, 10" tablet, landscape; Wear round small/large.
  - Text: iOS xSmall to AX5; Android font scale 0.85 to 2.0 and display size; dark and light; 9 languages plus a long pseudo-language.
  - A self-test with deliberately broken screens that the audit must catch (as on the web).
  - Lint rule: screens use platform components and the kit only.
- **Done when:** a kitchen-sink screen per platform passes the full audit; screenshot baselines exist.

### N4 · Model, codes, rules (M)
- Port the model, the catalogue and every clinical rule to Swift and Kotlin; all rule vectors pass; property tests (Swift Testing parameterised + Kotlin) replay the TS seeds.
- **Done when:** 100% of rule vectors pass on both; branch coverage of rules close to 100%.

### N5 · Secure store and app lock (L)
- Device key in Secure Enclave / Keystore; record sealing (AES-GCM with AAD) per the spec; change log; HLC; field-level merge; tombstones; working set.
- App lock: PIN plus Face ID/Touch ID/fingerprint; lock after the time away you set, never during a recording; the OS limits attempts.
- Backup exclusions, keyboards, app-switcher cover, screenshot setting (A3).
- Backup file: write and read v7 backups (PBKDF2 + AES-GCM) byte-compatible with the PWA; restore by change-log replay.
- **Done when:** crypto, merge and backup vectors pass on both; a PWA-made backup restores natively and a native backup restores in the PWA.

## Phase 2: Core parity (both platforms in parallel)

### N6 · Recording engine, Home and recording screens (L)
- Port of the recording reducer; the seizure written at Start; every tap one write; crash recovery (`recover()`), including past-12-minute recordings.
- At Start, the 5-minute alert, the one-minute warning and the 12-minute stop are **scheduled as local notifications** (time-sensitive; Critical when granted), so they fire with the app closed; cancelled on stop.
- Screens: Set-up, Home (Start, Log past seizure, last 5 with badges, cancelled and locked-recording cards), Recording (carer phases or self Stop, timers, warning, red emergency screen with rescue medication and contact, 12-minute stop, quick notes, optional symptom strip, cluster warning at Start; **no other buttons**), Log past seizure, lost-recording question.
- Screen stays on (`isIdleTimerDisabled` / `keepScreenOn`), haptics, optional beep.
- **Done when:** F-101–F-102, F-201–F-208, F-210–F-213, F-215, F-1005 pass on both; recording vectors pass; Start under 100 ms.

### N7 · Lock screen and system entry points (M)
- **Apple:** Live Activity + Dynamic Island with the timer and phase; Control Center control, Lock Screen widget, Action Button, App Intents ("Start seizure recording"), all starting a recording without unlocking (the locked-start dropbox, per `docs/decisions/locked-start.md`); Critical Alerts if granted.
- **Android:** foreground service with an ongoing timer notification (Live Updates on Android 16); Quick Settings tile; lock-screen shortcut; activity shown over the lock screen; home-screen widget (Glance); alarm channel that may bypass Do Not Disturb.
- The locked alert card follows the existing settings (`lockedAlertContent`, `lockedShowName`).
- **Done when:** F-1003 passes natively from every entry point; the dropbox merges at unlock with nothing lost (vectors).

### N8 · Seizure editor and logging (XL)
- Classification (type, ILAE questions, "not sure"), Before (warning time, triggers, symptoms), During, After (findings, areas, recovery), Notes; overview strip; vertical timeline (F-314, one component in editor, review, detail and PDF); body map (Apple Pencil on iPad); Review; edit history; discard flagged; "leave without saving?"; only changed fields saved.
- Saved sets, own symptoms, quick-note labels, between-seizures log.
- **Done when:** F-301–F-315 (editor parts), F-303, F-304, F-313 pass on both; the timeline audit passes at the largest text size.

### N9 · Watch apps and the detection engine (XL; detection hidden)
- **Apple Watch and Wear OS:** Start, carer phases, Stop; timers; haptics at warning, 5 min and 12 min; quick notes; complications / Smart Stack (Apple), Tiles and complications (Wear); Double Tap and the Action Button on Ultra; standalone recording on a cellular watch; sync to the phone (WatchConnectivity / Wearable Data Layer); heart rate at a high rate during a recording.
- **Detection (`AuraDetect`, `:detect`), hidden behind a release flag:**
  - monitoring sessions the wearer starts and stops, any time (Apple: workout session if App Review agrees; Wear OS: foreground health service)
  - rule-based detector for generalized tonic-clonic seizures (rhythmic movement + heart-rate rise), on the watch
  - countdown on the wrist (15–30 s) to cancel; then a recording starts automatically from the **estimated onset**, marked "detected" and "approximate"; carers alerted through every route; cancelled detections kept and counted as false alarms
  - **replay bench** in CI: recorded sensor traces (synthetic + consented clinical traces when available) run through the detector, reporting sensitivity and false alarms per change
- **Done when:** watch recording passes its tests on both; detection passes the replay bench on synthetic traces; release flag proven off in release builds.

### N10 · History and graphical timelines (L)
- Seizure list with filters kept; event detail with the timeline, danger flags, edit history; delete with tombstone; trend chart (Swift Charts / Compose Canvas); the History timeline over days and weeks; between-seizures entries.
- iPad and tablet: list and detail side by side.
- **Done when:** F-401–F-404, F-315, F-409 pass on both.

### N11 · Medications and doses (L)
- Add/change/stop medication with confirm sheets, rename reasons, change history, tracking start date, dose panel, extra dose, history grid, assumed (90 min, 31-day backfill) and missed doses.
- **Reminders as real scheduled notifications** per patient (a big gain over the PWA), with actions "Taken" and "Snooze" (opening the app only when needed).
- **Done when:** F-104, F-105, F-405, F-501–F-509 pass; dose-rule vectors pass.

### N12 · Patients, settings, wellbeing, EEG diary, help (L)
- Patients (add, rename, colour, remove, switcher, "Recording for"); every settings group (identity, appearance with the platform's own text size and theme, display, recording and emergency plan, clinician, data and backup, app lock); wellbeing module (off by default; check-in, factors, daily reminder, correlation view); EEG diary (sessions, activities, seizure references); Help, About, What's new; backup reminder.
- Language: follows the system language per app (iOS per-app language, Android per-app locales), with the in-app choice of the 9.
- **Done when:** F-106, F-107, F-110, F-111, F-406, F-407, F-551–F-554, F-581–F-583, F-585, F-601–F-607, F-901–F-906 pass.

### N13 · Video (M)
- Recording during a seizure (AVFoundation / CameraX), front or back, overlay with start time and elapsed; linked to the seizure; stays on the recording device; file protection; never in the cloud backup.
- **Done when:** F-209 passes on both; storage and deletion tested.

### N14 · Reports and export (XL)
- Neurologist report, event log, monthly diary, EEG diary (PDFKit / `ImageRenderer` on Apple; `PdfDocument`/Canvas on Android), following `docs/plan/report-inventory.md` and the M5 additions; CSV export in the v7 format; preview; share sheet.
- **Report-number vectors:** the same data gives the same numbers on all three platforms.
- **Done when:** F-701–F-707 and F-408 pass; PDFs reviewed by you side by side with the PWA's.

### N15 · Import, backup and the move from the PWA (M)
- Restore from a PWA v7 backup file (Files app, share sheet, "Open in AuraTrack7"), with the comparison report; CSV import with the same checks as the PWA (`AuraTrack7-Shared/packages/store/src/importCsv.ts`: problems listed, nothing written until confirmed, duplicates skipped); backup creation and reminders.
- In the PWA (a small change, allowed while paused): a "Moving to the app" guide that makes the backup and explains the steps.
- **Done when:** F-801, F-802, F-805 pass; your own PWA data moves to both platforms with a matching comparison report.

### N16 · Household sync, native (XL)
- Create and join by QR (camera) and PIN across platforms; device names; follow patients; remove a device (key replaced); sync by meeting on the same Wi-Fi (Bonjour/NSD + TLS); the hub client (HTTPS); update by QR or file; "Household up to date?"; conflict notes.
- Native ↔ PWA through the hub or the file (D-11).
- iOS Local Push Connectivity extension (at home, on named Wi-Fi); Android foreground connection to the hub (also over Tailscale).
- Multi-device tests: simulators/emulators plus the TS reference as a third device; three devices meeting in different orders; deletions; removal.
- **Done when:** F-1101–F-1106, F-1201–F-1202 pass in a mixed household (iPhone, Android, PWA, hub).

### N17 · Alerts everywhere: relay, push, SMS (L)
- `AuraTrack7-Relay` built and deployed (A5 design); APNs and FCM senders; UnifiedPush for F-Droid; Notification Service Extension (iOS) and messaging service (Android) open the sealed alert; Critical Alerts where granted.
- The opt-in question during household setup; per-device and per-patient alert choices; plain statement of what passes through Apple, Google and the relay.
- **Alert-only token** kept in the clear so a recording started from the lock screen alerts at once (the open M7 decision, settled for native).
- SMS to chosen contacts: Android automatic at Start and/or 5 min (Play SMS permission declaration; F-Droid without restriction); iPhone prepared message from the emergency screen.
- **Done when:** F-1203 passes for every sender/receiver pair (iPhone, Android, watch) at home and away; relay compromise tests (forged, replayed and unsigned alerts are shown nowhere).

## Phase 3: Platform depth

### N18 · Health data and correlations (L)
- HealthKit / Health Connect read permissions per type (A6); heart rate around each seizure; sleep, activity, SpO2, breathing, temperature, cycle (opt-in) on the timelines; simple statistics with the data count shown and neutral wording; a report section.
- **Done when:** permissions, denial and partial data are tested; nothing is ever written to either store (test).

### N19 · iPad, tablets and foldables, done properly (M)
- Apple: `NavigationSplitView` everywhere it helps, multiple windows (scenes), Stage Manager, keyboard shortcuts and menu commands, pointer, drag and drop of reports, Pencil on the body map.
- Android: adaptive layouts (window size classes, list-detail and supporting-pane scaffolds), foldable postures, keyboard and mouse, drag and drop, multi-window.
- **Done when:** the audit passes on every tablet size and posture; you've used it on your iPad and Android tablet.

### N20 · Accessibility and language pass (M)
- VoiceOver, TalkBack, Voice Control, Voice Access, Switch Access on every screen; Reduce Motion, Bold Text, Increase Contrast, colour-blind check; the watch apps too.
- Native-speaker translation review (at least Norwegian), store-listing texts in all 9.
- **Done when:** manual pass on real devices with each screen reader; zero audit issues.

## Phase 4: Release

### N21 · Security hardening and review (M)
- Threat model rechecked against the code; dependency and SBOM review; reproducible F-Droid build verified; key handling review (Secure Enclave, Keystore, relay); an independent review if possible (e.g. a free open-source audit programme such as OTF's Red Team Lab, applied for in N0).
- **Done when:** findings fixed or accepted by you in writing.

### N22 · Regulatory track: Class I file complete (M, alongside every milestone, finished here)
- Intended-use statement (one text, used in listings, About and the CE declaration); risk management file (ISO 14971); software lifecycle records (IEC 62304: requirements = this roadmap and parity list, verification = sign-off files and CI); usability evidence (IEC 62366); post-market surveillance plan; declaration of conformity; UDI; EUDAMED registration; labelling (CE mark and UDI in About).
- Change-control procedure for releases and toolchain updates.
- **Done when:** your adviser signs off.

### N23 · Beta (M)
- TestFlight (internal, then external with a few families); Play internal → closed testing; feedback and fixes.
- **Done when:** a few families have used it for at least two weeks with no data loss.

### N24 · First store release of AuraTrack7 (S)
- Store listings in 9 languages (wording: records and times seizures, reminds of the emergency plan, shares within the household; never "detects", "predicts", "prevents", "life-saving"; not a replacement for emergency services); privacy labels ("Data not collected", checked word for word against the stores' rules on end-to-end encrypted data); Play health apps declaration; Apple medical device status; screenshots per device family and language; App Store phased release, Play staged rollout; F-Droid metadata.
- **Done when:** AuraTrack7 is live on the App Store, Google Play and F-Droid; tagged.

## Phase 5: After the first release (ordered, each a milestone when its time comes)

| # | Milestone | Content |
|---|---|---|
| N25 | Detection release | Only after your regulatory confirmation: clinical validation results in the replay bench, release flag on, careful onboarding and limits text |
| N26 | Watch depth | Independent watch-only households, more complications, Smart Stack relevance, Wear OS Tiles refresh |
| N27 | PWA's new role | Decide and build: desktop viewer, clinician view (records shared by sealed file or through the hub, never a hosted server), or household admin |
| N28 | Mac | Native macOS app (SwiftUI) for reports and desktop use, possibly replacing the PWA's desktop role; can also host the hub |
| N29 | Structured export | FHIR export of reports (prepared by the coded model), for a possible Helsenorge route later |
| N30+ | Feature requests | From families and clinicians, each through the normal milestone process |

## Phase 6: Permanent yearly cycle (repeats every year)
| When | Milestone "Platform year YYYY" |
|---|---|
| June (WWDC) / May (Google I/O) | Read what's new; list new APIs that fit AuraTrack (with privacy check); plan |
| July–August | Build against the betas in a branch; fix deprecations; new extras behind availability checks |
| September (iOS) / when Android's new version ships | Release with the new SDKs; raise the minimum OS by the rule below; regulatory change record |
| Yearly | Rotate relay keys, review the threat model, licence and trademark, renew the Apple membership |

**Minimum-OS rule:** keep supporting an OS while Apple or Google still ship security updates for it and it is above a few percent of our users' devices (as seen in the stores' own anonymous figures). Raised at most once a year, announced in the app one version ahead.

## PWA track (paused)
- Stays the reference implementation: its packages must keep passing the vectors; CI stays green.
- Security fixes only, plus the small "Moving to the app" guide (N15).
- The open PWA checks (M3/M6/M7 phone checks, translation review, 7.0/7.1 tags) are listed in `docs/plan/STATUS.md` and done only if you want them.
- After the first native release: N27 decides its new role.

---

# Part D: Parity map (summary; the full table is `parity.md`)

| PWA features | Native milestone | Apple way | Android way |
|---|---|---|---|
| F-101–F-102, F-201–F-208, F-210–F-213, F-215 recording | N6 | SwiftUI, local notifications, `isIdleTimerDisabled`, Core Haptics | Compose, foreground service, exact alarms, `keepScreenOn`, VibrationEffect |
| F-1003 start from the lock screen | N7 | Live Activity, Control Center, Lock Screen widget, App Intents | Ongoing notification, QS tile, lock-screen shortcut, `showWhenLocked` |
| F-1005 crash-proof recording | N6 | SwiftData writes per tap, `recover()` | Room writes per tap, `recover()` |
| F-209 video | N13 | AVFoundation | CameraX |
| F-214, F-581–F-585 EEG diary | N12 | | |
| F-301–F-315 editor, timeline, body map | N8 | SwiftUI, Canvas, Pencil | Compose, Canvas, stylus |
| F-103, F-401–F-404, F-409, F-315 history | N10 | Swift Charts | Compose Canvas charts |
| F-104, F-105, F-405, F-501–F-509 medications | N11 | UserNotifications with actions | AlarmManager + notification actions |
| F-106, F-406, F-551–F-554 wellbeing | N12 | | |
| F-108 install banner, F-109 update bar | dropped | Stores handle installs and updates | Stores handle installs and updates |
| F-110 backup reminder, F-801–F-802, F-805 | N15 | Files app, share sheet, document types | Storage Access Framework, share sheet |
| F-111, F-601–F-607 patients and settings | N12 | System text size and theme first | System font scale and theme first |
| F-701–F-707, F-408 reports and CSV | N14 | PDFKit, `ImageRenderer` | `PdfDocument`, Canvas |
| F-803–F-804, F-1101–F-1106 household | N16 | Network.framework, Bonjour, AVFoundation QR scan | NsdManager, TLS sockets, CameraX QR scan (Android has no built-in QR decoder without Play Services: which decoder the F-Droid build uses is decided in N16) |
| F-806 persistent storage | not needed | Native storage is persistent | Native storage is persistent |
| F-901–F-906 help, about, languages, offline, a11y, toasts | N12, N20 | Native alerts and banners in place of toasts | Snackbars |
| F-1001–F-1002 encryption, app lock | N5 | Secure Enclave, Keychain, LocalAuthentication | Keystore/StrongBox, BiometricPrompt |
| F-1004 merge and audit trail | N5 | Vectors | Vectors |
| F-1006 6.1 importer | dropped natively | via the PWA | via the PWA |
| F-1201–F-1204 hub and push | N16, N17 | Hub client, Local Push, APNs via relay | Hub client, foreground connection, FCM/UnifiedPush via relay |

# Part E: Extras (summary; the full list is `extras.md`)
- **iPhone:** X-101 Live Activity and Dynamic Island · X-102 Control Center control · X-103 Lock Screen widget · X-104 Action Button · X-105 Siri and Shortcuts (App Intents) · X-106 Critical Alerts · X-107 Home Screen widgets (last seizure, today's doses; neutral text) · X-108 Focus filter (alerts through Focus).
- **iPad:** X-201 split view everywhere · X-202 multiple windows and Stage Manager · X-203 keyboard shortcuts and menus · X-204 Pencil on the body map · X-205 drag and drop of reports.
- **Apple Watch:** X-301 recording on the wrist · X-302 complications and Smart Stack · X-303 Double Tap · X-304 Action Button (Ultra) · X-305 cellular standalone · X-306 heart rate during recording · X-307 detection (hidden until approved).
- **Android:** X-401 Quick Settings tile · X-402 ongoing timer notification and Live Updates · X-403 lock-screen shortcut · X-404 Glance widgets · X-405 automatic SMS · X-406 alarm channel through Do Not Disturb · X-407 app shortcuts.
- **Android tablets and foldables:** X-501 adaptive list-detail · X-502 foldable postures · X-503 keyboard, mouse, drag and drop.
- **Wear OS:** X-601 recording on the wrist · X-602 Tiles and complications · X-603 heart rate during recording · X-604 detection (hidden until approved).
- **Both:** X-701 health data views and statistics · X-702 dose reminders with "Taken" from the notification · X-703 real background alerts.

# Decisions recorded (one note each in `decisions/`)
D-1 native apps named AuraTrack7, PWA paused · D-2 tools and minimum OS · D-3 monorepo in six folders (PWA, Apple, Android, Server, Relay, Shared) and spec-with-vectors · D-4 privacy rules (A3) · D-5 hosted-server rule wording and the sealed relay (Cloud Run, europe-north1) · D-6 generic hub · D-7 GPL-3.0 + app-store exception + name policy (™, §7(e), registration later) · D-8 Class I self-declared, regulatory track · D-9 Play + F-Droid builds · D-10 v7 backup main import, CSV too, no 6.1 natively · D-11 native ↔ PWA through the hub or file · D-12 watches with the phones; detection early, hidden; auto-start from estimated onset · D-13 health data read-only, views + simple statistics · D-14 GitHub Actions only, signing via API key · D-15 parallel platforms per milestone.

# How sessions carry on (multi-session, two machines)
- Every native session starts by reading `docs/AuraTrack7/STATUS.md`, then the current `N<n>.md`.
- STATUS.md says per slice: **Apple / Android / shared**, done or not, and **which machine** the next step needs. The Mac session does `AuraTrack7-Apple`; the WSL session does everything else. Each session starts with `git pull` and ends by updating STATUS.md; you commit and push so the other machine sees it.
- Sign-off file per milestone (`N<n>-signoff.md`) maps each item to its tests on both platforms.
- The roadmap itself changes only with your approval; changes are logged at the bottom of `ROADMAP.md` with the date.

# Changes to this roadmap
The roadmap changes only with your approval. Each change is logged here with its date.

| Date | Change |
|---|---|
| 2026-11-03 | First version, approved |
| 2026-11-03 | The move to six folders moved from N1 to N0 (Part A, first), at your request: the PWA runs from the new layout on Vercel before accounts and money are spent |
