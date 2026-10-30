# AuraTrack v7: instructions for Claude

**Start every session by reading `docs/plan/STATUS.md`,** then the current milestone's file in `docs/plan/`. Update STATUS.md at the end of every working session: tasks, decisions, open questions, next step.

## What this is

AuraTrack is a privacy-first seizure-tracking PWA for people with epilepsy and their carers. v7 is a rebuild from scratch of AuraTrack 6.1 (archived as `AuraTrack-v6`, local copy at `/home/user01/Projects/AuraTrack6`). The overall plan is `docs/plan/README.md`.

## Working rules (binding)

- **Milestone by milestone.** The user approves a milestone's plan before it starts. The user commits.
- **Medical data integrity first.** Never lose or silently change a record.
- **Codes, not English text, in stored data.** Labels come from `packages/i18n`, in 9 languages: en, nb, nn, da, sv, fi, de, fr, es.
- **Clinical rules are settled** (see the overview). Don't change them without asking:
  - emergency plan: alert 5 min, cluster 3 in 8 min, both settings
  - 12-minute auto-stop
  - no extra buttons on the recording screen
- **UI:** only `packages/ui` components. Nothing may overlap, clip or leave the screen on any device in the matrix; the layout audit enforces this.
- **Tests:** a feature isn't done until its unit, component and end-to-end tests pass (see the testing strategy in the overview).
- **Wording:** careful and neutral, never tone-deaf about seizures.
- **No third-party scripts or analytics. No data on any hosted server.**
- **Dates:** never use `toISOString()` for a calendar day; use the local-date helpers.

## Tools

- pnpm (`~/.local/bin`, through corepack), Node 24, TypeScript strict.
- Scripts at the root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.
