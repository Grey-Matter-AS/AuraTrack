# AuraTrack 6.1 feature checklist (acceptance list for 7.0)

**Status: draft, for your review** (updated 2026-10-30 with the v7 design decisions; v7 changes are marked "v7:"). Every 6.1 feature has an ID, its 6.1 behaviour in one line, and the milestone that rebuilds it. 7.0 is done when every item passes its test, or you've marked it "drop". Add anything missing, and mark items you want changed.

Columns: **ID · feature · 6.1 behaviour · milestone**

## Home (F-100)
- **F-101 · Start Timer:** a red circle that starts a recording at once. M3
- **F-102 · Log Past Seizure:** an amber circle opening a sheet with date, time, total duration and optional phase durations; phases add up to the total. M3
- **F-103 · Recent seizures:** the last 5, with type, date, time, duration, badges (edited, manual, video, EEG, untagged, danger flags), View/Edit and Delete. M4
- **F-104 · Dose panel:** today's scheduled doses by time slot; tap to mark, then Save; status taken, late, missed or assumed. M4
- **F-105 · Extra dose:** log an unscheduled or rescue dose. M4
- **F-106 · Wellbeing check-in card:** with today's status. v7: only while the wellbeing module is on. M4
- **F-107 · EEG controls:** start or end a session, start or stop an activity, elapsed time, a link to the diary (when enabled). M4
- **F-108 · Install banner:** an install prompt, with instructions on iOS; can be re-shown from About. M4
- **F-109 · Update bar:** a new version waits for a tap, and is never offered during recording or tagging. M2 (shell), M4
- **F-110 · Backup reminder:** after the chosen interval; back up now, snooze, or turn off. M4
- **F-111 · Patient switcher and colour,** when there is more than one patient. M4

## Recording (F-200)
- **F-201 · Total elapsed timer:** a large display in the duration format setting. M3
- **F-202 · Carer phase tiles:** End aura, End seizure; recovery runs on; the phase timers show at the top. M3
- **F-203 · No aura:** tapping End seizure first records aura = 0. M3
- **F-204 · Self mode:** a simplified screen with no phase tiles. M3
- **F-205 · Emergency alert:** full screen at the alert time (default 5 min), measuring seizure time (aura and recovery excluded). Wording differs for carer and self. Shows rescue medication, neurologist and emergency contact. Dismissable. v7: what it shows while the app is locked is a setting (default: rescue medication and contacts). M3
- **F-206 · Warning** one minute before the alert. M3
- **F-207 · 12-minute auto-stop:** saves with a status-epilepticus note; quick notes are kept. M3
- **F-208 · Quick notes:** configurable labels, timestamped in the notes ("[T+35s] FELL"). M3
- **F-209 · Video:** optional, front or back camera, an overlay with start time and elapsed, saved and linked to the seizure. v7: the video stays on the device that recorded it; the record notes which device. M4 (capture in M3 flow)
- **F-210 · Wake lock:** the screen stays on, with a banner if unsupported. M3
- **F-211 · Haptics** on taps (setting). M3
- **F-212 · Crash recovery:** start time, phase taps, notes and patient restored after a close or crash. M3
- **F-213 · "Recording for: <patient>"** when there is more than one patient. M3
- **F-214 · Stopping an EEG activity** when a seizure starts; the seizure is referenced in the EEG diary. M4
- **F-215 · v7: optional symptom strip** during recording: off by default (setting), the usual symptoms for this patient and type, one tap adds a symptom timed automatically into the running phase. No other new buttons on the recording screen. M3

