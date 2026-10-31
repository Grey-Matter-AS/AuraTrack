# AuraTrack v7: status

**Read this first in every session.** Then read the current milestone's file (`M<n>.md`) and continue with "Next step".

- **Current milestone:** M0, Foundation
- **Last updated:** 2026-10-31

## M0 tasks
| # | Task | State |
|---|---|---|
| 1 | Repositories: 6.x tagged `v6.1.0` locally; you rename and archive it on GitHub; new repo `Grey-Matter-AS/AuraTrack` | done: 6.x renamed to `AuraTrack-v6` and archived; new repo created (2026-10-30). Local remotes set: 6.x → `AuraTrack-v6`, v7 → `AuraTrack`. The `v6.1.0` tag exists only locally (an archived repo is read-only). |
| 2 | Monorepo (pnpm, TS strict, ESLint, Prettier, Vitest) | done: typecheck, lint, format, test and build all pass. TypeScript is pinned to 6 because typescript-eslint doesn't support 7 yet. Exact versions throughout (`.npmrc`). |
| 3 | CI (GitHub Actions) | done (`.github/workflows/ci.yml`); runs once the repo is on GitHub. Bundle budget script `pnpm size`: 67.5 KB of 180 KB. |
| 4 | End-to-end tool trial (Playwright vs Cypress) | done: **Playwright** (`docs/decisions/e2e-tool.md`). Chromium and Firefox run locally (20/20); WebKit can't run on openSUSE, so it runs in CI on Ubuntu. |
| 5 | PWA shell (prompt updates, CSP, deploy target) | done in code: prompt-mode service worker, manifest, strict CSP (`vercel.json`). Connecting the deploy target waits for the GitHub repo. |
| 6 | Design tokens from 6.1 | done (`packages/ui/src/tokens.css`, one definition per colour using light-dark()) |
| 7 | 6.1 feature checklist (`feature-checklist.md`), reviewed by you | draft written: waiting for your review |
| 8 | 6.1 report inventory (`report-inventory.md`) | draft from the code. Visual reference generated 2026-10-31 from made-up data (`docs/plan/reports-6.1/`, `scripts/gen-6x-reference.mjs`): 4 PDFs, CSV, previews. Still to do: compare the draft against it section by section. |

## Decisions
- The plan was approved on 2026-10-30, including the milestone-by-milestone workflow: you approve each milestone's plan before it starts, and you commit.
- **Folders:**
  - v7 lives in `/home/user01/Projects/AuraTrack7`
  - 6.x stays in `/home/user01/Projects/AuraTrack6`, untouched, for reference and the importer
- **Package manager:** pnpm, enabled through corepack in `~/.local/bin`.
- **GitHub:** first commit `M0: foundation` pushed to `Grey-Matter-AS/AuraTrack`; CI green (2026-10-30). `gh` is installed in WSL and logged in. You commit and push.

## Open questions
- (none)

## Design decisions for later milestones
- **M3 seizure editor:** tabs by phase (Before, During, After, Details), always visible with their state; an overview strip and a Review before saving.
- **M3:** a "Between seizures" (interictal) quick log on the same timeline.
- **M3, M4, M5:** graphical timelines (F-314, F-315).
  - **Per seizure, vertical (README section 5.1):**
    - a line in phase colours, with phase markers
    - moments holding one or more symptoms on a shared leader line
    - spacing by order, with intervals written on the line, marked exact, approximate (~) or unknown
    - the ★ first symptom
    - rounded boxes, not hexagons
    - the prodrome as a broken section
    - phones: line on the left; wider screens and the PDF: boxes alternate sides
    - one component everywhere
  - **Over days and weeks in History and the report:** seizures, between-seizures entries and medication changes.
- **M4:** wellbeing becomes an optional module, off by default; nothing of it shows while off; it may move to 7.x.

## Rules added
- Real medical data (reports, backups, exports) is never committed. Reference material is generated from made-up test data.

## Next step
- **Done:** planning docs rebuilt (2026-10-30); feature checklist reviewed by you; first commit pushed and CI green; 6.1 reference reports generated from made-up data (2026-10-31).
- **You:** commit the new reference files (`docs/plan/reports-6.1/`, about 6.4 MB, mostly the 6 MB neurologist PDF) and `scripts/gen-6x-reference.mjs`. Say so if you'd rather keep the PDF out of git.
- **Me, next:** check `report-inventory.md` section by section against the reference PDFs. Note the reference has no medication changes, so R-1 section 5 and R-2's changes table aren't covered yet.
- **Then:** M0 is done once you accept the inventory. M1 starts after you approve `M1.md`.
- **Deferred:** connecting the deploy target (Vercel) waits until you choose to do it.
