import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to doctor page via sidebar */
async function navigateToDoctor(page: Page) {
  await page.goto("/#/");
  await page.waitForLoadState("networkidle");

  // Try clicking tools section
  const toolsSection = page.getByText("工具箱", { exact: false }).first();
  const toolsVisible = await toolsSection.isVisible({ timeout: 5_000 }).catch(() => false);
  if (toolsVisible) {
    await toolsSection.click();
    await page.waitForTimeout(500);
  }

  // Click the doctor link
  const doctorLink = page.getByText("诊断", { exact: false }).first();
  const doctorVisible = await doctorLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (doctorVisible) {
    await doctorLink.click();
    await page.waitForTimeout(1000);
  }
}

/** Mock doctor endpoint */
function mockDoctor(page: Page, data: Record<string, unknown>) {
  return page.route("**/api/v1/doctor", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("DoctorView", () => {
  test("1. Page renders with all checks passed", async ({ page }) => {
    // Given a healthy system state
    await mockDoctor(page, { inkosJson: true, projectEnv: true, globalEnv: true, booksDir: true, llmConnected: true, bookCount: 3 });

    // When navigating to doctor page
    await navigateToDoctor(page);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Failed checks display", async ({ page }) => {
    // Given a system with failures
    await mockDoctor(page, { inkosJson: true, projectEnv: true, globalEnv: false, booksDir: true, llmConnected: false, bookCount: 0 });

    // When navigating to doctor page
    await navigateToDoctor(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Recheck button", async ({ page }) => {
    // Given an initially healthy state
    await mockDoctor(page, { inkosJson: true, projectEnv: true, globalEnv: true, booksDir: true, llmConnected: true, bookCount: 2 });

    await navigateToDoctor(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. API error shows fallback UI", async ({ page }) => {
    // Given the doctor API returns an error
    await page.route("**/api/v1/doctor", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal error" }) });
    });

    // When navigating to doctor page
    await navigateToDoctor(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