## Tagging and logging (F-300), rebuilt as the tabbed editor with the vertical timeline in M3
- **F-301 · Seizure type:** Tonic-Clonic, Focal Aware, Focal Impaired, Absence, Aura Only; skip allowed. v7: plus the ILAE 2017 guided questions, with "Not sure" everywhere; the plain-language type stays the headline. M3
- **F-302 · Symptoms:** a group → symptom → detail → body region → sub-region → parts (multi-select) wizard. v7: replaced by the tabbed editor, a search over the symptom list, and the body map. M3
- **F-303 · Custom symptoms and details,** remembered for next time ("added by you"). M3
- **F-304 · Saved symptom sets** per seizure type: suggested names, "most used for <type>", managed in Settings. M3
- **F-305 · Symptom order** by drag (the first is the main symptom). v7: order and intervals on the vertical timeline (F-314). M3
- **F-306 · Summary:** editable total and phase timers (marked "edited"), the type with Change, the event date and time for past or edited seizures. v7: phase times show their source (timed, edited, entered later). M3
- **F-307 · After-seizure findings:** 7 groups, body areas for movement and sensation findings, custom findings, "back to normal after", "not back yet". M3
- **F-308 · Triggers:** 11, linked to wellbeing factors. v7: the wellbeing link only while that module is on. M3
- **F-309 · Clinical notes** (free text). M3
- **F-310 · Finish & save; Save timing only** (details later); **Cancel & discard** for a new seizure, Cancel changes for an edit. M3
- **F-311 · Edit history:** which fields changed and when; an edit returns to where it started. M3
- **F-312 · v7: tabs by phase** (Before, During, After, Details), always visible with their state; an overview strip on every tab; a Review before saving; Save works from any tab. M3
- **F-313 · v7: "Between seizures" log** (interictal symptoms): a quick entry from Home with symptom, time, body area and note; shown on the History timeline and in reports. M3, M4, M5
- **F-314 · v7: vertical seizure timeline** (README section 5.1):
  - a line in phase colours, with phase markers and times (start, aura ends, seizure ends, back to normal)
  - moments holding one or more symptoms on a shared leader line; drag a box onto a moment to make symptoms simultaneous
  - spacing by order; intervals written on the line, marked exact, approximate (~) or unknown; true scale as an option in the report and on wide screens
  - the ★ first symptom; rounded boxes with name, body area or side, and "~"
  - the prodrome as a broken-line section ("≈ 2 h before")
  - "+" between moments, drag or move up and down, and a list view for screen readers
  - phones: the line on the left; tablets, computers and the PDF: boxes alternate sides, continuing in columns in the PDF
  - one component: compact in the editor's overview, full in Review, on the detail page and in the PDF

  M3, M4, M5
- **F-315 · v7: History timeline** over days and weeks: seizures (sized by duration, coloured by type), between-seizures entries, medication changes and missed doses; tap anything to open it; also for the report period. M4, M5

