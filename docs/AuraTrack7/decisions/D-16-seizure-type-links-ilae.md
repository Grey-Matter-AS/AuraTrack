# D-16: The seizure type fills in the ILAE answers it settles

**Replaced by D-17 (2026-11-04):** the type row gives way to seizure profiles and ILAE 2025. The link below stays in the PWA only until M8 removes it.

**Decided:** 2026-11-04, by you. Built in the PWA first (reference); the native editors follow in N8 (F-301).

## Decision
Picking a seizure type on the Classification tab fills in the ILAE 2017 answers that type settles by definition. Every answer stays editable. The rule is `linkIlae` in `AuraTrack7-Shared/packages/model/src/rules/classification.ts`:

| Type | Onset | Awareness | Motor |
|---|---|---|---|
| Tonic-clonic | (open: generalized, or focal to bilateral) | | motor |
| Focal aware | focal | aware | (open) |
| Focal impaired | focal | impaired | (open) |
| Absence | generalized | | non-motor |
| Aura only | focal | aware | non-motor |

- An answer the old type filled in, that the new type doesn't settle and nobody changed, is cleared when the type changes. Answers given by hand are kept.
- Only a pick changes answers: opening a saved seizure never does.
- The ILAE feature (for example typical or atypical absence) is never filled in: no question on the screen shows it.
- The catalogue's `suggestedIlae` (from 6.1) is not used: it marks every tonic-clonic seizure as generalized.
- The section heading is now "ILAE 2017 classification for your neurologist" (9 languages; translations to review).

## Why
Without the link, a type like "Focal aware" had to be answered twice, and the two could contradict each other without notice. Only what a type settles by definition is filled in, so the app never guesses an onset or a motor answer.
