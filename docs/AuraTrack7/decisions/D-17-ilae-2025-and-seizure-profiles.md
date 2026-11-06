# D-17: ILAE 2025 classification and seizure profiles

**Decided:** 2026-11-04, by you. Replaces the top row of D-16. Built in the PWA first (M8, `docs/plan/M8-plan.md`), so the TypeScript reference carries it into N2 (specification), N4 (rules) and N8 (editor).

## Decision
1. **ILAE 2025 is the only classification** for new answers, as the position paper sets it out (Beniczky et al., *Epilepsia* 2025, doi 10.1111/epi.18338). We follow the paper; no separate clinical review of its terms.
2. **The plain-language seizure type row goes.** In its place the patient's own **seizure profiles**: up to 12 per patient (the first 3 in the row, the rest under "More"), each a name, its ILAE 2025 answers and, optionally, its usual signs in order. One tap fills in the classification and the usual signs; anything can be changed for this seizure.
3. **"Something different"** sits beside the profiles and opens the ILAE questions directly. After saving, the app offers to keep the answers as a profile.
4. **A seizure keeps a snapshot**: the profile's id and name as they were, and its own ILAE 2025 answers. Editing or removing a profile later never changes past seizures.
5. **Old records are not converted.** A seizure saved with a type code and ILAE 2017 answers keeps them and shows them as recorded ("ILAE 2017"). 2025 answers can be added to it by hand.

## The ILAE 2025 questions (basic version)
The paper advises asking about recall and responsiveness rather than "consciousness"; the questions follow that.
- **Where did it start?** Focal · Generalized · Not known (unknown whether focal or generalized)
- Focal or not known:
  - **Did they remember it afterwards?** (awareness) Yes · No · Not sure
  - **Could they respond normally during it?** (responsiveness) Yes · No · Not sure
  - **Did it become a tonic-clonic seizure on both sides?** Yes · No · Not sure
  - **Could others see signs of it?** (observable manifestations) Yes · No · Not sure
- Generalized: **Which kind?** Absence (typical, atypical, myoclonic, eyelid myoclonia, or not sure which) · Tonic-clonic (plain, myoclonic-tonic-clonic, absence-to-tonic-clonic) · Myoclonic · Clonic · Negative myoclonus · Epileptic spasms · Tonic · Atonic · Myoclonic-atonic

## Rules (from the paper)
- Consciousness is **impaired** if recall or responsiveness is impaired; **preserved** only if both are preserved; otherwise **undetermined**, and the seizure is named by its class alone ("Focal seizure").
- Impaired consciousness counts as having observable manifestations.
- Bilateral tonic-clonic names the type: focal-to-bilateral tonic-clonic, or bilateral tonic-clonic of unknown origin.
- Nothing answered: not classified (shown as such; "Unclassified" is a clinician's label and is not set by the app).
- The vertical symptom timeline is the expanded version's "semiology in chronological sequence".
- A seizure that is focal, preserved, without observable manifestations is shown like the old "aura only": no During tab.

## Why
One classification instead of two that could disagree; the version neurologists now use (2017 is replaced); one tap for a patient's usual seizure; each seizure carries a full classification a neurologist can read directly.
