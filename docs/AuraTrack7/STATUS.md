# AuraTrack7 native: status

**Read this first in every native session.** Then read `ROADMAP.md` (Part A is binding) and the current milestone's `N<n>.md`, and continue with "Next step".

- **Current milestone:** N0, The move to six folders (Part A), then accounts, machines, decisions (Part B). **Part A: committed to `main` (`dcc6958`, `0ba28c7`), Vercel production built from the new layout (Root Directory `AuraTrack7-PWA`). CI green on `main` (2026-11-04, `fcc44c7`). Left: your phone check of production.**
- **Roadmap:** approved 2026-11-03 (`ROADMAP.md`).
- **PWA:** paused 2026-11-03. Its open checks are listed in `docs/plan/STATUS.md`.
- **Last updated:** 2026-11-06 (WSL)

## Next step
1. ~~Commit the CI fix and check CI~~: done, CI green on `main` (`fcc44c7`).
2. **You:** on your phone, against production:
   - [ ] the app loads and shows Home
   - [ ] start and stop a test recording; it's in History
   - [ ] airplane mode, reload: it still opens
   - [ ] an installed copy picked up the update
3. **You:** look at the 2026-11-06 changes (below), commit them, and check that CI is green again. Before opening the new version on your phones, see "On your phones" below.
4. **Then:** Part A is done; Part B (accounts, D-U-N-S, Apple and Google enrolment, toolchains), including checking every ⚠ row in `extras.md` against Apple's and Google's documentation (D-20).

## N0 A2–A4: the move (2026-11-03, WSL)
- `git mv`: `apps/web` → `AuraTrack7-PWA`, `apps/server` → `AuraTrack7-Server/hub`, `apps/tray` → `AuraTrack7-Server/tray`, `packages/*` → `AuraTrack7-Shared/packages/*`. Package names unchanged.
- Paths updated in: `pnpm-workspace.yaml`, `tsconfig.json` and every package's `extends`, `vitest.config.ts`, `playwright.config.ts`, `stryker.config.json`, `eslint.config.js`, `lint-rules.test.ts`, the e2e support files and `dev.spec.ts`, `package.json` (`pnpm hub`), `scripts/*.mjs`, the hub's `package.mjs`, `Dockerfile` and `README.md`, `hub-release.yml`, `vercel.json` (`outputDirectory: AuraTrack7-PWA/dist`), `CLAUDE.md` (with a layout note). `ci.yml` and `mutation.yml` needed nothing. History in `docs/plan/` and `docs/decisions/` keeps the old paths; `docs/plan/STATUS.md` says so.
- Lockfile: only the workspace links changed, no dependency version. `--frozen-lockfile` passes.
- Found and fixed on the way: `Backup.tsx` had the same flaky pattern as `ImportCsv` (busy cleared one step after the test ended; seen in `cards.test.tsx`). Its five handlers are now one `async` function each with `try/finally`; restore and the 6.x import refresh the lists before showing the result.
- After the move (same as A1): format, typecheck, lint pass; 92 files, 1215 tests; coverage statements 97.42%, branches 90.55%, functions 98.01%, lines 98.7%; build passes; size 75.7 KB; e2e Chromium (app, recording, shell, m4, household, date-fields, passkey, dev; no audit) 28 passed; Stryker dry run: the same 15 files and 2343 mutants; hub + tray package builds with the app inside.
- Then, at your request, more out of the root: `playwright.config.ts`, `vercel.json` (`outputDirectory: dist`), `check-size.mjs`, `build-icons.mjs` into `AuraTrack7-PWA` (scripts in `AuraTrack7-PWA/scripts`); `build-catalogue.mjs`, `gen-6x-reference.mjs` into `AuraTrack7-Shared/scripts`; `e2e-trial/` removed. Root commands unchanged (`pnpm e2e`, `audit`, `visual` pass `-c AuraTrack7-PWA`). Checked again: static checks, 1215 tests, size 75.7 KB, e2e 28 passed, and a Vercel-style install and build inside `AuraTrack7-PWA`.
- 2026-11-04: pushed straight to `main` (no preview branch); Vercel production built fine. CI failed on one test, `session.peer.test.ts` "refuses a list with far too many ids": it gave the session 400 ms while sealing 200,001 ids itself, too short on GitHub's runner. Its limit is now 15 s (test only). The scheduled mutation failure of 2026-11-03 was the old `reports` ignore in Stryker, already fixed in A1.
- Not checked here: the Docker image (no Docker on WSL); the hub single executable (`sea`, built by `hub-release.yml`).

