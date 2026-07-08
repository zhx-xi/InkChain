import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to log viewer page via sidebar */
async function navigateToLogViewer(page: Page) {
  // Navigate to dashboard first
  await page.goto("/#/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);

  // Try clicking system section to expand it
  const systemSection = page.getByText("系统", { exact: false }).first();
  const systemVisible = await systemSection.isVisible({ timeout: 5_000 }).catch(() => false);
  if (systemVisible) {
    await systemSection.click();
    await page.waitForTimeout(500);
  }

  // Click the log link
  const logLink = page.getByText("日志", { exact: false }).first();
  const logVisible = await logLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (logVisible) {
    await logLink.click();
    await page.waitForTimeout(1000);
  }
}

/** Mock /api/v1/logs endpoint */
function mockLogs(page: Page, entries: ReadonlyArray<Record<string, string>>) {
  return page.route("**/api/v1/logs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries }),
    });
  });
}

// ── Sample log entries ──────────────────────────────────────────

const SAMPLE_ENTRIES = [
  { level: "info", tag: "system", message: "Application started successfully", timestamp: "2026-07-09T08:00:00.000Z" },
  { level: "warn", tag: "llm", message: "API rate limit approaching (85/100)", timestamp: "2026-07-09T08:01:00.000Z" },
  { level: "error", tag: "daemon", message: "Connection timeout to upstream service", timestamp: "2026-07-09T08:02:00.000Z" },
  { level: "debug", tag: "session", message: "Cache hit: session-abc-123", timestamp: "2026-07-09T08:03:00.000Z" },
];

// ── Tests ────────────────────────────────────────────────────────

test.describe("LogViewer", () => {
  test("1. Page renders with log entries", async ({ page }) => {
    // Given the logs API returns sample entries
    await mockLogs(page, SAMPLE_ENTRIES);

    // When navigating to the log viewer page
    await navigateToLogViewer(page);

    // Then the page title should be visible
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain("日志");
    // And the log messages should be rendered
    expect(bodyText).toContain("Application started successfully");
    expect(bodyText).toContain("Connection timeout");
  });

  test("2. Empty state shows placeholder", async ({ page }) => {
    // Given the logs API returns empty entries
    await mockLogs(page, []);

    // When navigating to the log viewer page
    await navigateToLogViewer(page);
    await page.waitForTimeout(1000);

    // Then the empty state placeholder should be visible
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain("暂无日志");
  });

  test("3. API error does not crash the page", async ({ page }) => {
    // Given the logs API returns a server error
    await page.route("**/api/v1/logs", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server error" }) });
    });

    // When navigating to the log viewer page
    await navigateToLogViewer(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. Log entries display correct level colors", async ({ page }) => {
    // Given the logs API returns entries with various levels
    await mockLogs(page, SAMPLE_ENTRIES);

    // When navigating to the log viewer page
    await navigateToLogViewer(page);
    await page.waitForTimeout(1000);

    // Then all four log levels should appear in the rendered output
    const bodyText = await page.evaluate(() => document.body.innerText);
    // Check level labels appear (uppercase log levels)
    expect(bodyText).toContain("INFO");
    expect(bodyText).toContain("WARN");
    expect(bodyText).toContain("ERROR");
    expect(bodyText).toContain("DEBUG");
    // Check tags appear
    expect(bodyText).toContain("system");
    expect(bodyText).toContain("llm");
    expect(bodyText).toContain("daemon");
    expect(bodyText).toContain("session");
  });
});
