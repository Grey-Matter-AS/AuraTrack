# M3 sign-off: every M3 item in the feature checklist, and the test that covers it

Written 2026-11-02 at the end of slice 10. "unit" is Vitest on the pure rules and the store; "component" is Vitest with the real screens on the real store in memory and a clock the test moves; "e2e" is Playwright in a real browser (Chromium and Firefox here, WebKit in CI).

| Item | What | Where it is tested |
|---|---|---|
| F-101 | Start Timer | component `screens/app.test.tsx` (records with the phase buttons); e2e `app.spec.ts` (set up, record, see it on Home); Start under 100 ms: e2e `app.spec.ts` (Start answers inside a frame or two) |
| F-102 | Log Past Seizure | unit `rules/recording.test.ts` (logging a past seizure); component `app.test.tsx`; e2e `app.spec.ts` |
| F-103 | Recent seizures | last 5 with type, date, time, length and badges (entered later, recorded while locked, stopped at 12 minutes, long, cluster): component `app.test.tsx`. View/Edit/Delete buttons on each card: Edit/Add details is in M3 (`editor.test.tsx`); Delete stays for M4 as planned |
| F-109 | Update bar, never during recording or editing | component `lock.test.tsx` (the update card) |
| F-201 | Total elapsed timer | unit `recording.test.ts`; component `app.test.tsx`; the duration-format setting is M4 (F-603) |
| F-202, F-203 | Carer phase tiles; End seizure first means no aura | unit `recording.test.ts`; component `app.test.tsx` |
| F-204 | Self mode | component `app.test.tsx` (the simpler screen) |
| F-205 | Emergency alert, red, with rescue medication and contact; carer and self wording | component `app.test.tsx`; e2e `app.spec.ts` (alert on a moved clock) |
| F-206 | Warning a minute before | component and e2e as above |
| F-207 | 12-minute auto-stop, quick notes kept, end time unknown | unit `recording.test.ts`; component `app.test.tsx`; e2e `app.spec.ts`; editor asks later: `editor.test.tsx` |
| F-208 | Quick notes, with labels from settings, timed "[T+35s] FELL" | component `app.test.tsx`, `lock.test.tsx` |
| F-210 | Wake lock, banner if unsupported | unit `recording/controller.test.ts` |
| F-211 | Haptics (setting; iPhone has none and says so) | unit `controller.test.ts` |
| F-212 | Crash recovery | unit `store/recording.test.ts`; component `app.test.tsx` (a recording the app lost); e2e `app.spec.ts`, `recording.spec.ts` |
| F-213 | "Recording for" with more than one person | component `app.test.tsx` (cycles between people) |
| F-215 | Optional symptom strip | component `app.test.tsx` |
| F-301 | Seizure type and ILAE questions | component `editor.test.tsx` |
| F-302 | Symptoms: search, browse by group, body map | component `editor.test.tsx`; e2e `app.spec.ts` |
| F-303 | Your own symptoms | component `editor.test.tsx` |
| F-304 | Saved sets: suggested names, most used for the type, managed | component `editor.test.tsx` |
| F-305 | Order of symptoms (move up and down; the first is starred) | component `editor.test.tsx` |
| F-306 | Editable times with their source (timed, edited, entered later); start time | component `editor.test.tsx`; unit `editor/draft` through the same tests |
| F-307 | Findings afterwards, in your own words, recovery | component `editor.test.tsx` |
| F-308 | Triggers | component `editor.test.tsx` |
| F-309 | Clinical notes | component `editor.test.tsx` |
| F-310 | Finish and save; save timing only; discard | component `editor.test.tsx` (discard keeps the seizure, flagged) |
| F-311 | Edit history | component `editor.test.tsx`; store `history` |
| F-312 | Tabs by phase, overview strip, Review, Save from any tab | component `editor.test.tsx`; e2e `app.spec.ts` |
| F-313 | Between-seizures log | component `editor.test.tsx`; e2e `app.spec.ts` |
| F-314 | Vertical timeline | component `editor.test.tsx` (Review, order, move, remove); layout audit |
| F-1002 | App lock: PIN, passkey, lock by itself | component `lock.test.tsx`; store `passkey.store.test.ts`; e2e `passkey.spec.ts` (a real passkey with PRF in Chromium) |
| F-1003 | Start from the lock screen | unit/store `dropbox.test.ts`; component `app.test.tsx`; e2e `app.spec.ts`, `recording.spec.ts` |
| F-1005 | Crash-proof recording | store `recording.test.ts`; e2e `recording.spec.ts` |

## What M3 does not do (by the plan, or by choice)
- **F-209 video** and the dose, wellbeing, EEG cards on Home: M4.
- **Dragging** a symptom to reorder or to make two simultaneous: not built. Move up/down and the "time since the one before" menu ("at the same time", "a few seconds", ...) do the same jobs and work with a screen reader. Say if you want drag as well.
- **The timeline and the body map** are components of the app (`apps/web/src/editor/`), not yet of the kit (`packages/ui`): the plan asked for kit components with component tests. They are tested through the editor, and are meant to move into the kit when the detail page (M4) needs the timeline too.
- **"Lock automatically"** (`appLockEnabled`) means: lock after the time away you set, or after 5 minutes untouched. Opening the app always asks for the PIN or passkey; the app cannot be opened without them, because the data key is only ever wrapped by them.
- **Your own symptoms** cannot be deleted or renamed, so seizures that use them stay readable.
