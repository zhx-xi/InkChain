import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests for InkOS → InkChain rename (#579).
 *
 * Verifies the app loads and navigates correctly after the rename.
 * On CI the test-project is minimal — root "/" may 500 if
 * /api/v1/project init fails.  These tests focus on navigable routes
 * that work regardless of project data, plus API server liveness.
 */

test.describe("rename-smoke — app health after InkOS→InkChain", () => {
  test("normal: Navigate to Agents page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("normal: Navigate to Skills page", async ({ page }) => {
    await page.goto("/skills");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("normal: Navigate to Dashboard via explicit route", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("api: API server responds (IPv4)", async ({ page }) => {
    // GitHub Actions Ubuntu resolves localhost to ::1 (IPv6),
    // but the API server only binds 127.0.0.1 (IPv4).
    const response = await page.request.get("http://127.0.0.1:4581/");
    // 200 = OK, 404 = Not Found — both mean the server is alive.
    expect([200, 404]).toContain(response.status());
  });

  test("edge: rapid sequential navigation does not crash", async ({ page }) => {
    const routes = ["/agents", "/skills", "/dashboard"];
    for (const route of routes) {
      await page.goto(route, {
        waitUntil: "load",
        timeout: 10_000,
      });
      await page.waitForTimeout(2000);
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });
});
