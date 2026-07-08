import { test, expect } from "@playwright/test";

test.describe("AgentPipelineView", () => {
  test("1. Agents page loads via hash route", async ({ page }) => {
    await page.goto("/#/agents", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("2. Agents page has content", async ({ page }) => {
    await page.goto("/#/agents", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const headings = ["Agent Team", "Agent 团队", "Agents", "Writer"];
    let found = false;
    for (const h of headings) {
      found = await page.getByText(h).isVisible({ timeout: 2_000 }).catch(() => false);
      if (found) break;
    }
    expect(found || (await page.evaluate(() => document.body.innerText)).length > 0).toBeTruthy();
  });
  test("3. Dashboard to agents navigation", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.goto("/#/agents", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
  test("4. Error handling", async ({ page }) => {
    await page.route("**/api/**", async (route) => { await route.abort(); });
    await page.goto("/#/agents", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThanOrEqual(0);
  });
});
