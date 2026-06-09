import { defineConfig } from "cypress";

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: "http://127.0.0.1:4173",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx}",
    supportFile: "cypress/support/e2e.js",
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 430,
    viewportHeight: 932,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(_on, config) {
      return config;
    },
  },
});
