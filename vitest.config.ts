import { defineConfig } from 'vitest/config';

// One test run for the whole repo; every package keeps its tests next to its code (*.test.ts)
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: { provider: 'v8', include: ['packages/*/src/**'], reporter: ['text-summary', 'html'] },
  },
});
