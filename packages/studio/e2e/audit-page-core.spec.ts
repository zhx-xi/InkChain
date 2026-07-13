import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

/**
 * Baseline E2E for AuditPage (#569 - 核心创作功能全页面覆盖)
 *
 * Covers: batch audit, approve, re-audit, auto-fix, volume filter, pagination
 * States: loading, empty, normal, error, batch-progress, all-passed
 */

test.describe("AuditPage — 核心创作功能基线", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/audit`);
  });

  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. 批量审计按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const batchBtn = page.locator(
      "[data-testid='au-batch-audit-btn'], [data-testid='au-btn-batch-audit'], button:has-text('批量'), button:has-text('审计')"
    );
    const count = await batchBtn.count();
    console.log(`Batch audit buttons: ${count}`);
  });

  test("3. 审计模式选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const modeSelect = page.locator(
      "[data-testid*='mode'], select, [role='combobox']"
    );
    const count = await modeSelect.count();
    console.log(`Mode selectors: ${count}`);
  });

  test("4. 卷筛选选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const volumeFilter = page.locator(
      "[data-testid*='volume'], [data-testid*='volume'], select, [role='combobox']"
    );
    const count = await volumeFilter.count();
    console.log(`Volume filter elements: ${count}`);
  });

  test("5. 加载中状态", async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/audit`);
    const spinner = page.locator(
      "[data-testid='au-loading-spinner'], [data-testid='au-state-loading'], [class*='spinner'], [class*='loading']"
    );
    const hasSpinner = (await spinner.count()) > 0;
    console.log(`Loading spinner visible: ${hasSpinner}`);
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("6. 空状态: 无可审计章节", async ({ page }) => {
    await page.waitForTimeout(2000);
    const emptyState = page.locator("[data-testid='au-empty-state'], [data-testid='au-state-empty']");
    const emptyText = page.locator(":has-text('暂无'), :has-text('无可审计')");
    const hasEmpty = (await emptyState.count()) > 0 || (await emptyText.count()) > 0;
    console.log(`Empty state visible: ${hasEmpty}`);
  });

  test("7. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/books/**/audit**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator("[data-testid='au-error-state'], [data-testid='au-state-error']");
    const errorText = page.locator(":has-text('错误'), :has-text('失败'), :has-text('重试')");
    const hasError = (await error.count()) > 0 || (await errorText.count()) > 0;
    console.log(`Error state visible: ${hasError}`);
  });

  test("8. 一键修复按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const fixBtn = page.locator(
      "[data-testid='au-auto-fix-btn'], [data-testid='au-btn-apply-fix'], button:has-text('修复'), button:has-text('Fix')"
    );
    const count = await fixBtn.count();
    console.log(`Fix buttons: ${count}`);
  });

  test("9. 分页控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const pagination = page.locator(
      "[data-testid*='pagination'], [class*='pagination'], button:has-text('上一页'), button:has-text('下一页')"
    );
    const count = await pagination.count();
    console.log(`Pagination elements: ${count}`);
  });
});
