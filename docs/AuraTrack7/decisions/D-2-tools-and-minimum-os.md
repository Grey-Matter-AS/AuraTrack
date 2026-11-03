# D-2: Native tools and minimum OS

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
Swift 6, SwiftUI, Xcode 26.x; Kotlin 2, Jetpack Compose, latest Android SDK. Always built with the newest stable tools. **Minimum OS: iOS/iPadOS 18, watchOS 11, Android 12 (API 31).** Newer features switch on with availability checks. Only platform libraries (AndroidX on Android); Firebase Messaging only in the Play build.

## Why
Nothing in the plan requires iOS 26 or Android 16. iOS 18 runs on the same iPhones as iOS 17 (XR/XS and later) and adds the Control Center control; Android 12 gives modern alarm and notification behaviour for the 5-minute alert. The minimum is raised at most once a year (ROADMAP Phase 6).
