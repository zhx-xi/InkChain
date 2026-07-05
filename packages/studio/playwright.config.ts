import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Rebuild @actalk/inkos-core before starting the E2E server.  The API server
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
  // Always start a dedicated E2E server with INKOS_AGENT_LLM_STUB=1 so the
  // agent uses the deterministic stub and never makes real LLM calls.
  // reuseExistingServer: false ensures the stub env var is always active —
  // if an existing dev server (started without the stub) were reused, the
  // agent would attempt a real LLM call with the fake API key and hang.
  // Ports 4580/4581 are dedicated to E2E to avoid conflict with the dev server.
  //
  // To run E2E tests against real LLM APIs (requires configured API keys):
  //   set INKOS_E2E_REAL_LLM=1 && pnpm --filter @inkos/studio exec playwright test
  // This skips page.route() mocking for AI extraction endpoints, letting
  // requests pass through to the real backend. See e2e/fixtures/mock-llm-helper.ts.
  // CI always runs with Mock mode (default).
  webServer: {
    command: "echo E2E servers already running manually",
    url: "http://localhost:4580",
    reuseExistingServer: true,
    timeout: 5_000,
    cwd: ".",
  },
});
