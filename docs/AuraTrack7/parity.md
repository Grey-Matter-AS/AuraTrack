# AuraTrack7 parity list

Every feature of the PWA (IDs from `docs/plan/feature-checklist.md`) with the native milestone that rebuilds it and how each platform does it. **This is the acceptance list:** a feature is done when its tests pass on Apple **and** Android and the shared vectors pass. "Dropped" means the platform makes it unnecessary (reason given).

**Updated 2026-11-06** to the PWA as it is after M8 (all of `docs/plan/STATUS.md` up to that day), D-18 (no compatibility before 7.0.8; records from newer versions kept and counted) and D-19 (cluster rule). When the PWA changes, this list changes in the same session.

## Definitions both apps take from the PWA (spec in N2, with vectors)
- **Four phases** for times and symptoms: `prodrome` (warning signs; before the seizure, not part of it), `aura` (part of the seizure), `seizure`, `recovery` (until back to usual self). Nothing else is read (D-18).
- **Seizure length** = start (aura included) to the end of the seizure; recovery never counts. The alert, the "long" badge, History, cards, EEG links and every report use it. A 12-minute stop counts as long everywhere ("12:00+").
- **Seizure phase** (after any aura) appears only as a breakdown beside the length in the neurologist report.
- **Cluster** = at least the set number of seizures inside one window of the set length (default 3 in 8 min), edges included (D-19).
- **Times**: every seizure time is to the second (HH:MM:SS); medicines and the rest to the minute. Durations are typed as one HH:MM:SS box filled from the right.
- **Doses**: one dose and one unit per scheduled time; "when needed" has a single dose; a daily total per medicine.
- **One classification:** ILAE 2025 (D-17), with the patient's profiles. No ILAE 2017 and no plain-language seizure type anywhere (D-18).
- **One shape per record:** every field is present (null or empty when not given); no field may be missing because older records lacked it (D-18).
- **Codes, not words:** medicine forms are catalogue codes (`form.tablet`); catalogue version 2 (`model/src/codes/catalogue.ts`).
- **Records this version cannot show** (unknown type, or a value it does not know) are kept, synced, backed up and counted on Home; never dropped (D-18).

Columns: **ID · feature · milestone · Apple · Android · state**

## Home (F-100)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-101 | Start Timer (one of three round buttons on one line: Start timer, Log past seizure, Log symptoms between seizures; labels never split) | N6 | SwiftUI button; the seizure written at Start | Compose button; the seizure written at Start | not started |
| F-102 | Log Past Seizure: when (to the second), warning signs before (HH:MM:SS), aura, seizure length (required), recovery; saved as entered later | N6 | Sheet with detents | Modal bottom sheet | not started |
| F-103 | Recent seizures (last 5, badges, View/Edit, Delete) | N10 | List with swipe actions | List with menu actions | not started |
| F-104 | Dose panel | N11 | Home card | Home card | not started |
| F-105 | Extra dose | N11 | Sheet | Bottom sheet | not started |
| F-106 | Wellbeing check-in card (module on only) | N12 | Home card | Home card | not started |
| F-107 | EEG controls | N12 | Home card | Home card | not started |
| F-108 | Install banner | dropped | The App Store installs the app | Play / F-Droid install the app | dropped |
| F-109 | Update bar | dropped | The App Store updates the app | Play / F-Droid update the app | dropped |
| F-110 | Backup reminder | N12 | Home card + local notification | Home card + notification | not started |
| F-111 | Patient switcher and colour | N12 | Toolbar menu | Top app bar menu | not started |

