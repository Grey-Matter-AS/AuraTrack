# AuraTrack — Claude Code Reference

## Core Development Principles

These are binding. No exceptions.

1. **Think Before Coding** — Ask clarifying questions. Surface assumptions and tradeoffs *before* writing code. Don't assume.
2. **Simplicity First** — Minimum code that solves the problem. Zero speculative features. If it works in 10 lines, not 20.
3. **Surgical Changes** — Touch only what's necessary. Match existing style. Don't refactor unbroken code. Clean up only your own mess.
4. **Goal-Driven Execution** — Define success criteria upfront. Verify completion. No guessing.

## Project Context

**AuraTrack** is a seizure tracking PWA for people with epilepsy. Users record seizures in real-time, annotate events, track medications, and export reports for neurologists. All data is stored locally (IndexedDB). Medical accuracy and data integrity are critical.

## Tech Stack

- **Framework:** React 19.2.5 (Vite)
- **Styling:** Tailwind CSS 4.2.4
- **Database:** IndexedDB via Dexie 4.4.2
- **Routing:** State-based (no React Router; `status` variable in App.jsx controls what view renders)
- **Charts:** Recharts
- **Drag-and-drop:** @dnd-kit
- **PDF export:** jsPDF + html2canvas
- **PWA:** vite-plugin-pwa

## Project Structure

```
src/
├── App.jsx                    # Main component. Routes via status state: IDLE, RECORDING, TAGGING, HISTORY, SETTINGS, EXPORT, EVENT_DETAIL, HELP, ABOUT
├── pages/
│   ├── IdleView.jsx          # Home/dashboard. Start recording, recent events, medications
│   ├── RecordingView.jsx      # Active timer during seizure recording
│   ├── TaggingView.jsx        # Post-recording wizard (symptom/anatomy/notes annotation)
│   ├── HistoryView.jsx        # List of all events, search/filter, delete
│   ├── SettingsView.jsx       # User preferences (theme, emergency contacts, neurologist info, notifications)
│   ├── ExportView.jsx         # CSV/JSON/PDF export
│   ├── EventDetailView.jsx    # View/edit single event
│   ├── HelpView.jsx           # Help guide with expandable sections
│   └── AboutView.jsx          # App info, version, dev credits, disclaimer, links
├── components/
│   ├── Header.jsx             # Top nav with HISTORY, title, SETTINGS, ? buttons
│   ├── DeleteModal.jsx        # Confirmation dialog
│   ├── ManualEntrySheet.jsx   # Modal for logging past seizures
│   ├── PWAInstallBanner.jsx   # App install prompt
│   ├── SettingsForm.jsx       # Settings form with tabs
│   ├── Tabs.jsx               # Tab switcher component
│   └── [other UI components]
├── hooks/
│   ├── useEventTimer.js       # Timer, lap marking, elapsed time
│   ├── useEventHistory.js     # Fetch/manage events from DB
│   ├── useTaggingWizard.js    # Post-recording tagging state machine
│   ├── useSettings.js         # User preferences
│   ├── useMedications.js      # Medication list and dose logging
│   ├── usePWAInstall.js       # PWA install detection
│   ├── useWakeLock.js         # Screen wake lock during recording
│   └── useNotifications.js    # Medication reminders
├── utils/
│   ├── exportHelpers.js       # CSV/JSON export, PDF generation
│   ├── pdfCharts.js           # Chart rendering for PDF
│   ├── dangerFlags.js         # Clinical danger detection (prolonged seizures, clusters)
│   ├── medicationSchedule.js  # Dose scheduling logic
│   ├── formatters.js          # Time/date formatting
│   ├── phaseCalculations.js   # Seizure phase duration math
│   └── hapticFeedback.js      # Device vibration
└── data/
    └── db.js                  # Dexie database schema (events, settings, medications, medicationLogs)
```

## Data Model

