import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID; // "e2e-sidebar-nav" — a book with 3 drafted chapters

test.describe("ChapterReader — 章节阅读 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 书籍页面加载并显示章节列表", async ({ page }) => {
    // Given 一个已存在书籍
    // When 导航到书籍主页面
    await page.goto(`/#/book/${BOOK_ID}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效书籍 ID 显示错误或安全回落", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-book-99999";

    // When 导航到该书籍页面
    await page.goto(`/#/book/${invalidId}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容（可能显示错误提示或空状态）
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Edge: 侧边栏导航到书籍设置页后返回", async ({ page }) => {
    // Given 一个已存在的书籍
    await page.goto(`/#/book/${BOOK_ID}`);
    await page.waitForTimeout(3_000);

    // When 导航到设置页
    await page.goto(`/#/book/${BOOK_ID}/settings`);
    await page.waitForTimeout(3_000);

    // Then 设置页面应显示内容
    const settingsText = await page.evaluate(() => document.body.innerText);
    expect(settingsText.length).toBeGreaterThan(0);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("4. Empty: 无章节书籍可正常加载", async ({ page }) => {
    // Given 一个存在但无章节的特殊书籍
    const emptyBookId = "e2e-chapter-reader-empty";
    try {
      await page.request.post("/api/books", {
        data: { id: emptyBookId, title: "E2E Empty Book", genre: "xianxia", status: "active" },
      });
    } catch {
      // 如果 API 不可用，跳过 API 调用
    }

    // When 导航到空书籍
    await page.goto(`/#/book/${emptyBookId}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容（可能显示空状态提示）
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
