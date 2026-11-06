# AuraTrack7 platform extras

What each platform adds beyond parity. Every extra must pass the privacy rules in `ROADMAP.md` A3 (no content to Siri, Spotlight or suggestions; neutral text on the lock screen and watch face; nothing written to HealthKit or Health Connect). Clinical rules are unchanged: no extra buttons on the recording screen; extra ways to *start* a recording are allowed.

**D-20 applies to every row:** an extra states what it **needs** (minimum OS, hardware, permission or entitlement) and what the user gets **otherwise**. An extra without a fallback is not built, and safety (the alert, the warning, the 12-minute stop) never depends on one. Data an extra creates has a shared code in the spec first, so every other device can show it or at least count it (D-18).

**Checked against the vendors' documentation: not yet.** The "Needs" and "Otherwise" columns were written on 2026-11-06 from what was known then; each is checked before the milestone that builds it (permissions and entitlements in N0 Part B). Rows marked ⚠ have a known risk.

Columns: **ID · extra · N · needs · otherwise · privacy note · state**

## iPhone (minimum iOS 18)
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-101 | Live Activity and Dynamic Island (timer, phase) | N7 | iOS 16.1+; Dynamic Island: iPhone 14 Pro or later; the user can switch Live Activities off | Live Activity on the Lock Screen only; with Live Activities off, the scheduled notifications still fire | No name unless `lockedShowName` | not started |
| X-102 | Control Center control "Start recording" | N7 | iOS 18; the user adds it | Lock Screen widget, Siri, the app | Starts the locked-start dropbox | not started |
| X-103 | Lock Screen widget and Lock Screen control | N7 | Widget iOS 16+; replacing the bottom Lock Screen buttons with a control: iOS 18 | Control Center | Neutral text | not started |
| X-104 | Action Button | N7 | iPhone 15 Pro, 16 or later (hardware) | Control Center, Lock Screen control, Back Tap through Shortcuts | | not started |
| X-105 | Siri and Shortcuts (App Intents: start recording only) | N7 | iOS 16+ | The app | No content donated | not started |
| X-106 | Critical Alerts | N6, N17 | Apple's entitlement (may be refused) and the user's permission ⚠ | Time-sensitive notifications plus the full-screen alert in the app; X-109 on iOS 26 | | not started |
| X-107 | Home Screen widgets (last seizure, today's doses) | N10, N11 | iOS 17+ for buttons in widgets | Read-only widget | Neutral text; shown only when unlocked if set | not started |
| X-108 | Alerts through Focus | N17 | Time-sensitive notifications (on by default; the user can turn them off per Focus) | Critical Alerts if granted; otherwise the alert waits for Focus to end ⚠ (stated at setup) | | not started |
| X-109 | AlarmKit alarms for the alert, warning and 12-minute stop (new, D-20) | N6, N17 | iOS 26; the user's permission | iOS 18–25: time-sensitive or Critical (X-106) | Neutral text | not started |
| X-110 | Rolling notification schedule | N6, N11 | iOS keeps at most 64 pending local notifications per app ⚠ (alerts, dose reminders for every patient, wellbeing, backup) | Schedule the nearest ones first; refill on opening the app and in background refresh; recording alerts always come first | | not started |

## iPad (minimum iPadOS 18)
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-201 | Split view everywhere it helps | N10, N19 | Regular width | One column, like the iPhone | | not started |
| X-202 | Multiple windows and Stage Manager | N19 | Stage Manager on supported iPads; the newer window system on iPadOS 26 | Split View and Slide Over | App-switcher cover per window | not started |
| X-203 | Keyboard shortcuts and menu commands | N19 | A hardware keyboard; the menu bar on iPadOS 26 | Touch | | not started |
| X-204 | Apple Pencil on the body map | N8, N19 | An Apple Pencil | Finger | | not started |
| X-205 | Drag and drop of reports | N19 | | Share sheet | Only when the user drags | not started |

## Apple Watch (minimum watchOS 11)
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-301 | Recording on the wrist (Start, phases, Stop, haptics) | N9 | watchOS 11 (Series 6 or later) | The phone | | not started |
| X-302 | Complications and Smart Stack | N9 | watchOS 10+ for the Smart Stack | Open the app | Neutral text | not started |
| X-303 | Double Tap | N9 | Series 9, Ultra 2 or later (hardware) | Tap the screen | | not started |
| X-304 | Action Button (Ultra) | N9 | Apple Watch Ultra; it starts workouts or intents, so it depends on the App Review answer (B1.3) ⚠ | Complication, the app | | not started |
| X-305 | Standalone recording on a cellular watch | N9 | A cellular watch with a plan, or a known Wi-Fi | Without a connection the recording is saved on the watch and synced later; its alerts to others wait (stated in the watch app) ⚠ | | not started |
| X-306 | Heart rate during a recording | N9 | HealthKit read permission; a high rate needs a workout session | No heart rate shown | Read only, stays on device; other platforms do not see it | not started |
| X-307 | Seizure detection (tonic-clonic; auto-start from estimated onset) | N9, N25 | Workout session (App Review); regulatory approval | Hidden; manual recording | Hidden until regulatory approval; off by default; start source `detected` in the spec (D-18, D-20) | not started |

## Android phone (minimum Android 12, API 31)
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-401 | Quick Settings tile "Start recording" | N7 | The user adds the tile; on Android 14+ a tile opens the app only through a `PendingIntent` | Ongoing notification, app shortcut, the app | | not started |
| X-402 | Ongoing timer notification; Live Updates on Android 16 | N7 | Notification permission (Android 13+); Live Updates: Android 16 | A normal ongoing notification; with notifications denied the recording still runs and the app says alerts are off | No name unless `lockedShowName` | not started |
| X-403 | Lock-screen shortcut | N7 | ⚠ No known public API for an app's own lock-screen shortcut on phones: to check, likely dropped | The QS tile (usable from the lock screen) and the activity shown over the lock screen | | not started |
| X-404 | Glance home-screen widgets | N7, N10, N11 | Home screen on all versions; lock-screen widgets only on some devices and newer versions (to check) | Read-only widget | Neutral text | not started |
| X-405 | Automatic SMS to chosen contacts | N17 | `SEND_SMS`; Google Play allows it only for listed uses ⚠ (declaration needed, may be refused); F-Droid unrestricted | A prepared message the user sends (as on iPhone) | Plain text, wording chosen by the household, explained at setup | not started |
| X-406 | Alert through Do Not Disturb and over the lock screen | N6, N17 | Alarm sound (`USAGE_ALARM`); bypassing Do Not Disturb needs the user's consent; full-screen alerts: on Android 14+ only granted by default to calling and alarm apps ⚠ | A high-priority notification with alarm sound; the app asks for full-screen permission in Set-up and says when it is missing | | not started |
| X-407 | App shortcuts | N7 | Launcher support | The app | | not started |
| X-408 | Timing that survives a closed app (new, D-20) | N6 | Foreground service of a type Play accepts for this use (`health` needs a body-sensor or activity permission on Android 14+; `specialUse` needs a Play declaration) ⚠; exact alarms: denied by default on Android 14+ for new installs | The foreground service keeps its own clock while recording; without exact alarms, dose reminders may be a few minutes late (stated) | | not started |

## Android tablets and foldables
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-501 | Adaptive list-detail layouts | N10, N19 | Medium or expanded width | One column | | not started |
| X-502 | Foldable postures | N19 | A foldable | Normal layout | | not started |
| X-503 | Keyboard, mouse, drag and drop | N19 | The hardware | Touch, share sheet | | not started |

## Wear OS (Play build; minimum Wear OS 4, API 33)
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-601 | Recording on the wrist | N9 | Play build (Wearable Data Layer) | The phone; F-Droid builds have no watch app | | not started |
| X-602 | Tiles and complications | N9 | | Open the app | Neutral text | not started |
| X-603 | Heart rate during a recording | N9 | Health Services and the body-sensor permission (renamed on newer Wear OS: to check) | No heart rate shown | Read only, stays on device; other platforms do not see it | not started |
| X-604 | Seizure detection | N9, N25 | Foreground health service; regulatory approval | Hidden; manual recording | Hidden until regulatory approval; off by default; start source `detected` in the spec | not started |

## Both platforms
| ID | Extra | N | Needs | Otherwise | Privacy note | State |
|---|---|---|---|---|---|---|
| X-701 | Health data views and simple statistics (HR, HRV, sleep, activity, SpO2, breathing, temperature, cycle) | N18 | HealthKit read permissions per type. Health Connect: built in from Android 14, a separate app on 12–13 (often missing on F-Droid phones) ⚠; data older than 30 days and reading in the background need extra permissions ⚠; skin temperature only on newer versions | Each missing type is left out with a note ("no heart-rate data for this time"); never a guess | Read only; cycle opt-in; neutral wording; stays on the device that read it | not started |
| X-702 | Dose reminders with "Taken" from the notification | N11 | Notification permission; exact alarms on Android (X-408); the 64-notification limit on iOS (X-110) | Reminders shown in the app's dose panel | Neutral text | not started |
| X-703 | Real background alerts (closed app) | N6, N17 | X-106/X-109 (iOS), X-406/X-408 (Android) | In-app alert only when the app is open (stated) | Sealed end to end | not started |
