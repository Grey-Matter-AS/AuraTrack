# D-4: Privacy rules for the native apps

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
No data collection by us or anyone we let in. Medical data and user ids stay on the household's devices. Keys `ThisDeviceOnly`; Android cloud backup off; HealthKit and Health Connect read only; no Siri/Spotlight donations with content; neutral lock-screen text; third-party keyboards refused on iOS, no personalised keyboard learning on Android; no analytics or crash SDKs. Details in ROADMAP A3.

## Why
All user data is the user's. The platforms' own services (cloud backup, health stores, suggestions, keyboards) are the realistic ways data could leave the device without the app asking.
