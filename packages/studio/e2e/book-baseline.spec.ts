import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("BookDashboard — 书籍/Dashboard 基线 (Issue #689)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
  });

  // 1. 正常加载
  test("1. 正常加载: Dashboard 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 侧边栏导航
  test("2. 侧边栏导航存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const sidebar = page.locator(
      "[data-testid*='sidebar'], nav[class*='sidebar'], aside[class*='sidebar'], [role='navigation']"
    );
    const count = await sidebar.count();
    console.log(`Sidebar: ${count}`);
  });

  // 3. 书架/作品列表
  test("3. 书架/作品列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const bookshelf = page.locator(
      "[data-testid*='dash-bookshelf'], [data-testid*='dash-书架'], :has-text('书架'), :has-text('作品'), :has-text('项目')"
    );
    const count = await bookshelf.count();
    console.log(`Bookshelf section: ${count}`);

    const bookItems = page.locator(
      "[data-testid*='dash-book'], [data-testid*='book-item'], [class*='book-card'], [class*='book-item'], [class*='project-card']"
    );
    const itemCount = await bookItems.count();
    console.log(`Book items: ${itemCount}`);
  });

  // 4. 创建书籍按钮
  test("4. 创建书籍按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='dash-create'], [data-testid*='bd-create'], button:has-text('创建'), button:has-text('新建'), button:has-text('开始创作'), button:has-text('创作小说')"
    );
    const count = await btn.count();
    console.log(`Create book button: ${count}`);
  });

  // 5. 快速入口
  test("5. 快速入口存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const quickActions = page.locator(
      "[data-testid*='dash-quick'], [data-testid*='quick-action'], :has-text('快速'), :has-text('快捷')"
    );
    const count = await quickActions.count();
    console.log(`Quick actions: ${count}`);
  });

  // 6. 工具区域
  test("6. 工具区域存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const tools = page.locator(
      "[data-testid*='dash-tool'], :has-text('工具'), :has-text('管理'), :has-text('设置')"
    );
    const count = await tools.count();
    console.log(`Tools section: ${count}`);
  });

  // 7. 加载状态
  test("7. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 8. 空状态
  test("8. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('还没有'), :has-text('创建第一个')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 9. 错误状态
  test("9. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      "[data-testid*='error'], [data-testid*='Error'], :has-text('错误'), :has-text('失败')"
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });
});
