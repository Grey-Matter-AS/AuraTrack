# M8 in detail: ILAE 2025 and seizure profiles (draft for approval)

**Status: approved 2026-11-04, one run.** Your answers: old seizures start with the 2025 questions empty and nothing is converted (old type codes, for example from 6.1 imports, stay readable as recorded); more than 3 profiles allowed in Settings, the first 3 in the row plus "More"; one run; the linking stays live everywhere (a profile fills in the answers and usual signs, the answers decide which questions show and the ILAE 2025 type, and the tabs follow the answers). Decision: `docs/AuraTrack7/decisions/D-17-ilae-2025-and-seizure-profiles.md`. The PWA is paused for features; this one is made for it too at your request, and it becomes the reference the native apps copy (N2, N4, N8). Branch `7.2.0---M8`. You bump the version and commit.

## What changes for the person using the app
- The Classification tab starts with **their own seizure profiles** (the first 3 of up to 12, the rest under "More"; for example "Usual seizure", "Night seizure") and **Something different**. A profile fills in the ILAE 2025 answers and its usual signs; everything can still be changed for this seizure.
- Below it, the **ILAE 2025 questions** (D-17), in plain words: where it started, did they remember it, could they respond, did it become tonic-clonic on both sides, could others see signs; for generalized, which kind. The resulting ILAE 2025 seizure type is shown as the answers are given ("Focal impaired consciousness seizure").
- After saving a seizure that used no profile, "Keep this as a profile?" (with a name), if the patient has fewer than 12.
- **Settings → Patients → Seizure profiles**: add, rename, change answers and usual signs, reorder, remove. Changes never touch past seizures.
- History, the detail view, the seizure card, reports and the CSV show the **profile name** and the **ILAE 2025 type**. Older seizures show their type and ILAE 2017 answers as recorded.

## Order of work

| # | Slice | What |
|---|---|---|
| 1 | **Model** (`packages/model`) | `Ilae2025Schema` (class, recall, responsive, bilateralTonicClonic, observable, generalizedType; each nullable, "not sure" kept as its own value). The 21 type codes and the generalized kinds as catalogue codes (`ilae2025.*`). Rules: `consciousness()` (impaired if either is impaired, preserved if both, else undetermined) and `ilae2025Type()` (answers → one of the 21 types, or the class alone, or not classified), `isAuraLike()` (replaces "aura only" for the tabs). `SeizureProfileSchema` (patient, name, ILAE 2025 answers, usual signs 0–40 in order, position). Seizure gains `ilae2025` and `profile` (`{ id, name }` snapshot), both optional so every existing record stays valid. Unit tests per rule; mutation testing covers them (rules/**) |
| 2 | **Store, sync, backup** | `seizureProfile` as a record type: encrypted like the others, field-level merge and audit trail, tombstone on removal, in the v7 backup and restore, in the household sync. Old backups restore unchanged. Tests through the real store and merge |
| 3 | **Editor** | Classification tab rewritten: profile chips + Something different; the ILAE 2025 questions with labels shown; the live type line. Picking a profile copies its answers and offers its usual signs on the timeline (added in order, each removable). The tabs follow `isAuraLike()`. The type row and D-16's `linkIlae` are removed. An old seizure opened for editing shows its recorded type and 2017 answers read-only, with the 2025 questions empty to answer if wanted. "Keep this as a profile?" after saving. Saved symptom sets stay, no longer tied to a type |
| 4 | **Profiles in Settings** | Per patient, under Patients: list, add (from scratch or from a past seizure), edit, reorder, remove (with "past seizures keep their classification"). Up to 12; the first 3 show in the editor's row, the rest under "More" |
| 5 | **History, detail, reports, CSV** | Filter by profile and by ILAE 2025 type (old seizures by their recorded type). Neurologist report: the ILAE section counts 2025 types, with 2017 answers of older seizures listed apart, never merged. Event log and monthly diary show profile and type. CSV: new columns (`profileName`, the 2025 answers) in a new CSV format version; import reads both versions. Seizure card and detail view |
| 6 | **Words** | All new text in the 9 languages: the questions, the 21 type names, profile screens. The type names follow the paper's English; the other 8 languages are mine and go to your translation review (`review.json`), as before |
| 7 | **Tests and sign-off** | Unit (rules, schemas, merge), component (editor, profiles, history filter, reports), e2e (log with a profile, with Something different, edit an old seizure, profile change leaves past seizures alone, sync of a profile between two devices), targeted layout audit of the changed screens, mutation run. `M8-signoff.md`, STATUS.md, feature checklist |

## Rules held throughout
- **No record is changed or converted silently.** Old type codes and ILAE 2017 answers stay as recorded; 2025 answers are only ever added by a person.
- No change to the clinical rules; nothing added to the recording screen; nothing is asked while recording.
- Codes, not English text, in stored data (profile names are the user's own words, like own symptoms).
- Tests before done: unit, component and end-to-end.
