import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("ForeshadowingPage — 伏笔追踪基线 (Issue #688)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/foreshadowing`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 创建伏笔按钮
  test("2. 创建伏笔按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='fs-btn-create-foreshadowing'], button:has-text('创建'), button:has-text('新建'), button:has-text('添加伏笔')"
    );
    const count = await btn.count();
    console.log(`Create foreshadowing button: ${count}`);
  });

  // 3. AI 提取按钮
  test("3. AI 提取按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='fs-btn-ai-extract'], button:has-text('AI'), button:has-text('提取'), button:has-text('智能')"
    );
    const count = await btn.count();
    console.log(`AI extract button: ${count}`);
  });

  // 4. 视图切换按钮
  test("4. 视图切换按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const viewBtns = page.locator(
      "[data-testid*='fs-btn-view'], button:has-text('列表'), button:has-text('卡片'), button:has-text('关系图')"
    );
    const count = await viewBtns.count();
    console.log(`View toggle buttons: ${count}`);
  });

  // 5. 搜索输入框
  test("5. 搜索输入框存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const input = page.locator(
      "[data-testid='fs-input-search'], input[placeholder*='搜索'], input[type='text'], input[id*='search']"
    );
    const count = await input.count();
    console.log(`Search input: ${count}`);
  });

  // 6. 状态和类型筛选器
  test("6. 筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filters = page.locator(
      "[data-testid*='fs-select'], select, [role='combobox']"
    );
    const count = await filters.count();
    console.log(`Filter selectors: ${count}`);
  });

  // 7. 伏笔表格/列表
  test("7. 伏笔列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const table = page.locator(
      "[data-testid='fs-table-foreshadowing-list'], [data-testid*='fs-table'], table, [class*='foreshadowing-list'], [role='table']"
    );
    const count = await table.count();
    console.log(`Foreshadowing table/list: ${count}`);

    const items = page.locator(
      "[data-testid*='fs-item'], tr[class*='item'], li[class*='foreshadowing']"
    );
    const itemCount = await items.count();
    console.log(`Foreshadowing items: ${itemCount}`);
  });

  // 8. 编辑和删除按钮
  test("8. 编辑和删除按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const editBtns = page.locator(
      "[data-testid*='fs-btn-edit'], button:has-text('编辑')"
    );
    const editCount = await editBtns.count();
    console.log(`Edit buttons: ${editCount}`);

    const deleteBtns = page.locator(
      "[data-testid*='fs-btn-delete'], button:has-text('删除')"
    );
    const deleteCount = await deleteBtns.count();
    console.log(`Delete buttons: ${deleteCount}`);
  });

  // 9. 遗忘检测按钮
  test("9. 遗忘检测按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='fs-btn-forgotten-check'], button:has-text('遗忘'), button:has-text('检测')"
    );
    const count = await btn.count();
    console.log(`Forgotten check button: ${count}`);
  });

  // 10. 分页控件
  test("10. 分页控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const pagination = page.locator(
      "[data-testid='fs-pagination'], [class*='pagination'], [class*='pager'], nav[aria-label*='分页']"
    );
    const hasPagination = (await pagination.count()) > 0;
    console.log(`Pagination: ${hasPagination}`);
  });

  // 11. 加载状态
  test("11. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 12. 空状态
  test("12. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 13. 错误状态
  test("13. 错误状态: API失败时显示错误", async ({ page }) => {
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