## N0 A1: checks before the move (2026-11-03, WSL)
First run: branch coverage 88.98%, below the 90% threshold. Fixed before moving anything:
- new tests: `packages/model/src/rules/csvFormat.test.ts`, more cases in `packages/store/src/importCsv.test.ts`
- `stryker.config.json`: ignore `/reports` (the root folder) instead of `reports`, which also left the `packages/reports` package out
- `apps/web/src/screens/ImportCsv.tsx`: Import now refreshes before it shows the result. A flaky unhandled error came from `backup.test.tsx` ending while the refresh still ran; a refresh failure was also shown as "import failed" although the rows were added.

Baseline (all green):
| Check | Result |
|---|---|
| format, typecheck, lint | pass |
| unit and component tests | 92 files, 1215 tests |
| coverage | statements 97.42%, branches 90.53%, functions 98.01%, lines 98.7% |
| build | pass |
| size | 75.7 KB initial JS gzipped (budget 180 KB) |
| e2e, Chromium (app, recording, shell, m4, audit-m4, household, date-fields, passkey) | 56 passed |
| mutation (model, store) | 88.61% (break 80) |

## Milestones
| # | Milestone | State |
|---|---|---|
| N0 | Six-folder move (A); accounts, machines, decisions (B) | A done (your phone check left); B not started |
| N1 | Governance and rules | not started |
| N2 | Specification and test vectors | not started |
| N3 | Project skeletons and design system | not started |
| N4 | Model, codes, rules | not started |
| N5 | Secure store and app lock | not started |
| N6 | Recording engine, Home and recording screens | not started |
| N7 | Lock screen and system entry points | not started |
| N8 | Seizure editor and logging | not started |
| N9 | Watch apps and the detection engine (detection hidden) | not started |
| N10 | History and graphical timelines | not started |
| N11 | Medications and doses | not started |
| N12 | Patients, settings, wellbeing, EEG diary, help | not started |
| N13 | Video | not started |
| N14 | Reports and export | not started |
| N15 | Import, backup and the move from the PWA | not started |
| N16 | Household sync, native | not started |
| N17 | Alerts everywhere: relay, push, SMS | not started |
| N18 | Health data and correlations | not started |
| N19 | iPad, tablets and foldables | not started |
| N20 | Accessibility and language pass | not started |
| N21 | Security hardening and review | not started |
| N22 | Regulatory track: Class I file (runs alongside, finished here) | not started |
| N23 | Beta | not started |
| N24 | First store release | not started |
| N25+ | After the first release (ROADMAP Phase 5) and the yearly cycle (Phase 6) | later |

## Decided
- Bundle and package ids: `eu.greymatter.auratrack7` on both platforms (approved 2026-11-06).

## Your accounts and requests (ROADMAP Part B1)
| Item | State |
|---|---|
| D-U-N-S number | not started |
| Apple Developer Program (organisation) | not started |
| Entitlement requests: Critical Alerts, Local Push Connectivity; App Review question on workout sessions | not started |
| Google Play Console (organisation) | not started |
| Firebase + Google Cloud project, budget alert, `europe-north1` | not started |
| Regulatory adviser | yours, in progress per you |

