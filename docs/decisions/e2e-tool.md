# Decision: end-to-end test tool

**Decided 2026-10-30: Playwright.**
- Chromium and Firefox run on this computer.
- WebKit (Safari's engine) runs in GitHub Actions on every push.
- Cypress is not used in v7.

## Why a trial
Playwright was tried in 6.x and dropped; the reason wasn't recorded. The plan (docs/plan/README.md, Testing strategy) ran a trial in this setup first.

## Trial (2026-10-30)
Test files: `e2e-trial/`. They run against the real 6.1 app (`vite preview` on port 4173).
- **Test 1:** record a seizure, choose a type, save, and see it on the home screen.
- **Test 2:** two separate "devices" (browser contexts) in one test.
- Each test was run 5 times in a row, with no retries.

| Engine | On this computer (openSUSE Tumbleweed, WSL) |
|---|---|
| Chromium (Pixel 7 emulation) | 10 of 10 passed |
| Firefox | 10 of 10 passed |
| WebKit (iPhone 15 emulation) | cannot start |

## Why WebKit can't run here (and the likely 6.x reason)
- Playwright supports only Ubuntu and Debian as Linux hosts.
- Its WebKit build is linked against Ubuntu 24.04's exact library versions: ICU 74, libxml2.so.2, libjxl 0.8, libflite, libmanette, WPE WebKit and others.
- openSUSE Tumbleweed ships different (newer) versions and package names, so the `apt-get` command can't apply, and the exact versions can't be installed from zypper.
- Chromium and Firefox are unaffected.

## How Safari's engine is still tested
- **CI:** the end-to-end job runs on `ubuntu-latest` with `playwright install --with-deps`, for all three engines, on every push and pull request. A WebKit failure blocks the merge.
- **Optional, locally:** WebKit can run here inside the official Playwright container image (`mcr.microsoft.com/playwright`) once a container tool is installed (`sudo zypper install podman`). Not needed day to day.
- **Real iPhones and iPads:** still checked by you once per milestone. No tool runs real iOS Safari.

## Why Playwright over Cypress
- Several devices in one test, which household sync needs; this works here.
- WebKit: in CI here, and only experimental in Cypress.
- Phone and tablet emulation, offline mode, parallel runs.
- The 6.x Cypress suite showed seeding and retry problems.
