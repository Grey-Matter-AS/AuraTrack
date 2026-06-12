# AuraTrack

AuraTrack is a privacy-first seizure tracking PWA for people with epilepsy and their caregivers. It records seizures in real time, tracks medications and adherence, supports EEG diary workflows, and generates clinician-friendly reports while keeping primary data local on the device.

> **Not a medical device.** AuraTrack is a personal logging tool and report assistant. It does not diagnose, treat, or replace professional medical advice.

## What AuraTrack Does

### Seizure recording

- One-tap start for urgent real-world use
- Caretaker and self-recording modes
- Live phase timing for aura, seizure, and recovery
- Quick timestamped notes during recording
- 4-minute warning, 5-minute emergency alert, 12-minute automatic stop
- Optional seizure video capture when browser/device support is available
- Manual entry flow for past seizures that were not recorded live

### Clinical detail capture

- Guided tagging wizard for seizure type, symptoms, body regions, triggers, and notes
- Drag-to-reorder symptom list
- Editable phase timings after the event
- Event detail view with danger flags, timings, notes, and audit markers

### Medication tracking

- Structured medication list with OD / BD / TDS / QDS / PRN frequencies
- Scheduled times and day-of-week recurrence
- Rescue medication highlighting for emergency use
- Daily dose tracker on the home screen
- Medication history grid with corrections and edited markers
- Browser notification reminders for scheduled doses

### EEG diary

- Optional EEG session tracking
- Activity logging during an EEG session
- Linked seizure references inside the EEG diary view
- EEG diary export support in CSV and PDF/report flows where relevant

### Reports and exports

- Encrypted backup export using a user-supplied passphrase
- Encrypted backup import for restore or device migration
- CSV export for spreadsheet analysis
- Printable event log / PDF export
- Neurologist report with charts, medication summary, and clinical flags
- Monthly seizure diary
- EEG diary preview / PDF export

### Sync and recovery

- Device-to-device sync over PeerJS, WebRTC/LAN, or manual file transfer
- Backup reminders instead of background auto-backup
- Storage protection status in Settings using `navigator.storage.persist()`
- Silent persistence check where the browser allows it, manual retry/request where supported

## Privacy Model

- Primary health data is stored locally in IndexedDB on the device
- No account or backend is required for core use
- Data leaves the device only when the user explicitly exports, prints, syncs, or saves a video file
- Encrypted backups are protected with the passphrase chosen at export time
- CSV, PDF, and video files are standard files and should be handled like sensitive medical documents

## Backup Model

- Auto-backup has been removed
- AuraTrack uses reminder-driven manual backups
- Backups are written as encrypted `.atbak` files
- The encryption key is derived from the passphrase and is not stored by the app
- Import decrypts in memory and does not intentionally leave a plaintext backup copy on disk

## Settings Areas

| Area | Purpose |
|------|---------|
| Identity | User mode, names, date of birth, emergency contact |
| Medications | Medication setup, schedules, reminders, emergency visibility |
| Appearance | Theme, accent color, font size, language |
| Recording | Haptics, EEG diary toggle, quick-note labels |
| Clinician | Neurologist details, report notes, DOB inclusion |
| Data & Backup | Storage protection, encrypted backup/import, reminder interval, destructive data actions |

## Technology

| Layer | Technology |
|------|------------|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS 4 |
| Local database | IndexedDB via Dexie |
| Charts | Recharts |
| Drag and drop | `@dnd-kit` |
| Reports / PDF | jsPDF + custom HTML/SVG renderers |
| PWA | `vite-plugin-pwa` |
| i18n | i18next + react-i18next |

## Development

```bash
git clone https://github.com/Grey-Matter-AS/AuraTrack.git
cd AuraTrack
npm install
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Documentation

- [README.md](/home/user01/Projects/AuraTrack/README.md) is the product-facing overview
- [Meta_Explainer.md](/home/user01/Projects/AuraTrack/Meta_Explainer.md) is the full technical walkthrough of the app internals, data model, flows, and implementation details

## License

AuraTrack is licensed under the GNU GPL v3.0 or later. See [LICENSE](/home/user01/Projects/AuraTrack/LICENSE).
