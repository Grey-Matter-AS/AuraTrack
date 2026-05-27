# AuraTrack

**AuraTrack** is a privacy-first seizure tracking PWA for people with epilepsy and their caregivers. Record seizures in real time, annotate events with clinical detail, track medications, and generate structured reports for your neurologist — all stored locally on your device. No account, no server, no data leaving your phone.

> **Not a medical device.** AuraTrack is a personal logging tool. Always consult a qualified healthcare provider for diagnosis, treatment, and medication decisions.

---

## Features

### Recording

- **One-tap START** — works even during aura; minimal interaction required
- **Dual mode**
  - *Caretaker* — full phase timing controls: mark Aura end, Seizure end, Recovery
  - *Self* — simplified one-button interface for solo users
- **Quick notes** — customisable shortcut buttons (Fell, Rescue Med, Not Responding, etc.) that stamp timestamped notes mid-recording
- **Live danger indicators** — timer turns red at 4 minutes; warning banner appears at 5 minutes
- **Emergency alert overlay** — full-screen red alert at 5 minutes showing emergency contacts, neurologist info, and rescue medications to administer
- **Auto-stop at 12 minutes** — prevents runaway recordings; event is flagged as emergency stop

### Post-Recording Tagging

- Step-by-step wizard: seizure type → symptom drill-down → anatomy mapping → triggers → clinical notes
- Drag-to-reorder observed symptoms
- Editable phase timers (aura / seizure / recovery) — correct timing after the fact
- Retroactive date and time editing (edit mode and manual entry)
- Log past seizures via **Manual Entry** from the home screen

### Event History

- Filterable and paginated event list (filter by type or date; 5 / 10 / 25 / 50 per page)
- **Seizure trend chart** — frequency over time at a glance
- **Clinical danger flags** shown on each event card:
  - ⚠ Prolonged — duration > 5 minutes
  - ⚠ Cluster / SE Risk — 3+ events within an 8-minute window without confirmed recovery
- Inline **Medications** tab and **Export** tab in History

### Event Detail

- Full event breakdown: total duration, aura / seizure / recovery phases, seizure type
- Symptoms, body regions, triggers, and clinical notes
- Danger alert banners with clinical guidance
- Edit any field directly from the detail view

### Medication Tracking

- Add medications with name, dosage, unit, and frequency (OD / BD / TDS / QDS / PRN)
- Set scheduled dose times and day-of-week recurrence
- Flag rescue medications — shown prominently in the emergency alert overlay
- **Daily dose tracker** on the home screen — mark doses taken or log an unscheduled dose
- Full medication history log with dose-by-dose status
- Dose reminder notifications (requires notification permission)

### Export & Reports

All exports are filterable by date range.

| Format | Contents |
|--------|----------|
| **Backup JSON** | Full data export — events, medications, dose logs. Use for backup or device migration. |
| **Spreadsheet CSV** | Events, medications, and dose logs in flat CSV format for Excel / Google Sheets. |
| **Simple Print / PDF** | Quick printable event table — opens print dialog. |
| **Neurologist Report** | Purpose-built clinical PDF — patient info, phase timings, symptom breakdown, event log, and medication summary. Formatted for presenting at appointments. |
| **Monthly Seizure Diary** | One-page calendar grid colour-coded by seizure type. The quick-reference sheet to bring to every appointment. |

### Settings

Six tabs of configuration:

| Tab | Options |
|-----|---------|
| **Profile** | Mode (Caretaker / Self), patient & caretaker names, date of birth, emergency contact, neurologist name, institution, contact |
| **Medications** | Add, edit, deactivate, and delete medications; configure schedules and reminders |
| **Display** | History page size, date format (system / ISO / US / EU), duration display (123s / 2m 3s), time format (12h / 24h) |
| **Recording** | Haptic feedback toggle, customise all 6 quick note button labels |
| **Reports** | Report notes for the neurologist report, patient DOB visibility in reports |
| **Data** | Import JSON backup, export full data, clear all event data, reset settings to defaults |

**Appearance** (within Display settings): theme (Dark / Light / System), accent colour (Red / Blue / Green / Purple / Amber), font size (S / Normal / L / XL).

### PWA

- Installable on Android, iOS, and desktop (Chrome / Edge / Safari)
- Fully offline — all data and logic runs on-device
- Screen wake lock keeps the display on during active recording
- No backend, no account, no network required

### Privacy

All data is stored exclusively on your device using IndexedDB. Nothing is transmitted to any server. Your health data never leaves your device.

---

## Clinical Thresholds

| Threshold | Value |
|-----------|-------|
| Warning alert | 5 minutes |
| Auto-stop | 12 minutes |
| Prolonged seizure flag | > 5 minutes |
| Cluster / SE risk window | 3+ events within 8 minutes (no confirmed recovery) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19.2 + Vite 8 |
| Styling | Tailwind CSS 4.2 |
| Database | IndexedDB via Dexie 4.4 |
| Charts | Recharts 3 |
| Drag-and-drop | @dnd-kit |
| PDF export | jsPDF + html2canvas |
| PWA | vite-plugin-pwa |

---

## Getting Started

```bash
git clone https://github.com/Grey-Matter-AS/AuraTrack.git
cd AuraTrack
npm install
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint check |

---

## License

AuraTrack is licensed under the **GNU General Public License v3.0** ([GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html)).

- Free to use, modify, and distribute
- Commercial use is allowed
- Modifications must be shared under the same license
- Improvements benefit the entire community

See [LICENSE](LICENSE) for the full license text.

---

## Contributing

Contributions are welcome. This is a community-driven medical utility — improvements and bug fixes benefit patients and caregivers worldwide.

Report bugs or request features via [GitHub Issues](https://github.com/Grey-Matter-AS/AuraTrack/issues).

**Developer:** [Grey Matter AS](https://github.com/Grey-Matter-AS)
