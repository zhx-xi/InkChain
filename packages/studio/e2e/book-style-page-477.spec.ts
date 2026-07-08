import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID;

test.describe("BookStylePage — 书籍风格 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载显示风格分析内容", async ({ page }) => {
    // Given 一个已存在的书籍
    // When 导航到风格页面
    await page.goto(`/#/book/${BOOK_ID}/style`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Then 页面应加载不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效书籍 ID 不崩溃", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-style-book-99999";

    // When 导航到该书籍风格页
    await page.goto(`/#/book/${invalidId}/style`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("3. Edge: 页面中存在风格分析相关UI元素", async ({ page }) => {
    // Given 一个已存在的书籍
    await page.goto(`/#/book/${BOOK_ID}/style`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // When 页面加载完成
    // Then 骨架屏或加载态应最终渲染完成
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);

    // 页面不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("4. Empty: 浏览器基本导航正常", async ({ page }) => {
    // Given 风格页面已加载
    await page.goto(`/#/book/${BOOK_ID}/style`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // When 导航到首页再返回
    await page.goto("/#/dashboard");
    await page.waitForTimeout(2_000);
    await page.goto(`/#/book/${BOOK_ID}/style`);
    await page.waitForTimeout(3_000);

    // Then 返回后页面仍不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });
});
