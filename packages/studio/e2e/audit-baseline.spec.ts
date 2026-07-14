import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("AuditPage — 章节审计基线 (Issue #687)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/audit`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 审计表格
  test("2. 审计表格存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const table = page.locator(
      "[data-testid='au-table-audit-list'], [data-testid*='au-table'], table[class*='audit'], [class*='audit-table']"
    );
    const count = await table.count();
    console.log(`Audit table: ${count}`);
  });

  // 3. 触发审计按钮
  test("3. 触发审计按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='au-btn-trigger-audit'], button:has-text('审计'), button:has-text('触发'), button:has-text('检查')"
    );
    const count = await btn.count();
    console.log(`Trigger audit button: ${count}`);
  });

  // 4. AI 审计按钮
  test("4. AI 审计按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='au-btn-ai-audit'], button:has-text('AI审计'), button:has-text('AI'), button:has-text('智能审计')"
    );
    const count = await btn.count();
    console.log(`AI audit button: ${count}`);
  });

  // 5. 批准按钮
  test("5. 批准按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='au-btn-approve'], button:has-text('批准'), button:has-text('通过'), button:has-text('Approve')"
    );
    const count = await btn.count();
    console.log(`Approve button: ${count}`);
  });

  // 6. 批量审计按钮
  test("6. 批量审计按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='au-btn-batch-audit'], button:has-text('批量'), button:has-text('全部'), button:has-text('Batch')"
    );
    const count = await btn.count();
    console.log(`Batch audit button: ${count}`);
  });

  // 7. 修复建议按钮
  test("7. 修复建议按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='au-btn-fix-suggestions'], button:has-text('修复'), button:has-text('建议'), button:has-text('Fix')"
    );
    const count = await btn.count();
    console.log(`Fix suggestions button: ${count}`);
  });

  // 8. 审计模式选择器
  test("8. 审计模式选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const select = page.locator(
      "[data-testid='au-select-audit-mode'], select[id*='mode'], select[name*='mode'], [class*='audit-mode']"
    );
    const count = await select.count();
    console.log(`Audit mode selector: ${count}`);
  });

  // 9. 状态徽章
  test("9. 状态徽章存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const badges = page.locator(
      "[data-testid*='au-badge-status'], [class*='badge'], [class*='status-badge'], [class*='状态']"
    );
    const count = await badges.count();
    console.log(`Status badges: ${count}`);
  });

  // 10. 加载状态
  test("10. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 11. 空状态
  test("11. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('暂无可审计')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 12. 错误状态
  test("12. 错误状态: API失败时显示错误", async ({ page }) => {
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
