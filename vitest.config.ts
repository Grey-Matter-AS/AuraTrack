import { defineConfig } from 'vitest/config';

// One test run for the whole repo; every package keeps its tests next to its code (*.test.ts)
export default defineConfig({
  test: {
    include: [
      'AuraTrack7-Shared/packages/*/src/**/*.test.{ts,tsx}',
      'AuraTrack7-PWA/src/**/*.test.{ts,tsx}',
      'AuraTrack7-Server/*/src/**/*.test.{ts,tsx}',
    ],
    passWithNoTests: true,
    // The screen tests run the real encrypted store and many taps; with every core busy a few of them time out, so some are left free
    maxWorkers: 6,
    // The screen tests drive the real store and many taps; they are slower under coverage
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['AuraTrack7-Shared/packages/*/src/**'],
      reporter: ['text-summary', 'html'],
      // The plan's floor for AuraTrack7-Shared/packages/* (docs/plan/README.md, Testing strategy); the clinical rules, merge, crypto and importer sit near 100% of branches
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
