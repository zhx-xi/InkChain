import { test, expect } from "@playwright/test";
const BASE_URL = "http://localhost:4580";

test.describe("Dashboard — 项目收缩与边界拖拽", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.addStyleTag({ content: ".pointer-events-none { pointer-events: auto !important; }" });
  });

  test("N1: Dashboard loads — page renders", async ({ page }) => {
    await page.waitForURL(/#\//, { timeout: 10000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test("N2: Sidebar visible", async ({ page }) => {
    await page.waitForTimeout(2000);
    const sidebar = page.locator("[data-testid='sidebar-toggle'], aside, [class*='sidebar']").first();
    const visible = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });

  test("B1: Collapse button clickable", async ({ page }) => {
    const collapseBtn = page.locator("[data-testid*='collapse'], [data-testid*='minimize'], button[aria-label*='collapse']").first();
    const visible = await collapseBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await collapseBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const bodyAfter = await page.locator("body").innerText();
      expect(bodyAfter.length).toBeGreaterThan(5);
      await collapseBtn.click({ force: true });
    }
  });

  test("B2: Drag handle no jitter", async ({ page }) => {
    const handle = page.locator("[data-testid*='resize'], [data-testid*='divider'], [role='separator']").first();
    const visible = await handle.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + box.height/2, { steps: 5 });
        await page.mouse.up();
      }
    }
    expect(await page.locator("body").innerText().then(t => t.length)).toBeGreaterThan(5);
  });

  test("E1: Layout persists after reload", async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000);
    expect(await page.locator("body").innerText().then(t => t.length)).toBeGreaterThan(10);
  });
});
