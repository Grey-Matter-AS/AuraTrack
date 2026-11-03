# D-11: Native and PWA devices meet through the hub or a file

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
Native devices sync with each other directly on the same Wi-Fi (Bonjour/mDNS + TLS). A native device and a PWA device sync through the hub, or by the update file or QR code.

## Why
The PWA's direct link is WebRTC, which isn't a platform library on iOS or Android; the PWA is being phased down.
