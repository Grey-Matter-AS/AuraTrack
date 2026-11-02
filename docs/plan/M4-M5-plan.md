# M4 and M5 together: the detailed plan (draft for approval)

**Status: approved and built 2026-11-02** (see `M4-signoff.md`, `M5-signoff.md`). It builds on `M4.md` and `M5.md`, which keep the requirements. This file adds the order, the gates and the decisions.

Decided with the user, 2026-11-02:
- M4 and M5 are planned together and built in **one run**, as slices 7 to 10 of M3 were.
- The 6.1-faithful reports come first. The report additions are built **last**, and each one stays only if the user approves it from a preview.
- The wellbeing module is built, last in M4.
- All 9 languages for new screen and report text, drafted by Claude, listed for a native check later.

The branch is `7.0.4---M4`. The user bumps the version and commits.

## Already in place (from M0 to M3)
- Model schemas and rules for medications, changes, dose logs (`rules/doses.ts`, `regimen.ts`), wellbeing, EEG, patients, settings, tombstones and the change log.
- Store: encryption, backup format, merge, and the 6.1 importer with its comparison tool (`import6x/`).
- App: Home, recording, editor, between-seizures log, sets, lock, update card.
- `packages/reports` is an empty stub. 6.1 builds its PDFs with jsPDF and jspdf-autotable.

## Order of work

### M4, everything else in daily use
| # | Slice | What |
|---|---|---|
| 1 | **Shell, Patients, Settings, Help** | A bottom tab bar (Home, History, Medications, More) with the tabs hidden when a feature is off and has no data (F-409). Patients: add, rename, colour, remove, switcher, "Recording for". Settings, every 6.1 group (identity, appearance, display, recording and emergency plan, clinician and reports, medications, data and backup, lock). Help, About, What's new, clear all data in one transaction (F-805). The emergency plan screen keeps the settled rules; changing the plan is the user's choice, as in 6.1 |
| 2 | **Timeline and body map into the kit** | Moved from `apps/web/src/editor/` to `packages/ui`, each with component tests and entries in the kit audit. The History detail and (in M5) the PDF reuse the same drawing |
| 3 | **History** | One list of seizures and between-seizures entries, paged by the page-size setting. Filters (type including "not set", dates, needs details), Clear, kept when you go back. Trend chart with medication-change markers. Event detail with the vertical timeline, danger flags against the patient's rule, the audit trail, delete (tombstone, also removes a linked EEG note). The **graphical timeline** over days and weeks: seizures sized by duration and coloured by type, with between-seizures entries, medication changes and missed doses as markers; zoom, and tap anything to open it |
| 4 | **Medications** | Add, with the ingredient picker (about 30 built in plus your own) and form, schedules with per-slot doses, frequency OD to QDS and PRN. Confirm sheet for started, changed, stopped and correction, with effective date and dose time. Name locked after confirming; rename asks why. Stop instead of delete. Tracking start date. **Dose panel** on Home (tap, then Save; taken, late, missed, assumed) and **extra dose**. Unlogged doses become assumed after 90 minutes, backfilled up to 31 days (`planMissedDoses`); missed doses recorded automatically. Dose history grid (editable, with audit marker). Dose reminders for every patient while the app is open or recently used, with permission status and the iOS note |
| 5 | **EEG diary** | Sessions (title, planned duration, notes, end), activities (label or custom, mood, notes, start and stop), controls on Home, the seizure reference added automatically and the running activity stopped when a seizure starts (F-214), history tab, on or off setting |
| 6 | **Video** | Optional, front or back camera, overlay with start time and elapsed, saved and linked to the seizure. **The video stays on the device that recorded it** and is stored encrypted under the same data key, never in a backup unless the user chooses it. The recording screen gets no extra button (the camera is switched on in settings, and starts with Start) |
| 7 | **Install, backup reminder, update** | Install banner with iOS instructions, re-shown from About. Backup reminder after the chosen interval (back up now, snooze, turn off). The update card stays as built |
| 8 | **Wellbeing** (optional, off by default) | Check-in (mood of 12, intensity, factors, notes, time), editable factor definitions, history with filters, correlation view with seizures, daily reminder skipped once today's entry exists. While off: no card, tab, reminder or report section |
| 9 | **M4 tests and sign-off** | `M4-signoff.md` maps F-1xx, F-3xx, F-4xx, F-5xx, F-55x, F-58x, F-6xx and F-9xx to tests. Full layout audit |

