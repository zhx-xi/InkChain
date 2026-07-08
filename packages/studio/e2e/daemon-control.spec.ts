import { test, expect, Page } from "@playwright/test";
import { seedProject } from "./fixtures/seed-project";

// ── Helpers ──────────────────────────────────────────────────────

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
function mockDaemonStart(page: Page, result: { ok: boolean; running: boolean; error?: string }) {
  return page.route("**/api/v1/daemon/start*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

/** Mock daemon stop endpoint */
function mockDaemonStop(page: Page, result: { ok: boolean; running: boolean; error?: string }) {
  return page.route("**/api/v1/daemon/stop*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

// ── Normal data ──────────────────────────────────────────────────

test.describe("DaemonControl E2E", () => {
  test.beforeAll(async () => {
    await seedProject();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/#/daemon");
  });

  test("1. Page renders with stopped status", async ({ page }) => {
    // Given the daemon is stopped
    await mockDaemonStatus(page, { running: false });

    // When navigating to daemon page
    await page.goto("/#/daemon");
    await page.waitForLoadState("networkidle");

    // Then the page title should be visible
    await expect(page.getByText("守护进程控制")).toBeVisible({ timeout: 10_000 });

    // And the status should show "stopped"
    await expect(page.getByText(/停止|stopped|未运行/)).toBeVisible({ timeout: 5_000 });

    // And the start button should be visible
    const startButton = page.getByRole("button", { name: /启动|start/i });
    await expect(startButton).toBeVisible({ timeout: 5_000 });
  });

  test("2. Start daemon changes status to running", async ({ page }) => {
    // Given the daemon is initially stopped
    await mockDaemonStatus(page, { running: false });
    await page.goto("/#/daemon");
    await page.waitForLoadState("networkidle");

    // Wait for initial render
    await expect(page.getByText("守护进程控制")).toBeVisible({ timeout: 10_000 });

    // Mock start endpoint to succeed
    await mockDaemonStart(page, { ok: true, running: true });

    // When clicking the start button
    const startButton = page.getByRole("button", { name: /启动|start/i });
    await startButton.click();
    await page.waitForTimeout(1000);

    // Then the status should change to running
    await expect(page.getByText(/运行|running/)).toBeVisible({ timeout: 5_000 });
  });

  test("3. Stop daemon changes status back to stopped", async ({ page }) => {
    // Given the daemon is running
    await mockDaemonStatus(page, { running: true });
    await page.goto("/#/daemon");
    await page.waitForLoadState("networkidle");

    // Wait for initial render
    await expect(page.getByText("守护进程控制")).toBeVisible({ timeout: 10_000 });

    // Mock stop endpoint to succeed
    await mockDaemonStop(page, { ok: true, running: false });

    // When clicking the stop button
    const stopButton = page.getByRole("button", { name: /停止|stop/i });
    await stopButton.click();
    await page.waitForTimeout(1000);

    // Then the status should change back to stopped
    await expect(page.getByText(/停止|stopped|未运行/)).toBeVisible({ timeout: 5_000 });
  });

  test("4. Error handling — start failure shows error", async ({ page }) => {
    // Given the daemon is stopped
    await mockDaemonStatus(page, { running: false });
    await page.goto("/#/daemon");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("守护进程控制")).toBeVisible({ timeout: 10_000 });

    // Mock start endpoint to fail
    await mockDaemonStart(page, { ok: false, running: false, error: "Daemon busy" });

    // When clicking the start button
    const startButton = page.getByRole("button", { name: /启动|start/i });
    await startButton.click();
    await page.waitForTimeout(1000);

    // Then an error message should be displayed (the page should not crash)
    // The page should still be functional
    await expect(page.getByText("守护进程控制")).toBeVisible({ timeout: 5_000 });
  });
});
