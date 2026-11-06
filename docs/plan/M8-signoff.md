# M8 sign-off: ILAE 2025 and seizure profiles (7.2)

Written 2026-11-04, after the one build run (plan `M8-plan.md`, decision `docs/AuraTrack7/decisions/D-17-ilae-2025-and-seizure-profiles.md`). Built on branch `7.2.0---M8`; the work and its later additions are on `main` (merged before 2026-11-06; the additions of 2026-11-04 to 06 were committed straight to `main`). Test kinds as in `M4-signoff.md`. **7.2 is not tagged:** that needs your own look at the editor and the profiles screen on your phones, the translation review, and the version bump.

| Slice | What | Where it is tested |
|---|---|---|
| 1 Model | `Ilae2025Schema` (start, recall, responsiveness, bilateral tonic-clonic, observable signs, generalized kind), `ILAE_2025_GENERALIZED` (Table 1 of the paper, plus "absence" and "tonic-clonic" when the subtype is not known); seizure gains `ilae2025` and a `profile` snapshot, both optional; `SeizureProfileSchema` (name, answers, usual signs, position; up to 12). Rules in `rules/ilae2025.ts`: `consciousness` (impaired if either is impaired, preserved only if both), `ilae2025Type` (the 21 types, or the class alone), `observable` (by definition with impaired consciousness or bilateral tonic-clonic), `ilae2025Questions`, `ilae2025ForSaving`, `isAuraLike`, `switchProfileAnswers`. History: `seizureKindKey` (profile, else ILAE 2025 type, else the older type). D-16's `linkIlae` removed | unit `ilae2025.test.ts` (46), `schemas.test.ts`, `history.test.ts`; mutation (rules/**) |
| 2 Store, sync, backup | `seizureProfile` is a record type like the others: encrypted, field-level merge, tombstone, in the backup and the household | unit `store.test.ts` (a seizure keeps its copy when its profile changes), `backup.test.ts` (profiles and 2025 answers restored exactly), `household.test.ts` (a profile travels; two edits to different fields on two devices both survive) |
| 3 Editor | Classification tab: the profile row (first 3, "More profiles", "Something different"), the ILAE 2025 questions with their names shown and only the ones that apply, the type named live, "Keep these answers as a profile" (name, and optionally the signs on the timeline). A profile fills in its answers and usual signs; another profile takes back what the first filled in if nobody changed it; answers given by hand stay. Tabs follow `isAuraLike` (and an older "aura only"). An older seizure shows its type and ILAE 2017 answers read-only; the editor can no longer write `typeCode` or `ilae` at all. Edit history names the new fields | component `editor.test.tsx` (27); e2e `app.spec.ts` (answers + a symptom + Save; keep as a profile, then one tap on the next seizure) |
| 4 Profiles screen | More → Seizure profiles: list (name, ILAE 2025 type, usual signs), add, edit (the same questions), copy the signs of a seizure, move up and down, remove (asks first, says seizures keep their classification); up to 12 | component `profiles.test.tsx` (4) |
| 5 History, detail, reports, CSV | Name everywhere: profile, else ILAE 2025 type, else the older type. History filter and chart colours by kind; detail view shows the ILAE 2025 type under a profile name and the older type when there is one. Neurologist report counts by clinical class; event log "ILAE type (profile)"; monthly diary and timeline colours by kind; the ILAE section counts 2025 types and lists 2017 answers of older seizures apart, never merged. CSV: new columns `profile`, `ilae2025Type`, the six answers as codes; the import reads the answers back (not the profile link, which a spreadsheet cannot carry) | unit `additions.test.ts`, `history.test.ts`; component `history.test.tsx`; round trip `csvRoundTrip.test.ts`, `csv.test.ts`, `importCsv.test.ts` |
| 6 Words | 95 new messages (`classify.`, `prof.`, `field.`, `rep.ilae2017`) in the 9 languages; type names follow the paper's English. **The 8 other languages are drafted by Claude and wait for your translation review** | unit `messages.test.ts` (every message written in every language, placeholders the same) |
| 7 Tests | Everything below | |

## Checks run (WSL, 2026-11-04)
- format, typecheck, lint: pass
- unit and component: 94 files, 1277 tests; coverage statements 97.35%, branches 90.57%, functions 97.97%, lines 98.66%
- build: pass; size 75.7 KB initial JavaScript gzipped (budget 180 KB, unchanged)
- e2e Chromium (app, recording, shell, m4, household, date-fields, passkey, dev): 28 of 29 passed. The one failure was "Start answers inside a frame or two" (112 ms against 100 ms) while 29 tests ran at once. Measured alone, 15 times each and interleaved with `main`: medians 37–42 ms on this branch and 37 ms on `main`, both with occasional outliers near 57 ms. Start is not slower; the 100 ms test is borderline under load on WSL.
- layout audit, screens (Chromium, 10 device sizes, new looks added: generalized kinds, keep-as-profile sheet, profiles screen, profile sheet): pass
- mutation: see below

## Changed from the plan
- "Keep this as a profile?" is a button on the Classification tab (with a name and the signs), not a question after saving: it can be done while the answers are on screen, and the seizure is saved with its new profile straight away.
- More than 3 profiles allowed (up to 12), at your request; the first 3 show in the row.

## Left for you
- Try the editor and the profiles screen on your phones.
- Translation review of the new messages (8 languages).
- Version bump to 7.2, commit, tag.
