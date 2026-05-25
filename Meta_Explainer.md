# AuraTrack — A Complete Guide (For a 12-Year-Old)

> This document explains every file, every function, every tool, and every idea used in the AuraTrack project. No experience needed. If there's a word you don't know, scroll to the **Glossary** at the bottom.

---

## Table of Contents

1. [What Is AuraTrack?](#1-what-is-auratrack)
2. [The Tech Stack — Tools Used to Build It](#2-the-tech-stack)
3. [The Project File Tree](#3-the-project-file-tree)
4. [Every File Explained In-Depth](#4-every-file-explained-in-depth)
   - [Entry Points](#entry-points)
   - [Configuration Files](#configuration-files)
   - [Data Layer](#data-layer)
   - [Hooks (Smart State Managers)](#hooks-smart-state-managers)
   - [Pages (The Screens)](#pages-the-screens)
   - [Components (Reusable Building Blocks)](#components-reusable-building-blocks)
   - [Utilities (Helper Functions)](#utilities-helper-functions)
   - [Styles](#styles)
5. [How the App Works — User Journeys](#5-how-the-app-works--user-journeys)
6. [The Database — Where Data Lives](#6-the-database)
7. [The Symptom System — The Medical Brain](#7-the-symptom-system)
8. [Danger Flags — The Safety System](#8-danger-flags--the-safety-system)
9. [Exports and Reports](#9-exports-and-reports)
10. [PWA — Making It Feel Like a Real App](#10-pwa--making-it-feel-like-a-real-app)
11. [Glossary — Definitions for Every Technical Term](#11-glossary)

---

## 1. What Is AuraTrack?

### The Problem It Solves

Imagine you have a family member who has **epilepsy** — a brain condition that causes seizures (sudden bursts of electrical activity in the brain that make the body shake, go stiff, or the person lose consciousness). When a seizure happens, it can be scary and chaotic. You need to:

- Know **how long** the seizure lasted
- Record **what the body did** (did the arm shake? did the eyes roll up?)
- Notice if seizures are happening **more frequently**
- Track **which medications** are being taken and when
- Show a doctor a **clear report** of what has been happening

This is extremely hard to do in the middle of an emergency. Paper notebooks get lost. Memory is unreliable when you are frightened.

**AuraTrack solves this.** It's an app that lives on your phone that lets you:

1. Tap one big button to start recording the moment a seizure begins
2. Mark different phases of the seizure (the warning phase, the main seizure, the recovery)
3. After the seizure, calmly add notes about what happened (what body parts were affected, what symptoms appeared, what may have triggered it)
4. Track medications and log dose times with a single tap
5. Review a history of all past seizures
6. Generate a professional medical report that a neurologist (brain doctor) can use
7. Print a monthly seizure diary calendar to bring to every appointment

### Who Uses It

The app has two modes:

| Mode | Who is using it | What they see |
|------|-----------------|---------------|
| **CARETAKER** | A parent, nurse, or helper watching the patient | Timer, phase buttons for aura/seizure/recovery, quick-note buttons |
| **PATIENT (Self)** | The patient themselves (if they can feel the seizure coming and have a brief warning called an "aura") | Same tools, but configured for self-recording |

### Key Design Choices

- **100% offline** — No internet needed. All data stays on your phone. This matters for medical privacy.
- **One tap to start** — In an emergency, speed matters. No login, no menu hunting.
- **Works like a phone app** — Even though it's a website, it can be installed on your phone and looks/feels like a native app (this is called a PWA).
- **No server needed** — Nothing is sent anywhere. Your data lives only on your device.
- **Screen stays on** — During recording, the app prevents the phone screen from going to sleep so timers are never missed.

### The Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│                 YOUR PHONE/BROWSER               │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │           React App (UI)                │   │
│   │  ┌──────────┐  ┌──────────┐            │   │
│   │  │  Pages   │  │  Hooks   │            │   │
│   │  │ (Screens)│  │ (Logic)  │            │   │
│   │  └──────────┘  └────┬─────┘            │   │
│   │                     │                  │   │
│   │               reads/writes             │   │
│   │                     │                  │   │
│   │  ┌──────────────────▼──────────────┐   │   │
│   │  │    Dexie.js (Database Layer)    │   │   │
│   │  └──────────────────┬──────────────┘   │   │
│   │                     │                  │   │
│   │  ┌──────────────────▼──────────────┐   │   │
│   │  │   IndexedDB (Browser Storage)   │   │   │
│   │  │   (Like a notebook built into   │   │   │
│   │  │    every browser)               │   │   │
│   │  └─────────────────────────────────┘   │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │    Service Worker (Offline Manager)     │   │
│   │    (Caches files so the app works       │   │
│   │     even with no internet)              │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 2. The Tech Stack

The **tech stack** is the collection of tools and libraries used to build the app. Think of them like the ingredients in a recipe.

### The Main Ingredients

| Tool | Version | Plain-English Explanation | Why It Was Chosen |
|------|---------|--------------------------|-------------------|
| **React** | 19.2.5 | The Lego system for building the UI. You make small reusable "pieces" (called components) and snap them together. | Industry standard, huge community, great for apps that change state a lot (like a live timer) |
| **Vite** | 8.0.10 | The packaging machine. Takes all your code files and bundles them into a single super-fast package the browser can read. Also runs a development server with instant updates. | Extremely fast (10–100x faster than older tools), simple setup |
| **Tailwind CSS** | 4.2.4 | A giant collection of pre-written style "stickers". Instead of writing `.button { background: red; padding: 10px; }`, you just write `className="bg-red-500 p-2"` directly in your HTML. | Fast to write, consistent design, no naming collisions |
| **Dexie.js** | 4.4.2 | A friendly wrapper around IndexedDB (the browser's built-in database). Makes storing and reading data easy with simple commands like `db.events.add(...)`. | Makes IndexedDB (which is complex) feel simple; works offline; no server required |
| **Recharts** | 3.8.1 | A library for drawing charts (bar charts, line charts). Built for React. | Easy to use in React, responsive on mobile, flexible |
| **@dnd-kit** | core 6.3.1 | A drag-and-drop library. Used so users can drag symptoms up and down to reorder them. | Modern, accessible, works on touch screens |
| **vite-plugin-pwa** | 1.3.0 | A plugin for Vite that automatically creates a service worker and makes the app installable as a Progressive Web App (PWA). | Automated; handles the complex parts of making an app work offline |
| **ESLint** | 10.2.1 | The code spell-checker. It reads your code and warns you about bugs, bad patterns, or style issues. | Catches mistakes before they cause bugs |
| **PostCSS + Autoprefixer** | 8.5.14 / 10.5.0 | PostCSS transforms CSS. Autoprefixer automatically adds browser-specific prefixes (like `-webkit-`) so CSS works in all browsers. | Ensures styles work in older browsers without manual effort |

### How They Work Together

```
You write JSX code (React + HTML mix)
        │
        ▼
   Vite reads it
        │
        ├── Tailwind CSS processes your class names → optimized CSS
        ├── @vitejs/plugin-react compiles JSX → JavaScript
        ├── vite-plugin-pwa generates a service worker
        │
        ▼
   Output: dist/ folder
   (index.html + bundled JS + bundled CSS + service worker)
        │
        ▼
   Browser loads it
        │
        └── React mounts the app
        └── Dexie connects to IndexedDB
        └── Service Worker enables offline use
```

---

## 3. The Project File Tree

Here is every file in the project, with a one-line explanation:

```
AuraTrack/
│
├── index.html                  ← The one HTML file. The shell that loads everything.
├── package.json                ← The "ingredients list" — lists all tools and libraries used.
├── package-lock.json           ← Auto-generated: exact versions of all packages locked in.
├── vite.config.js              ← Settings for the Vite build tool.
├── postcss.config.js           ← Settings for PostCSS (CSS transformer).
├── eslint.config.js            ← Rules for the code spell-checker (ESLint).
├── Containerfile               ← Recipe for building a Docker container (for running in isolated environment).
├── .gitignore                  ← Tells Git which files to ignore (e.g., node_modules).
├── README.md                   ← Brief project description.
│
├── public/                     ← Files served directly to the browser, unchanged.
│   ├── manifest.json           ← PWA "ID card" — app name, icon, colors for installation.
│   ├── favicon.svg             ← The tiny icon shown in the browser tab.
│   └── icons.svg               ← Additional icon assets.
│
├── src/                        ← All the source code you actually write.
│   ├── main.jsx                ← The very first file that runs. Mounts the React app inside ErrorBoundary.
│   ├── App.jsx                 ← The root component. Manages which screen is shown.
│   ├── ErrorBoundary.jsx       ← Catches unexpected crashes and shows a friendly recovery screen.
│   ├── App.css                 ← Legacy CSS (mostly unused).
│   ├── index.css               ← Global styles, theme variables, touch fixes.
│   │
│   ├── assets/                 ← Images and icons used in the app.
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   │
│   ├── data/                   ← Data definitions (database + medical constants).
│   │   ├── db.js               ← Creates and configures the Dexie database (v6 schema).
│   │   └── constants.js        ← Seizure types, symptom tree, body region tree, TRIGGERS list.
│   │
│   ├── hooks/                  ← Custom React hooks (smart logic managers).
│   │   ├── useEventTimer.js    ← Manages the live stopwatch during recording.
│   │   ├── useEventHistory.js  ← Loads and deletes events from the database.
│   │   ├── useTaggingWizard.js ← Manages the multi-step symptom form state + triggers.
│   │   ├── useSettings.js      ← Loads and saves user preferences.
│   │   ├── usePWAInstall.js    ← Handles the "Install App" prompt and update notifications.
│   │   ├── useWakeLock.js      ← Keeps the phone screen on during recording.
│   │   ├── useNotifications.js ← Schedules browser push notifications for upcoming doses.
│   │   └── useMedications.js   ← Manages medications list, scheduled times, and dose logs.
│   │
│   ├── pages/                  ← The 7 main screens of the app.
│   │   ├── IdleView.jsx        ← Home screen: START button, dose tracker panel, recent events.
│   │   ├── RecordingView.jsx   ← Live recording screen: timer + phase buttons.
│   │   ├── TaggingView.jsx     ← Post-seizure symptom entry wizard.
│   │   ├── HistoryView.jsx     ← All past events: list, chart, filters + medication history tab.
│   │   ├── SettingsView.jsx    ← Settings screen wrapper.
│   │   ├── ExportView.jsx      ← Export data: JSON, CSV, PDF, neurologist report, seizure diary.
│   │   └── EventDetailView.jsx ← Full details for a single event including triggers.
│   │
│   ├── components/             ← Reusable UI pieces used across screens.
│   │   ├── EventCard.jsx       ← One event shown as a card (date, type, duration).
│   │   ├── WizardMenu.jsx      ← Navigation menu used inside the symptom wizard.
│   │   ├── Summary.jsx         ← Final review step of the wizard; includes trigger chip selector.
│   │   ├── DeleteModal.jsx     ← The "Are you sure?" popup before deleting.
│   │   ├── SeizureTrendChart.jsx ← The zoomable bar/line trend chart.
│   │   ├── SettingsForm.jsx    ← Settings form: identity, modes, medications, appearance, data.
│   │   ├── ExportCard.jsx      ← A clickable card for each export format.
│   │   ├── MedicationDosePanel.jsx ← Idle-screen dose tracker with LATE/MISSED status colours.
│   │   ├── MedicationHistoryTab.jsx ← Scrollable grid showing every dose slot with status badges.
│   │   ├── ManualEntrySheet.jsx ← Bottom-sheet form for logging a past seizure (date/time/duration).
│   │   └── PWAInstallBanner.jsx ← The "Install this app" banner + update-available notification.
│   │
│   └── utils/                  ← Pure helper functions (no React).
│       ├── exportHelpers.js    ← Creates JSON, CSV, PDF, neurologist report, seizure diary.
│       ├── dangerFlags.js      ← Detects dangerous seizure patterns (long duration, clusters).
│       ├── hapticFeedback.js   ← Makes the phone vibrate on button presses.
│       ├── formatters.js       ← Formats numbers into readable text (e.g., "2m 30s").
│       ├── medicationSchedule.js ← Scheduling calculations: slot expansion, visibility filtering, status.
│       ├── htmlEscape.js       ← Shared HTML-escape helper used by PDF generators.
│       ├── phaseCalculations.js ← Shared aura/seizure/recovery phase duration calculator.
│       └── pdfCharts.js        ← Generates SVG charts for the neurologist report.
```

---

## 4. Every File Explained In-Depth

---

### Entry Points

---

#### `index.html`

**What it is:** The one and only HTML file in the entire project. Every website needs at least one HTML file — it's the skeleton.

**What it does:**
- Sets the page title to "AuraTrack"
- Links to the PWA manifest (so the browser knows this is an installable app)
- Adds special `<meta>` tags so the app looks like a native iOS app
- Prevents the page from zooming in when you tap an input field
- Prevents the "white flash" you sometimes see when a dark app loads
- Has a `<div id="root">` — this is the empty box where React will inject the entire app
- Loads `src/main.jsx` as the starting JavaScript file

**Key lines explained:**

```html
<!-- This prevents iOS Safari from zooming in when you tap a text field -->
<meta name="viewport" content="..., maximum-scale=1.0, user-scalable=no, viewport-fit=cover">

<!-- This makes iOS treat the web page like a standalone app (hides the browser bar) -->
<meta name="apple-mobile-web-app-capable" content="yes">

<!-- React will render the entire app inside this div -->
<div id="root"></div>

<!-- This loads the JavaScript code that starts everything -->
<script type="module" src="/src/main.jsx"></script>
```

---

#### `src/main.jsx`

**What it is:** The very first JavaScript file that runs. It's the ignition switch.

**What it does:** Uses React's `createRoot` function to "mount" the `App` component inside the `<div id="root">` in `index.html`. The entire app is wrapped in an `ErrorBoundary` so that if anything unexpected crashes React, the user sees a helpful recovery screen instead of a blank white page.

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

**`StrictMode`:** A React developer tool that runs each component twice to catch mistakes early. Only active during development, not in the final build.

---

#### `src/ErrorBoundary.jsx`

**What it is:** A safety net that catches JavaScript crashes inside the React component tree.

**Why it exists:** In production, any unhandled JavaScript error inside a React component causes the whole app to go blank. For a medical app this is dangerous — a caretaker mid-recording would see a white screen with no way to recover. `ErrorBoundary` catches these crashes and shows a friendly message with a "Reload App" button.

**How React error boundaries work:**

React provides a special lifecycle method called `componentDidCatch`. When any child component throws an error, `ErrorBoundary` intercepts it:

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };  // Switch to error UI
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);  // Log for debugging
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Something went wrong.</p>
          <button onClick={() => window.location.reload()}>Reload App</button>
        </div>
      );
    }
    return this.props.children;  // Otherwise, render the app normally
  }
}
```

---

#### `src/App.jsx`

**What it is:** The root (top-level) component. Think of it as the app's "traffic controller" — it decides which screen to show and manages global behaviour.

**The core concept — Status-Based Routing:**

Most websites use URLs to navigate (e.g., `/history`, `/settings`). AuraTrack instead uses a single piece of state called `status`. This is simpler and works perfectly offline.

```
IDLE ──────────────────────► RECORDING ──────────────────► TAGGING
  │                                                             │
  │◄────────────────────────────────────────────────────────────┘
  │
  ├──► HISTORY ──────────────────► EXPORT
  │       │◄──────────────────────────┘
  │
  ├──► SETTINGS
  │
  └──► EVENT_DETAIL (can be reached from IDLE or HISTORY)
```

**Component: `Header`**

The top bar showing:
- A "HISTORY" button on the left
- The "AURATRACK" title in the center (with a colored line)
- A "⚙ SETTINGS" button on the right

Only visible when NOT recording or tagging (would get in the way).

**State managed by `App`:**

| State variable | Type | What it tracks |
|----------------|------|----------------|
| `status` | string | Which screen is showing: `'IDLE'`, `'RECORDING'`, `'TAGGING'`, `'HISTORY'`, `'SETTINGS'`, `'EXPORT'`, `'EVENT_DETAIL'` |
| `previousStatus` | string | The screen before EVENT_DETAIL so the Back button returns correctly |
| `itemToDelete` | number or null | ID of event being deleted (triggers confirmation popup) |
| `detailEventId` | number or null | ID of event whose detail view is being shown |
| `fullHistory` | array | All events ever recorded (used by IdleView + danger flags) |
| `toastMsg` | string | Temporary error message shown at the bottom of the screen |
| `wakeLockUnsupported` | boolean | True when the browser cannot keep the screen on (e.g. Firefox) |
| `todayLogs` | array | Today's medication logs, refreshed on IDLE entry and after saving doses — feeds `getVisibleDosesForPanel()` |
| `showManualEntry` | boolean | Controls visibility of the `ManualEntrySheet` bottom-sheet for logging past seizures |

**Key functions:**

| Function | What it does |
|----------|-------------|
| `handleStart()` | Resets the wizard, starts the timer, switches to RECORDING |
| `handleStop()` | Stops the timer, saves a raw event to the database, switches to TAGGING. Uses `stoppingRef` to prevent double-saves. |
| `handleEdit(event)` | Loads an old event into the wizard for editing |
| `handleSave()` | Saves the final tagged event, reloads history, goes to IDLE |
| `handleCancel()` | Discards tagging. If this was a new (not editing) event, **deletes the orphan record** from the database before going to IDLE |
| `handleDeleteConfirm()` | Deletes the event from the database, reloads history |
| `handleEmergencyStop()` | 12-minute auto-stop: saves event with emergency note, skips tagging. Uses `stoppingRef` to prevent double-saves. |
| `handleManualCreate({ date, time, durationSec, manualDurations })` | Creates a past seizure entry in the database with `isManualEntry: true` and the user-specified date/time. Calls `wizard.loadForManualEntry()` then switches to TAGGING. |
| `handleSaveDoses(doses)` | Logs each toggled dose with status `'taken'`, refreshes `todayLogs`, shows a toast naming the drugs logged |
| `goToDetail(id)` | Saves current screen, navigates to EVENT_DETAIL |
| `showToast(msg)` | Displays a message for 5 seconds |

**Crash recovery:**

```jsx
useEffect(() => {
  try {
    const saved = localStorage.getItem('aura_startTime');
    if (localStorage.getItem('aura_status') === 'RECORDING' && saved) {
      timer.restore(parseInt(saved, 10));
      setStatus('RECORDING');
    }
  } catch { /* private browsing — crash recovery unavailable */ }
}, []);
```

When the timer starts, `useEventTimer` saves the start time and status to `localStorage`. If the browser closes during recording, reopening the app finds this saved state and continues the recording. The `try/catch` handles private browsing mode where `localStorage` access is blocked.

**The `stoppingRef` double-save guard:**

```jsx
const stoppingRef = useRef(false);

const handleStop = async () => {
  if (stoppingRef.current) return;  // Already stopping — ignore duplicate calls
  stoppingRef.current = true;
  try {
    // ... save event ...
  } finally {
    stoppingRef.current = false;
  }
};
```

On mobile, users sometimes tap the Stop button twice very quickly, or a touch event fires more than once. Without this guard, two events would be saved. A `useRef` (not `useState`) is used because we need the protection to be immediate — state updates are asynchronous and would miss the second call.

**Wake Lock integration:**

```jsx
const wakeLock = useWakeLock();
const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false);

// Acquire/release based on recording status
useEffect(() => {
  if (status === 'RECORDING') {
    wakeLock.acquire().then(ok => {
      if (!ok && !wakeLock.supported) setWakeLockUnsupported(true);
    });
  } else {
    wakeLock.release();
    setWakeLockUnsupported(false);
  }
}, [status]);

// Re-acquire when the tab becomes visible again
// (The OS releases the wake lock when you switch tabs or get a phone call)
useEffect(() => {
  const handler = () => {
    if (document.visibilityState === 'visible' && status === 'RECORDING') {
      wakeLock.acquire();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, [status]);
```

When `wakeLockUnsupported` is true, a warning banner appears at the top of the recording screen telling the user to increase their screen timeout manually.

**Medication dose panel:**

When returning to IDLE, `App` calls three things in sequence: `meds.load()`, `meds.markMissedDoses()`, and `meds.getLogsForDay(Date.now())`. The last result is stored in `todayLogs`. Then `getVisibleDosesForPanel(activeMedications, todayLogs)` produces `medicationGroups` — a sorted object of `{ 'HH:MM': [med, ...] }` containing only the slots that still need action (upcoming slots and past unlogged slots). This is passed to `MedicationDosePanel` inside `IdleView`. Non-rescue active medications are in `activeMedications`; the full active list (including rescue) is in `allActiveMedications` for the ad-hoc dose section.

**Medication derivations computed at render:**

```javascript
const activeMedications    = meds.medications.filter(m => m.active && !m.isRescue);
const allActiveMedications = meds.medications.filter(m => m.active);
const emergencyMedications = meds.medications.filter(m => m.active && m.showInEmergency);
const medicationGroups     = getVisibleDosesForPanel(activeMedications, todayLogs);
```

**Toast system:**

```jsx
const showToast = (msg) => {
  setToastMsg(msg);
  setTimeout(() => setToastMsg(''), 5000);
};
```

A small red banner at the bottom of the screen that disappears after 5 seconds. Used for all error conditions (save failed, delete failed, emergency save failed).

---

### Configuration Files

---

#### `package.json`

The project's "ingredients list". Key scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

#### `vite.config.js`

Configures Vite with three plugins:
1. `@vitejs/plugin-react` — compiles JSX
2. `@tailwindcss/vite` — processes Tailwind classes
3. `VitePWA` — generates service worker + web app manifest link

Key PWA settings:
- `registerType: 'autoUpdate'` — the app silently updates whenever a new version deploys
- `workbox.globPatterns` — caches all JS, CSS, HTML, and image files for full offline support
- `manifest` — defines app name, icons, theme color for the installation screen

#### `postcss.config.js`

Runs `@tailwindcss/postcss` and `autoprefixer`. PostCSS is the pipeline that transforms CSS — Tailwind generates the utility classes, Autoprefixer adds browser-specific prefixes so the CSS works everywhere.

---

### Data Layer

---

#### `src/data/db.js`

**What it is:** Creates and configures the Dexie database. This is the single source of truth for how data is stored.

**The current schema (version 6):**

```javascript
import Dexie from 'dexie';

export const db = new Dexie('AuraTrackDB');

// Version 3: original events table
db.version(3).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes'
});

// Version 4: added settings table
db.version(4).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key'
});

// Version 5: added medications and medicationLogs tables
db.version(5).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id',
  medicationLogs: '++id, medicationId, takenAt'
});

// Version 6: added scheduledTime index on medicationLogs for efficient per-slot querying
db.version(6).stores({
  events: '++id, startTime, date, type, isComplete, isEdited, notes',
  settings: 'key',
  medications: '++id',
  medicationLogs: '++id, medicationId, takenAt, scheduledTime'
});
```

**What the `++id` and indexed fields mean:**

- `++id` — auto-incrementing primary key (Dexie assigns 1, 2, 3… automatically)
- `startTime`, `medicationId`, `takenAt` etc. — indexed fields, meaning you can search and sort by them efficiently
- Fields NOT listed (like `duration`, `symptoms`, `triggers`, `laps`) are still stored — they just can't be queried directly by Dexie

**The four tables:**

| Table | Purpose |
|-------|---------|
| `events` | Every seizure event ever recorded |
| `settings` | User preferences (theme, name, userMode, etc.) stored as key-value pairs |
| `medications` | The patient's medication list (name, dose, unit, frequency) |
| `medicationLogs` | Timestamped records of when each dose was actually taken |

**An event record looks like this:**

```javascript
{
  id: 42,                        // Auto-assigned
  startTime: 1716019200000,      // Unix timestamp in milliseconds
  date: '2026-05-18',            // Human-readable date
  time: '14:32',                 // Human-readable time
  duration: 187,                 // Total seconds recorded
  type: 'Tonic-Clonic',          // Seizure type chosen in wizard
  isComplete: true,              // false if wizard was skipped
  isEdited: false,               // true if manually edited after saving
  isEmergencyStop: false,        // true if the 12-min auto-stop triggered
  laps: {                        // Phase transition timestamps (ms)
    aura: 1716019215000,
    seizure: 1716019230000,
    recovery: 1716019360000
  },
  manualDurations: {},           // Phase durations overridden by user in wizard
  editedTimers: [],              // Which phases were manually edited
  symptoms: [                    // Array of symptom objects
    {
      symptom: 'Rhythmic Shaking',
      med: 'Clonic activity',    // Medical term translation
      region: 'Arms',
      subRegion: 'Right Arm',
      specificPart: 'Wrist'
    }
  ],
  triggers: [                    // Selected trigger tags (new in v5)
    'Sleep Deprivation',
    'Stress'
  ],
  notes: 'Patient was unresponsive for 30s after.',
  lastModified: 1716019500000,
  userModeAtTime: 'CARETAKER',   // Which mode the app was in
  editLog: [],                   // History of edits
  quickNotes: []                 // Timed notes added during recording
}
```

**A medication record looks like this:**

```javascript
{
  id: 3,
  name: 'Levetiracetam',
  dose: 500,
  unit: 'mg',                   // 'mg' | 'g' | 'mcg' | 'ml' | 'IU'
  frequency: 'BD',              // 'OD' | 'BD' | 'TDS' | 'QDS' | 'PRN'
  scheduledTimes: ['08:00', '20:00'],  // HH:MM strings; derived from frequency if absent
  scheduledDays: [0,1,2,3,4,5,6],     // 0=Sun…6=Sat; absent/all-7 means daily
  isRescue: false,              // true for emergency-only medications like Midazolam
  reminderEnabled: true,        // whether push notifications fire for this medication
  showInEmergency: false,       // whether to surface this med on the recording screen
  active: true
}
```

**A medication log record looks like this:**

```javascript
{
  id: 201,
  medicationId: 3,              // Links to the medication above
  scheduledTime: '08:00',       // HH:MM of the scheduled slot (null for ad-hoc doses)
  takenAt: 1716019200000,       // Millisecond timestamp of when the dose was recorded
  status: 'taken',              // 'taken' | 'late' | 'missed'
  isEdited: false,              // true if the log was manually corrected after saving
  lastModified: 1716019500000   // ms timestamp of last manual edit (undefined if never edited)
}
```

**Status values explained:**

| Status | Meaning |
|--------|---------|
| `taken` | Dose logged within 90 minutes of the scheduled time |
| `late` | Dose logged more than 90 minutes after the scheduled time |
| `missed` | No log found; auto-inserted by `markMissedDoses()` when returning to IDLE |

**Automatic migration:**

When a user who has the old version (v4 or v5) opens the updated app (v6), Dexie automatically:
1. Creates or updates the `medications` and `medicationLogs` tables as needed
2. Leaves all existing events completely untouched

The user never needs to do anything. Their data is safe.

---

#### `src/data/constants.js`

**What it is:** A large data file defining all the medical options available in the app.

**Contents:**

1. **`SYMPTOM_WIZARD`** — The four-level tree of symptoms (see Section 7 for full explanation)
2. **`BODY_REGIONS`** — The anatomical region tree (Whole Body → Head & Face → Arms → Legs → Torso)
3. **`SEIZURE_TYPES`** — The list of seizure types selectable in the wizard (Tonic-Clonic, Focal Aware, Focal Impaired Awareness, Absence, Aura Only, Myoclonic, Unknown, etc.)
4. **`TRIGGERS`** — List of common seizure triggers (new):

```javascript
export const TRIGGERS = [
  'Sleep Deprivation',
  'Missed Medication',
  'Stress',
  'Illness / Fever',
  'Hormonal',
  'Alcohol',
  'Flashing Lights',
  'Heat / Overheating',
  'Exercise',
  'Hunger / Low Blood Sugar',
  'Unknown',
];
```

**Why triggers are separate from symptoms:**

- **Symptoms** = what happened *during* the seizure (the body shaking, eyes rolling — these are medical, ictal observations)
- **Triggers** = what happened *before* the seizure (the pre-ictal context — lifestyle and environmental factors)

Mixing them in the same wizard step would confuse the clinical data model. A neurologist reads them differently.

---

### Hooks (Smart State Managers)

---

#### `src/hooks/useEventTimer.js`

**What it is:** The stopwatch. Manages the live timer during recording.

**What it stores:**
- `startTime` — the exact millisecond the recording started
- `elapsed` — seconds since start, updated every 100ms
- `laps` — object with optional `aura`, `seizure`, `recovery` timestamps

**Key functions:**
- `startTimer()` — saves start time to `localStorage` (crash recovery), starts 100ms interval
- `stopTimer()` — clears the interval, returns a completed event object with all timing data
- `restore(startMs)` — resumes a timer from a previously saved start time (crash recovery)
- `recordLap(phase)` — records a phase transition timestamp
- `setForEdit(duration, laps, startTime)` — puts the timer in read-only edit mode so the wizard can display the original timings

---

#### `src/hooks/useEventHistory.js`

**What it is:** Manages loading and deleting events from the database for display purposes.

**What it stores:**
- `history` — the most recent N events (configured by `historyPageSize` setting)
- `loading` / `error` — load state

**Key functions:**
- `load()` — fetches recent events ordered by `startTime` descending
- `loadAll()` — fetches every event (used by App to calculate danger flags across the full dataset)
- `deleteEvent(id)` — removes an event from the database

---

#### `src/hooks/useTaggingWizard.js`

**What it is:** The state machine for the multi-step symptom entry wizard.

**The wizard steps (in order):**

```
TYPE → S_CAT → S_SYM → S_DET → R_CAT → R_SUB → R_DET → SUMMARY
  │
  └── SUMMARY (shortcut when editing an existing event)
```

| Step | What the user does |
|------|-------------------|
| `TYPE` | Chooses the seizure type (Tonic-Clonic, Focal Aware, etc.) |
| `S_CAT` | Chooses a symptom category (Physical Movement, Consciousness, etc.) |
| `S_SYM` | Chooses a specific symptom within that category |
| `S_DET` | Confirms the detail/variant of the symptom |
| `R_CAT` | Chooses the body region category (Whole Body, Head, Arms…) |
| `R_SUB` | Chooses a sub-region |
| `R_DET` | Chooses the specific part |
| `SUMMARY` | Reviews everything: symptoms list, trigger tags, notes, phase timings |

**State managed:**

| State | Type | Purpose |
|-------|------|---------|
| `taggingStep` | string | Current wizard step |
| `selections` | object | Partial selections while navigating the tree |
| `tempSymptomList` | array | Confirmed symptoms added so far |
| `notes` | string | Free-text clinical observations |
| `triggers` | array | Selected trigger labels (e.g. `['Stress', 'Sleep Deprivation']`) |
| `editingId` | number or null | ID of existing event being edited (null for new events) |
| `activeEventId` | number or null | ID of the event currently being tagged |
| `manualDurations` | object | Phase durations manually overridden by the user |
| `editedTimers` | array | Which phases were manually edited |
| `overrideDateTime` | `{date, time}` or null | Replacement date (YYYY-MM-DD) and time (HH:MM) for the event. Set during the Log Past Seizure flow or when the user changes date/time in Summary while editing. Applied to `startTime`, `date`, and `time` in `handleFinalSave()`. |
| `isManualEntry` | boolean | True when the event was created via the Log Past Seizure flow (not a live recording). Drives the date/time edit row in Summary. |

**Key functions:**

| Function | What it does |
|----------|-------------|
| `triggerToggle(label)` | Toggles a trigger on/off. If already selected, removes it; otherwise adds it |
| `loadForEdit(event)` | Populates all wizard state from an existing event, including its triggers. Clears `overrideDateTime` and `isManualEntry`. |
| `loadForManualEntry(id, manualDurs, dateTime)` | Sets up wizard for a retrospective entry: sets `activeEventId`, pre-loads `manualDurations`, sets `overrideDateTime` and `isManualEntry = true`. Steps to `TYPE` so the user can classify the seizure. |
| `setEventDateTime(date, time)` | Updates `overrideDateTime`. Called from the date/time inputs in Summary. |
| `handleFinalSave()` | Writes the completed event to the database, including `triggers`, `symptoms`, `notes`. If `overrideDateTime` is set, also writes `startTime`, `date`, and `time` to match the user-specified moment. |
| `reset()` | Clears all state including `overrideDateTime` and `isManualEntry` back to initial values |

**`triggerToggle` implementation:**

```javascript
const triggerToggle = (label) => {
  setTriggers(prev =>
    prev.includes(label)
      ? prev.filter(t => t !== label)   // Remove if already selected
      : [...prev, label]                // Add if not selected
  );
};
```

---

#### `src/hooks/useSettings.js`

**What it is:** Loads and saves user preferences to the `settings` table in IndexedDB.

**Settings stored:**

| Key | Default | What it controls |
|-----|---------|-----------------|
| `theme` | `'dark'` | `'dark'` or `'light'` |
| `accentColor` | `'blue'` | The highlight color throughout the app |
| `fontSize` | `'normal'` | Text size |
| `userMode` | `'CARETAKER'` | `'CARETAKER'` or `'PATIENT'` |
| `hapticFeedback` | `true` | Whether the phone vibrates on button presses |
| `personName` | `''` | Patient name (appears in neurologist reports) |
| `caretakerName` | `''` | Caretaker name (CARETAKER mode only; shown in reports as reporter) |
| `dateOfBirth` | `''` | Patient date of birth (optional; toggle to include in reports) |
| `emergencyContact` | `''` | Emergency contact number — shown on the RedAlert screen during recording |
| `neurologistName` | `''` | Doctor's name (appears in reports and on the RedAlert screen) |
| `neurologistContact` | `''` | Neurologist phone/contact — shown on the RedAlert screen during recording |
| `neurologistInstitution` | `''` | Hospital/institution name (appears in reports) |
| `reportNotes` | `''` | Additional clinical notes |
| `historyPageSize` | `20` | How many events to show in HistoryView |
| `quickNoteLabels` | `[]` | Custom labels for quick-note buttons during recording |

**Pattern:** Uses Dexie's `settings` table as a key-value store. Each preference is stored as `{ key: 'theme', value: 'dark' }`. On load, all rows are fetched and assembled into a plain object. On update, only the changed key is written.

---

#### `src/hooks/useWakeLock.js`

**What it is:** A hook that uses the browser's Screen Wake Lock API to prevent the phone screen from going to sleep during recording.

**Why this matters in a clinical context:**

A caretaker holding a phone during a seizure cannot interact with the screen. If the screen goes dark (typically after 30–60 seconds), they cannot tap lap buttons to record phase transitions. Missed laps mean inaccurate timing data.

**Browser support:**

| Browser | Supported? |
|---------|-----------|
| Chrome 84+ (Android/Desktop) | ✅ Yes |
| Edge 84+ | ✅ Yes |
| Safari 16.4+ (iOS + macOS) | ✅ Yes (iOS 16.4 = April 2023) |
| Samsung Internet 14+ | ✅ Yes |
| Firefox (all versions) | ❌ No — not implemented |
| Older Safari / iOS < 16.4 | ❌ No |

**Implementation:**

```javascript
import { useRef, useCallback } from 'react';

export function useWakeLock() {
  const lockRef = useRef(null);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const acquire = useCallback(async () => {
    if (!supported) return false;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
      // The OS releases the lock automatically on tab switch, phone call, etc.
      // Track that so we know to re-acquire when the tab becomes visible again.
      lockRef.current.addEventListener('release', () => { lockRef.current = null; });
      return true;
    } catch {
      return false;  // Permissions denied, battery low, etc.
    }
  }, [supported]);

  const release = useCallback(async () => {
    if (lockRef.current) {
      await lockRef.current.release().catch(() => {});
      lockRef.current = null;
    }
  }, []);

  return { supported, acquire, release };
}
```

**Graceful degradation:**

When the browser does not support Wake Lock (`supported` is false), `acquire()` returns `false`. `App.jsx` detects this and shows a one-time banner: *"Screen may sleep — increase screen timeout in device settings."* No silent failure — the user is informed.

---

#### `src/hooks/useMedications.js`

**What it is:** Manages the patient's medication list and the log of dose timestamps.

**Why structured medications matter:**

The previous approach stored medication information in a free-text `reportNotes` field. This made it impossible for the app to:
- Show a structured medication table in clinical reports
- Count how many doses were taken in a reporting period
- Display a "Log Dose" button for one-tap recording

**What this hook provides:**

```javascript
const {
  medications,         // Array of medication objects currently in the database
  load,                // Re-fetch medications from database
  addMedication,       // Add a new medication record
  updateMedication,    // Update an existing medication record
  deleteMedication,    // Delete a medication (and all its dose logs)
  logDoseWithStatus,   // Record a dose with an explicit taken/late/missed status
  getLogsForDay,       // Fetch all dose logs for a specific day (used by the dose panel)
  getLogsForPeriod,    // Fetch all dose logs within a date range (used for reports)
  updateLog,           // Edit an existing log entry (sets isEdited + lastModified)
  markMissedDoses,     // Auto-insert 'missed' records for any past-due unlogged doses
} = useMedications();
```

**`logDoseWithStatus` — how a dose is recorded:**

```javascript
const logDoseWithStatus = async (medicationId, scheduledHHMM, takenAt, status) => {
  await db.medicationLogs.add({
    medicationId,
    scheduledTime: scheduledHHMM ?? null,   // links to the time slot, null for ad-hoc
    takenAt: takenAt ?? Date.now(),
    status: status ?? 'taken',              // 'taken' | 'late' | 'missed'
  });
};
```

**`markMissedDoses` — auto-filling the history:**

Called every time the app returns to the IDLE state. It idempotently inserts a `'missed'` log record for every scheduled dose whose time has passed today but has no existing log. This means the medication history tab always shows a complete record even when the user didn't open the app.

**`getLogsForPeriod` — for reports:**

```javascript
const getLogsForPeriod = async (fromMs, toMs) => {
  try {
    return await db.medicationLogs
      .where('takenAt')
      .between(fromMs, toMs, true, true)   // inclusive on both ends
      .toArray();
  } catch { return []; }
};
```

The `takenAt` field is indexed in the database schema, making this query fast even if hundreds of dose logs exist.

**Clinical dosage notation:**

The standard clinical format is: `[Drug name] [dose][unit] [frequency]`

For example: `Levetiracetam 500mg BD`

| Abbreviation | Full meaning |
|---|---|
| OD | Once daily |
| BD | Twice daily (bis die) |
| TDS | Three times daily (ter die sumendum) |
| QDS | Four times daily (quater die sumendum) |
| PRN | As needed (pro re nata — for rescue medications like Midazolam) |

| Unit | Use |
|------|-----|
| mg | Most antiepileptic drugs (AEDs) |
| g | Rare (very high-dose medications) |
| mcg | Microgram doses |
| ml | Liquid medications, rescue injections |
| IU | International Units (some vitamins, biologics) |

---

#### `src/hooks/usePWAInstall.js`

**What it is:** Manages the Progressive Web App install prompt and service worker update notifications.

**Two responsibilities:**

1. **Install prompt** — Captures the browser's `beforeinstallprompt` event so the app can show its own styled install button instead of the browser's default prompt. Also detects iOS (which doesn't fire this event) and shows manual instructions instead.

2. **Update notifications** — The Vite PWA plugin's `useRegisterSW` callback fires `needRefresh` when a new version of the app has been downloaded by the service worker. The app shows an "App update available — Reload" banner at the top of the screen. Tapping it calls `updateServiceWorker()` which activates the new version immediately.

| Property | What it is |
|----------|-----------|
| `isVisible` | Whether to show the install banner |
| `isIOS` | Whether to show iOS-specific instructions |
| `install()` | Triggers the browser's install dialog |
| `dismiss()` | Hides the banner (saves dismissal to localStorage) |
| `needRefresh` | True when a new app version is ready |
| `updateServiceWorker()` | Activates the newly downloaded service worker |

---

#### `src/hooks/useNotifications.js`

**What it is:** Schedules browser push notifications to fire at each medication's scheduled dose times for the current day.

**Why it exists:**

The dose tracker panel on the idle page is passive — it shows what's due, but only if the user opens the app. Notifications actively alert the user when a dose time arrives, without requiring them to have the app open.

**Key design decision — module-level timer store:**

```javascript
const pendingTimers = new Map();
```

This `Map` lives outside the React component (at module scope), so it survives component re-renders and state changes. If it were inside `useNotifications`, it would be recreated on every render and all scheduled timers would be lost.

**Exported functions:**

| Function | What it does |
|----------|-------------|
| `requestPermission()` | Calls `Notification.requestPermission()`, stores and returns the result (`'granted'` / `'denied'` / `'default'`) |
| `scheduleForToday(medications)` | Cancels all existing timers, then schedules a `setTimeout` for each upcoming dose today (skips: PRN/rescue meds, meds with `reminderEnabled: false`, any slot < 1 minute away) |
| `cancelAll()` | Clears all pending timers |

**How a notification fires:**

```javascript
// At the scheduled time, fireNotification() is called:
const title = `Time to take ${med.name}`;
const body  = `${med.dose}${med.unit} — tap to confirm in AuraTrack`;
// Preferred: via Service Worker (shows even when app is not in foreground)
const sw = await navigator.serviceWorker?.ready;
if (sw?.showNotification) {
  await sw.showNotification(title, { body, tag, icon: '/favicon.svg' });
} else {
  new Notification(title, { body, tag });  // fallback: standard Web Notification
}
```

**Integration in `App.jsx`:**

- `scheduleForToday()` is called whenever `meds.medications` changes (via `useEffect`)
- It is also called in the `visibilitychange` handler when the tab regains focus (to reschedule after the user switches back to the app)
- `requestPermission()` is called from `SettingsView` when the user enables a reminder

---

### Pages (The Screens)

---

#### `src/pages/IdleView.jsx`

**What it is:** The home screen. What the user sees when no recording is happening.

**What it shows:**
- The big **START** button, with a small **"+ Log Past Seizure"** text link directly below it
- The **Dose Tracker panel** (`MedicationDosePanel`) — only visible when at least one medication is configured
- A list of the most recent 5 events (from `history` prop)
- Danger flag badges on events that were dangerous (>5 min, cluster)

**Dose Tracker panel integration:**

```jsx
{hasMedications && (
  <MedicationDosePanel
    medicationGroups={medicationGroups}
    allActiveMedications={allActiveMedications ?? []}
    onSaveDoses={onSaveDoses}
  />
)}
```

`hasMedications` is `true` when `medicationGroups` has any time slots OR `allActiveMedications` has any entries. The panel is hidden for users who haven't set up medications, keeping the idle screen clean.

**Props:**

| Prop | Purpose |
|------|---------|
| `history` | Recent events array (last 5) |
| `fullHistory` | All events (for danger map calculations) |
| `onStart` | Called when START is tapped |
| `onManualEntry` | Called when "Log Past Seizure" is tapped — opens `ManualEntrySheet` |
| `onEdit` | Called when an event's Edit button is tapped |
| `onDelete` | Called when an event's Delete button is tapped |
| `onViewDetail` | Called when an event card is tapped |
| `medicationGroups` | Object `{ 'HH:MM': [med, ...] }` of today's actionable dose slots |
| `allActiveMedications` | Full list of active medications (for the ad-hoc dose section) |
| `onSaveDoses` | Called with toggled dose array to log them as taken |

---

#### `src/pages/RecordingView.jsx`

**What it is:** The live recording screen. Shown during an active seizure.

**What it shows:**
- The elapsed time counter (large, high-contrast)
- Phase buttons: AURA, SEIZURE, RECOVERY (each highlights when that phase is active)
- A STOP button
- An emergency stop mechanism (12-minute auto-stop with countdown)
- Quick-note buttons (configurable labels) for one-tap timestamped notes
- In CARETAKER mode: a full-screen `RedAlert` overlay when elapsed > 5 minutes (see below)
- If wake lock is unsupported: a warning banner at the top

**`RedAlert` — the emergency overlay:**

Triggered in CARETAKER mode when the seizure phase exceeds 5 minutes (`ALERT_THRESHOLD = 300s`). Covers the entire screen with a deep-red background and contains:
1. A "MEDICAL ALERT / UNRESPONSIVE" heading with elapsed time
2. "CALL EMERGENCY SERVICES NOW" instruction
3. **Emergency medication box** (white card, red border) — lists each medication where `showInEmergency === true`, showing name, dose, and unit. Only shown if at least one such medication is configured.
4. **Contact info panel** — neurologist name, neurologist contact number, and emergency contact number (drawn from settings). Only shown if at least one of these fields is non-empty.

The overlay has a close (✕) button so the caretaker can dismiss it and return to the timer if needed. Recording continues uninterrupted behind it. After `AUTO_STOP_AT = 720s` (12 minutes) the recording stops automatically regardless.

**Phase tracking:**

When a phase button is tapped, it calls `onLap(phase)`. The `useEventTimer` hook records the exact timestamp. These timestamps (stored in `laps`) are used later to calculate how long each phase lasted.

---

#### `src/pages/TaggingView.jsx`

**What it is:** The post-seizure symptom entry wizard. Shown after STOP is pressed.

**What it does:** Renders the appropriate wizard step based on `taggingStep`, passing all the state and callbacks from `useTaggingWizard` down to the child components.

**Props passed to child components:**

All props come from `useTaggingWizard` spread via `{...wizard}` in `App.jsx`, plus timer data. The key new additions:

- `triggers` — the array of selected trigger labels
- `triggerToggle` — the function to add/remove a trigger

These are passed through to `<Summary>` where the trigger chip UI lives:

```jsx
// In TaggingView.jsx
const { triggers, triggerToggle, ...rest } = props;

// In the SUMMARY step render:
<Summary
  ...rest
  triggers={triggers}
  onTriggerToggle={triggerToggle}
/>
```

---

#### `src/pages/HistoryView.jsx`

**What it is:** The event history browser with three tabs.

**Three tabs:**

| Tab | Content |
|-----|---------|
| **Seizures** | Scrollable list of `EventCard` components; type and date filters; `SeizureTrendChart`; pagination |
| **Medications** | Renders `MedicationHistoryTab` — a calendar-style grid of every scheduled dose slot with TAKEN/LATE/MISSED status badges |
| **Export** | Renders `ExportView` inline — all export formats (JSON, CSV, PDF, neurologist report, seizure diary) accessible without leaving the History context |

**Seizures tab details:**
- Type filter dropdown (`SEIZURE_TYPES` from `data/constants`)
- Date filter (`<input type="date">`)
- Pagination controlled by `historyPageSize` setting
- Danger map computed via `buildDangerMap(allEvents)` and passed to each `EventCard`

---

#### `src/pages/SettingsView.jsx`

**What it is:** A thin wrapper around `SettingsForm`. Renders the form with a Back button and passes all setting values and update callbacks.

---

#### `src/pages/ExportView.jsx`

**What it is:** The export hub. Lets users generate data files and clinical reports.

**Exports available:**

| Export | What it produces |
|--------|-----------------|
| Backup JSON | All event data as a `.json` file |
| Spreadsheet CSV | Comma-separated event data for Excel/Sheets |
| Simple Print / PDF | Opens a printable table in a new tab |
| Neurologist Report | Detailed clinical PDF with charts, medications, and trigger analysis |
| Monthly Seizure Diary | Single-page A4 calendar grid for bring-to-appointment use |

**Date range picker:**

The JSON, CSV, PDF, and Neurologist Report use a date range picker (From → To). Both inputs enforce valid ranges: "From" cannot be after "To", and "To" cannot be in the future.

**Seizure Diary month picker:**

```jsx
const [diaryMonth, setDiaryMonth] = useState(
  () => new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
);
```

The diary uses a separate `<input type="month">` picker capped at the current month, since future months have no data.

**How medications are passed to the neurologist report:**

```javascript
const handleNeurologistReport = async () => {
  const events = await getEvents();
  const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
  const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
  const medLogs = await getLogsForPeriod(fromMs, toMs);
  exportNeurologistReport(events, settings, medications, medLogs);
};
```

The hook's `getLogsForPeriod` is called with the same date range so only doses taken within the report period are included in the adherence count.

---

#### `src/pages/EventDetailView.jsx`

**What it is:** Shows all recorded information for a single seizure event.

**What it shows:**
1. Danger alerts (Prolonged Seizure warning, Cluster/SE Risk warning) — shown above the main content
2. Duration summary card (total duration, aura/seizure/recovery breakdown)
3. Date and time details
4. Symptoms list (with medical term translations)
5. **Triggers card** (new) — shows selected trigger tags as styled chips
6. Clinical observations (free-text notes)

**Triggers card:**

```jsx
{event.triggers?.length > 0 && (
  <div className="p-5 rounded-2xl" ...>
    <p ...>Possible Triggers</p>
    <div className="flex flex-wrap gap-2">
      {event.triggers.map(t => (
        <span key={t} className="px-3 py-1.5 rounded-full ..." ...>
          {t}
        </span>
      ))}
    </div>
  </div>
)}
```

The `?.length` guard means the section only renders if at least one trigger was recorded. Events recorded before the trigger feature was added will have `undefined` for `triggers` — this is handled safely.

**Not-found state:**

```jsx
if (notFound) {
  return (
    <div ...>
      <p>Event not found.</p>
      <button onClick={onClose}>← Back</button>
    </div>
  );
}
```

If the event ID no longer exists (e.g., was deleted while the detail was open), a graceful "not found" message appears with a Back button. Previously the app would silently show nothing.

**Danger flag loading:**

```jsx
const nearby = await db.events
  .where('startTime')
  .between(ev.startTime - CLUSTER_WINDOW_MS, ev.startTime + CLUSTER_WINDOW_MS, true, true)
  .toArray();
setDangerFlags(computeDangerFlags(ev, nearby));
```

Instead of loading all events, only events within the 8-minute cluster window are fetched. This is efficient even if the database contains thousands of records.

---

### Components (Reusable Building Blocks)

---

#### `src/components/Summary.jsx`

**What it is:** The final step of the symptom wizard where the user reviews everything before saving.

**What it shows:**
- **Event Date & Time row** — two editable inputs (date + time) shown when editing an existing event (`editingId` is set) or creating a past entry (`isManualEntry` is true). Allows backdating a live-recorded event or correcting a manual entry's date/time before save.
- Phase timing display (aura/seizure/recovery durations with edit capability)
- Confirmed symptoms list with drag-to-reorder
- **POSSIBLE TRIGGERS section** — a grid of pill-shaped chip buttons
- Notes textarea for free-text clinical observations
- A SAVE button

**Trigger chips:**

```jsx
<div className="flex flex-wrap gap-2">
  {TRIGGERS.map(t => {
    const selected = triggers.includes(t);
    return (
      <button
        key={t}
        onClick={() => onTriggerToggle?.(t)}
        style={selected
          ? { backgroundColor: 'var(--accent)', color: '#fff', ... }
          : { backgroundColor: 'transparent', color: 'var(--text-dim)', ... }
        }
      >
        {t}
      </button>
    );
  })}
</div>
```

Tap once to select (chip fills with the accent color). Tap again to deselect (chip becomes outlined). Multiple chips can be selected. The section is entirely optional — nothing is required.

---

#### `src/components/SettingsForm.jsx`

**What it is:** The entire settings form rendered inside SettingsView.

**Sections (in order):**

1. **Identity** — Patient name, neurologist name, user mode (Caretaker/Patient)
2. **Recording** — Quick note button labels, haptic feedback toggle
3. **Medications** (new) — Structured medication management
4. **Appearance** — Theme, accent color, font size
5. **History** — Page size setting
6. **Data & Backup** — Export/import buttons, database version info
7. **Reports & Neurologist** — Additional clinical notes (reportNotes)

**Medications section (`MedicationSection` component):**

Rendered inline within `SettingsForm` using its own instance of `useMedications()`.

*What it shows:*
- A list of currently saved medications: `Name · Dose Unit · Frequency`
- A Rescue badge next to PRN medications
- A delete button per medication (with confirmation)
- An "Add Medication" inline form with:
  - Name text input
  - Dose number input
  - Unit dropdown: mg / g / mcg / ml / IU
  - Frequency dropdown: Once daily (OD) / Twice daily (BD) / Three times daily (TDS) / Four times daily (QDS) / As needed (PRN)
  - Scheduled times (auto-populated from frequency; editable HH:MM inputs)
  - Scheduled days of the week (toggles for Mon–Sun; absent = daily)
  - "Show in emergency screen?" toggle (surfaces the med on the RecordingView for quick reference)
  - "Enable dose reminders?" toggle (controls browser push notifications)
  - Save / Cancel buttons

*Why PRN medications are treated differently:*
Selecting PRN frequency automatically sets `isRescue = true`. Rescue medications are excluded from the routine dose panel and `getVisibleDosesForPanel` — they appear only in the ad-hoc dose sheet.

*Why the confirmation on delete:*
Deleting a medication also deletes all its dose logs (`medicationLogs` records). This is irreversible. The confirmation step prevents accidental data loss.

---

#### `src/components/EventCard.jsx`

**What it is:** Displays a single seizure event as a card in a list.

**What it shows:**
- Date and time
- Seizure type (with a type-specific color indicator)
- Total duration
- Danger flag badges: `>5 MIN` (amber) and `CLUSTER/SE RISK` (red)
- An `EDITED` badge (gray) for manually modified records
- A `MANUAL ENTRY` badge (indigo) for events logged retrospectively via the Log Past Seizure flow
- An `EMERGENCY STOP` badge for auto-stopped events
- Edit and Delete action buttons

---

#### `src/components/SeizureTrendChart.jsx`

**What it is:** An interactive chart showing seizure trends over time.

**Two chart modes:**
1. **Frequency** — bar chart of how many seizures happened per day
2. **Duration** — line chart of average seizure duration per day

Uses `recharts` for rendering. Supports pinch-to-zoom and touch panning on mobile via Recharts' built-in brush component.

---

#### `src/components/DeleteModal.jsx`

**What it is:** A confirmation dialog before permanently deleting an event.

Shows "Are you sure?" with the event's date/time, a red CONFIRM DELETE button, and a Cancel button. Rendered as a fixed overlay (on top of everything else).

---

#### `src/components/ExportCard.jsx`

**What it is:** A reusable card component for each export format in ExportView.

Shows:
- An icon
- A label
- A short description
- A button that triggers the export

---

#### `src/components/MedicationDosePanel.jsx`

**What it is:** The dose tracker panel shown on the idle page when medications are configured. Replaces the old single "Log Dose Taken" button with a full scheduled-dose interface.

**What it shows:**
- A "DOSE TRACKER" heading with a Save button (disabled until at least one dose is toggled)
- One section per scheduled time slot (e.g., Morning · 08:00)
- Each slot label gains a status suffix:
  - `· LATE` (amber `#d97706`) if the scheduled time was 0–90 minutes ago
  - `· MISSED` (red `#dc2626`) if the scheduled time was more than 90 minutes ago
- One pill-shaped button per medication in that slot
  - **Gray** → upcoming (scheduled time is in the future)
  - **Amber-tinted, amber border** → LATE (0–90 min past due, not yet logged)
  - **Red-tinted, red border** → MISSED (>90 min past due, not yet logged)
  - **Accent color** → toggled (the user has tapped this dose and is about to save it)
- A "+ Extra / On-Demand Dose" button that opens a bottom sheet for logging ad-hoc doses

**Behaviour:**
- Tapping a button toggles it — it turns accent-colored to confirm intent
- Tapping Save calls `onSaveDoses` with all toggled doses, then shows "✓ Saved" for 2.5 seconds
- Toggled state takes precedence over LATE/MISSED coloring — the user's intent overrides the status display
- `nowMs = Date.now()` is computed once per render; the panel does not auto-refresh (it updates when the parent re-renders on IDLE entry)

**Status color logic (per slot):**

```javascript
const scheduledTs = scheduledTimestampForDay(hhMM, nowMs);
const diffMin = (nowMs - scheduledTs) / 60000;
const slotIsMissed = diffMin > 90;
const slotIsLate   = diffMin > 0 && !slotIsMissed;
```

---

#### `src/components/MedicationHistoryTab.jsx`

**What it is:** A scrollable calendar-style grid showing every scheduled dose slot for the current month, with a coloured status badge in each cell.

**What it shows:**
- Columns = one per day
- Rows = one per medication × scheduled time slot
- Each cell shows the status of that dose:

| Status | Color |
|--------|-------|
| `taken` | Green `#16a34a` |
| `late` | Amber `#d97706` |
| `missed` | Red `#dc2626` |
| `upcoming` | Gray outline |
| `no data` | Faint outline |

- Cells are tappable to correct an entry (opens an edit sheet)
- Edited entries show a `✎` indicator
- The component builds a fast lookup index (`logIndex`) keyed by `"dayStart|medId|hhMM"` to avoid O(n²) scanning when rendering hundreds of cells

---

#### `src/components/ManualEntrySheet.jsx`

**What it is:** A bottom-sheet modal for logging a past seizure with the correct date, time, and duration. Opened from the "Log Past Seizure" link on IdleView.

**Fields:**

| Field | Input type | Default | Notes |
|-------|-----------|---------|-------|
| Date | `<input type="date">` | Today | Capped at today (`max={today}`) — cannot select future dates |
| Time | `<input type="time">` | Current local time | |
| Total Duration | Two number inputs (min + sec) | 0 min 0 sec | Required — must be > 0 to continue |
| *(collapsible)* Aura | Two number inputs (min + sec) | 0 | Expand via "▸ Phase Breakdown (optional)" |
| *(collapsible)* Seizure (Ictal) | Two number inputs (min + sec) | 0 | Same collapsible section |
| *(collapsible)* Post-Ictal / Recovery | Two number inputs (min + sec) | 0 | Same collapsible section |

**Validation:** The "Continue to Details →" button is blocked if total duration is 0. A red error message appears.

**On confirm:** Calls `onConfirm({ date, time, durationSec, manualDurations })`. The parent (`App.jsx`) creates the event in the database and calls `wizard.loadForManualEntry()`, then transitions to TAGGING.

**Style:** Same pattern as the ad-hoc dose sheet in `MedicationDosePanel` — dark backdrop, white card sliding up from the bottom.

---

#### `src/components/PWAInstallBanner.jsx`

**What it is:** A banner that appears at the bottom of the screen promoting app installation, and also shows the "App update available" notification bar at the top.

**Two behaviors:**
1. **Install banner** — On Chrome/Edge Android: shows a styled "Install AuraTrack" button. On iOS/Safari: shows step-by-step instructions (tap Share → Add to Home Screen).
2. **Update banner** — When `needRefresh` is true (a new service worker is ready), shows a thin banner at the top: "App update available [Reload]".

---

### Utilities (Helper Functions)

---

#### `src/utils/exportHelpers.js`

**What it is:** All the logic for creating files and printable documents. No React here — pure JavaScript functions.

**Functions:**

| Function | What it does |
|----------|-------------|
| `filterEventsByDateRange(events, fromDate, toDate)` | Filters an event array to only those within the given date range |
| `exportToJSON(events)` | Downloads a `.json` file containing all event data |
| `exportToCSV(events)` | Downloads a `.csv` file (comma-separated values) |
| `exportToPDF(events)` | Opens a new tab with a printable HTML table and calls `window.print()` |
| `exportNeurologistReport(events, settings, medications, medicationLogs)` | Opens a new tab with a full clinical PDF-ready report |
| `exportSeizureDiary(allEvents, settings, medications, month, year)` | Opens a new tab with a one-page monthly calendar grid |

**How files are downloaded:**

Browsers don't let JavaScript write directly to your disk. Instead:

1. Create the data as a `Blob` (raw bytes in memory)
2. Create a temporary URL: `URL.createObjectURL(blob)`
3. Create an invisible `<a>` tag with `download="filename.json"`
4. Programmatically click it
5. Revoke the URL to free memory

**The Edge browser hang fix:**

Early versions of the neurologist report used:

```html
<script>window.onload = () => window.print();</script>
```

This caused Edge to hang — the synchronous `window.print()` call inside a popup's `onload` blocks the opener tab's event loop. The fix: **removed the auto-print script entirely**. Instead, a sticky "🖨 Print / Save as PDF" button at the top of the popup page lets users print when they're ready:

```html
<button class="no-print" onclick="window.print()">🖨 Print / Save as PDF</button>
```

The `.no-print` CSS class hides this button when the browser's print dialog is open, so it doesn't appear in the PDF.

**The Neurologist Report — section by section:**

**Section 1: Header**
- App name, report title, generated date
- Date range
- Patient name and neurologist name (from settings)

**Section 2: Medications (new)**

A structured table of current medications:

```
Current Medications
────────────────────────────────────────────
Levetiracetam    500 mg    BD (Twice Daily)
Clobazam          10 mg    OD (Once Daily)
Midazolam [rescue] 10 mg   PRN (As Needed)
```

If dose logs exist for the reporting period, an adherence summary line is added:
> "87 doses logged in 30 days"

If no medications have been configured, this section is omitted.

**Section 3: Stats Grid**
- Total events in the period
- Average duration
- Days with recorded events
- Number of different seizure types

**Section 4: Recent Events Table**
Each row: # · Date · Time · Type · Total Duration · Aura · Seizure · Recovery · Notes · Badges

Trigger tags are shown as small inline badges in each row (e.g. a purple "Sleep Deprivation" chip next to an event's notes).

**Section 5: Trend Analysis — 4 SVG Charts**
1. Frequency bar chart (events per day over the period)
2. Duration line chart
3. Type distribution
4. Phase breakdown stacks

**Section 6: Condensed Event Details**
Full breakdown of the last 3 events plus any events over 5 minutes or that were edited. Each event shows trigger tags as coloured chips.

**Section 7: Clinical Flags (Auto-generated)**

Automatically checks for:
- Events over 5 minutes
- Increasing frequency (compares first half vs second half of the period)
- Increasing duration
- Auto-stopped events
- Edited records
- **Trigger aggregate** (new): "Most reported triggers: Sleep Deprivation (8×), Stress (5×), Missed Medication (3×)"

**Section 8: Data Quality**

```
CONFIDENCE: HIGH (85% fully recorded)
┌────────┬─────────┬──────────┬─────────────┬────────┐
│   17   │    2    │    1     │      0      │    3   │
│ Fully  │ Partial │ Untagged │ Auto-Stopped│ Edited │
│Recorded│         │          │             │        │
└────────┴─────────┴──────────┴─────────────┴────────┘
```

**The Seizure Diary — `exportSeizureDiary`**

A one-page A4 landscape calendar grid designed to be printed and brought to every neurology appointment.

**Why it's useful vs the in-app charts:**

The in-app `SeizureTrendChart` is interactive — good for reviewing patterns on-screen. But it cannot be printed easily, and it's too wide for A4. The seizure diary is a **single printed sheet** — the format neurologists already expect from patients. It shows at a glance which days had events, how many, and what types. Reading it takes three seconds.

**Layout:**

```
NOVEMBER 2025           AuraTrack Seizure Diary — [Patient Name]
─────────────────────────────────────────────────────────────────
Mon   Tue   Wed   Thu   Fri   Sat   Sun
                              1     2
 3     4    [80TC  4FA]  6     7     8     9
10    11    12    [1FA]  14    15    16
...
─────────────────────────────────────────────────────────────────
Legend: TC Tonic-Clonic  FA Focal Aware  FI Focal Impaired
        Ab Absence  Au Aura Only  Un Uncategorized
Medications: Levetiracetam 500mg BD, Clobazam 10mg OD
```

**High-frequency patient support:**

Days with many seizures show per-type count badges instead of dots. If a patient has 80 Tonic-Clonic and 4 Focal Aware seizures in one day, the cell shows:

```
[80] TC
[ 4] FA
```

Where each `[count]` badge is a color-filled rectangle (red for TC, amber for FA, etc.) and the abbreviation is color-matched. This scales to any number of seizures without overflow.

**Type abbreviations:**

| Seizure Type | Abbreviation | Color |
|---|---|---|
| Tonic-Clonic | TC | Red |
| Focal Aware | FA | Amber |
| Focal Impaired Awareness | FI | Orange-red |
| Absence | Ab | Blue |
| Aura Only | Au | Purple |
| Myoclonic | My | Teal |
| Uncategorized | Un | Gray |

**Print settings:** `@page { size: A4 landscape; margin: 10mm; }` — ensures it fits on one sheet.

---

#### `src/utils/dangerFlags.js`

**What it is:** Calculates whether a seizure event has any dangerous characteristics.

**Two exported functions:**

**`computeDangerFlags(event, allEvents)`**

Used when displaying a single event (EventDetailView or EventCard).

```javascript
export function computeDangerFlags(event, allEvents = []) {
  const flags = [];

  // Flag 1: duration > 5 minutes
  if ((event.duration || 0) > 300) {
    flags.push('long_duration');
  }

  // Flag 2: 3+ events within ±8 minutes with no confirmed recovery
  const nearby = allEvents.filter(e =>
    Math.abs((e.startTime || 0) - (event.startTime || 0)) <= CLUSTER_WINDOW_MS &&
    !e.laps?.recovery
  );
  if (nearby.length >= 3) {
    flags.push('cluster');
  }

  return flags;
}
```

**`buildDangerMap(allEvents)`**

Used when displaying a list of events (IdleView, HistoryView). Instead of calling `computeDangerFlags` once per event (which would be O(n²)), this function calculates all flags in one pass:

```javascript
export function buildDangerMap(allEvents) {
  const sorted = [...allEvents].sort((a, b) => a.startTime - b.startTime);
  const map = {};

  for (let i = 0; i < sorted.length; i++) {
    const flags = [];
    const t = sorted[i].startTime || 0;

    // Duration check
    if ((sorted[i].duration || 0) > 300) flags.push('long_duration');

    // Cluster check: scan outward from position i using early termination
    let clusterCount = sorted[i].laps?.recovery ? 0 : 1;
    for (let j = i - 1; j >= 0 && t - sorted[j].startTime <= CLUSTER_WINDOW_MS; j--) {
      if (!sorted[j].laps?.recovery) clusterCount++;
    }
    for (let j = i + 1; j < sorted.length && sorted[j].startTime - t <= CLUSTER_WINDOW_MS; j++) {
      if (!sorted[j].laps?.recovery) clusterCount++;
    }
    if (clusterCount >= 3) flags.push('cluster');

    map[sorted[i].id] = flags;
  }
  return map;
}
```

**Why O(n·k) instead of O(n²):**

The sorted array means we can stop scanning as soon as an event falls outside the 8-minute window. For most real-world data, only a handful of events are within 8 minutes of any other event, so `k` (the window size) is very small.

---

#### `src/utils/hapticFeedback.js`

**What it is:** A tiny module that vibrates the phone when buttons are pressed.

```javascript
let enabled = true;
export const setHapticEnabled = (v) => { enabled = v; };
export const haptic = (pattern = [10]) => {
  if (enabled && navigator.vibrate) navigator.vibrate(pattern);
};
```

`navigator.vibrate` is a browser API that takes a pattern of millisecond durations (vibrate, pause, vibrate, pause…). A `[10]` pattern is a very short 10ms buzz — barely perceptible but confirms the button was pressed.

---

#### `src/utils/formatters.js`

**What it is:** Converts raw numbers into human-readable strings.

**Exported functions:**

```javascript
// Converts seconds to "2m 30s" or "45s" format
export function formatDuration(seconds) { ... }

// Formats a comma-separated row for CSV export
export function formatCSVRow(event) { ... }
```

The `seconds == null` guard in `formatDuration` prevents crashes when an event is partially recorded (missing laps mean some phase durations are `null` or `undefined`).

---

#### `src/utils/medicationSchedule.js`

**What it is:** Pure utility functions for all medication scheduling logic. No React, no database calls — everything is deterministic given a list of medications and a timestamp.

**Exported functions:**

| Function | What it does |
|----------|-------------|
| `defaultScheduledTimes(frequency)` | Returns the default HH:MM array for a frequency (e.g. BD → `['08:00', '20:00']`) |
| `scheduledTimestampForDay(hhMM, dateMs)` | Converts `'08:00'` + a day's timestamp into a precise millisecond timestamp for that day |
| `scheduledTimestampForToday(hhMM)` | Shortcut: `scheduledTimestampForDay(hhMM, Date.now())` |
| `getDoseStatus(scheduledHHMM, loggedAtMs, dayMs)` | Returns `'taken'` (logged ≤90 min after scheduled), `'late'` (logged >90 min after), or `'missed'` (no log) |
| `isMedScheduledForDay(med, dayMs)` | Returns `true` if the medication should be taken on the given day (checks `scheduledDays`) |
| `getScheduledDosesForDay(medications, dateMs)` | Expands all active non-PRN medications × their scheduled times into a flat sorted array |
| `getVisibleDosesForPanel(medications, todayLogs, nowMs)` | Returns `{ 'HH:MM': [med, ...] }` for the dose panel — only upcoming and unlogged past slots |
| `slotLabel(hhMM)` | Returns a human label: `'Morning'` (before 12), `'Afternoon'` (12–17), `'Evening'` (17–21), `'Night'` (21+) |
| `scheduledDaysLabel(scheduledDays)` | Returns a short display string like `'Mon · Wed · Fri'`, or `null` for daily medications |

**`getVisibleDosesForPanel` — the core panel filter:**

```javascript
// For each med × scheduled time:
// - If the slot time is in the future → always show (upcoming)
// - If the slot time has passed → show ONLY if it has no successful log (missed/unlogged)
// - If it has been logged as taken or late → hide it (already done)
if (scheduledTs <= nowMs) {
  const logged = todayLogs.some(
    l => l.medicationId === med.id &&
         l.scheduledTime === hhMM &&
         l.status !== 'missed'   // 'missed' auto-records don't count as done
  );
  if (logged) continue;
}
```

---

#### `src/utils/htmlEscape.js`

**What it is:** A single-line shared utility that sanitises strings before embedding them in HTML. Used by both `exportHelpers.js` and `pdfCharts.js` to prevent HTML injection in user-supplied data (patient names, notes, etc.).

```javascript
export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

---

#### `src/utils/phaseCalculations.js`

**What it is:** A shared utility for computing aura, seizure, and recovery phase durations from a recorded event. Previously this logic was duplicated inline in both `exportHelpers.js` and `pdfCharts.js`; extracting it here removes that duplication.

```javascript
export function phaseDurs(e) {
  const m = e.manualDurations || {};
  return {
    aura:     m.aura     ?? (e.laps?.aura && e.startTime         ? Math.round((e.laps.aura - e.startTime) / 1000)         : 0),
    seizure:  m.seizure  ?? (e.laps?.aura && e.laps?.seizure     ? Math.round((e.laps.seizure - e.laps.aura) / 1000)       : 0),
    recovery: m.recovery ?? (e.laps?.seizure && e.laps?.recovery ? Math.round((e.laps.recovery - e.laps.seizure) / 1000)   : 0),
  };
}
```

Manual overrides (`manualDurations`) take precedence over lap-derived values — this matters when the user has edited the timings in the wizard SUMMARY step.

---

#### `src/utils/pdfCharts.js`

**What it is:** Generates SVG chart markup for use inside the neurologist report HTML document.

**Four chart generators:**

1. **`freqBarChart(days)`** — Vertical bar chart of events per day over the reporting period
2. **`durationLineChart(events)`** — Line chart of event duration over time
3. **`typeDistribution(events)`** — Horizontal bar chart of seizure type breakdown
4. **`phaseStackChart(events)`** — Stacked bar showing aura/seizure/recovery proportions per event

SVG (Scalable Vector Graphics) is a way to describe shapes using mathematical coordinates rather than pixels. This means charts look sharp when printed at any resolution.

```javascript
// A simple bar in SVG:
// x, y: top-left corner; width, height: size; fill: color
`<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#1e3a5f" rx="2"/>`
```

---

### Styles

---

#### `src/index.css`

**What it is:** Global styles that apply to the entire app. This is where the theming system lives.

**The theme system:**

The app uses CSS Custom Properties (variables) for all colors. Every color in every component references a variable like `var(--bg-base)` or `var(--accent)`.

Themes are set by the `data-theme` attribute on the root `<div>`:

```css
:root[data-theme="dark"] {
  --bg-base: #0f172a;
  --bg-card: #1e293b;
  --text-primary: #f1f5f9;
  --accent: #3b82f6;   /* default blue */
}

:root[data-theme="light"] {
  --bg-base: #f8fafc;
  --bg-card: #ffffff;
  --text-primary: #0f172a;
  --accent: #3b82f6;
}
```

The accent color is also customizable via `data-accent`. When `data-accent="purple"` is set, a CSS rule overrides `--accent` to the purple value.

**Touch optimizations:**

```css
* {
  -webkit-tap-highlight-color: transparent;  /* No gray flash on iOS tap */
  touch-action: manipulation;                /* Faster tap response (no double-tap zoom) */
}
```

**Custom scrollbar:**

```css
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }
```

A thin, minimal scrollbar that blends with the dark theme.

---

## 5. How the App Works — User Journeys

---

### Journey 1: Recording a Seizure (Standard)

```
1. User opens the app (IDLE screen)
2. Seizure begins → taps START RECORDING
   → App saves startTime to localStorage
   → Screen wake lock acquired (prevents phone sleeping)
   → Switches to RECORDING screen
3. During seizure:
   → Timer counts up in real time
   → Caretaker taps AURA when warning phase begins
   → Taps SEIZURE when convulsions start
   → Taps RECOVERY when convulsions stop
   → Optionally taps quick-note buttons (e.g. "FELL", "BLUE LIPS")
4. Seizure ends → taps STOP
   → Timer stops
   → Raw event saved to database (type: 'Uncategorized', isComplete: false)
   → localStorage cleared
   → Wake lock released
   → Switches to TAGGING screen (wizard step: TYPE)
5. In the wizard:
   → Selects seizure type (e.g. Tonic-Clonic)
   → Navigates through symptom tree (category → symptom → body region)
   → Adds as many symptoms as observed
   → Reaches SUMMARY step
   → Optionally taps trigger chips (e.g. "Sleep Deprivation")
   → Optionally types notes
   → Taps SAVE
6. Event is updated in database with all details
7. Returns to IDLE
```

---

### Journey 2: Emergency — Seizure Still Going at 12 Minutes

```
1. User starts recording
2. 4 minutes in: timer turns red (visual warning)
3. 5 minutes in (CARETAKER mode): full-screen red overlay appears with instructions:
   → "CALL EMERGENCY SERVICES"
   → "DO NOT LEAVE THE PATIENT"
   → "DO NOT PUT ANYTHING IN THE MOUTH"
   (Patient mode: no overlay — patient may be unconscious)
4. 12 minutes in: App auto-stops the timer
   → Saves event with note: "PATIENT UNRESPONSIVE — all timers automatically stopped at 12 minutes"
   → isEmergencyStop: true
   → Skips tagging wizard entirely
   → Returns to IDLE
5. Later: caretaker can find the event in History and edit/add notes
```

---

### Journey 3: Generating a Neurologist Report

```
1. From HISTORY, taps Export button
2. ExportView shown
3. Optionally adjusts the date range (default: last 30 days)
4. Taps "Generate & Print Report"
5. App:
   → Fetches all events in the date range
   → Fetches medication logs for the same date range
   → Calls exportNeurologistReport(events, settings, medications, medLogs)
6. A new browser tab opens with the complete report:
   → Patient name and neurologist details
   → Structured medications table with adherence count
   → Statistics grid
   → Events table with trigger badges
   → Four SVG charts
   → Condensed event details (with triggers highlighted)
   → Clinical flags including trigger aggregate
   → Data quality confidence score
7. User clicks the "Print / Save as PDF" sticky button
8. Browser print dialog opens
9. User saves as PDF or sends to printer
   (The print button is hidden in the printed output via .no-print CSS class)
```

*Note: The report popup does NOT auto-print. In older versions, an auto-print script was included but caused Edge to hang (the synchronous `window.print()` in the popup's `onload` blocked the opener tab's event loop). The fix is to always require the user to click the sticky print button.*

---

### Journey 4: Logging a Medication Dose

```
1. User opens the IDLE screen
2. The Dose Tracker panel is visible (medications have been set up in Settings)
3. Each scheduled dose slot is shown with its time and a pill-shaped button per medication:
   → Upcoming slots: gray buttons
   → Past-due within 90 min: amber buttons labelled "· LATE"
   → Past-due over 90 min: red buttons labelled "· MISSED"
4. User taps the medication button(s) they have just taken — each turns accent-colored
5. User taps "Save"
6. App calls logDoseWithStatus(medicationId, scheduledHHMM, now, 'taken') for each toggled dose
7. Panel clears toggles and shows "✓ Saved" for 2.5 seconds
8. A toast appears: "Logged: Levetiracetam 500mg"
9. The logged doses disappear from the panel (taken slots are filtered out by getVisibleDosesForPanel)
10. The dose is now recorded and will appear in the next neurologist report

ALTERNATIVE: Ad-hoc or rescue dose
→ User taps "+ Extra / On-Demand Dose" at the bottom of the panel
→ A bottom sheet appears listing ALL active medications (including rescue/PRN)
→ User optionally types a reason ("doctor advised extra dose")
→ User taps the medication name
→ Dose is logged with scheduledHHMM = null (marks it as unscheduled)
```

---

### Journey 5: Generating a Monthly Seizure Diary

```
1. From ExportView, scroll to the "Seizure Diary" section
2. The month picker defaults to the current month
3. User changes the month if desired (cannot select future months)
4. Taps "Generate"
5. App:
   → Fetches ALL events from the database (entire history)
   → Calls exportSeizureDiary(allEvents, settings, medications, month, year)
6. A new browser tab opens with a one-page A4 landscape calendar:
   → Month name and patient name in the header
   → Calendar grid with days of the week as columns
   → Cells for days with events show colored count+abbreviation badges:
     [80] TC    [4] FA    [7] Ab    etc.
   → Days with no events are empty
   → Legend at the bottom explains abbreviations
   → Medications listed below the calendar
7. User clicks "Print / Save as PDF"
8. Browser print dialog opens — fits one A4 landscape page
```

---

### Journey 6: Setting Up Medications

```
1. User goes to Settings
2. Scrolls to the "Medications" section
3. Taps "Add Medication"
4. Fills in the form:
   → Name: "Levetiracetam"
   → Dose: 500
   → Unit: mg
   → Frequency: BD (Twice daily)
   → Scheduled times: auto-populated as 08:00 and 20:00 (editable)
   → Scheduled days: all 7 days (editable — e.g. Mon/Wed/Fri only)
   → Show in emergency screen: toggle on if relevant
   → Enable dose reminders: toggle on to receive browser push notifications
5. Taps Save
6. Medication appears in the list: "Levetiracetam · 500 mg · BD"
7. Returns to IDLE — the Dose Tracker panel now appears showing today's scheduled slots
8. Repeat for additional medications
```

---

### Journey 7: Logging a Past Seizure

For seizures that happened when the app was not open (e.g. during sleep, or when the carer's phone was unavailable).

```
1. From IdleView, tap the small "Log Past Seizure" link below the START button
2. The ManualEntrySheet bottom-sheet appears:
   → Date picker (today by default, capped to prevent future dates)
   → Time picker (current time by default)
   → Total Duration fields: minutes + seconds
   → "Phase Breakdown" toggle expands three additional duration pairs:
       Aura / Seizure (Ictal) / Post-Ictal Recovery
3. User enters yesterday's date, the time the seizure occurred (e.g. 02:30),
   and total duration (e.g. 2 minutes 30 seconds → 150 s)
4. Optionally expands Phase Breakdown and enters phase durations
5. Taps "Continue to Details →"
   → Validation: duration must be > 0
6. App creates the event in the database with:
   → startTime = new Date("YYYY-MM-DDThh:mm").getTime() (milliseconds)
   → date/time stored in the user's locale format (toLocaleDateString / toLocaleTimeString)
   → duration = total seconds
   → manualDurations = { total, aura?, seizure?, recovery? }
   → isManualEntry = true (audit trail)
7. App transitions to TAGGING → TYPE step (just like a normal recording)
8. User selects seizure type, adds symptoms, triggers, notes
9. In the SUMMARY step, a "Event Date & Time" row appears at the top
   showing the date/time the user entered — editable if they need to correct it
10. User taps "FINISH & SAVE LOG"
11. Event is saved with the correct date/time — it appears in History
    under the correct date, the calendar places it on the right day,
    and neurologist reports include it in the proper date range
12. EventCard shows an indigo "Manual Entry" badge as an audit trail indicator
```

**Backdating an existing event** (if an event was recorded with the wrong timestamp):

```
1. Open History → find the event
2. Tap "View / Edit" → the TAGGING Summary step opens
3. At the top of the Summary card, edit the "Event Date & Time" fields
4. Change to the correct date and time
5. Tap "FINISH & SAVE LOG"
6. The event's startTime, date, and time are updated in the database
```

---

## 6. The Database

### Entity-Relationship Diagram (v5 Schema)

```
┌─────────────────────────────────────────────────────────────────┐
│  events                                                         │
│  ─────────────────────────────────────────────────────────────  │
│  id          (PK, auto)                                         │
│  startTime   (indexed)   millisecond timestamp                  │
│  date        (indexed)   'YYYY-MM-DD'                           │
│  type        (indexed)   seizure type string                    │
│  isComplete  (indexed)   boolean                                │
│  isEdited    (indexed)   boolean                                │
│  notes       (indexed)   free text                              │
│  duration                total seconds                          │
│  laps                    { aura, seizure, recovery } timestamps │
│  manualDurations         { aura, seizure, recovery } in seconds │
│  editedTimers            array of phase names                   │
│  symptoms                array of symptom objects               │
│  triggers     (new)      array of trigger label strings         │
│  isEmergencyStop         boolean                                │
│  isManualEntry           boolean — true for past-seizure entries│
│  userModeAtTime          'CARETAKER' | 'PATIENT'                │
│  lastModified            ms timestamp                           │
│  editLog                 array of edit records                  │
│  quickNotes              array of { label, elapsed } objects    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  settings                                                        │
│  ──────────────────────────────────────────────────────────────  │
│  key   (PK)   string key (e.g. 'theme', 'personName')           │
│  value        any JSON-serialisable value                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  medications                          (added in v5)              │
│  ──────────────────────────────────────────────────────────────  │
│  id              (PK, auto)                                      │
│  name                       e.g. 'Levetiracetam'                │
│  dose                       e.g. 500                            │
│  unit                       'mg' | 'g' | 'mcg' | 'ml' | 'IU'   │
│  frequency                  'OD' | 'BD' | 'TDS' | 'QDS' | 'PRN'│
│  scheduledTimes             array of 'HH:MM' strings            │
│  scheduledDays              array of 0–6 (day-of-week, 0=Sun)   │
│  isRescue                   boolean                              │
│  reminderEnabled            boolean                              │
│  showInEmergency            boolean                              │
│  active                     boolean                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  medicationLogs                       (added in v5, updated v6)  │
│  ──────────────────────────────────────────────────────────────  │
│  id             (PK, auto)                                       │
│  medicationId   (indexed)   FK → medications.id                  │
│  takenAt        (indexed)   ms timestamp when dose was recorded  │
│  scheduledTime  (indexed)   'HH:MM' of the slot (null=ad-hoc)   │
│  status                     'taken' | 'late' | 'missed'         │
│  isEdited                   boolean (true if manually corrected) │
│  lastModified               ms timestamp of last edit            │
└──────────────────────────────────────────────────────────────────┘
```

### Version History

| Version | Changes |
|---------|---------|
| v1 | Initial schema (pre-production) |
| v2 | Internal iteration |
| v3 | Public `events` table with all indexed fields |
| v4 | Added `settings` table for user preferences |
| v5 | Added `medications` and `medicationLogs` tables |
| v6 | Added `scheduledTime` index on `medicationLogs`; medications gained `scheduledTimes`, `scheduledDays`, `reminderEnabled`, `showInEmergency`; logs gained `status`, `isEdited`, `lastModified` |

### Automatic Migration

When a user who has v4 or v5 data opens the v6 app, Dexie automatically:
1. Creates or updates the `medications` table (new fields are absent on old records — treated as `undefined`, which is handled safely throughout)
2. Creates the `medicationLogs` table (empty)
3. Leaves every existing event completely untouched

If a user has v3 data, Dexie runs both the v4 and v5 migrations sequentially. The user never needs to do anything. Their data is always safe.

---

## 7. The Symptom System

### The Four-Level Tree

The symptom system is designed to capture medical-grade information from non-medical users. A caretaker doesn't know the word "Fasciculation" — but they know the arm muscle was flickering.

```
Physical Movement           ← Category (Level 1)
    │
    ├── Small Twitching     ← Group (Level 2)
    │       ├── Muscle Flickering       → med: "Fasciculation"
    │       ├── Single Muscle Jerks     → med: "Myoclonic jerks"
    │       ├── Muscle Rippling         → med: "Myokymia"
    │       └── Eye/Lid Twitching       → med: "Eyelid myoclonia"
    │                                      (forceRegion: Head & Face > Eyes)
    │
    ├── Big Shaking/Jerking   ← Group (Level 2)
    │       ├── Rhythmic Shaking        → med: "Clonic activity"
    │       ├── Violent Jolts           → med: "Myoclonus"
    │       └── ...
    │
    └── Automatic Habits    ← Group (Level 2, skipRegion=true)
            ├── Lip Smacking/Chewing    → med: "Orofacial automatisms"
            └── ...
```

### Why Map to Medical Terms?

The app bridges the communication gap between patient/caretaker and doctor:

| What the user says | What the report says to the doctor |
|-------------------|----------------------------------|
| "Muscle Flickering" | Fasciculation |
| "Eyes rolling up" | Oculogyric crisis |
| "Rising butterfly feeling" | Epigastric aura |
| "Confused/Dream-like" | Focal Impaired Awareness |

The doctor immediately knows the precise medical meaning without ambiguity.

### Body Region Tree

The region system gives precise anatomical locations:

```
Whole Body → General → Both Sides Equally
                     → Starts one side → Spreads
Head & Face → Eyes   → Left Eye / Right Eye / Both Eyes
            → Mouth  → Left Side / Right Side / Tongue
Arms → Left Arm  → Shoulder / Upper Arm / Elbow / Wrist / Hand/Fingers
     → Right Arm → Shoulder / Upper Arm / Elbow / Wrist / Hand/Fingers
Legs → Left Leg  → Hip/Thigh / Knee / Ankle / Foot/Toes
     → Right Leg → Hip/Thigh / Knee / Ankle / Foot/Toes
Torso → Front/Back → Chest / Stomach / Upper Back / Lower Back
```

---

## 8. Danger Flags — The Safety System

### Two Types of Danger

#### Type 1: Long Duration (`long_duration`)

If a seizure lasts more than 5 minutes, it becomes medically dangerous. Normally, seizures self-terminate within 2–3 minutes. A seizure beyond 5 minutes is called **Status Epilepticus** and is a medical emergency.

```javascript
if ((event.duration || 0) > 300) {  // 300 seconds = 5 minutes
  flags.push('long_duration');
}
```

This shows as an amber ⚠ badge: **>5 MIN**

#### Type 2: Cluster Seizures (`cluster`)

When multiple seizures happen within a short window without recovery, this can indicate **Cluster Seizures** or developing **Status Epilepticus** — another emergency.

```javascript
// Count events within ±8 minutes with NO confirmed recovery lap
const nearby = allEvents.filter(e =>
  Math.abs(e.startTime - event.startTime) <= 8 * 60 * 1000
  && !e.laps?.recovery
);
if (nearby.length >= 3) {
  flags.push('cluster');
}
```

This shows as a red ⚠ badge: **CLUSTER/SE RISK**

### Safety Safeguards in Recording

| Safeguard | Threshold | What happens |
|-----------|-----------|-------------|
| Yellow alert | 4 minutes elapsed | Timer display turns amber |
| Red alert (caretaker) | Seizure phase > 5 minutes | Fullscreen red overlay with emergency instructions |
| Red alert (patient) | Total elapsed > 5 minutes | Same |
| Auto-stop | 12 minutes elapsed | Recording automatically stops, event saved with emergency note |

### The `buildDangerMap` Optimisation

When displaying a list of 100 events, calling `computeDangerFlags(event, allEvents)` for each event would require 100 × 100 = 10,000 comparisons. This is slow.

`buildDangerMap` sorts all events by `startTime` first, then uses nested loops with early termination — once an event is outside the 8-minute window it stops scanning. For typical real-world data (a few events per day, not hundreds), each inner loop runs at most 2–3 iterations. This is called **O(n·k)** complexity where k is tiny.

---

## 9. Exports and Reports

### Export Formats

| Format | File | Best for |
|--------|------|---------|
| **JSON** | `.json` | Full backup, restoring data later |
| **CSV** | `.csv` | Opening in Excel or Google Sheets |
| **PDF** | Browser print | Simple printable table |
| **Neurologist Report** | Browser print → PDF | Giving to a doctor |
| **Seizure Diary** | Browser print → PDF | Monthly calendar for appointments |

### How Files Are Downloaded

Browsers don't let JavaScript write directly to your disk (security!). Instead, we:

1. Create the data as a `Blob` (a lump of binary data in memory)
2. Create a temporary URL pointing to that blob: `URL.createObjectURL(blob)`
3. Create an invisible `<a>` tag with that URL and `download="filename.json"`
4. Programmatically click the link
5. Delete the URL

This tricks the browser into starting a download.

### The Neurologist Report — Section by Section

**Section 1: Header**
- App name, report title, generated date
- Reporting period (date range)
- Patient name and neurologist details

**Section 2: Medications**
- Structured table: Name · Dose · Unit · Frequency
- Rescue medications marked separately
- Dose log count for the reporting period

**Section 3: Stats Grid**
- Total events in period
- Average duration
- Days with recorded events
- Number of different seizure types

**Section 4: Recent Events Table**

| # | Date | Time | Type | Total | Aura | Seizure | Recovery | Notes | Badges |
|---|------|------|------|-------|------|---------|----------|-------|--------|

Trigger tags appear as small inline chips next to each event.

**Section 5: Trend Analysis — 4 SVG Charts**
1. Frequency bar chart
2. Duration line chart
3. Type distribution
4. Phase breakdown stacks

**Section 6: Condensed Event Details**
Full breakdown of the last 3 events plus any events over 5 minutes or that were edited. Each event shows trigger badges.

**Section 7: Clinical Flags (Auto-generated)**

- Events over 5 minutes
- Increasing frequency (first half of period vs second half)
- Increasing duration
- Auto-stopped events
- Edited records
- **Trigger aggregate** — "Most reported triggers: Sleep Deprivation (8×), Stress (5×)"

**Section 8: Data Quality**

```
CONFIDENCE: HIGH (85% fully recorded)
┌────────┬─────────┬──────────┬─────────────┬────────┐
│   17   │    2    │    1     │      0      │    3   │
│ Fully  │ Partial │ Untagged │ Auto-Stopped│ Edited │
│Recorded│         │          │             │        │
└────────┴─────────┴──────────┴─────────────┴────────┘
```

- **HIGH** confidence: ≥80% fully recorded
- **MEDIUM** confidence: ≥50% fully recorded
- **LOW** confidence: <50% fully recorded

### The SVG Charts — How They Work

SVG (Scalable Vector Graphics) is a way to draw shapes using code. Instead of a photo, it's a list of instructions like "draw a rectangle at position X, Y with width W and height H."

```svg
<!-- A simple bar chart bar -->
<rect x="50" y="80" width="20" height="40" fill="#1e3a5f"/>
<!-- At position (50, 80), draw a rectangle 20px wide, 40px tall, dark blue -->
```

The chart functions calculate where each bar should go:

```javascript
// For each event, calculate bar height proportional to count
const bh = (count / maxCount) * chartHeight;
// If maxCount is 5 and this bar has count 3: bh = (3/5) * 100 = 60px
```

---

## 10. PWA — Making It Feel Like a Real App

### What is a PWA?

A **Progressive Web App** (PWA) is a website that has been enhanced to work like a native phone app. It can:
- Be installed on the home screen
- Work without internet
- Look like a real app (no browser bar when opened)
- Show an "update available" notification

### What is a Service Worker?

A **Service Worker** is a special JavaScript file that runs in the background, separate from the main app. Think of it as a smart middleman between your app and the internet.

```
App requests a file (e.g., "index.html")
        │
        ▼
Service Worker intercepts the request
        │
        ├── Is it in the cache? → YES → Return from cache (fast, works offline)
        │
        └── NO → Fetch from network → Save to cache → Return to app
```

**`vite-plugin-pwa`** automatically generates the service worker using **Workbox**, a Google library that handles the complex caching logic.

The `workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'] }` setting tells Workbox to cache ALL JavaScript, CSS, HTML, and image files. This means the entire app works offline.

### The `registerType: 'autoUpdate'` Strategy

When you deploy a new version of the app:
1. The browser checks for a new service worker
2. The new service worker downloads in the background
3. When ready, a `needRefresh` flag becomes `true` in `usePWAInstall`
4. The app shows a banner: "App update available — Reload"
5. The user taps Reload, the new version activates immediately

### `manifest.json` — The App's ID Card

When a browser sees a `<link rel="manifest">` in `index.html`, it reads `manifest.json` to learn how to install the app:

| Manifest field | Value | What it controls |
|----------------|-------|----------------|
| `short_name` | "AuraTrack" | Name under the icon on home screen |
| `name` | "AuraTrack: Epilepsy Monitor" | Full name in the install dialog |
| `start_url` | "/" | Which page opens when you launch the app |
| `display` | "standalone" | Hide the browser bar — looks like a real app |
| `theme_color` | "#0f172a" | Color of the Android status bar |
| `background_color` | "#0f172a" | Splash screen color while app loads |
| `icons` | favicon.svg | The app icon |

### How iOS Is Different

Apple made PWA installation on iOS deliberately manual (they prefer native apps in their App Store). You have to:

1. Open in Safari
2. Tap the Share icon (⬆)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

The `PWAInstallBanner` component detects iOS and shows these instructions instead of the Android install button.

---

## 11. Glossary

Every technical term used in this document, explained plainly:

---

**AED (Anti-Epileptic Drug)** — The class of medications used to prevent or reduce seizures. Also called anti-seizure medications (ASMs). Examples: Levetiracetam (Keppra), Sodium Valproate, Lamotrigine, Clobazam, Midazolam.

**Array** — An ordered list of things. Like `['apple', 'banana', 'cherry']` or `[event1, event2, event3]`.

**Async/Await** — A way to write code that waits for slow operations (like reading from a database) without freezing the whole program. `async function doStuff() { const result = await readDatabase(); }`.

**Aura** — A warning sensation that some people experience immediately before a seizure. It can be a strange smell, visual disturbance, rising feeling in the stomach, or déjà vu. Not everyone has an aura. In AuraTrack, the first phase of the timer.

**BD (Bis die)** — Latin abbreviation meaning "twice daily". A medication prescribed BD is taken morning and evening. Standard clinical dosage abbreviation.

**Blob** — A chunk of raw binary data in memory. Used to create downloadable files.

**Bundle** — A single combined JavaScript file created from many separate files. Vite creates the bundle when you run `npm run build`.

**Cache** — A saved copy of something that's frequently used, so it can be accessed quickly without re-fetching it.

**Cluster Seizures** — Three or more seizures in a short period (AuraTrack uses 8 minutes) without full recovery between them. Can indicate developing Status Epilepticus. A medical emergency.

**Component** — A reusable piece of UI in React. Like a LEGO block. Has its own appearance and behavior.

**CSS** — Cascading Style Sheets. The language that controls how HTML looks (colors, sizes, spacing, fonts).

**CSS Custom Properties (Variables)** — Special CSS values you define once and reuse everywhere. `--accent: red` can be referenced as `var(--accent)` anywhere.

**Dexie** — A JavaScript library that makes IndexedDB easy to use.

**Drag-and-Drop** — A user interface interaction where you press and hold on something, move it, and release to place it. Used to reorder symptoms.

**ESLint** — A tool that reads your code and warns you about potential bugs or bad patterns. Like a grammar checker for code.

**Export** — Saving data to a file that you can download to your computer.

**Haptic Feedback** — Making the phone vibrate in response to user actions. Creates a physical sensation that confirms a button was pressed.

**Hook (React)** — A special function in React that lets components "hook into" features like state (memory) and effects (reactions to changes). Always named `useXxx`.

**HMR (Hot Module Replacement)** — Vite's feature that instantly updates parts of the running app when you change code, without a full page reload.

**HTML** — HyperText Markup Language. The structure language of the web. Describes what elements are on a page (headings, paragraphs, buttons, etc.).

**Ictal** — Relating to the period *during* a seizure (from Latin *ictus*, a blow/stroke). "Ictal symptoms" are what the body does while the seizure is happening. Compare: pre-ictal (before), post-ictal (after).

**IndexedDB** — A database built into every browser. Can store lots of structured data locally. Survives page refreshes and browser restarts.

**JSX** — A JavaScript extension that lets you write HTML-like code inside JavaScript files. Used in React. `const btn = <button onClick={fn}>Click me</button>`.

**JSON** — JavaScript Object Notation. A text format for storing structured data. Looks like `{"name": "Alice", "age": 30}`. Readable by humans and machines.

**Library** — Pre-written code you can use in your project. Like buying a toolbox instead of making your own tools.

**localStorage** — A simple browser storage that stores text key-value pairs. Survives page refreshes. Used for crash recovery and dismissal flags.

**Manifest** — A JSON file that tells browsers how to install and display a PWA.

**Mermaid** — A tool that creates diagrams from text descriptions. Used to create the flowcharts in this document.

**Node.js** — A JavaScript runtime that lets you run JavaScript outside of a browser. Used to run build tools like Vite.

**npm** — Node Package Manager. The tool that downloads and manages libraries for your project.

**npm ci** — Short for "clean install". Installs exact versions from `package-lock.json`. Faster and more reliable than `npm install` for deployment.

**Object** — A collection of key-value pairs in JavaScript. Like `{ name: 'Alice', age: 30, isAdmin: false }`.

**OD (Omni die)** — Latin abbreviation meaning "once daily". Standard clinical dosage abbreviation.

**Post-ictal** — The period immediately *after* a seizure ends. Often characterised by confusion, exhaustion, or headache. In AuraTrack, this is the "Recovery" phase.

**PostCSS** — A tool that transforms CSS using plugins. Used here to process Tailwind's utility classes.

**PRN (Pro re nata)** — Latin meaning "as needed". Used for rescue medications like Midazolam that are only given when a prolonged seizure occurs, not on a regular schedule.

**Props** — Short for "properties". Data passed into a React component from its parent. Like arguments to a function.

**PWA (Progressive Web App)** — A website enhanced to look and behave like a native mobile app. Can be installed, works offline, has its own icon.

**QDS (Quater die sumendum)** — Latin for "four times daily". Standard clinical dosage abbreviation.

**React** — A JavaScript library for building user interfaces. Developed by Facebook/Meta. Uses components and a virtual DOM.

**Recharts** — A charting library for React. Provides Bar, Line, Pie charts etc.

**Schema** — The structure definition of a database (what tables exist, what fields they have, what types they are).

**Seizure Diary** — A one-page monthly calendar showing which days had seizures, colour-coded by type. The standard document patients bring to every neurology appointment.

**Service Worker** — A script that runs in the background in a browser, acting as a proxy between the app and the network. Enables offline capability.

**State** — Data that a component "remembers". When state changes, React re-renders the component with the new data.

**Status Epilepticus** — A prolonged seizure lasting more than 5 minutes, or multiple seizures without recovery between them. A medical emergency requiring immediate intervention.

**SVG** — Scalable Vector Graphics. A way to describe shapes (circles, rectangles, lines, paths) as text/code. Looks sharp at any size because it's mathematical, not pixel-based.

**Tailwind CSS** — A CSS framework that provides hundreds of tiny pre-built classes. Instead of writing `button { background-color: red; }`, you write `className="bg-red-500"`.

**TDS (Ter die sumendum)** — Latin for "three times daily". Standard clinical dosage abbreviation.

**Timestamp** — A number representing a specific moment in time, measured as milliseconds since January 1, 1970. Example: `1716019200000` = "18 May 2026, 12:00:00 UTC".

**Trigger** — An environmental or lifestyle factor that precedes a seizure and may have contributed to it. Common triggers include sleep deprivation, stress, missed medication, alcohol, and illness. Distinct from *symptoms* (which describe what happens *during* a seizure). In AuraTrack, triggers are selected as chips in the Summary step of the wizard.

**`isManualEntry`** — A boolean flag on an event record set to `true` when the event was created via the Log Past Seizure flow rather than a live recording. Shown as an indigo "Manual Entry" badge on `EventCard`. Included in CSV and JSON exports so clinicians can identify retrospective entries.

**Manual Entry** — A seizure event logged after the fact, not during a live recording. Created via the "Log Past Seizure" button on the home screen. The user specifies the date, time, and duration manually, then completes the standard symptom/trigger/notes wizard.

**Dose Status** — The classification of a medication log entry. `taken` = logged within 90 minutes of the scheduled time. `late` = logged more than 90 minutes after the scheduled time. `missed` = automatically inserted when no log exists for a past-due slot.

**Scheduled Slot** — A specific combination of a medication and a time (e.g. Levetiracetam at 08:00). The dose panel shows one button per active scheduled slot for today.

**`useEffect`** — A React hook that runs code when something changes. Like "whenever X changes, do Y."

**`useMemo`** — A React hook that caches the result of a calculation and only recalculates it when its inputs change.

**`useState`** — A React hook that creates a piece of state (remembered data). Returns `[value, setValue]`.

**Vite** — A modern, fast build tool for web projects. Much faster than older tools like Webpack.

**Wake Lock API** — A browser API (`navigator.wakeLock.request('screen')`) that prevents the phone screen from going to sleep. Supported in Chrome 84+, Edge 84+, and Safari 16.4+ (iOS 16.4+). Not supported in Firefox.

**Workbox** — Google's library for creating service workers. Handles caching strategies automatically.

---

> **That's everything in AuraTrack.** From the first line in `index.html` to the last SVG point in a chart — every file, every hook, every clinical feature, and every design decision has been documented here. The project exists to help people manage a serious medical condition — offline, privately, reliably, and with the quality a clinical environment demands.
