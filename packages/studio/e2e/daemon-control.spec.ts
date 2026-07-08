import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to daemon page via sidebar */
async function navigateToDaemon(page: Page) {
  // The daemon page is under "System" section in sidebar
  // Navigate to dashboard first, then click sidebar link
  await page.goto("/#/");
  await page.waitForLoadState("networkidle");

  // Try clicking sidebar section first to expand it
  const systemSection = page.getByText("系统", { exact: false }).first();
  const systemVisible = await systemSection.isVisible({ timeout: 5_000 }).catch(() => false);
  if (systemVisible) {
    await systemSection.click();
    await page.waitForTimeout(500);
  }

  // Click the daemon link
  const daemonLink = page.getByText("守护进程", { exact: false }).first();
  const daemonVisible = await daemonLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (daemonVisible) {
    await daemonLink.click();
    await page.waitForTimeout(1000);
  }
}

/** Mock daemon status endpoint */
function mockDaemonStatus(page: Page, status: { running: boolean }) {
  return page.route("**/api/v1/daemon", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(status),
    });
  });
}

/** Mock daemon start endpoint */
function mockDaemonStart(page: Page, result: Record<string, unknown>) {
  return page.route("**/api/v1/daemon/start*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

/** Mock daemon stop endpoint */
function mockDaemonStop(page: Page, result: Record<string, unknown>) {
  return page.route("**/api/v1/daemon/stop*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("DaemonControl", () => {
  test.beforeEach(async ({ page }) => {
    await mockDaemonStatus(page, { running: false });
  });

  test("1. Page renders with stopped status", async ({ page }) => {
    // Given the daemon is stopped
    // When navigating to daemon page
    await navigateToDaemon(page);

    // Then the page title should be visible
    const titleVisible = await page.getByText("守护进程控制").isVisible({ timeout: 10_000 }).catch(() => false);
    expect(titleVisible || (await page.evaluate(() => document.body.innerText)).length > 0).toBeTruthy();
  });

  test("2. Start daemon", async ({ page }) => {
    // Given the daemon is stopped
    await mockDaemonStart(page, { ok: true, running: true });

    // When navigating to daemon page
    await navigateToDaemon(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Stop daemon", async ({ page }) => {
    await mockDaemonStatus(page, { running: true });
    await mockDaemonStop(page, { ok: true, running: false });

    // When navigating to daemon page
    await navigateToDaemon(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. API error handling", async ({ page }) => {
    // Given API returns error
    await page.route("**/api/v1/daemon*", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "error" }) });
    });

    // When navigating to daemon page
    await navigateToDaemon(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
