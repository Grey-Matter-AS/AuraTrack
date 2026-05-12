# 📋 AuraTrack: The Exhaustive Master To-Do List

## 🏗️ Phase 1: Structural Refactoring (Clean Slate)
- [x] **File Decoupling**: Create `src/components/Shared.jsx` and move `WizardMenu` and `DeleteModal` into it.
- [x] **Create Summary Component**: Move the entire `taggingStep === 'SUMMARY'` logic into `src/components/Summary.jsx`.
- [x] **Prop Handover**: Update `App.jsx` to pass `tempSymptomList`, `notes`, and `elapsed` as props to the new components.
- [x] **DB Version 3**: Update `src/db.js` schema to include `notes` (string), `isEdited` (boolean), `laps` (object), and `editLog` (array).

---

## ⏱️ Phase 2: Advanced Timing (The "Caretaker" Engine)
- [X] **Triple-Phase Timer**: Modify the recording state to support three "Lap" buttons: `[ Aura ]`, `[ Seizure ]`, and `[ Recovery ]`.
- [X] **Duration Logic**: Ensure each phase stores its own `startTime` and `endTime` so the doctor sees the duration of each specific stage.
- [-] **Haptic Confirmation**: Add a `useEffect` to trigger `navigator.vibrate` every 60 seconds while `status === 'RECORDING'`.
- [x ] **Live Note-Taking**: Add a small "Quick Note" button to the recording screen for one-tap markers (e.g., "Fell here").make those buttons append text directly to your notes state during the recording.

---

## 📝 Phase 3: Chronological Symptom Wizard
- [ ] **Sequence Enforcement**: Ensure every symptom added to `tempSymptomList` is stored with its index to maintain the "Seizure March" order.
- [ ] **Timeline Re-ordering**: In `Summary.jsx`, implement `[ ▲ ]` and `[ ▼ ]` buttons for every symptom to allow manual re-ordering.
- [ ] **Granular Deletion**: Add a text-based `[ Remove ]` button for each individual symptom in the summary list.
- [ ] **Smart Branching Audit**: Test every path in `constants.js` to ensure "Forced Regions" (like Jaw -> Mouth) never trigger the full body-part wizard.

---

## ✏️ Phase 4: Advanced Edit Mode (The Correction Suite)
- [ ] **View/Edit Integration**: Clicking `[ View / Edit ]` on the dashboard must load the record's data and jump directly to the SUMMARY screen.
- [ ] **Manual Time Entry**: Add numeric input fields in the Edit screen to allow the user to type in a corrected duration (e.g., changing 45s to 50s).
- [ ] **Edited Flagging**: Automatically set `isEdited: true` when any change is saved to an existing record.
- [ ] **Change Log**: Write a function that appends a string to the `editLog` array describing the change (e.g., "Added 'Twitching' symptom on [Date]").

---

## ⚙️ Phase 5: Preferences & Customization
- [ ] **User Mode Toggle**: Create a Settings page to switch between Patient Mode (Single button) and Caretaker Mode (Laps/Full Specs).
- [ ] **Theme Switcher**: Implement a theme state to toggle between Midnight Navy, High-Contrast (Yellow/Black), and Soft Clinical.
- [ ] **Text-First UI**: Audit every screen to ensure symbols (✎, ✕) are replaced with clear, uppercase text buttons.

---

## 📊 Phase 6: Reporting & Portability
- [ ] **Full History Page**: Create a new route/view for the "Total History" with infinite scrolling and date filtering.
- [ ] **CSV/JSON Export**: Build a function to generate a downloadable file of the entire IndexedDB content for backup.
- [ ] **Import Engine**: Build a file-upload listener to overwrite or merge a previously exported .json file.
- [ ] **The Neuro-Report**: Create a "Report Mode" that formats a specific seizure into a clean, printable layout with medical terms prioritized.

---

## 🚩 Key Implementation Rules
1. **NEVER** use `alert()` or `confirm()`. Always use the custom `DeleteModal` for safety.
2. **ALWAYS** use the medical term from `constants.js` when generating exports, but keep label for the on-screen UI.
3. **SAFETY FIRST**: The background must remain `#0f172a` in `index.html` to prevent the "White Flash" trigger.

---
*If you follow this list from top to bottom, you will build a clinical-grade medical application. See you at the next session! 🏠🚀*
