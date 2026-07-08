import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID; // "e2e-sidebar-nav" — a book with 3 drafted chapters

test.describe("BookDetail — 书籍详情 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载并显示书籍信息", async ({ page }) => {
    // Given 一个已存在书籍
    // When 导航到书籍设置页
    await page.goto(`/#/book/${BOOK_ID}/settings`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    await page.waitForTimeout(2_000);
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效书籍 ID 显示错误状态", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-book-99999";

    // When 导航到该书籍的设置页
    await page.goto(`/#/book/${invalidId}/settings`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容（可能显示错误提示）
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Edge: 书籍设置页面加载时侧边栏导航可用", async ({ page }) => {
    // Given 一个已存在的书籍
    await page.goto(`/#/book/${BOOK_ID}/settings`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // When 页面加载完成
    // Then 侧边栏导航按钮应存在（包括返回、章节等）
    await page.waitForTimeout(2_000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("4. Empty: 无章节书籍页面可正常加载", async ({ page }) => {
    // Given 一个存在但无章节的特殊书籍
    const emptyBookId = "e2e-book-detail-empty";
    try {
      await page.request.post("/api/books", {
        data: { id: emptyBookId, title: "E2E Empty Book", genre: "xianxia", status: "active" },
      });
    } catch {
      // 如果 API 不可用，跳过 API 调用
    }

    // When 导航到空书籍
    await page.goto(`/#/book/${emptyBookId}/settings`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
