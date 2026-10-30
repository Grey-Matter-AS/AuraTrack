import { defineConfig, devices } from '@playwright/test';

// M0 trial (docs/decisions/e2e-tool.md): run against the real 6.1 app served on :4173
export default defineConfig({
  testDir: '.',
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 430, height: 932 } } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
});
