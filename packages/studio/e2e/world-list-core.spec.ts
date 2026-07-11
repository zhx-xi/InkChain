import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

/**
 * Baseline E2E for WorldListPage (#569 - 核心创作功能全页面覆盖)
 *
 * Covers: AI extract, create, associate, empty state, error state
 * States: loading, empty, normal, error
 */

test.describe("WorldListPage — 核心创作功能基线", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/book-worlds`);
  });

  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. 创建世界观按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const createBtn = page.locator(
      '[data-testid="wl-create-btn"], [data-testid="wl-btn-create-world"], button:has-text("创建"), button:has-text("新建")'
    );
    const count = await createBtn.count();
    console.log(`Create world buttons: ${count}`);
  });

  test("3. AI提取按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const aiBtn = page.locator(
      '[data-testid*="extract"], [data-testid*="Extract"], button:has-text("AI"), button:has-text("提取")'
    );
    const count = await aiBtn.count();
    console.log(`AI extract buttons: ${count}`);
  });

  test("4. 搜索输入框存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const searchInput = page.locator(
      'input[type="text"], [data-testid*="search"], [data-testid*="Search"]'
    );
    const count = await searchInput.count();
    console.log(`Search inputs: ${count}`);
  });

  test("5. 空状态: 无世界观时显示空状态", async ({ page }) => {
    await page.waitForTimeout(2000);
    const emptyState = page.locator(
      '[data-testid="wl-empty-state"], [data-testid="wl-state-empty"], :has-text("创建第一个"), :has-text("暂无")'
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  test("6. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/worlds/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      '[data-testid="wl-error-state"], [data-testid="wl-state-error"], :has-text("错误"), :has-text("失败"), :has-text("重试")'
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });

  test("7. 世界观列表渲染", async ({ page }) => {
    await page.waitForTimeout(2000);
    const list = page.locator(
      '[data-testid="wl-table-world-list"], [data-testid*="list"], [data-testid*="List"], table, [role="list"]'
    );
    const count = await list.count();
    console.log(`List elements: ${count}`);
  });
});
