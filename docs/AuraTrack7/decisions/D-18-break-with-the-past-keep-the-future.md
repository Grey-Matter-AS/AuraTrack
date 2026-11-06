# D-18: Break with the past, keep the future

**Decided:** 2026-11-06, by you ("I am happy to make breaking changes even to the PWA. Let's not consider anything sacred unless it is actually correct"). Applies to the PWA, the shared packages and both native apps.

## Decision
1. **No compatibility with versions before 7.2.** Nobody else uses the app yet, and your earlier neurologist reports are kept. Old shapes of data are not read, guessed at or converted:
   - the three symptom phases of 7.0–7.1 (`before`, `during`, `after`) are no longer read as aura, seizure and recovery ("before" could have been a warning sign or an aura); a record that still has them is kept and counted as "cannot be shown"
   - the CSV columns `seizureSeconds` and `totalSeconds` are gone; the CSV uses the app's own terms (`lengthSeconds`: start to end of the seizure, aura included; `recoverySeconds`: from the end of the seizure)
   - the M3 clickable prototype (`#/prototype`) is removed: it showed an editor and phases the app no longer has
   - the native apps read only the current format (the 7.2 backup and CSV); no legacy paths are specified in N2
2. **Forward compatibility is kept, because the household will always mix versions** (iPhone, Android, PWA, hub, each updated on its own day):
   - a record of a type this version does not know is **kept**, sealed, passed on in sync and in backups (it used to be refused)
   - a record that does not fit this version's schema is never dropped and never edited away
   - the app **says how many records it cannot show** (Home: "Records this device cannot show yet: n …"), so nothing disappears without a word
   - **every record carries `dataVersion`** (2 = the model of 7.2, filled in by the store). It is what tells an old record from a newer one
4. **Records from before 7.2 are deleted, with a notice (decided 2026-11-06: "there should be no records hidden without notice; if they are legacy records purge and delete them"):** every time the app loads its data, a record without `dataVersion` (saved before 7.2, or brought in by an old backup or an old device) is deleted as a tombstone, so the other devices delete it too, and Home says "Records from a version before 7.2 removed: n". A record *with* a data version is never deleted for not fitting: from 7.2 on, a version that changes the model must convert the records it changes, and a record from a newer version is kept and counted until this device is updated.
   - every reader (Swift, Kotlin, TypeScript) follows the same rule; it is written into `AuraTrack7-Shared/spec/data-model.md` in N2 with vectors
3. **Everything superseded is removed (decided 2026-11-06: "ILAE 2017 should not be present anywhere, only ILAE 2025"; "no point in keeping them for the app base or for the PWA"):**
   - **ILAE 2017 is gone everywhere:** the `ilae` answers on seizures, the 2017 codes in the catalogue, the 2017 rows in the neurologist report, the editor's "recorded before ILAE 2025" section, and their messages in 9 languages. ILAE 2025 (D-17) is the only classification.
   - **The plain-language seizure type is gone:** `typeCode` on seizures, `seizureTypeCode` on saved sets, the five `seizure_type.*` codes and their labels. A seizure is named by its profile, else its ILAE 2025 type, else "Type not set". An EEG seizure reference no longer copies a kind: the diary names it from the linked seizure.
   - **`recoveryMinutes` is gone:** recovery is only the time from the end of the seizure to the recovery mark.
   - **The 6.1 importer is gone** (F-1006): the importer, its comparison report, the Backup screen section, the dev-page check, the 6.1 fixture, and the two scripts that read the 6.1 source (`build-catalogue.mjs`, `gen-6x-reference.mjs`). The catalogue (`model/src/codes/catalogue.ts`, version 2) is now the source and is edited by hand; it holds no 6.1 labels.
   - **"Only in old records" optional fields are now required**, so every record has one shape: a symptom's `phase`; a seizure's `ilae2025`, `profile`, `prodromeSecondsBefore` (null when none), `quickNotes`, `recordedWhileLocked`, `cancelled`; a person's `emergencyPhone`; a regimen's `slotUnits`. The code that filled them in when missing is gone.
   - **Medicine forms are stored as codes** (`form.tablet`), not words, and reports and CSV show the label in the report's language (a Norwegian report used to say "tablet").
   - **Symptoms with a fixed place** (tongue biting → mouth) point at body-area codes instead of 6.1 English names.
   - **Unused messages removed:** 92 keys in 9 languages (828 entries), including the 6.1 import screen, ILAE 2017, the old Before/During/After tabs and removed fields. Help → "What is new" no longer offers a version 6 import.
   - **CSV:** no `type`, `typeCode` or `recoveryMinutes` columns; medicine forms have a `formCode` column; the code list for the template lists medicine forms, not seizure types. Each imported record keeps its CSV row as `importedFrom` (was `legacy`).

## Why
Compatibility code that guesses (before → aura) changes what a record means without anyone deciding it, which breaks "never silently change a record". A strict schema without a "kept but not shown" path breaks "never lose a record" as soon as two versions meet.
