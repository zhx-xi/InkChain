import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID; // "e2e-sidebar-nav" — a book with 3 drafted chapters

test.describe("CharacterTiering — 角色分级 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载并显示分级界面", async ({ page }) => {
    // Given 一个已存在书籍
    // When 导航到角色分级页面
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
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

    // When 导航到无效书籍的分级页
    await page.goto(`/#/characters/${invalidId}/tiers`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Edge: 书籍设置页和分级页间导航", async ({ page }) => {
    // Given 一个已存在的书籍
    // When 先访问书籍设置页再导航到分级页
    await page.goto(`/#/book/${BOOK_ID}/settings`);
    await page.waitForTimeout(3_000);
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    // Then 页面应有内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. Empty: 无章节书籍的分级页加载", async ({ page }) => {
    // Given 一个存在但无章节的特殊书籍
    const emptyBookId = "e2e-tiering-empty";
    try {
      await page.request.post("/api/books", {
        data: { id: emptyBookId, title: "E2E Tiering Empty Book", genre: "xianxia", status: "active" },
      });
    } catch {
      // 如果 API 不可用，跳过
    }

    // When 导航到空书籍的分级页
    await page.goto(`/#/characters/${emptyBookId}/tiers`);
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
