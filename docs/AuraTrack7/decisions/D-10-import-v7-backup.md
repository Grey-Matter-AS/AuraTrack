# D-10: Moving in: the v7 backup file first, CSV too

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
The main way into the native apps is the encrypted v7 backup file from the PWA (lossless), checked by a comparison report. CSV import in the v7 format is also offered. No 6.1 importer natively: 6.1 users go through the PWA first. No Argon2id natively; backups stay PBKDF2-SHA256 + AES-GCM so any backup opens on any platform.

## Why
The CSV lacks the exact symptom timeline, edit history, settings, emergency plan, saved sets and videos. Native keys sit in hardware, so a memory-hard PIN function adds nothing.