## History (F-400)
- **F-401 · Seizure list:** paginated (page size setting), filters by type (including "type not set"), date range and "needs details", Clear; the filters are kept when coming back. M4
- **F-402 · Trend chart:** frequency over time with medication change markers. M4
- **F-403 · Event detail:** type, phases, symptoms, after-seizure findings with areas and recovery, triggers, notes, video file name, EEG badge, danger flags (long seizure, cluster against the patient's rule), edit history; Edit. v7: with the vertical seizure timeline (F-314). M4
- **F-404 · Delete with confirmation** (also removes the linked EEG note). M4
- **F-405 · Medications tab:** a dose history grid by day and slot, editable (taken, missed, time), with an audit marker. M4
- **F-406 · Wellbeing tab:** entries, filters, a correlation overview with seizures. v7: only while the module is on. M4
- **F-407 · EEG diary tab:** sessions, activities, seizure references, edit and delete. M4
- **F-408 · Export tab:** report actions (F-700) and a link to Backup. M5
- **F-409 · Tabs hidden** when a feature is off and has no data. M4

## Medications (F-500)
- **F-501 · Add medication:** name, active ingredient picker (about 30 built in plus your own, capitalised), form, dose and unit, frequency (OD, BD, TDS, QDS, PRN), times, days, per-slot doses, rescue flag, show on the emergency screen, reminders. M4
- **F-502 · Change confirm sheet:** effective date and dose time, optional note; types started, changed, stopped, correction. M4
- **F-503 · Name locked after confirmation;** renaming asks why (typo, brand, different medicine → replace). M4
- **F-504 · Stop instead of delete;** delete only for mistakes, synced as a tombstone. M4
- **F-505 · Change history view;** changes shown in reports and exports. M4, M5
- **F-506 · Medication tracking start date.** M4
- **F-507 · Assume doses taken:** unlogged doses become "assumed" after 90 min, backfilled up to 31 days since it was turned on. M4
- **F-508 · Missed doses** recorded automatically. M4
- **F-509 · Dose reminders** for every patient (while the app is open or recently used; tapping one opens the doses), with permission status and iOS notes. M4

## Wellbeing (F-550): optional module, off by default in v7 (decided)
- **F-551 · Check-in:** mood (12 options), intensity, factors, notes, time. M4
- **F-552 · Factor definitions:** editable (boolean, scale or number, unit, help), add, remove, reset. M4
- **F-553 · Daily reminder** at a time (skipped once today's entry exists). M4
- **F-554 · On or off** (the tab is hidden if off and empty). M4

## EEG diary (F-580)
- **F-581 · Sessions:** start, planned duration (preset or custom), title, notes, end. M4
- **F-582 · Activities:** label from a list or custom, mood, notes, start and stop, edit. M4
- **F-583 · Seizure references** added automatically. M4
- **F-584 · EEG diary PDF.** M5
- **F-585 · On or off** (setting). M4

## Settings (F-600)
- **F-601 · Identity:** mode (carer or self), patient name, carer name, date of birth, emergency contact, the patients on this device (add, rename, colour, remove). M4
- **F-602 · Appearance:** theme (dark, light, system), accent colour (5), text size (4), language (9). M2 tokens, M4 screen
- **F-603 · Display:** history page size, date format, duration format, time format. M4
- **F-604 · Recording:** emergency plan (alert time, cluster rule, reset), saved symptom sets and your symptoms, haptics, EEG diary on or off, quick note labels, wellbeing on or off (v7: off by default), reminder and factors; v7: the symptom strip on or off (F-215) and what the locked alert shows (F-205). M3, M4
- **F-605 · Medications** (F-500). M4
- **F-606 · Clinician and reports:** neurologist name, institution, contact, include date of birth, report notes. M4
- **F-607 · Data and backup:**
  - storage used and storage protection (persistent), last backup
  - backup reminders and interval
  - create an encrypted backup (one or all patients), import or restore (copy everything on a new phone), sync
  - clear all data, reset settings (keeps saved sets)
  - About (version, schema, re-show install prompt)

  M4, M5

## Reports and export (F-700), see `report-inventory.md`
- **F-701 · Neurologist report** (PDF) for a date range. v7: the 6.1 layout first, then the additions you approve (seizure and period timelines, body-map figures, ILAE type, recovery times, time-of-day patterns, a summary page). M5
- **F-702 · Event log PDF** for a date range. M5
- **F-703 · Monthly seizure diary PDF.** M5
- **F-704 · EEG diary PDF.** M5
- **F-705 · CSV export** (seizures, medications, logs, changes, wellbeing, EEG). M5
- **F-706 · Print preview** in the app. M5
- **F-707 · Save via the system dialog, or a download.** v7: plus Share (the share sheet). M5

## Backup, sync, data safety (F-800)
- **F-801 · Encrypted backup:** passphrase of at least 8 characters, every table and field, verified on restore. v7: new backup format, plus the printable recovery kit (QR of the household keys). M1 (format), M5 (screen)
- **F-802 · Restore:** counts, skipped records explained, "copy everything" for a new phone, all-patients backups. M5
- **F-803 · Device sync** (internet, or the same Wi-Fi with QR and PIN): edits and deletions carried, settings split between device and shared. v7: replaced by the household (F-1100). M6
- **F-804 · Medication conflict dialog** in sync. v7: replaced by per-record merge rules and a quiet note of what changed (F-1100). M6
- **F-805 · Clear all data,** in one transaction. M4
- **F-806 · Persistent storage request.** v7: plus an installed-app check and a clear warning about iOS deleting data of non-installed web apps after 7 days. M1

## Help and general (F-900)
- **F-901 · Help:** expandable sections (what's new, recording, tagging, past seizures, medications, wellbeing, EEG, history, reports, backup and sync, settings). M4
- **F-902 · About:** version, credits, disclaimer, links. M4
- **F-903 · 9 languages,** with the last language loaded before the first screen. M1 (i18n), every milestone
- **F-904 · Offline:** everything works without a network. M0 shell, every milestone
- **F-905 · Accessibility:** focus kept inside sheets, reduced motion, screen-reader labels, 44px targets. M2
- **F-906 · Toasts** for results and errors. M2

## Security and data core (F-1000), new in v7
- **F-1001 · Encrypted at rest:** every record AES-GCM encrypted under a non-extractable device key. M1
- **F-1002 · App lock:** PIN, or Face ID / fingerprint through a passkey where supported (PIN fallback). M3
- **F-1003 · Start from the lock screen:** recording never waits for the lock; merged when unlocked. M3
- **F-1004 · Field-level merge and audit trail:** HLC per field, append-only change log, tombstones, merge rule per record type. M1
- **F-1005 · Crash-proof recording:** saved the moment Start is tapped, every tap written at once. M3
- **F-1006 · 6.1 importer:** plain or encrypted, one or all patients; a review list for anything unmapped; a comparison report against 6.1's numbers. M1

## Household (F-1100), new in v7
- **F-1101 · Create and join:** the first device creates it; others join by QR code and PIN; device names. M6
- **F-1102 · Follow patients** per device; remove a device (key replaced for future data). M6
- **F-1103 · Sync by meeting:** internet (PeerJS broker) or the same Wi-Fi; devices pass on what they got from others; a search for about a minute on opening. M6
- **F-1104 · "Household up to date?"** screen with each device's last sync. M6
- **F-1105 · Update by QR code or file** as a last resort. M6
- **F-1106 · Background sync** on installed Android. M6

## Household hub (F-1200), 7.1
- **F-1201 · AuraTrack Hub** on a household computer; Docker for a Pi or NAS; setup wizard. M7
- **F-1202 · Background sync** through the hub; it stores only sealed entries. M7
- **F-1203 · Push alerts** (started, past the alert time, recorded), sealed end to end. M7
- **F-1204 · Daily encrypted backups** on the hub. M7

## Not carried over (decided)
- 6.x legacy data formats, except through the importer.
- HelsaMi and Helsenorge integration: a distant idea, not planned.
- Phone or tablet as a household hub.
- The 6.x Cypress suite (replaced by Playwright).
