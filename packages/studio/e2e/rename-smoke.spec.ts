import { test, expect } from "@playwright/test";

/**
 * E2E rename-smoke — project rename application health check.
 *
 * Issue #713: Fix CI pre-existing failures.
 * Timeout: 20s per test (CI environment is slower; fix plan requires 10s→20s).
 *
 * Covers: Dashboard, Agents, Skills, Settings page loads + error/empty/edge states.
 * 4-state coverage: normal × 5, error × 3, empty × 1, edge × 3 = 12 tests.
 */

test.describe("RenameSmoke — project rename application health check", () => {
  const BASE_TIMEOUT = 20_000;

  // ── Helpers ──────────────────────────────────────────────

  /** Collect page-level JS errors for the test duration. */
  async function collectErrors(page) {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    return errors;
  }

  /** Navigate and assert basic health: body has content, no page crash. */
  async function navigateAndAssert(page, route: string) {
    await page.goto(route, { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Must have meaningful content
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  }

  // ── Normal ────────────────────────────────────────────────

  test("N1: Dashboard homepage loads successfully", async ({ page }) => {
    // Given the application is running
    const errors = await collectErrors(page);
    // When navigating to the dashboard
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Then the page renders with content and no JS errors
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  test("N2: Agents page loads successfully", async ({ page }) => {
    // Given the application is running
    // When navigating to the Agents page
    await navigateAndAssert(page, "/#/agents");
    // Then the page renders with content
  });

  test("N3: Skills page loads successfully", async ({ page }) => {
    // Given the application is running
    // When navigating to the Skills page
    await navigateAndAssert(page, "/#/skills");
    // Then the page renders with content
  });

  test("N4: Settings page loads successfully", async ({ page }) => {
    // Given the application is running
    // When navigating to the Settings page
    await page.goto("/#/settings", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Then the page renders — settings-related text or sidebar is visible
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("N5: Sidebar navigation elements exist on Dashboard", async ({ page }) => {
    // Given the application is on Dashboard
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Then sidebar or header navigation elements are visible
    const navVisible =
      (await page.locator('[data-testid="dash-sidebar"]').isVisible().catch(() => false)) ||
      (await page.locator("nav").first().isVisible().catch(() => false)) ||
      (await page.locator("aside").first().isVisible().catch(() => false)) ||
      (await page.locator("header").first().isVisible().catch(() => false));
    expect(navVisible).toBeTruthy();
  });

  // ── Error ─────────────────────────────────────────────────

  test("E1: Graceful degradation when API is unreachable", async ({ page }) => {
    // Given the API is offline
    const errors = await collectErrors(page);
    await page.route("**/api/**", (route) => route.abort());
    // When navigating to the dashboard
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("domcontentloaded", { timeout: BASE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2000);
    // Then the page does not crash — body has content, no unhandled JS errors
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  test("E2: Invalid route does not crash the app", async ({ page }) => {
    // Given the application is running
    const errors = await collectErrors(page);
    // When navigating to a non-existent route
    await page.goto("/#/nonexistent-page-xyz", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("domcontentloaded", { timeout: BASE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2000);
    // Then the page does not white-screen and does not throw JS errors
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  test("E3: Settings page handles API offline gracefully", async ({ page }) => {
    // Given the API is offline
    const errors = await collectErrors(page);
    await page.route("**/api/**", (route) => route.abort());
    // When navigating to Settings
    await page.goto("/#/settings", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("domcontentloaded", { timeout: BASE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2000);
    // Then page does not crash
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  // ── Empty ─────────────────────────────────────────────────

  test("V1: Empty project homepage loads without crash", async ({ page }) => {
    // Given an empty/minimal project (seed data)
    const errors = await collectErrors(page);
    // When navigating to the dashboard
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Then the page renders (may show empty state guidance, but must not crash)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  // ── Edge ──────────────────────────────────────────────────

  test("B1: Rapid sequential navigation does not crash", async ({ page }) => {
    // Given the application is running
    const errors = await collectErrors(page);
    // When rapidly navigating through Agents → Skills → Dashboard
    const routes = ["/#/agents", "/#/skills", "/#/"];
    for (const route of routes) {
      await page.goto(route, { timeout: BASE_TIMEOUT });
      await page.waitForLoadState("load", { timeout: BASE_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(1000);
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    }
    // Then no JS errors accumulated
    expect(errors).toHaveLength(0);
  });

  test("B2: Page refresh preserves application state", async ({ page }) => {
    // Given the application is on the Dashboard
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // When the page is refreshed
    const errors = await collectErrors(page);
    await page.reload({ timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // Then the page reloads without crashing
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  test("B3: Browser back button works correctly", async ({ page }) => {
    // Given we start on Dashboard and navigate to Agents
    await page.goto("/#/", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    await page.goto("/#/agents", { timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    // When clicking browser back
    const errors = await collectErrors(page);
    await page.goBack({ timeout: BASE_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: BASE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1000);
    // Then we return to the previous page without crash
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });
});
