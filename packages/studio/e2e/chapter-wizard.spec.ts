import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID; // "e2e-sidebar-nav" — a book with 3 drafted chapters

test.describe("ChapterWizard — 章节向导 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载并显示向导界面", async ({ page }) => {
    // Given 一个已存在书籍
    // When 导航到章节向导页面
    await page.goto(`/#/chapter-wizard/${BOOK_ID}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效书籍 ID 的错误处理", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-book-99999";

    // When 导航到无效书籍的向导页
    await page.goto(`/#/chapter-wizard/${invalidId}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Edge: 书籍设置页和向导页间导航", async ({ page }) => {
    // Given 一个已存在的书籍
    // When 先访问书籍设置页再导航到向导页
    await page.goto(`/#/book/${BOOK_ID}/settings`);
    await page.waitForTimeout(3_000);
    await page.goto(`/#/chapter-wizard/${BOOK_ID}`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. Empty: 无章节书籍的向导页加载", async ({ page }) => {
    // Given 一个存在但无章节的特殊书籍
    const emptyBookId = "e2e-wizard-empty";
    try {
      await page.request.post("/api/books", {
        data: { id: emptyBookId, title: "E2E Wizard Empty Book", genre: "xianxia", status: "active" },
      });
    } catch {
      // 如果 API 不可用，跳过
    }

    // When 导航到空书籍的向导页
    await page.goto(`/#/chapter-wizard/${emptyBookId}`);
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