## Open questions
- D-17 (ILAE 2025, seizure profiles): built in the PWA as M8 (on `main`) (sign-off `docs/plan/M8-signoff.md`); the native apps take it in N2, N4 and N8.
- Translation review: the M8 messages (`classify.`, `prof.`, `field.ilae2025`, `field.profile`; 8 languages), `home.hidden`, `help.newText`, `after.backAfter` (all drafted by Claude).
- Version scheme of the first store release (1.0 or continuing 7.x): settled in N0.
- The ⚠ rows in `extras.md` (Critical Alerts, Android full-screen alerts and exact alarms, `SEND_SMS` on Play, the Android lock-screen shortcut, Health Connect history): checked in N0 Part B.
- Contact address for security reports (`SECURITY.md`): N0.
- Which QR decoder the F-Droid build uses: N16.

## Review and fixes of 2026-11-06 (WSL): nothing committed
Your instruction: fix every logical error that harms the app or its data; breaking changes are fine, in the PWA too; nothing is sacred unless it is correct. Decisions D-18, D-19, D-20.

**Code (PWA and shared packages):**
- **Cluster rule (D-19):** `clusterCounts` counted up to 8 min before *and* after each seizure (0, 7, 14 min read as "3 in 8 min"); now the seizures must fall inside one window. The 6.1 import comparison still compares 6.1's rule on both sides, with v7's count in its note.
- **CSV lost each time's unit:** `slotUnits` column added (medicines and their changes), exported and imported; round-trip test covers "150 mg + 1 tablet".
- **CSV duration columns** now mean what the app means: `lengthSeconds` (start to end of the seizure, aura included) and `recoverySeconds` (after the end of the seizure) replace `seizureSeconds`/`totalSeconds`. A recovery without an end of seizure is a listed problem. `seizureSeconds()` is renamed `seizurePhaseSeconds()` (only the neurologist report's breakdown and the 6.1 comparison use it).
- **Records were hidden without a word:** the store now keeps records of unknown types (from a newer version or another platform) instead of refusing them; they load after a restart, sync on and are in backups. Home shows "Records this device cannot show yet: n …" (new Home card `HiddenRecordsCard`, built from the kit's `Card`, message `home.hidden` in 9 languages, drafted by Claude).
- **No compatibility before 7.2 (D-18):** the `before/during/after` phase alias is gone (schema and CSV); a CSV `#phase` it doesn't know is now a listed problem (it used to be dropped). Records on your devices that still hold old phase names will be counted by the new Home card.
- **The M3 prototype (`#/prototype`) is removed** (it showed the old editor and phases); its button left the options page; `prototype.spec.ts` deleted (staged with `git rm`).
- **Wording:** `after.backAfter` says "Back to usual self" in 9 languages; the unused `det.recovery` is deleted.
- **CI was red** (Prettier on two e2e files since `277e6fe`): formatted.
- Checks: format, typecheck, lint clean; unit and component 1,301 of 1,301 (95 files); build passes, 77.8 KB initial JS; e2e Chromium `shell`, `app`, `recording`: 16 of 16. Not run: Firefox, the layout audits (Home has a new card that shows only when records are hidden).

**Second round, same day (your instruction: "remove all legacy items that are superseded"; ILAE 2025 only):** ILAE 2017, the plain-language type (`typeCode`, `seizureTypeCode`), `recoveryMinutes`, the 6.1 importer and its scripts, and 92 unused messages (828 entries in 9 languages) are removed; catalogue version 2 is now edited by hand (`model/src/codes/catalogue.ts`); fields that were optional only for old records are required; medicine forms are stored as codes and reports label them in the report's language; EEG seizure references are named from the linked seizure; the CSV import now writes every field and reads `recordedWhileLocked`; CSV-imported records keep their row as `importedFrom`. Details in D-18 point 3. Checks: format, typecheck, lint clean; unit and component 1,251 of 1,251 (94 files); build passes, 77.8 KB; e2e Chromium (shell, app, recording, dev, m4, date-fields, passkey) 57 of 57. Not run: Firefox, household, video, the layout audits.

**Third round, same day (your approval):** no record is hidden without notice any more. Every record carries `dataVersion` (2); at each load, records without it (from before 7.2, also from an old backup or an old device) are deleted as tombstones and Home says "Records from a version before 7.2 removed: n"; records from a newer version are kept and counted (D-18 point 4). Also: the last "back to normal" wording in 8 languages (`help.recordingText`, `det.recoveryOngoing`, `reports.extra.recoveryTimesHelp`); more than 12 profiles after a sync are all kept and shown with a note (`prof.over`); the M8 sign-off says the work is on `main`. Checks: format, typecheck, lint clean; 1,254 of 1,254 unit and component tests; build 77.8 KB; e2e Chromium (shell, app, recording, dev, m4, date-fields, passkey, household) 59 of 59. Not run: Firefox, video, the layout audits.

**On your phones:** the first time you open the new version, everything saved by the version now in production is deleted (it has no data version), and Home says how many records went. Make a CSV export or backup first if you want a copy; it will also be deleted if you restore it into the new version.

**Docs:** `ROADMAP.md` (A4, new A9, N0, N2, N3, N5, N6, N8, N10, N11, N12, N14, N15, N16, Part D/E, decisions, change log), `parity.md` (definitions section; F-101, F-102, F-110, F-205, F-301–F-306, F-312, F-314, F-315, F-402, F-403, F-501, F-705, F-1006; new F-1007), `extras.md` (what each extra needs and what happens otherwise; new X-109 AlarmKit, X-110 iOS 64-notification limit, X-408 Android timing), decisions D-18, D-19, D-20, `docs/plan/feature-checklist.md` (7.2 notes, F-1007), `docs/plan/STATUS.md`, `CLAUDE.md`.

## Session log
| Date | Machine | What |
|---|---|---|
| 2026-11-03 | WSL | Discussion of the native apps; roadmap approved and written into `docs/AuraTrack7/` |
| 2026-11-03 | WSL | `N0.md` drafted; the six-folder move brought forward into N0 Part A, before the accounts |
| 2026-11-03 | WSL | N0 A1: coverage brought back over 90%, flaky CSV import test fixed, baseline recorded (session crashed once, resumed) |
| 2026-11-03 | WSL | N0 A2–A4: the move on branch `n0-move`, paths updated, all checks green; waiting for your commit and the Vercel preview |
| 2026-11-04 | WSL | Part A on `main` and in production; CI timing fix in a sync test |
| 2026-11-04 | WSL | D-16: the seizure type fills in the ILAE answers it settles (PWA editor + model rule); heading renamed in 9 languages. Then replaced by D-17: ILAE 2025 and seizure profiles (PWA M8 plan drafted; native N2, N4, N8) |
| 2026-11-06 | WSL | Records from before 7.2 deleted at load with a notice (`dataVersion`); last wording, profile-limit and M8 sign-off fixes |
| 2026-11-06 | WSL | CI actions moved off Node 20 (GitHub's deprecation warning): `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6` (pnpm 12 support since 6.1.0), `actions/upload-artifact@v7`; all run on Node 24. Not yet run in CI |
| 2026-11-06 | WSL | Second round: every superseded legacy item removed (ILAE 2017, plain-language type, 6.1 importer, legacy-optional fields, unused messages); bundle id approved |
| 2026-11-06 | WSL | Review of code and native plan against the PWA, then the fixes and doc updates (see "Review and fixes of 2026-11-06"); D-18, D-19, D-20 |
| 2026-11-04 | WSL | PWA M8 (D-17) built on `7.2.0---M8`: ILAE 2025 questions, seizure profiles, reports and CSV; all checks green (see `docs/plan/M8-signoff.md`) |
