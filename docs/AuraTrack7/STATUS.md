# AuraTrack7 native: status

**Read this first in every native session.** Then read `ROADMAP.md` (Part A is binding) and the current milestone's `N<n>.md`, and continue with "Next step".

- **Current milestone:** N0, The move to six folders (Part A), then accounts, machines, decisions (Part B). **Part A: slices A1 to A4 are built on branch `n0-move` and green locally. Waiting for your commit, the Vercel preview and production.**
- **Roadmap:** approved 2026-11-03 (`ROADMAP.md`).
- **PWA:** paused 2026-11-03. Its open checks are listed in `docs/plan/STATUS.md`.
- **Last updated:** 2026-11-03 (WSL)

## Next step
1. **You, before pushing:** in Vercel, Project Settings → Build and Deployment → **Root Directory** = `AuraTrack7-PWA` (keep "Include files outside the root directory" on). From then on `main` (old layout) would fail to build, so don't push to `main` until the merge in step 4.
2. **You:** on branch `n0-move`: `git add -A`, commit (one commit, so it can be reverted in one step), `git push -u origin n0-move`.
3. **You:** open the Vercel preview on your phone and check:
   - [ ] the app loads and shows Home
   - [ ] start and stop a test recording; it's in History
   - [ ] airplane mode, reload: it still opens (offline after one visit)
   - [ ] an installed copy of production picks up the update after the merge (step 3)
   - [ ] GitHub CI is green on the branch
4. **You:** merge to `main`, check production the same way, CI green on `main`. Then Part A is done.
5. **Then:** Part B (accounts, D-U-N-S, Apple and Google enrolment, toolchains).

## N0 A2–A4: the move (2026-11-03, WSL)
- `git mv`: `apps/web` → `AuraTrack7-PWA`, `apps/server` → `AuraTrack7-Server/hub`, `apps/tray` → `AuraTrack7-Server/tray`, `packages/*` → `AuraTrack7-Shared/packages/*`. Package names unchanged.
- Paths updated in: `pnpm-workspace.yaml`, `tsconfig.json` and every package's `extends`, `vitest.config.ts`, `playwright.config.ts`, `stryker.config.json`, `eslint.config.js`, `lint-rules.test.ts`, the e2e support files and `dev.spec.ts`, `package.json` (`pnpm hub`), `scripts/*.mjs`, the hub's `package.mjs`, `Dockerfile` and `README.md`, `hub-release.yml`, `vercel.json` (`outputDirectory: AuraTrack7-PWA/dist`), `CLAUDE.md` (with a layout note). `ci.yml` and `mutation.yml` needed nothing. History in `docs/plan/` and `docs/decisions/` keeps the old paths; `docs/plan/STATUS.md` says so.
- Lockfile: only the workspace links changed, no dependency version. `--frozen-lockfile` passes.
- Found and fixed on the way: `Backup.tsx` had the same flaky pattern as `ImportCsv` (busy cleared one step after the test ended; seen in `cards.test.tsx`). Its five handlers are now one `async` function each with `try/finally`; restore and the 6.x import refresh the lists before showing the result.
- After the move (same as A1): format, typecheck, lint pass; 92 files, 1215 tests; coverage statements 97.42%, branches 90.55%, functions 98.01%, lines 98.7%; build passes; size 75.7 KB; e2e Chromium (app, recording, shell, m4, household, date-fields, passkey, dev; no audit) 28 passed; Stryker dry run: the same 15 files and 2343 mutants; hub + tray package builds with the app inside.
- Then, at your request, more out of the root: `playwright.config.ts`, `vercel.json` (`outputDirectory: dist`), `check-size.mjs`, `build-icons.mjs` into `AuraTrack7-PWA` (scripts in `AuraTrack7-PWA/scripts`); `build-catalogue.mjs`, `gen-6x-reference.mjs` into `AuraTrack7-Shared/scripts`; `e2e-trial/` removed. Root commands unchanged (`pnpm e2e`, `audit`, `visual` pass `-c AuraTrack7-PWA`). Checked again: static checks, 1215 tests, size 75.7 KB, e2e 28 passed, and a Vercel-style install and build inside `AuraTrack7-PWA`.
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
| N0 | Six-folder move (A); accounts, machines, decisions (B) | not started |
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
- Version scheme of the first store release (1.0 or continuing 7.x): settled in N0.
- Bundle and package ids: domain is `grey-matter.eu`; proposed `eu.greymatter.auratrack7` on both platforms (no hyphen: Android ids can't contain one). Waiting for your yes (N0 slice 2).
- Contact address for security reports (`SECURITY.md`): N0.
- Which QR decoder the F-Droid build uses: N16.

## Session log
| Date | Machine | What |
|---|---|---|
| 2026-11-03 | WSL | Discussion of the native apps; roadmap approved and written into `docs/AuraTrack7/` |
| 2026-11-03 | WSL | `N0.md` drafted; the six-folder move brought forward into N0 Part A, before the accounts |
| 2026-11-03 | WSL | N0 A1: coverage brought back over 90%, flaky CSV import test fixed, baseline recorded (session crashed once, resumed) |
| 2026-11-03 | WSL | N0 A2–A4: the move on branch `n0-move`, paths updated, all checks green; waiting for your commit and the Vercel preview |
