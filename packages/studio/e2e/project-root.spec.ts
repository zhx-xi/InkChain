import { test, expect } from "@playwright/test";

/**
 * E2E infrastructure validation test for PR #463.
 *
 * Verifies that the E2E servers start with the correct INKOS_PROJECT_ROOT
 * configuration, the API responds, and the dashboard loads without crashing.
 * The test-project is intentionally empty (no books/chapters) — this tests
 * graceful handling of the empty state, not regression from the pre-existing
 * API crash issue.
 *
 * 4-state coverage:
 * - Normal:  API responds, dashboard loads showing empty state
 * - Error:   API returns 5xx or connection refused → test fails
 * - Empty:   project with no books/chapters shows empty state, doesn't crash
 * - Edge:    API health endpoint returns 200 with valid response body
 */

test.describe("E2E server project root configuration (PR #463)", () => {

  test("1. API server health check", async ({ page }) => {
    // Edge + Normal: hit the API health endpoint directly
    const response = await page.request.get("http://localhost:4581/api/v1/books");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    // The test-project is intentionally empty — expect an empty books array or
    // a valid response structure, not a crash or 5xx
    expect(body).toHaveProperty("books");
    expect(Array.isArray(body.books)).toBe(true);
  });

  test("2. Dashboard loads without crash (empty project)", async ({ page }) => {
    // Normal path: navigate to dashboard, should render even with no books
    // Use "load" instead of "networkidle" because the frontend uses SSE
    // (EventSource) connections that never let network activity settle
    await page.goto("/", { waitUntil: "load" });

    // The page should not crash — wait for React to mount
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });

    // Should show rendered content (not a blank/white screen)
    // The empty project state should not produce a crash
    const rootContent = await root.innerHTML();
    expect(rootContent.length).toBeGreaterThan(50);
  });

  test("3. Frontend renders without JS errors (empty project)", async ({ page }) => {
    // Normal path: frontend should render even with empty project root.
    // Listen for page errors before navigating, then check none occurred.
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/", { waitUntil: "load" });
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });

    // No JS errors should have occurred on initial load
    expect(errors.length).toBe(0);
  });

  test("4. API project root responds with empty book list", async ({ page }) => {
    // Empty path: test-project has no books, should return empty array
    const response = await page.request.get("http://localhost:4581/api/v1/books");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty("books");
    expect(Array.isArray(body.books)).toBe(true);
    expect(body.books.length).toBe(0);
  });

  test("5. Frontend and API server both reachable on E2E ports", async ({ page }) => {
    // Edge: verify both E2E servers (Vite 4580, API 4581) are running
    const apiResp = await page.request.get("http://localhost:4581/api/v1/books");
    expect(apiResp.ok()).toBe(true);

    // Navigate to the Vite frontend (default port for E2E is 4580)
    // Use "load" not "networkidle" because of SSE connections
    await page.goto("http://localhost:4580/", { waitUntil: "load" });
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });
  });
});
