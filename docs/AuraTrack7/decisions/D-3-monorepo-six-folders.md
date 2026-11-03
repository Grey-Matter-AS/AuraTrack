# D-3: Monorepo in six folders, specification with test vectors

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
One repository with `AuraTrack7-PWA`, `-Apple`, `-Android`, `-Server`, `-Relay` and `-Shared` (spec, vectors, TS reference packages, translation export). The move happens first, in N0 Part A (moved from N1 on 2026-11-03), and the PWA runs on Vercel from it before anything else. The TypeScript packages are the reference implementation; the written spec and generated test vectors are the contract both native apps must pass.

## Why
Three codebases stay compatible only if they are tested against the same vectors. Shared code in its own folder means no app depends on the PWA.
