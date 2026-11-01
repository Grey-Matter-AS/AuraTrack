# AuraTrack v7: status

**Read this first in every session.** Then read the current milestone's file (`M<n>.md`) and continue with "Next step".

- **Current milestone:** M2, Design system and layout guarantee (branch `7.0.2---M2`, approved 2026-10-31). M0 and M1 are done.
- **Last updated:** 2026-10-31

## M2 slices
| # | Slice | State |
|---|---|---|
| 1 | Kit foundation: styles (`packages/ui/src/ui.css`), fluid type, 44px tap-target floor, strings for the kit's own words (`UiStringsProvider`), test tooling (jsdom, Testing Library) | done |
| 2 | Components: Button, IconButton, ChipGroup, ChoiceList, Toggle, Checkbox, Section, Card, Inset, EmptyState, FieldRow, TextField, TextArea, NumberField (fresh entry), DecimalField, DateTimeField (own hint and icon), Select (never blank) | done, 96 component tests |
| 3 | Overlays: BottomSheet, Dialog, Toast (focus in, trapped, returned; Escape; only the topmost reacts; messages never cover an overlay's controls) | done |
| 4 | Tabs (wide row joined to the panel; narrow: one control as the panel's top edge with "2 of 4" and dots, list opens in a sheet), screen-stack navigator (history, focus, scroll), header with patient chip, reduced motion (phone setting or `data-motion`) | done |
| 5 | Layout primitives (`Screen`, `ScrollArea`, `Stack`, `Cluster`), lint rules (screens only use kit components, no `position: fixed`, no browser dialogs, no `toISOString`; tested in `lint-rules.test.ts`) | done |
| 6 | Layout audit as a permanent end-to-end test (`apps/web/e2e/audit.spec.ts`): kitchen sink at `/#/kitchen`, 10 device sizes, dark and light, 5 accents, 4 text sizes, every overlay; overlap, clipping, off-screen, tap targets of 44px, contrast of 4.5:1. The audit proves itself in `audit-selftest.spec.ts` (10 deliberately broken pages must be caught) | done: passes on all 10 devices in Chromium; 2 of them also checked in Firefox. WebKit runs in CI |
| 7 | Visual baselines of the kitchen sink (`pnpm visual`; 3 devices x dark/light) | done locally; skipped in CI until baselines are made on the CI image (fonts differ) |
| 8 | You look at the kitchen sink on your own phones | **yours**: open `https://auratrack7.vercel.app/#/kitchen` on each phone (private tab, or clear site data first) |

### M2 decisions
- **Filled buttons and selected chips use a darkened accent** (`--action`, 62% accent), because white on the bright accent was 3.3:1, under the 4.5:1 rule. The bright accent stays for lines, dots and focus rings. Success green darkened for the same reason.
- **Tap-target tokens never go below 44px**, whatever the text size (`max(44px, 2.75rem)`).
- **Very long words break as a last resort** (`overflow-wrap: anywhere` on screens, buttons and chips), so a long German or Finnish word cannot run off the screen.
- **Layout is audited by what a person sees:** a box scrolled out of view inside a scroll area does not count as overlapping.
- **Narrow tabs** are a panel-top control with the position and dots, not a dropdown (your decision, 2026-10-31).
- Kit styles and components are ported from 6.1's kit with the same behaviours (fresh-entry number field, own date hint and icon, never-blank select), now typed and tested.
- Not in the kit yet (later milestones need them): body map, timeline, charts, the lock screen.

### M2 open points
- **Argon2id and the lock screen: decided (2026-11-01): M3**, as its first slice, before any real data is saved (so no key re-wrapping is needed later). It needs a wasm library and `wasm-unsafe-eval` in the CSP `script-src` in `vercel.json`; tell the user exactly what changes. Add it to `M3.md` when drafting.
- Date rows are already one column on the iPhone (checked by the user, 2026-11-01), so nothing to change there. Date hints may still be cut short in two-column rows on wider screens: allowed by the design (hint only).
- No "new version available, reload" prompt yet: the service worker (M0) serves the saved copy first, so a returning user sees an old version until a second reload. Needs a small update prompt; schedule it (M3 or later).
- The audit takes about 8 minutes for 10 devices in one engine; CI runs 3 engines (timeout set to 60 minutes).

## M1 slices (in order; tick as they land)
| # | Slice | State |
|---|---|---|
| 1 | `model`: ids and HLC (hybrid logical clock), property-tested | done 2026-10-31 |
| 2 | `store`: field-level merge (newest per field, dose rank, tombstones, append-only), property-tested | done 2026-10-31 (found and fixed a real NaN bug in rank comparison via the property tests) |
| 3 | `model`: zod schemas for every record type | done 2026-10-31: `packages/model/src/schemas/` (seizure with phase marks, medication, dose, wellbeing, EEG, settings, change log, tombstone; record registry, merge rules) |
| 4 | Codes catalogue (types, ILAE, symptoms, body areas, triggers, findings, moods) + `i18n` labels (en first, 8 languages ported from 6.1) | done: `scripts/build-catalogue.mjs` generates the catalogue (356 codes) and `packages/i18n/src/labels/*.json` from 6.1. 6.1 only has translations for seizure types, triggers, moods, after-seizure findings, wellbeing factors and medication forms. **274 labels per language (symptoms, body areas, EEG activities, ILAE parts) are English-only and listed in `labels/review.json` for you to review** |
| 5 | Clinical rules ported from 6.1 with their tests (emergency plan, 12-min auto-stop, regimen, doses) | done: `packages/model/src/rules/` (emergency plan, 12-min auto-stop, seizure time from phase marks, clusters, regimen history, scheduled/missed/assumed doses, local-date helpers), 6.1 tests ported, ~98% branch coverage |
| 6 | `store`: AES-GCM encryption, key wrapping (PIN/passkey), Dexie, change log, working set | done: AES-GCM per record with AAD, PIN-wrapped device key (PBKDF2-SHA256 600k; **Argon2id not yet: needs a wasm library, planned with the lock screen, first slice of M3**), passkey (PRF) adapter tested with a fake authenticator only, Dexie store, change log, working set, persistence request, installed-PWA check |
| 7 | Web Worker host | done: typed RPC over message ports (`rpc.ts`) and the store API for the worker (`api.ts`); tested over MessageChannel. The real `Worker` entry file comes with the developer page (slice 10) |
| 8 | Backup v7 and recovery kit | done: encrypted backup v7 (`backup.ts`) with counts and verification, restore by change-log replay, recovery kit (text + QR) that unlocks after a forgotten PIN. The kit holds the device-key recovery secret; keys for sharing between devices join it in M6 |
| 9 | 6.1 importer and comparison report | done: `packages/store/src/import6x/` reads plain, encrypted and all-patients 6.1 backups; maps English to codes (unmapped kept as your own codes and listed for review); laps and manual durations become phase marks that reproduce 6.1's seizure time exactly (property-tested over 500 random cases); medication history becomes change records; keeps the **complete original 6.1 row** on every record (`legacy`); ids derive from 6.1 uuids so a second import adds nothing. The comparison report recomputes 6.1's numbers from the file and compares seizures per month, durations, emergency-plan flags, medication changes and doses. **Not yet run on your real backup** |
| 10 | Developer page listing imported data; coverage and mutation targets | done: `/#/dev` (lazy-loaded, first load still 67.6 KB) with a real Web Worker; end-to-end test in Chromium and Firefox. Coverage 99.6% statements / 95.8% branches (floor of 90% now enforced in CI). Mutation score 91.5% (Stryker, `pnpm mutation`, nightly job, every file above 80%) |

## M0 tasks
| # | Task | State |
|---|---|---|
| 1 | Repositories: 6.x tagged `v6.1.0` locally; you rename and archive it on GitHub; new repo `Grey-Matter-AS/AuraTrack` (renamed to `AuraTrack7` on 2026-11-01) | done: 6.x renamed to `AuraTrack-v6` and archived; new repo created (2026-10-30). Local remotes set: 6.x → `AuraTrack-v6`, v7 → `AuraTrack7` (`origin`). The `v6.1.0` tag exists only locally (an archived repo is read-only). |
| 2 | Monorepo (pnpm, TS strict, ESLint, Prettier, Vitest) | done: typecheck, lint, format, test and build all pass. TypeScript is pinned to 6 because typescript-eslint doesn't support 7 yet. Exact versions throughout (`.npmrc`). |
| 3 | CI (GitHub Actions) | done (`.github/workflows/ci.yml`); runs once the repo is on GitHub. Bundle budget script `pnpm size`: 67.5 KB of 180 KB. |
| 4 | End-to-end tool trial (Playwright vs Cypress) | done: **Playwright** (`docs/decisions/e2e-tool.md`). Chromium and Firefox run locally (20/20); WebKit can't run on openSUSE, so it runs in CI on Ubuntu. |
| 5 | PWA shell (prompt updates, CSP, deploy target) | done in code: prompt-mode service worker, manifest, strict CSP (`vercel.json`). Connecting the deploy target waits for the GitHub repo. |
| 6 | Design tokens from 6.1 | done (`packages/ui/src/tokens.css`, one definition per colour using light-dark()) |
| 7 | 6.1 feature checklist (`feature-checklist.md`), reviewed by you | done: reviewed by you (2026-10-31) |
| 8 | 6.1 report inventory (`report-inventory.md`) | draft from the code. Visual reference generated 2026-10-31 from made-up data (`docs/plan/reports-6.1/`, `scripts/gen-6x-reference.mjs`): 4 PDFs, CSV, previews. Still to do: compare the draft against it section by section. |

## Decisions
- The plan was approved on 2026-10-30, including the milestone-by-milestone workflow: you approve each milestone's plan before it starts, and you commit.
- **Folders:**
  - v7 lives in `/home/user01/Projects/AuraTrack7`
  - 6.x stays in `/home/user01/Projects/AuraTrack6`, untouched, for reference and the importer
- **Package manager:** pnpm, enabled through corepack in `~/.local/bin`.
- **GitHub:** first commit `M0: foundation` pushed to `Grey-Matter-AS/AuraTrack7` (then named `AuraTrack`); CI green (2026-10-30). `gh` is installed in WSL and logged in. You commit and push.

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
- **M2 is built.** To close it: you open the kitchen sink on your own phones (`https://auratrack7.vercel.app/#/kitchen`) and tell me what looks or feels wrong. Argon2id and the lock screen are decided: M3.
- **M1 is closed (2026-10-31).** The user ran the importer on their real 6.1 backup: 334 of 334 rows imported, 0 rejected, 0 unaccounted for. The user decided not to spend more time checking 6.x data: the 7 series is the priority, so the 'comparison report checked by you' item in M1's done-when is waived. The importer stays for other households moving from 6.1.
- **Fixed after the real import:** body-area parts with no sub-region (for example 'Left Eye') now map to codes when only one sub-region has that part; 'Wrist' and similar (on both arms) stay at region level, original kept in `legacy`. The dev page showed 'Loading…' forever in `pnpm dev` (worker not ready yet, plus React dev double-effect closed the client): the worker now announces when ready.
- **Then:** you approve `M3.md` and M3 starts.
- **You:** review `packages/i18n/src/labels/review.json`: 274 labels per language (symptoms, body areas, EEG activities, ILAE parts) are English-only because 6.1 never translated them. They show in English until reviewed.
- **You:** the first commit included `apps/web/dist-types/` (generated). It is now in `.gitignore`; to remove it from git: `git rm -r --cached apps/web/dist-types`.
- **Vercel deploy: done (2026-11-01).** Repo renamed `Grey-Matter-AS/AuraTrack7` and made public (the free plan cannot link a private organisation repo). Project `auratrack7`, root directory `./`, settings from `vercel.json`. `main` is production at `auratrack7.vercel.app`; other pushed branches get preview addresses. The kitchen sink loads there (user confirmed). A browser that visited an older version shows the saved copy until the service worker updates.

## M1 decisions and open points
- **Every imported record keeps its original 6.1 row** in a `legacy` field (invisible to the schemas, kept in backups). This makes a mapping mistake unable to lose data. Once you have verified the import, we can decide whether to drop it.
- **Time zone:** 6.1 did not store one; the importer assumes this device's and says so in the report.
- **An unknown dose status, frequency or other invalid value is rejected with a reason, never guessed** (for example, never "taken" for a dose 6.1 recorded oddly). Rejected rows are listed in the import report and shown beside the comparison numbers.
- **A medication 6.1 had deleted** is imported as a stopped one, so its dose history still has a medication to belong to.
- **Argon2id** is not in yet (needs a wasm library); PIN keys use PBKDF2-SHA256 at 600,000 rounds. Planned with the lock screen, first slice of M3.
- **Passkey unlock (WebAuthn PRF)** is written and tested against a fake authenticator only. It needs a real iPhone and Android phone before it is trusted.
- **Recovery kit** covers recovery of this device's data after a forgotten PIN. Keys for sharing between devices join the kit in M6; the format is versioned.
- **Seizure phase marks** (`start`, `auraEnd`, `seizureEnd`, `recoveryEnd`): Stop on the recording screen sets `seizureEnd`; recovery is marked afterwards. Seizure time (what the emergency plan uses) is `seizureEnd` minus `auraEnd` (or `start`).
- **ILAE** parts are optional and never filled by the importer (6.1 had no ILAE data, and it will not guess a classification).
- Nightly mutation job is in `.github/workflows/mutation.yml`.