### M5, reports, backup and switch-over
| # | Slice | What |
|---|---|---|
| 10 | **Report data and PDF engine** (`packages/reports`) | Pure builders from records to a report model, one per report, tested without any drawing. A drawing layer on jsPDF and jspdf-autotable as in 6.1 (same look, text kept as real text, charts as vector), loaded only when a report is made, and run in the worker. All text in the chosen language |
| 11 | **The 6.1 reports, faithfully** | R-1 neurologist report (14 sections as in `report-inventory.md`), R-2 event log, R-3 monthly diary, R-4 EEG diary, R-5 CSV. Compared side by side with 6.1's output from the same imported data: the made-up reference set in `docs/plan/reports-6.1/` is the automated baseline, and your own data is compared on your computer only |
| 12 | **Print preview, Save, Share** | Preview in the app, Save through the system dialog or a download (file names carry the local date), and Share through the share sheet where the browser has one |
| 13 | **Backup, restore and import screens** | Encrypted backup of one patient or all (passphrase of at least 8 characters), restore with counts and skipped records explained, "copy everything" for a new phone, the recovery kit print, and the **import of a 6.1 backup** with the existing comparison shown on screen |
| 14 | **The agreed report additions** | Built last, each behind a switch, each shown to you as a preview page first: summary page first, per-seizure vertical timeline (boxes alternating sides, continuing in columns, true scale option, first symptom), period timeline, between-seizures symptoms over time, body-map figures, ILAE type, recovery times, time-of-day and sleep/wake patterns, clusters and long seizures against the patient's rule, medication changes and adherence against frequency, sharper charts. **You approve or drop each; a dropped one is removed, not left switched off** |
| 15 | **M5 tests and sign-off** | `M5-signoff.md`. Report model tests, PDF text checks (text is extracted and compared), the faithful reports against the 6.1 reference, backup and restore round trips, full layout audit including the preview and backup screens |

## What I cannot do, so it stays yours
- **M4:** use v7 next to 6.1 for a few days.
- **M5:** compare the faithful report with 6.1 on your real data, and rehearse backup, restore and import on your devices. The real 6.1 backup is never committed (`.gitignore` already blocks it).
- Phone checks, the version bump, the commit and push.

## Rules held throughout
- No change to the clinical rules (alert 5 min, cluster 3 in 8, 12-minute stop, no extra buttons on the recording screen).
- Records are never changed silently: edits keep the audit trail, deletes are tombstones, a stopped medication is never deleted.
- Codes in stored data, words from `packages/i18n`. Local-date helpers for every calendar day, never `toISOString()`.
- Only `packages/ui` components. No third-party scripts, analytics or hosted data. The jsPDF dependency is bundled, not loaded from a server.
- Every slice ends with typecheck, lint, unit, component and end-to-end tests passing; coverage and the mutation score on new rules stay at M3's level (rules 80% or more).
- The full layout audit runs **once per milestone sign-off** (slices 9 and 15), not between slices.

## Choices I made that you can change
1. **Tab bar:** Home, History, Medications, More (Wellbeing, EEG diary, Settings, Help, Backup under More while on).
2. **PDF library:** keep jsPDF, so the faithful reports match 6.1 and the code can be compared with the 6.1 source. A bundle cost applies only when a report is made.
3. **Video** is not included in backups unless the user ticks it, because of size.
4. **Reminders** work while the app is open or recently used (as in 6.1). Reliable reminders with the app closed need the server and push of 7.1.
5. **Drag reorder** and other M3 deviations stay as they are.

## Risks
- **Size:** about 60 checklist items plus 5 reports. The slices are ordered so that a stop after any of them leaves a working app.
- **Video on iPhone Safari:** `MediaRecorder` and camera behaviour differ by iOS version; it needs your phone to check. If it cannot be made reliable it is switched off on that browser and says so.
- **Report additions** need your eyes. They are built last for that reason.