**Events (Seizures)**
```
{
  startTime,          // Unix timestamp when recording started
  date,               // Formatted date string
  time,               // Formatted time string
  duration,           // Seconds (from start to stop)
  laps,               // { lapLabel: elapsed_seconds } — user-marked moments
  type,               // "Tonic-Clonic", "Absence", etc. (from tagging)
  anatomy,            // Array of affected body parts
  symptoms,           // Array of observed symptoms
  notes,              // User free-text notes
  isComplete,         // Boolean: was event tagged?
  editLog,            // Array of edits made to event
  userModeAtTime,     // "SELF" or "CARETAKER" mode when recorded
  isManualEntry,      // Boolean: was this logged retroactively?
  isEmergencyStop     // Boolean: auto-stopped at 12 minutes
}
```

**Medications**
```
{
  id,                 // UUID
  name,               // "Levetiracetam", etc.
  dosage,             // "500mg"
  frequency,          // "Twice daily", etc.
  active,             // Boolean
  isRescue,           // Boolean: emergency med?
  showInEmergency,    // Boolean: display in RECORDING view
  schedule            // Array of { time: "HH:MM", day: 0-6 } for recurrence
}
```

## Routing (Status-Based)

App.jsx controls UI via `status` state:
- `IDLE` → IdleView (home, start button, recent events)
- `RECORDING` → RecordingView (timer, lap markers, stop button)
- `TAGGING` → TaggingView (annotation wizard)
- `HISTORY` → HistoryView (event list)
- `SETTINGS` → SettingsView (preferences)
- `EXPORT` → ExportView (data export)
- `EVENT_DETAIL` → EventDetailView (view/edit single event)
- `HELP` → HelpView (usage guide)
- `ABOUT` → AboutView (app info, dev credits)

Update status with `setStatus('NEW_STATUS')`.

## Styling

- **CSS:** Tailwind 4.2.4 (no CSS modules)
- **Theme variables:** CSS custom properties — `var(--bg-base)`, `var(--text-primary)`, `var(--accent)`, etc.
- **Responsive:** Mobile-first. Max-width constraints for larger screens.
- **Dark/light mode:** Toggle via `data-theme="dark|light"` attribute on root div
- **Font scaling:** `data-font-size` attribute (affects root font-size)

Example button style (matches existing pattern):
```jsx
className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
```

## Git Workflow

- **Repo:** `/home/user01/Projects/AuraTrack` (WSL Ubuntu)
- **Branches:** User creates feature branches (`feat/*`, `fix/*`, `docs/*`). I commit to the checked-out branch.
- **Commits:** Conventional format. Co-authored. Local only — user merges and pushes.

## Code Patterns

### Import order
1. React and hooks
2. External libraries
3. Local components/hooks/utils

### Naming
- Components: PascalCase (e.g., `EventDetailView`)
- Hooks: camelCase, prefix with `use` (e.g., `useEventTimer`)
- Utilities: camelCase (e.g., `formatters.js`)
- Variables/constants: camelCase, UPPER_SNAKE_CASE for constants

### Component structure
```jsx
function MyComponent({ prop1, prop2, onCallback }) {
  const [state, setState] = useState(initial);
  
  useEffect(() => { /* side effects */ }, [deps]);
  
  const handleAction = () => { /* logic */ };
  
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}

export default MyComponent;
```

## Critical Rules

1. **Never edit directly on Windows `C:\ ` drive.** Work only in WSL Ubuntu `/home/user01/Projects/AuraTrack`.
2. **Medical accuracy matters.** Seizure timestamps, medication schedules, and event data must be correct.
3. **IndexedDB data is persistent.** Don't assume cache invalidation—explicit state updates are necessary.
4. **State-based routing, not URL-based.** Always use `setStatus()` to navigate, not React Router.
5. **No direct DOM manipulation.** Use React state and JSX only.
6. **Test changes in the real app.** Don't assume code correctness—verify in the browser.
7. **Offline-first.** All data must work without network.
8. **PWA constraints.** Respect screen wake-lock, notification permissions, and app install flows.

## Build & Run

```bash
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

## Testing Checklist Before Committing

- [ ] Feature works as described in goal criteria
- [ ] No console errors or warnings
- [ ] Responsive on mobile and tablet viewports
- [ ] Data persists after page reload (IndexedDB working)
- [ ] Existing features unaffected (surgical changes verified)
- [ ] Code matches existing style and patterns
- [ ] Commit message is conventional and clear
