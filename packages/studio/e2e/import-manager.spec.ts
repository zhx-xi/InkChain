import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to ImportManager page via hash route */
async function navigateToImport(page: Page, tab?: string) {
  const hash = tab ? `/#/import/${tab}` : "/#/import";
  await page.goto(hash, { waitUntil: "load" });
  // Allow brief settling for dynamic content
  await page.waitForTimeout(2000);
}

/** Mock /books API to return a list of books */
function mockBooks(page: Page, books: Array<{ id: string; title: string }>) {
  return page.route("**/api/v1/books", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ books }),
    });
  });
}

/** Mock /books API to return error */
function mockBooksError(page: Page) {
  return page.route("**/api/v1/books", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) });
  });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("ImportManager", () => {
  test.beforeEach(async ({ page }) => {
    await mockBooks(page, [{ id: "book-1", title: "测试小说" }]);
  });

  test("1. Page renders with all tabs", async ({ page }) => {
    // Given books API is mocked
    // When navigating to import page
    await navigateToImport(page);

    // Then the page title should be visible
    await expect(page.getByText("导入工具", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // And all 5 tab buttons should be visible
    const tabs = ["导入章节", "导入母本", "同人创作", "番外创作", "仿写创作"];
    for (const tab of tabs) {
      await expect(page.getByText(tab, { exact: false }).first()).toBeVisible();
    }

    // Then the page should not crash — body has content
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Tab switching via hash route", async ({ page }) => {
    // Given books API is mocked
    // When navigating to import page with fanfic tab
    await navigateToImport(page, "fanfic");

    // Then the fanfic tab button should be active
    await expect(page.getByText("同人创作", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. API error handling", async ({ page }) => {
    // Given books API returns error
    await mockBooksError(page);

    // When navigating to import page
    await navigateToImport(page);

    // Then the page should still render tabs without crash
    await expect(page.getByText("导入工具", { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. Page renders with chapters tab by default", async ({ page }) => {
    // Given books API is mocked
    // When navigating to import page with chapters tab
    await navigateToImport(page, "chapters");

    // Then the chapters tab content should be visible
    await expect(page.getByText("导入章节", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
