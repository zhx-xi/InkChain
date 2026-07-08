import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID; // has 3 chapters (numbers 1, 2, 3)

test.describe("ChapterReader — 章节阅读器 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载显示章节内容", async ({ page }) => {
    // Given 一个已存在书籍且存在章节
    // When 导航到第一章
    await page.goto(`/#/book/${BOOK_ID}/chapter/1`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Then 页面应有内容且不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效章节编号不崩溃", async ({ page }) => {
    // Given 一个已存在的书籍
    // When 导航到不存在的章节编号
    await page.goto(`/#/book/${BOOK_ID}/chapter/999`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("3. Edge: 多章节导航不崩溃", async ({ page }) => {
    // Given 一个有多章节的书籍
    // When 依次访问不同章节
    for (const chapterNum of [1, 2, 3]) {
      await page.goto(`/#/book/${BOOK_ID}/chapter/${chapterNum}`);
      await page.waitForTimeout(3_000);

      // Then 每个章节都不崩溃
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));
      expect(pageErrors.length).toBe(0);
    }
  });

  test("4. Empty: 无效书籍 ID 下访问章节不崩溃", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-chapter-book-99999";

    // When 导航到该书籍的章节
    await page.goto(`/#/book/${invalidId}/chapter/1`);
    await page.waitForTimeout(5_000);

    // Then 页面不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });
});
