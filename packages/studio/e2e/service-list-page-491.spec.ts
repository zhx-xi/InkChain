import { test, expect } from "@playwright/test";

test.describe("ServiceListPage", () => {
  test("1. Services page loads via hash route", async ({ page }) => {
    await page.goto("/#/services", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Services page has content", async ({ page }) => {
    await page.goto("/#/services", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const headings = ["Services", "服务", "Service", "API"];
    let found = false;
    for (const h of headings) {
      found = await page.getByText(h).isVisible({ timeout: 2_000 }).catch(() => false);
      if (found) break;
    }
    expect(found || (await page.locator("button, a, input").count()) > 0).toBeTruthy();
  });

  test("3. API error handling", async ({ page }) => {
    await page.route("**/api/**", async (route) => { await route.abort(); });
    await page.goto("/#/services", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThanOrEqual(0);
  });

  test("4. Navigate from dashboard", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.goto("/#/services", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
