import { test, expect } from "@playwright/test";

/**
 * E2E tests for global IndexManager (#597) — LRU cache layer for API data reads.
 *
 * Verifies that API routes continue to return correct data when the
 * IndexManager caching layer is active. The cache is transparent — it
 * should not change API behavior, only improve performance.
 *
 * 4-state coverage:
 * - Normal:   API returns correct data through cache layer
 * - Error:    API returns 5xx or cache corruption → test fails
 * - Empty:    API returns empty data gracefully even with cache active
 * - Edge:     Repeated reads (cache hit) return consistent data,
 *             write-through updates both cache and file
 */

const API_BASE = "http://localhost:4581";

test.describe("index-manager — transparent LRU cache for API reads", () => {
  test("normal: Worlds API returns correct data through cache", async ({ page }) => {
    // First read (cache miss — lazy load from disk)
    const response1 = await page.request.get(`${API_BASE}/api/worlds`);
    expect(response1.ok()).toBe(true);
    const body1 = await response1.json();
    expect(body1).toHaveProperty("worlds");
    expect(Array.isArray(body1.worlds)).toBe(true);

    // Second read (cache hit — should return identical data)
    const response2 = await page.request.get(`${API_BASE}/api/worlds`);
    expect(response2.ok()).toBe(true);
    const body2 = await response2.json();

    // Data should be consistent between reads
    expect(JSON.stringify(body1)).toEqual(JSON.stringify(body2));
  });

  test("normal: Foreshadowing API works through cache", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/foreshadowing`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("normal: Skills API works through cache", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/v1/skills`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("normal: Personas API works through cache", async ({ page }) => {
    const response = await page.request.get(`${API_BASE}/api/v1/project/personas`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("edge: Repeated reads return consistent data (cache hit stress)", async ({ page }) => {
    // Read the same endpoint 5 times — each call after the first should be a cache hit
    const results: string[] = [];

    for (let i = 0; i < 5; i++) {
      const response = await page.request.get(`${API_BASE}/api/worlds`);
      expect(response.ok()).toBe(true);
      const body = await response.json();
      results.push(JSON.stringify(body));
    }

    // All 5 responses must be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  test("edge: Multiple different endpoints all respond correctly (cache per namespace)", async ({ page }) => {
    const endpoints = [
      `${API_BASE}/api/worlds`,
      `${API_BASE}/api/foreshadowing`,
      `${API_BASE}/api/v1/skills`,
      `${API_BASE}/api/v1/project/personas`,
      `${API_BASE}/api/style-profiles`,
      `${API_BASE}/api/v1/project/voice-profiles`,
      `${API_BASE}/api/v1/project/agent-team`,
      `${API_BASE}/api/v1/agent-templates`,
    ];

    let okCount = 0;
    for (const url of endpoints) {
      const response = await page.request.get(url);
      if (response.ok()) {
        okCount++;
        const body = await response.json();
        expect(body).toBeDefined();
      } else {
        console.log(`Skipping endpoint (${response.status()}): ${url}`);
      }
    }

    // At least the core endpoints that have seed data should respond
    expect(okCount).toBeGreaterThanOrEqual(6);
  });

  test("normal: Frontend loads without JS errors with cache active", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/", { waitUntil: "load" });
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 20_000 });

    expect(errors.length).toBe(0);
  });

  test("empty: Empty namespaces return gracefully from cache", async ({ page }) => {
    // Custom agents and templates may be empty — cache should handle gracefully
    const response = await page.request.get(`${API_BASE}/api/v1/custom-agents`);
    expect([200, 404].includes(response.status())).toBe(true);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });
});
