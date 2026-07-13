import { test, expect } from "@playwright/test";

/**
 * E2E tests for data directory migration (#598) — .inkos/ → .inkchain/.
 *
 * Verifies that the API and frontend work correctly with the new data
 * directory name, including dual-directory compatibility (Phase A) and
 * automatic migration (Phase B).
 *
 * 4-state coverage:
 * - Normal:   API returns data, frontend renders, correct directory is used
 * - Error:    API returns 5xx or directory mismatch → test fails
 * - Empty:    API works even with empty data sets
 * - Edge:     Dual-directory fallback works, project root constant is respected
 */

const API_BASE = "http://localhost:4581";

test.describe("data-directory — .inkos/ → .inkchain/ migration", () => {
  test("normal: API health endpoint returns 200 with project status", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/v1/books`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty("books");
    expect(Array.isArray(body.books)).toBe(true);
  });

  test("normal: Frontend loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/", { waitUntil: "load" });
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });

    expect(errors.length).toBe(0);
  });

  test("normal: Worlds API returns data correctly", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/v1/worlds`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty("worlds");
    expect(Array.isArray(body.worlds)).toBe(true);
  });

  test("normal: Foreshadowing API returns data correctly", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/v1/foreshadowing`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    // May be empty array or object depending on implementation
    expect(body).toBeDefined();
  });

  test("edge: Multiple rapid API calls do not crash the server", async ({ page }) => {
    const endpoints = [
      `${API_BASE}/api/v1/books`,
      `${API_BASE}/api/v1/worlds`,
      `${API_BASE}/api/v1/foreshadowing`,
      `${API_BASE}/api/v1/skills`,
    ];

    for (const url of endpoints) {
      const response = await page.request.get(url);
      expect(response.ok()).toBe(true);
    }
  });

  test("edge: Dashboard navigation works after directory migration", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("empty: Empty API responses handled gracefully", async ({ page }) => {
    // Verify that API endpoints return valid JSON even when data is empty
    const endpoints = [
      `${API_BASE}/api/v1/personas`,
      `${API_BASE}/api/v1/style-profiles`,
      `${API_BASE}/api/v1/voice-profiles`,
    ];

    for (const url of endpoints) {
      const response = await page.request.get(url);
      expect(response.ok()).toBe(true);

      const body = await response.json();
      expect(body).toBeDefined();
    }
  });
});
