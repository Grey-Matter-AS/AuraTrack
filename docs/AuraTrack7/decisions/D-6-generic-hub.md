# D-6: One generic hub

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
The existing Node hub (`AuraTrack7-Server`) is the single household hub for every computer: single executable for Mac, Windows and Linux, Docker for a Pi or NAS. It speaks one written protocol that the iOS, Android and PWA apps all use. An Android hub mode is optional and later.

## Why
iPhones and iPads can't run background servers; one hub for every computer avoids a separate Mac app and keeps one protocol.
