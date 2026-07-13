import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Rebuild @inkchain/inkchain-core before starting the E2E server.  The API server
  // (tsx watch src/api/index.ts) imports core via its compiled dist/index.js,
  // not the TypeScript source.  A stale dist causes runtime behaviour to
  // diverge from the sources, making otherwise-correct logic invisible to the
  // test server.  See e2e/global-setup.ts for details.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  // Run specs serially against the single shared dev server. The authoring
  // agent flow streams a long SSE turn; with parallel workers, concurrent
  // specs hammering the one server starve that turn into a 60s timeout (the
  // spec passes alone but flakes in a parallel full run). Serial is both
  // reliable and faster here (one backend, no contention).
  workers: 1,
  use: {
    baseURL: "http://localhost:4580",
    headless: true,
    screenshot: "only-on-failure",
  },
  // Dedicated E2E servers run on ports 4580/4581 to avoid conflict with the
  // dev server (4567/4569).  The API server is started with INKCHAIN_AGENT_LLM_STUB=1
  // so the agent uses the deterministic stub and never makes real LLM calls.
  //
  // INKCHAIN_PROJECT_ROOT is configurable via the INKCHAIN_E2E_PROJECT_ROOT env var.
  // Defaults to test-project/ (relative to packages/studio), where seed fixtures
  // write test data.  Override for real project data:
  //   INKCHAIN_E2E_PROJECT_ROOT="C:/path/to/project" pnpm start:e2e
  //
  // To run E2E tests against real LLM APIs (requires configured API keys):
  //   set INKCHAIN_E2E_REAL_LLM=1 && pnpm --filter @inkchain/inkchain-studio exec playwright test
  // This skips page.route() mocking for AI extraction endpoints, letting
  // requests pass through to the real backend. See e2e/fixtures/mock-llm-helper.ts.
  // CI always runs with Mock mode (default).
  webServer: [
    {
      command: "node_modules/.bin/tsx watch --clear-screen=false src/api/index.ts",
      env: {
        INKCHAIN_STUDIO_PORT: "4581",
        INKCHAIN_AGENT_LLM_STUB: "1",
        INKCHAIN_PROJECT_ROOT: "test-project",
      },
      url: "http://localhost:4581",
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: ".",
    },
    {
      command: "node_modules/.bin/vite --host --port 4580",
      env: {
        INKCHAIN_STUDIO_PORT: "4581",
      },
      url: "http://localhost:4580",
      reuseExistingServer: true,
      timeout: 30_000,
      cwd: ".",
    },
  ],
});
