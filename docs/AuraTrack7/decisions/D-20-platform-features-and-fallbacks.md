# D-20: Platform-only features: each one states what it needs and what happens without it

**Decided:** 2026-11-06, by you (the review of the native plan). Extends D-2 ("newer features switch on with availability checks").

## Decision
1. **Every extra (X-ID) states four things** in `extras.md`: the minimum OS, the hardware, the permission or entitlement, and **what the user sees otherwise**. An extra without a written fallback is not built.
2. **Safety never depends on an extra.** The 5-minute alert, the warning and the 12-minute stop work on the minimum OS with no entitlement and no special permission granted; extras only make them louder or easier to reach. When a permission that the alert relies on is missing (notifications, exact alarms, full-screen alerts on Android 14 and later), the app says so plainly in Set-up and on the recording settings screen, with a way to fix it.
3. **Data made by a platform-only feature has a shared code** in the specification (N2) before it is built, so the other platform, the PWA and older versions can show it or at least count it (D-18). Example: a recording started by watch detection needs a start source `detected` and an approximate onset; the PWA and the other platform must show such a seizure, labelled, never hide it.
4. **Audits run on the oldest and the newest supported OS** (iOS 18 and current; Android 12 and current), not only on every screen size, because the platforms look and lay out differently (iOS 26's Liquid Glass; Android 15's edge-to-edge).
5. **Newer platform features are added where they help, behind availability checks**, and reviewed each year (ROADMAP Phase 6). Candidates already known: AlarmKit (iOS 26) for alarms that sound through silent mode and Focus, beside Critical Alerts; Android 16 Live Updates for the timer notification.
6. **Platform facts are checked against Apple's and Google's current documentation** before the milestone that builds them (in N0 Part B for permissions and entitlements, otherwise in the milestone's `N<n>.md`). The notes in `extras.md` written on 2026-11-06 are from memory and marked "to check".

## Why
The review found that the plan named the extras but not their limits: on Android 14 and later full-screen alerts and exact alarms are restricted by default, Health Connect gives 30 days of history unless asked for more, some extras need specific hardware (Double Tap, the Action Button), and Critical Alerts may be refused. Without a written fallback each of these could fail silently on some devices, and the one that matters most is the emergency alert.
