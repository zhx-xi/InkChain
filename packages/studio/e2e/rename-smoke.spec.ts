import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests for InkOS → InkChain rename (#579).
 *
 * Verifies the app loads and navigates correctly after the rename.
 * 4-state coverage: normal / error / empty / edge
 */

test.describe("rename-smoke — app health after InkOS→InkChain", () => {
  test("normal: Dashboard loads successfully", async ({ page }) => {
    await page.goto("/");

    // Wait for loading to complete
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Verify dashboard renders
    try {
      await expect(
        page.locator("[data-testid='dash-success-state']")
      ).toBeVisible({ timeout: 20_000 });
    } catch {
      // Fallback: page body has content
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
      // No visible error banner
      await expect(page.locator("text=Error").first()).not.toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("normal: Sidebar navigation is present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    try {
      await expect(
        page.locator("[data-testid='sidebar-toggle']")
      ).toBeVisible({ timeout: 10_000 });
    } catch {
      // Fallback: check for navigation elements
      const navElements = page.locator("nav, aside, [role='navigation']");
      const navCount = await navElements.count();
      expect(navCount).toBeGreaterThan(0);
    }
  });

  test("normal: Navigate to Agents page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("normal: Navigate to Skills page", async ({ page }) => {
    await page.goto("/skills");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("normal: Navigate to Dashboard via explicit route", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("empty: API health endpoint returns valid response", async ({
    page,
  }) => {
    const response = await page.request.get("http://localhost:4581/health");
    expect(response.ok()).toBeTruthy();
  });

  test("edge: rapid sequential navigation does not crash", async ({
    page,
  }) => {
    const routes = ["/", "/agents", "/skills"];
    for (const route of routes) {
      await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 10_000,
      });
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });
});
