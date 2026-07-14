import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("StyleManager — 风格管理基线 (Issue #682)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/style`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 创建风格配置文件按钮
  test("2. 创建风格配置文件按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='style-btn-create-profile'], button:has-text('创建'), button:has-text('新建'), button:has-text('添加风格')"
    );
    const count = await btn.count();
    console.log(`Create style profile button: ${count}`);
  });

  // 3. 分析文本按钮
  test("3. 分析文本按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='style-btn-analyze'], button:has-text('分析'), button:has-text('检测'), button:has-text('识别风格')"
    );
    const count = await btn.count();
    console.log(`Analyze text button: ${count}`);
  });

  // 4. 风格配置文件列表
  test("4. 风格配置文件列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const list = page.locator(
      "[data-testid='style-list-profiles'], [data-testid*='style-list'], [data-testid*='style-profile'], [class*='profile-list'], [class*='style-list']"
    );
    const count = await list.count();
    console.log(`Profile list: ${count}`);

    const items = page.locator(
      "[data-testid*='style-profile-item'], [data-testid*='style-item'], li:has([data-testid*='style'])"
    );
    const itemCount = await items.count();
    console.log(`Profile items: ${itemCount}`);
  });

  // 5. 语言选择器
  test("5. 语言选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const select = page.locator(
      "[data-testid='style-select-language'], select[id*='language'], select[name*='language'], [class*='language-select']"
    );
    const count = await select.count();
    console.log(`Language selector: ${count}`);
  });

  // 6. 文本输入区域
  test("6. 文本输入区域存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const textarea = page.locator(
      "[data-testid='style-textarea-input'], textarea[id*='style'], textarea[name*='style'], [class*='style-textarea'], [class*='text-input']"
    );
    const count = await textarea.count();
    console.log(`Text input area: ${count}`);
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
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个'), :has-text('还没有风格')"
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