## Recording (F-200)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-201 | Total elapsed timer | N6 | `TimelineView`, monospaced digits | Compose clock, tabular figures | not started |
| F-202 | Carer phase tiles | N6 | Large buttons | Large buttons | not started |
| F-203 | No aura (End seizure first: aura = 0) | N6 | Recording reducer (vectors) | Recording reducer (vectors) | not started |
| F-204 | Self mode | N6 | Simplified screen | Simplified screen | not started |
| F-205 | Emergency alert (counted from Start, aura included; default 5 min, full-screen red; locked content setting) | N6, N7 | Full-screen view + scheduled notification (time-sensitive / Critical / AlarmKit on iOS 26) | Full-screen activity + alarm-channel notification (full-screen permission asked, X-406) | not started |
| F-206 | Warning one minute before | N6 | Scheduled notification + banner | Exact alarm + banner | not started |
| F-207 | 12-minute auto-stop | N6 | Scheduled at Start; stops even if the app was closed | Exact alarm; foreground service stops it | not started |
| F-208 | Quick notes | N6 | Buttons on the recording screen (existing) | Buttons on the recording screen (existing) | not started |
| F-209 | Video | N13 | AVFoundation, overlay, file protection | CameraX, overlay | not started |
| F-210 | Wake lock | N6 | `isIdleTimerDisabled` | `keepScreenOn` | not started |
| F-211 | Haptics | N6 | Core Haptics / sensory feedback | `VibrationEffect` | not started |
| F-212 | Crash recovery | N6 | `recover()` on launch | `recover()` on launch | not started |
| F-213 | "Recording for: patient" | N6 | Header text | Header text | not started |
| F-214 | Stop EEG activity when a seizure starts | N12 | Store rule | Store rule | not started |
| F-215 | Optional symptom strip | N6 | Chip row | Chip row | not started |

