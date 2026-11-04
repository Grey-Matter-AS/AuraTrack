import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the v7 app (decision: docs/decisions/e2e-tool.md). Paths here are relative to this folder.
// Locally: Chromium and Firefox (`pnpm e2e:local`). In CI: all three engines, WebKit included.
export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'pnpm preview', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
    // A hub of our own for the hub tests (the built hub, an empty folder, port 9420): needs `pnpm build` first
    {
      command: 'node e2e/support/hub.mjs',
      url: 'http://127.0.0.1:9420/v1/health',
      reuseExistingServer: !process.env.CI,
    },
    // A signalling server of our own for the household tests: they never use the public one
    {
      command: 'node e2e/support/peer-server.mjs',
      url: 'http://127.0.0.1:9199/',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    // The household tests connect two browsers on this computer; browsers hide local addresses behind names that need
    // multicast DNS, which a test machine may not have, so that is switched off here (tests only)
    {
      name: 'chromium',
      use: { ...devices['Pixel 7'], launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 430, height: 932 },
        launchOptions: { firefoxUserPrefs: { 'media.peerconnection.ice.obfuscate_host_addresses': false } },
      },
    },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
});
