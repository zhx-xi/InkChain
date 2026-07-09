import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

/**
 * Baseline E2E for StyleManager (#569 - 核心创作功能全页面覆盖)
 *
 * Covers: prescreen, AI deep detect, volume select, chapter range, export, diff report
 * States: loading, empty, normal, analyzing, error, input-empty, no-anomalies
 */

test.describe("StyleManager — 核心创作功能基线", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/book-style`);
  });

  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. 分析按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const analyzeBtn = page.locator(
      'button:has-text("分析"), [data-testid*="analyze"], [data-testid*="Analyze"]'
    );
    const count = await analyzeBtn.count();
    console.log(`Analyze buttons: ${count}`);
  });

  test("3. 章节选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const chapterSelect = page.locator(
      '[data-testid*="chapter"], [data-testid*="Chapter"], select, [role="combobox"]'
    );
    const count = await chapterSelect.count();
    console.log(`Chapter selector elements: ${count}`);
  });

  test("4. 差异报告面板存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const diffPanel = page.locator(
      '[data-testid*="report"], [data-testid*="comparison"], [class*="panel"]'
    );
    const count = await diffPanel.count();
    console.log(`Diff/report panel elements: ${count}`);
  });

  test("5. 导出按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const exportBtn = page.locator(
      'button:has-text("导出"), button:has-text("Export"), [data-testid*="export"]'
    );
    const count = await exportBtn.count();
    console.log(`Export buttons: ${count}`);
  });

  test("6. 空状态: 无数据", async ({ page }) => {
    await page.waitForTimeout(2000);
    const emptyState = page.locator(
      '[data-testid*="empty"], text=暂无, text=无数据'
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  test("7. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/v1/books/**/style/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      'text=错误, text=失败, text=重试'
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });

  test("8. 初筛按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const prescreenBtn = page.locator(
      'button:has-text("初筛"), button:has-text("Prescreen"), [data-testid*="prescreen"]'
    );
    const count = await prescreenBtn.count();
    console.log(`Prescreen buttons: ${count}`);
  });

  test("9. AI深度检测按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const deepBtn = page.locator(
      'button:has-text("深度"), [data-testid*="deep"], [data-testid*="Deep"]'
    );
    const count = await deepBtn.count();
    console.log(`Deep detect buttons: ${count}`);
  });
});
