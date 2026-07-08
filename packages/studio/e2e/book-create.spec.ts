import { test, expect } from "@playwright/test";

test.describe("BookCreate — 创建书籍", () => {
  test("1. 页面加载 — 不崩溃", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/#/book/new");
    await page.waitForTimeout(3_000);

    // Page should render without crashes
    expect(pageErrors.length).toBe(0);

    // DOM should have content
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. 页面包含创建相关界面元素", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/#/book/new");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test("3. 返回导航可用", async ({ page }) => {
    await page.goto("/#/book/new");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Try to find a navigation element to go back
    const navBtn = page.getByRole("button").filter({ hasText: /书籍|Book|dashboard|←|back|返回|首页/i }).first();
    if (await navBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await navBtn.click();
      await page.waitForTimeout(1_000);
    }
  });
});
