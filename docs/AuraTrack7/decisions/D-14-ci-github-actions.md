# D-14: CI: GitHub Actions only

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
All builds, tests and releases run on GitHub Actions (free for public repositories, including macOS). Apple signing uses an App Store Connect API key with cloud-managed signing, kept in a GitHub environment that only release tags can use, with you as required approver. Android uses Play App Signing. Xcode Cloud can take over Apple releases later without code changes.

## Why
Free, one place for the whole monorepo, configuration in git (good for change control).
