# M4 sign-off: what was built, and the test that covers it

Written 2026-11-02, at the end of the one-run build of M4 and M5 (plan: `M4-M5-plan.md`). "unit" is Vitest on the pure rules, the store and the report builders; "component" is Vitest with the real screens on the real store in memory and a clock the test moves; "e2e" is Playwright in a real browser (Chromium and Firefox here, WebKit in CI). Items are grouped by slice, not by F-number; the F-number map was not redone line by line.

| Slice | What | Where it is tested |
|---|---|---|
| 1 Shell, people, settings, help | Bottom bar (Home, History, Medicines, More), people (add, edit, colour, remove with everything that belongs to them, switch), every settings group, notifications status, Help, About, "forgot the PIN" with the recovery kit, erase everything in one step | component `screens/shell.test.tsx`, `lock.test.tsx`; unit `store/erase.test.ts`; e2e `m4.spec.ts` |
| 2 Timeline and charts | Kit parts `NavBar`, `PhaseTimeline`, `PhaseStrip`, `TrendChart`, `EventChart`, `FilePicker`; in the kitchen page `#/kitchen/m4` | component `packages/ui/src/*.test.tsx`; kit audit; `audit-m4.spec.ts` |
| 3 History | List (paged, filters, needs details), trend chart with medication-change markers, graphical timeline, detail with flags, edit trail and delete (also removes the linked EEG note) | unit `model/rules/history.test.ts`; component `screens/history.test.tsx`; e2e `m4.spec.ts` |
| 4 Medicines | Add and change with the confirm sheet (started, changed, stopped, correction), rename reasons, stop and restart, delete a mistake, dose panel, extra dose, dose grid with audit marker, missed and assumed doses after 90 minutes, reminders while the app is open | unit `model/rules/medication.test.ts`, `doses.test.ts`; unit `store/changeMedication` tests (with rollback); component `screens/meds.test.tsx`; e2e `m4.spec.ts` |
| 5 EEG diary | Sessions, activities, running activity stopped when a seizure starts, seizures tied to the session, history | unit `model/rules/eeg.test.ts`; component `screens/eeg.test.tsx`; e2e `m4.spec.ts` |
| 6 Video | Optional camera, overlay with time, stored sealed on the device (not in backups), save a copy, delete; no new button on the recording screen | unit `recording/video.test.ts`, `store/video.test.ts`; component `screens/video.test.tsx`; e2e `m4-video.spec.ts` (Chromium, fake camera) |
| 7 Install, backup reminder, what's new | Install card (iOS wording), backup reminder (now, snooze, off), What's new | component `screens/cards.test.tsx`, unit `app/backupReminder.test.ts` |
| 8 Wellbeing | Optional, off by default; check-in, factors you can edit, history, alongside seizures, daily reminder skipped once today's entry exists; while off nothing shows anywhere | unit `model/rules/wellbeing.test.ts`; component `screens/wellbeing.test.tsx` |
| Words | 735 new messages (434 for M4, 301 for M5) in 9 languages; same placeholders everywhere | unit `i18n/messages.test.ts` |

## Numbers (2026-11-02)
- Unit and component tests: 950 pass (68 files). Typecheck and lint clean, formatting applied.
- End to end on Chromium and Firefox (M4 and M5 specs, with their layout audit): 51 pass (chromium video test included), 0 failed after one test fix (the backup test needed the native save dialog switched off in Chromium).
- Layout audit after the last change: kit audit 10 of 10 devices on Chromium; real screens (M3 and M4, `audit-screens`, `audit-m4`) 60 of 60 on Chromium and Firefox. The M3 screens audit had to be taught the new place of the symptom sets (under More); it found no layout problem.

## Deviations from the plan (all small, all yours to change)
- Timeline and body map stay app components in `apps/web/src/editor/`; the kit got new, separate `PhaseTimeline`/`PhaseStrip` and charts instead of a move.
- Video is stored encrypted inside the app and is not part of a backup; it was not recorded while locked.
- Dose reminders and the daily wellbeing reminder show only while the app is open or was used recently (as planned; closed-app reminders need the server, later).
- **Missed and assumed doses now appear only after the 90-minute grace**, not immediately (rule file and tests updated). Check this against how you use 6.1.
- All new translations are drafted by Claude and not checked by a native speaker.

## Still yours
Use v7 beside 6.1 for a few days; check the camera and install card on your iPhone; bump the version (the app still says 7.0.2); commit.
