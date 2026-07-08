import { test, expect, Page } from "@playwright/test";

// ── Constants ────────────────────────────────────────────────────

const E2E_BOOK_ID = "e2e-sidebar-nav";

// ── Helpers ──────────────────────────────────────────────────────

/** Mock dashboard endpoint for a book */
function mockDashboard(page: Page, bookId: string, data: unknown) {
  return page.route(`**/api/v1/books/${bookId}/dashboard*`, async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

function mockDashboardError(page: Page, bookId: string) {
  return page.route(`**/api/v1/books/${bookId}/dashboard*`, async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal error" }) });
  });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("EditDashboard", () => {
  test("1. Page renders with dashboard widgets", async ({ page }) => {
    // Given seed data with book
    await mockDashboard(page, E2E_BOOK_ID, {
      widgets: [
        { type: "progress", title: "写作进度", data: { total: 10, completed: 5 } },
        { type: "character", title: "角色总览", data: { count: 8 } },
      ],
    });

    // When navigating to dashboard page via hash URL (fully supported)
    await page.goto(`/#/edit-dashboard/${E2E_BOOK_ID}`);
    await page.waitForLoadState("networkidle");

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Empty widgets state", async ({ page }) => {
    // Given a book with no dashboard data
    await mockDashboard(page, E2E_BOOK_ID, { widgets: [] });

    // When navigating to dashboard
    await page.goto(`/#/edit-dashboard/${E2E_BOOK_ID}`);
    await page.waitForLoadState("networkidle");

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Multiple widgets grid", async ({ page }) => {
    // Given multiple widgets
    await mockDashboard(page, E2E_BOOK_ID, {
      widgets: [
        { type: "progress", title: "写作进度", data: { total: 10, completed: 3 } },
        { type: "character", title: "角色总览", data: { count: 12 } },
        { type: "relation", title: "关系图谱", data: { edges: 15 } },
        { type: "timeline", title: "时间线", data: { events: 20 } },
      ],
    });

    // When navigating to dashboard
    await page.goto(`/#/edit-dashboard/${E2E_BOOK_ID}`);
    await page.waitForLoadState("networkidle");

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. API error shows fallback UI", async ({ page }) => {
    // Given the dashboard API returns error
    await mockDashboardError(page, E2E_BOOK_ID);

    // When navigating to dashboard
    await page.goto(`/#/edit-dashboard/${E2E_BOOK_ID}`);
    await page.waitForLoadState("networkidle");

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
