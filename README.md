# 🧠 AuraTrack

AuraTrack is a progressive web app (PWA) designed for **accurate, real-world seizure tracking**.  
It prioritizes **reliability, clinical relevance, and usability during impaired states**, enabling both patients and caretakers to record events and generate structured reports for neurologists.

---

## 🎯 Purpose

Seizure events are difficult to capture accurately in real time due to varying levels of awareness. AuraTrack is built around this constraint.

Instead of relying on perfect user input, the system is designed to:

- Capture **critical event timing with minimal interaction**
- Allow **optional advanced input when possible**
- Support **post-event reconstruction**
- Generate **clinically meaningful reports and trends**

---

## ⚙️ Key Features

### ✅ 1. Smart Recording System
- One-tap start recording (works even during aura)
- Optional advanced phase markers:
  - Aura
  - Seizure
  - Recovery
- Automatic handling for:
  - missed inputs
  - user unresponsiveness
  - prolonged events

---

### ✅ 2. Fault-Tolerant Event Logging
- Events can be:
  - fully tracked
  - partially tracked
  - auto-terminated
- System preserves **uncertainty instead of guessing**
- Later correction and enrichment supported

---

### ✅ 3. Post-Event Reconstruction
- Structured tagging flow after recovery:
  - symptoms (ordered)
  - anatomical mapping
  - notes
- Designed to reflect **actual patient recall patterns**

---

### ✅ 4. Clinical-Grade Reporting

#### 📄 Neurologist Report (PDF)
- Recent event summary
- Detailed event breakdowns
- Trends and analytics
- Clinical flags:
  - prolonged seizures (>5 min)
  - cluster detection
- Designed for **2–4 page printable format**

---

### ✅ 5. Export & Portability

- **JSON Export**
  - Full backup of all events, settings, audit logs
  - Used for restore, migration, and syncing

- **CSV Export**
  - Flat dataset for:
    - Excel
    - research analysis
    - clinical review

---

### ✅ 6. Analytics & Trends

Tracks and visualizes:

- Seizure frequency over time
- Duration trends
- Phase breakdown (aura / seizure / recovery)
- Seizure type distribution
- Cluster detection & severity classification

---

### ✅ 7. Progressive Web App (PWA)

- Installable on mobile and desktop
- Works offline
- Data stored locally via IndexedDB
- No backend required

---

## 🧩 Design Philosophy

AuraTrack is built around a critical insight:

> User input during a seizure is unreliable.

So instead of enforcing strict input flows, the system:

- Accepts incomplete data ✅
- Recovers and annotates missing information ✅
- Avoids false assumptions ❌

This ensures that data remains **clinically useful and trustworthy**.

---

## 🧠 Clinical Logic Highlights

- **Prolonged seizure**: ≥ 5 minutes
- **Cluster detection**: multiple seizures within short intervals
- **Unresponsive handling**:
  - auto-detection of inactivity
  - safe auto-termination
  - post-event correction

---

## 🚀 Tech Stack

- React (Vite)
- IndexedDB (Dexie)
- PWA (Service Worker + Manifest)
- jsPDF + html2canvas (PDF export)
- Tailwind CSS

---

## 📦 Installation

```bash
git clone https://github.com/<your-org>/AuraTrack.git
cd AuraTrack
npm install
npm run dev
