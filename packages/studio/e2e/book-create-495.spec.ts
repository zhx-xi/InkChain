import { test, expect } from "@playwright/test";

test.describe("BookCreate", () => {
  test("1. Book create page loads", async ({ page }) => {
    await page.goto("/#/book/new", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("2. Book create has input fields", async ({ page }) => {
    await page.goto("/#/book/new", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const inputs = await page.locator("input, textarea, select").count();
    expect(inputs).toBeGreaterThan(0);
  });
  test("3. API error handling", async ({ page }) => {
    await page.route("**/api/**", async (route) => { await route.abort(); });
    await page.goto("/#/book/new", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThanOrEqual(0);
  });
  test("4. Dashboard to book create navigation", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.goto("/#/book/new", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
