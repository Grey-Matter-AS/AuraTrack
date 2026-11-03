# AuraTrack7 platform extras

What each platform adds beyond parity. Every extra must pass the privacy rules in `ROADMAP.md` A3 (no content to Siri, Spotlight or suggestions; neutral text on the lock screen and watch face; nothing written to HealthKit or Health Connect). Clinical rules are unchanged: no extra buttons on the recording screen; extra ways to *start* a recording are allowed.

Columns: **ID · extra · milestone · privacy note · state**

## iPhone
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-101 | Live Activity and Dynamic Island (timer, phase) | N7 | No name unless `lockedShowName` | not started |
| X-102 | Control Center control "Start recording" | N7 | Starts the locked-start dropbox | not started |
| X-103 | Lock Screen widget | N7 | Neutral text | not started |
| X-104 | Action Button | N7 | | not started |
| X-105 | Siri and Shortcuts (App Intents: start recording only) | N7 | No content donated | not started |
| X-106 | Critical Alerts (entitlement) | N6, N17 | | not started |
| X-107 | Home Screen widgets (last seizure, today's doses) | N10, N11 | Neutral text; shown only when unlocked if set | not started |
| X-108 | Focus filter (alerts through Focus) | N17 | | not started |

## iPad
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-201 | Split view everywhere it helps | N10, N19 | | not started |
| X-202 | Multiple windows and Stage Manager | N19 | App-switcher cover per window | not started |
| X-203 | Keyboard shortcuts and menu commands | N19 | | not started |
| X-204 | Apple Pencil on the body map | N8, N19 | | not started |
| X-205 | Drag and drop of reports | N19 | Only when the user drags | not started |

## Apple Watch
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-301 | Recording on the wrist (Start, phases, Stop, haptics) | N9 | | not started |
| X-302 | Complications and Smart Stack | N9 | Neutral text | not started |
| X-303 | Double Tap | N9 | | not started |
| X-304 | Action Button (Ultra) | N9 | | not started |
| X-305 | Standalone recording on a cellular watch | N9 | | not started |
| X-306 | Heart rate during a recording | N9 | Read only, stays on device | not started |
| X-307 | Seizure detection (tonic-clonic; auto-start from estimated onset) | N9, N25 | Hidden until regulatory approval; off by default | not started |

## Android phone
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-401 | Quick Settings tile "Start recording" | N7 | | not started |
| X-402 | Ongoing timer notification; Live Updates on Android 16 | N7 | No name unless `lockedShowName` | not started |
| X-403 | Lock-screen shortcut | N7 | | not started |
| X-404 | Glance home-screen widgets | N7, N10, N11 | Neutral text | not started |
| X-405 | Automatic SMS to chosen contacts | N17 | Plain text, wording chosen by the household, explained at setup | not started |
| X-406 | Alarm channel through Do Not Disturb | N6, N17 | | not started |
| X-407 | App shortcuts | N7 | | not started |

## Android tablets and foldables
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-501 | Adaptive list-detail layouts | N10, N19 | | not started |
| X-502 | Foldable postures | N19 | | not started |
| X-503 | Keyboard, mouse, drag and drop | N19 | | not started |

## Wear OS (Play build)
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-601 | Recording on the wrist | N9 | | not started |
| X-602 | Tiles and complications | N9 | Neutral text | not started |
| X-603 | Heart rate during a recording | N9 | Read only, stays on device | not started |
| X-604 | Seizure detection | N9, N25 | Hidden until regulatory approval; off by default | not started |

## Both platforms
| ID | Extra | N | Privacy note | State |
|---|---|---|---|---|
| X-701 | Health data views and simple statistics (HR, HRV, sleep, activity, SpO2, breathing, temperature, cycle) | N18 | Read only; cycle opt-in; neutral wording | not started |
| X-702 | Dose reminders with "Taken" from the notification | N11 | Neutral text | not started |
| X-703 | Real background alerts (closed app) | N6, N17 | Sealed end to end | not started |
