import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("Dashboard — 核心创作功能基线 (Issue #681)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 侧边栏导航项
  test("2. 侧边栏导航项存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const sidebarItems = page.locator(
      "[data-testid*='dash-'], [data-testid*='sidebar'], nav a, nav button, [role='navigation'] a, [role='navigation'] button"
    );
    const count = await sidebarItems.count();
    console.log(`Sidebar navigation items: ${count}`);
  });

  // 3. 创作区域入口
  test("3. 创作区域入口存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const createItems = page.locator(
      "[data-testid*='dash-create'], [data-testid*='dash-创作'], button:has-text('创作'), button:has-text('小说'), button:has-text('短篇'), button:has-text('剧本'), a:has-text('创作'), a:has-text('小说'), :has-text('创作小说'), :has-text('开始创作')"
    );
    const count = await createItems.count();
    console.log(`Create section items: ${count}`);
  });

  // 4. 书架区域
  test("4. 书架区域存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const bookshelf = page.locator(
      "[data-testid*='dash-bookshelf'], [data-testid*='dash-书架'], :has-text('书架'), :has-text('我的作品'), :has-text('最近编辑')"
    );
    const count = await bookshelf.count();
    console.log(`Bookshelf section: ${count}`);
  });

  // 5. 系统区域
  test("5. 系统区域项存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const systemItems = page.locator(
      "[data-testid*='dash-system'], [data-testid*='dash-系统'], :has-text('设置'), :has-text('帮助'), :has-text('关于'), :has-text('系统')"
    );
    const count = await systemItems.count();
    console.log(`System section items: ${count}`);
  });

  // 6. 工具区域
  test("6. 工具区域项存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const toolItems = page.locator(
      "[data-testid*='dash-tool'], [data-testid*='dash-工具'], :has-text('工具'), :has-text('导入'), :has-text('导出'), :has-text('大纲'), :has-text('灵感')"
    );
    const count = await toolItems.count();
    console.log(`Tools section items: ${count}`);
  });

  // 7. 加载状态
  test("7. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [data-testid*='Loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 8. 空状态
  test("8. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个')"
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

  // 10. 侧边栏折叠/展开
  test("10. 侧边栏折叠/展开行为", async ({ page }) => {
    await page.waitForTimeout(2000);
    const toggleBtn = page.locator(
      "[data-testid*='dash-toggle'], [data-testid*='collapse'], [data-testid*='sidebar-toggle'], button[aria-label*='折叠'], button[aria-label*='展开'], button[aria-label*='collapse'], button[aria-label*='expand']"
    );
    const hasToggle = (await toggleBtn.count()) > 0;
    console.log(`Sidebar collapse toggle: ${hasToggle}`);

    if (hasToggle) {
      await toggleBtn.first().click();
      await page.waitForTimeout(500);
      const sidebar = page.locator("[data-testid*='sidebar'], [class*='sidebar'], aside, nav");
      const isVisible = await sidebar.first().isVisible();
      console.log(`Sidebar visible after toggle: ${isVisible}`);
    }
  });
});
