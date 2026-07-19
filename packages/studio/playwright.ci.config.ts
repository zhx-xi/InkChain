import { defineConfig } from "@playwright/test";

/**
 * CI-specific Playwright config.
 * Servers are started externally by the CI workflow (start API/Vite steps).
 * Therefore we omit webServer — Playwright will use pre-running servers.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  workers: 1,  // Serial execution prevents Vite parallel-compile contention
  use: {
    baseURL: "http://localhost:4580",
    headless: true,
    screenshot: "only-on-failure",
  },
  // No webServer — servers are managed by CI workflow steps
});
