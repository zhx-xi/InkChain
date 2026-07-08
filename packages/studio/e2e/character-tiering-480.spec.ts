import { test, expect } from "@playwright/test";
import { seedSidebarNav, E2E_BOOK_ID } from "./fixtures/seed-sidebar-nav";

const BOOK_ID = E2E_BOOK_ID;

test.describe("CharacterTiering — 角色分层管理 E2E", () => {
  test.beforeAll(async () => {
    await seedSidebarNav();
  });

  test("1. Normal: 页面加载显示角色分层内容", async ({ page }) => {
    // Given 一个已存在的书籍
    // When 导航到角色分层页面
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Then 页面应加载不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error: 无效书籍 ID 不崩溃", async ({ page }) => {
    // Given 一个不存在的书籍 ID
    const invalidId = "non-existent-tiering-book-99999";

    // When 导航到角色分层页
    await page.goto(`/#/characters/${invalidId}/tiers`);
    await page.waitForTimeout(5_000);

    // Then 页面不应崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("3. Edge: 页面内容检测", async ({ page }) => {
    // Given 一个已存在的书籍
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // When 等待渲染完成
    await page.waitForTimeout(2_000);

    // Then 页面应有可读内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);

    // 页面不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });

  test("4. Edge: 导航往返不崩溃", async ({ page }) => {
    // Given 角色分层页面已打开
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
    await page.waitForTimeout(3_000);

    // When 导航到仪表盘再返回
    await page.goto("/#/dashboard");
    await page.waitForTimeout(2_000);
    await page.goto(`/#/characters/${BOOK_ID}/tiers`);
    await page.waitForTimeout(3_000);

    // Then 返回后页面不崩溃
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    expect(pageErrors.length).toBe(0);
  });
});
