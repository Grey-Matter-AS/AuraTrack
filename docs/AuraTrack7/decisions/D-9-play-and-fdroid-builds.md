# D-9: Two Android builds: Play and F-Droid

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
One codebase, two flavours: `play` (FCM push through the relay, Wear OS) and `fdroid` (UnifiedPush through the household's own distributor, no Google libraries, no Wear OS).

## Why
FCM needs Google's Firebase library, which F-Droid won't accept; the Wearable Data Layer needs Play Services.
