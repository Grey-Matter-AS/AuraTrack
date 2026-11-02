# M5 sign-off: reports, backup and switch-over

Written 2026-11-02. See `M4-signoff.md` for the test kinds and the overall numbers (layout audit included).

| Slice | What | Where it is tested |
|---|---|---|
| 10 Report data and PDF engine | `packages/reports`: pure builders (neurologist, event log, diary, EEG diary, CSV with formula-safe cells), a `Surface` drawing interface, jsPDF layer loaded only in a worker (first load is not heavier), a canvas preview that draws the same job | unit `reports/*.test.ts` (builders, text on the pages through a recording surface, page splitting, headings kept with their tables) |
| 11 The 6.1 reports | R-1 to R-5 following `report-inventory.md` | unit `neurologist.test.ts`, `render.test.ts`; PDFs inspected page by page with pdfjs during the build; e2e `m4.spec.ts` (a real PDF is made in the worker and saved: starts with `%PDF-`) |
| 12 Preview, save, share | Preview on canvas, save through the system dialog or a download, share where the browser allows it; file names carry the local date | component `screens/reports.test.tsx`; e2e as above |
| 13 Backup, restore, import | Backup of everyone or one person, restore with counts and a mismatch list, the move-to-a-new-phone steps, recovery kit page (QR drawn from the real code), import of a 6.1 file with its comparison on screen | unit `store/backup.test.ts` (one person), `recovery` tests; component `screens/backup.test.tsx`; e2e `m4.spec.ts` (a backup file is saved) |
| 14 Report additions | Twelve, each behind a switch, **all off by default** so the report is 6.1's until you choose: summary page, timeline for each seizure (with a true-scale option), period timeline, between-seizure symptoms, body figures, ILAE type, recovery times, time of day, clusters and long seizures, medication against frequency | unit `reports/additions.test.ts` and `render.test.ts` |

## Not done, on purpose or for time
- **You decide each addition** after seeing it: turn them on in Reports, look at the preview, tell me which to keep. Dropped ones are then removed from the code.
- Comparing the faithful report with 6.1 on your real data, and rehearsing backup, restore and import on your devices: yours.
- The layout audit does not yet open the Reports, Report preview and Backup screens (the M4 audit does open the other new screens).
- A native-speaker check of the nine languages.
