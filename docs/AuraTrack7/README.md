# docs/AuraTrack7: the native apps' planning folder

Everything about the native AuraTrack7 apps (iPhone, iPad, Apple Watch, Android phone and tablet, Wear OS), the relay and the shared specification lives in this one folder, so it can be read, shared or moved on its own. The PWA's history (milestones M0–M7) stays in `docs/plan/`.

## Reading order
1. **`STATUS.md`**: read first in every session. Current milestone, slices, open questions, the exact next step and which machine it needs (WSL or Mac).
2. **`ROADMAP.md`**: the permanent roadmap. Binding decisions (Part A), what you need to start (Part B), all milestones N0 onwards (Part C), the yearly cycle.
3. **The current milestone's file**, `N<n>.md`, written and approved just before the milestone starts.
4. **`parity.md`**: every PWA feature (F-IDs) and where and how it's rebuilt natively. The acceptance list.
5. **`extras.md`**: what each platform adds beyond parity (X-IDs).
6. **`decisions/`**: one short note per decision, with the reason.

## Files that appear as work goes on
- `N<n>.md`: a milestone's plan (slices, tests, done-when).
- `N<n>-signoff.md`: at the end of a milestone, every item mapped to its tests on Apple and Android.
- `threat-model.md` (N1).

## Rules for these files
- The roadmap changes only with your approval; each change is logged at the bottom of `ROADMAP.md`.
- `STATUS.md` is updated at the end of every working session, on either machine.
- No real medical data is ever committed here.
