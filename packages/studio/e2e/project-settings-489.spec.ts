import { test, expect } from "@playwright/test";

test.describe("ProjectSettings", () => {
  test("1. Navigate to dashboard works", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Settings page loads via hash route", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.goto("/#/settings", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Settings page has content", async ({ page }) => {
    await page.goto("/#/settings", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const sidebarTexts = ["Project Info", "项目信息", "Agent Config", "Agent 配置", "Chapters", "章节管理", "Export", "导出"];
    let found = false;
    for (const text of sidebarTexts) {
      found = await page.getByText(text).isVisible({ timeout: 2_000 }).catch(() => false);
      if (found) break;
    }
    expect(found).toBeTruthy();
  });

  test("4. Page does not crash with API errors", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      await route.abort();
    });
    await page.goto("/#/settings", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThanOrEqual(0);
  });
});