## Tagging and logging (F-300)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-301 | Seizure profiles (up to 12 per patient, more only after a sync: all kept and shown, with a note; the first 3 in the row, the rest under "More"; "Something different"; "Keep these answers as a profile"; a Profiles screen) + ILAE 2025 questions (D-17, vectors) | N8 | Classification tab | Classification tab | not started |
| F-302 | Symptoms: "+ Add symptom" in each phase opens a sheet (usual, search, browse, own symptoms, add your own); symptom cards with up/down and a "⋯" sheet (place on the body in labelled steps, move to phase, remove) | N8 | Sheet, `searchable`; body map in `AuraKit` | Bottom sheet, search bar; body map in `:core:designsystem` | not started |
| F-303 | Own symptoms and details | N8 | | | not started |
| F-304 | Saved symptom sets: "Fill the timeline from a saved set" above, "Save these symptoms as a set" below (not tied to a type) | N8 | | | not started |
| F-305 | Symptom order and the delays between them: delay cards (not known, same time, a few seconds, ~10 s, ~30 s, ~1 min, other time HH:MM:SS saved as approximate; live-tapped gaps exact) | N8 | Timeline component | Timeline component | not started |
| F-306 | Times in their phase sections, HH:MM:SS, with their source (timed, edited, entered later); after a 12-minute stop "when did it end?" | N8 | Duration field in `AuraKit` | Duration field in `:core:designsystem` | not started |
| F-307 | After-seizure findings | N8 | | | not started |
| F-308 | Triggers | N8 | | | not started |
| F-309 | Clinical notes | N8 | `TextEditor` (keyboard rules A3) | `TextField` (no personalised learning) | not started |
| F-310 | Save, save timing only, discard | N8 | | | not started |
| F-311 | Edit history | N8 | | | not started |
| F-312 | Three tabs: Classification, Timeline (the whole seizure, top to bottom, a tinted band per phase: Warning signs, Start, Aura, Seizure, Recovery), Notes; Review; Save from any tab | N8 | Segmented control / `TabView` | Material tabs | not started |
| F-313 | Between-seizures log | N8 | | | not started |
| F-314 | Vertical seizure timeline: phase-coloured line with a node and connector per band and card; warning signs drawn above Start and never the first sign; the ★ first symptom of the seizure; one component in editor, review, detail and PDF | N8 | `AuraKit` component, also in PDF | `:core:designsystem` component, also in PDF | not started |
| F-315 | History timeline over days and weeks (same-day seizures share one circle with the count; neighbours step down a lane; the chart's period controls) | N10 | Swift Charts | Compose Canvas | not started |

## History (F-400)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-401 | Seizure list with filters kept | N10 | `List` + filter menu | `LazyColumn` + filter chips | not started |
| F-402 | Trend chart: a bar per day, week or month with its count, long seizures marked, average line and upper limit (average + 3√average), medicine-change markers, tap a bar for its numbers, table view; − + ◀ ▶ Today and a From–To period | N10 | Swift Charts | Compose Canvas | not started |
| F-403 | Event detail (named by profile or ILAE 2025 type; times to the second; recovery from the phase marks; rescue medicine as time since the start; danger flags per D-19) | N10 | | | not started |
| F-404 | Delete with confirmation (tombstone) | N10 | Confirmation dialog | Alert dialog | not started |
| F-405 | Dose history grid | N11 | `Grid` | `LazyVerticalGrid` | not started |
| F-406 | Wellbeing tab (module on only) | N12 | | | not started |
| F-407 | EEG diary tab | N12 | | | not started |
| F-408 | Export tab | N14 | | | not started |
| F-409 | Tabs hidden when off and empty | N10 | | | not started |

## Medications (F-500)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-501 | Add medication (ingredients, forms, one dose and unit per scheduled time, "when needed" a single dose, daily total table, rescue, reminders) | N11 | Form | Form | not started |
| F-502 | Change confirm sheet | N11 | | | not started |
| F-503 | Name locked; rename asks why | N11 | | | not started |
| F-504 | Stop instead of delete | N11 | | | not started |
| F-505 | Change history (also in reports) | N11, N14 | | | not started |
| F-506 | Tracking start date | N11 | | | not started |
| F-507 | Assume doses taken (90 min, 31 days) | N11 | Rule (vectors) | Rule (vectors) | not started |
| F-508 | Missed doses | N11 | Rule (vectors) | Rule (vectors) | not started |
| F-509 | Dose reminders | N11 | Scheduled notifications with "Taken" / "Snooze" | Exact alarms + notification actions | not started |

## Wellbeing (F-550), optional module, off by default
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-551 | Check-in | N12 | | | not started |
| F-552 | Factor definitions | N12 | | | not started |
| F-553 | Daily reminder | N12 | Scheduled notification | Notification via WorkManager/alarm | not started |
| F-554 | On or off | N12 | | | not started |

## EEG diary (F-580)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-581 | Sessions | N12 | | | not started |
| F-582 | Activities | N12 | | | not started |
| F-583 | Seizure references | N12 | | | not started |
| F-584 | EEG diary PDF | N14 | PDFKit | `PdfDocument` | not started |
| F-585 | On or off | N12 | | | not started |

## Settings (F-600)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-601 | Identity and patients | N12 | | | not started |
| F-602 | Appearance (theme, accent, text size, language) | N12 | System Dynamic Type and theme first; per-app language | System font scale and theme first; per-app locales | not started |
| F-603 | Display (page size, formats) | N12 | | | not started |
| F-604 | Recording settings and emergency plan | N6, N12 | | | not started |
| F-605 | Medications settings | N11 | | | not started |
| F-606 | Clinician and reports | N12 | | | not started |
| F-607 | Data and backup, About | N12, N15 | | | not started |

## Reports and export (F-700)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-701 | Neurologist report PDF | N14 | PDFKit / `ImageRenderer` | `PdfDocument` / Canvas | not started |
| F-702 | Event log PDF | N14 | | | not started |
| F-703 | Monthly seizure diary PDF | N14 | | | not started |
| F-704 | EEG diary PDF (with F-584) | N14 | | | not started |
| F-705 | CSV export (current format only: `lengthSeconds`, `recoverySeconds`, `slotDoses`, `slotUnits`, `formCode`, four phases, ILAE 2025 columns; no type or ILAE 2017 columns; unknown values listed as problems, never dropped) | N14 | | | not started |
| F-706 | Print preview | N14 | `PDFView` / Quick Look | PDF viewer intent / in-app preview | not started |
| F-707 | Save and Share | N14 | Share sheet, Files | Share sheet, Storage Access Framework | not started |

## Backup, sync, data safety (F-800)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-801 | Encrypted backup (v7 format, PWA-compatible) | N5, N15 | CommonCrypto PBKDF2 + CryptoKit AES-GCM | JCA PBKDF2 + AES-GCM | not started |
| F-802 | Restore (incl. from the PWA; comparison report) | N15 | Document type, "Open in AuraTrack7" | Intent filter, Storage Access Framework | not started |
| F-803 | Device sync (replaced by the household) | N16 | see F-1101–F-1106 | see F-1101–F-1106 | not started |
| F-804 | Conflict handling (merge rules, quiet note) | N16 | Vectors | Vectors | not started |
| F-805 | Clear all data | N15 | | | not started |
| F-806 | Persistent storage request | dropped | Native storage is persistent | Native storage is persistent | dropped |

## Help and general (F-900)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-901 | Help | N12 | | | not started |
| F-902 | About (version, credits, disclaimer, CE/UDI later) | N12, N22 | | | not started |
| F-903 | 9 languages | every milestone | String Catalogs generated from `packages/i18n` | `strings.xml` generated from `packages/i18n` | not started |
| F-904 | Offline | every milestone | Everything works without a network | Everything works without a network | not started |
| F-905 | Accessibility | N3, N20 | VoiceOver, Dynamic Type, audits | TalkBack, font scale, audits | not started |
| F-906 | Toasts | N12 | Native banners and alerts | Snackbars | not started |

## Security and data core (F-1000)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-1001 | Encrypted at rest | N5 | Secure Enclave-wrapped key, AES-GCM per record, file protection | Keystore/StrongBox key, AES-GCM per record | not started |
| F-1002 | App lock (PIN, biometrics) | N5 | LocalAuthentication | BiometricPrompt | not started |
| F-1003 | Start from the lock screen | N7 | Live Activity, Control Center, Lock Screen widget, App Intents, Action Button | QS tile, lock-screen shortcut, `showWhenLocked`, ongoing notification | not started |
| F-1004 | Field-level merge and audit trail | N5 | Vectors | Vectors | not started |
| F-1005 | Crash-proof recording | N6 | One write per tap | One write per tap | not started |
| F-1007 | Records this device cannot show (from a newer version) are kept, synced, backed up and counted on Home; records from before 7.0.8 (no `dataVersion`) are deleted at load, with a notice (D-18) | N5, N12 | Store keeps unknown types and values | Store keeps unknown types and values | not started |
| F-1006 | 6.1 importer | removed (D-18) | | | removed |

## Household (F-1100)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-1101 | Create and join (QR and PIN) | N16 | AVFoundation QR scan | CameraX QR scan | not started |
| F-1102 | Follow patients; remove a device | N16 | | | not started |
| F-1103 | Sync by meeting | N16 | Network.framework + Bonjour + TLS | NsdManager + TLS | not started |
| F-1104 | "Household up to date?" | N16 | | | not started |
| F-1105 | Update by QR code or file | N16 | | | not started |
| F-1106 | Background sync | N16 | BackgroundTasks; Local Push at home | WorkManager; foreground connection to the hub | not started |

## Household hub (F-1200)
| ID | Feature | N | Apple | Android | State |
|---|---|---|---|---|---|
| F-1201 | AuraTrack Hub (generic, `AuraTrack7-Server`) | N16 | Hub client | Hub client | not started |
| F-1202 | Background sync through the hub | N16 | | | not started |
| F-1203 | Push alerts, sealed end to end | N17 | APNs via the relay; Local Push at home; Notification Service Extension | FCM via the relay (Play); UnifiedPush (F-Droid) | not started |
| F-1204 | Daily encrypted backups on the hub | N16 | Unchanged (hub side) | Unchanged (hub side) | not started |
