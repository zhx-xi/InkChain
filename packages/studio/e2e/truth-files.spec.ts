import { test, expect } from "@playwright/test";

test.describe("TruthFiles", () => {
  test("1. Truth files page loads", async ({ page }) => {
    await page.goto("/#/truth/default-book", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("2. Navigate via hash with different book ID", async ({ page }) => {
    await page.goto("/#/truth/test-book-id", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("3. Dashboard to truth navigation", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.goto("/#/truth/default-book", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("4. Page does not crash with errors", async ({ page }) => {
    await page.route("**/api/**", async (route) => { await route.abort(); });
    await page.goto("/#/truth/test", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeAttached({ timeout: 3_000 });
  });
});
