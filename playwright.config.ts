import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the v7 app (decision: docs/decisions/e2e-tool.md).
// Locally: Chromium and Firefox (`pnpm e2e:local`). In CI: all three engines, WebKit included.
export default defineConfig({
  testDir: 'apps/web/e2e',
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm preview', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 430, height: 932 } } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
});
