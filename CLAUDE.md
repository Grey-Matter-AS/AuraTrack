# AuraTrack v7: instructions for Claude

**Start every session by reading the right STATUS file:**

- **Native apps (AuraTrack7 for iOS, iPadOS, watchOS, Android, Wear OS), the relay, the shared spec:** `docs/AuraTrack7/STATUS.md`, then `docs/AuraTrack7/ROADMAP.md` (Part A is binding) and the current milestone's `N<n>.md`.
- **The PWA (paused since 2026-11-03):** `docs/plan/STATUS.md`, then the milestone's file in `docs/plan/`.

Update that STATUS file at the end of every working session: tasks, decisions, open questions, next step (and, for native work, which machine: WSL or Mac).

## What this is

AuraTrack is a privacy-first seizure-tracking app for people with epilepsy and their carers. v7 began as a PWA, rebuilt from scratch from AuraTrack 6.1 (archived as `AuraTrack-v6`, local copy at `/home/user01/Projects/AuraTrack6`); its plan is `docs/plan/README.md`. **Since 2026-11-03 the main work is the native apps, named AuraTrack7** (one Apple codebase, one Android codebase, same features, each fully native); their plan is `docs/AuraTrack7/ROADMAP.md`. The PWA stays as the reference implementation and later shrinks to desktop use.

## Working rules (binding)

- **Milestone by milestone.** The user approves a milestone's plan before it starts. The user commits.
- **Medical data integrity first.** Never lose or silently change a record.
- **Codes, not English text, in stored data.** Labels come from `packages/i18n`, in 9 languages: en, nb, nn, da, sv, fi, de, fr, es.
- **Clinical rules are settled** (see the overview). Don't change them without asking:
  - emergency plan: alert 5 min, cluster 3 in 8 min, both settings
  - 12-minute auto-stop
  - no extra buttons on the recording screen
  - a detected seizure (watch detection, hidden until regulatory approval) starts a recording counted from the estimated onset
- **UI:**
  - PWA: only `packages/ui` components.
  - Native: only the platform's own components (SwiftUI, Compose) plus the small AuraTrack7 kit (`AuraKit`, `:core:designsystem`) for what the platform lacks. Features are copied from the PWA; its look is not. Follow the platform's design guidelines and the most widely approved coding practices.
  - Nothing may overlap, clip or leave the screen on any device in the matrix; the layout audits enforce this.
- **Tests:** a feature isn't done until its unit, component (UI) and end-to-end tests pass (see the testing strategy in the overview); native features also on both platforms, with the shared test vectors passing.
- **Wording:** careful and neutral, never tone-deaf about seizures. Never "detects", "predicts", "prevents" or "life-saving" in listings.
- **No third-party scripts, analytics, crash SDKs or ads.** Native apps ship only platform libraries (AndroidX on Android; Firebase Messaging only in the Play build).
- **No records on any hosted server.** The only hosted part is the push relay: opt-in at household setup, it passes on sealed alerts it cannot read and keeps nothing.
- **Health data:** read from HealthKit and Health Connect only; never write.
- **Dates:** never use `toISOString()` for a calendar day; use the local-date helpers.

## Tools

- pnpm (`~/.local/bin`, through corepack), Node 24, TypeScript strict.
- Scripts at the root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- Native: Xcode 26.x and Swift 6 on the Mac; Kotlin 2, Gradle and the Android SDK on WSL, Android Studio on Windows (details in `docs/AuraTrack7/ROADMAP.md` Part B).
