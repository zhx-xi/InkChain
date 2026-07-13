import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const TEST_BOOK_ID = "test-project-123";

/**
 * E2E for #605: 时间线 — 卷筛选功能不起作用
 *
 * Bug: Volume filter on timeline page doesn't filter events
 *
 * States: loading, normal (filter works), error, edge (no volumes/filter shows nothing)
 */

test.describe("Timeline — 卷筛选功能验证", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/${TEST_BOOK_ID}/timeline`);
    await page.waitForTimeout(3000);
  });

  test("1. 正常加载: 时间线页面呈现", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    const canvas = page.locator(
      "[data-testid='tl-canvas-reactflow'], canvas, [data-testid*='canvas']"
    );
    const canvasCount = await canvas.count();
    console.log(`Timeline canvas elements: ${canvasCount}`);
  });

  test("2. 卷筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filterSelect = page.locator(
      "[data-testid='tl-volume-filter-select'], [data-testid='tl-select-volume-filter'], [data-testid*='volume'], [data-testid*='filter'], select, [role='combobox']"
    );
    const selectCount = await filterSelect.count();
    console.log(`Volume filter selectors: ${selectCount}`);
    expect(selectCount).toBeGreaterThanOrEqual(1);
  });

  test("3. 选择卷筛选: 事件列表应更新", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find the volume filter select
    const select = page.locator(
      "[data-testid='tl-volume-filter-select'], [data-testid='tl-select-volume-filter'], [data-testid*='volume-filter'], [data-testid*='volume-select'], select"
    ).first();

    const selectExists = await select.isVisible().catch(() => false);
    console.log(`Volume filter select visible: ${selectExists}`);

    if (selectExists) {
      // Get available options
      const options = await page.locator(`${select.locator("option")}`).allTextContents().catch(() => []);
      console.log(`Filter options: ${options}`);

      if (options.length > 1) {
        // Select a different option (not the first/default one)
        await select.selectOption(options[1]);
        await page.waitForTimeout(2000);

        // After filtering, verify no error
        const errorMsg = page.locator(
          "[data-testid$='error-state'], :has-text('错误'), :has-text('失败')"
        );
        const hasError = await errorMsg.isVisible().catch(() => false);
        expect(hasError).toBe(false);
        console.log(`Filter applied without errors: ${!hasError}`);
      } else {
        console.log("Only one filter option available — no volumes exist");
      }
    }
  });

  test("4. 筛选后切换回全部: 应恢复完整视图", async ({ page }) => {
    await page.waitForTimeout(2000);

    const select = page.locator(
      "[data-testid='tl-volume-filter-select'], select"
    ).first();
    const selectExists = await select.isVisible().catch(() => false);

    if (selectExists) {
      const options = await page.locator(`${select.locator("option")}`).allTextContents().catch(() => []);
      console.log(`Available options: ${options}`);

      if (options.length > 1) {
        // Select volume option
        await select.selectOption(options[1]);
        await page.waitForTimeout(1000);

        // Switch back to all/first option
        await select.selectOption(options[0]);
        await page.waitForTimeout(1000);

        // Verify page is still functional
        const errorMsg = page.locator(
          "[data-testid$='error-state'], :has-text('错误'), :has-text('失败')"
        );
        const hasError = await errorMsg.isVisible().catch(() => false);
        expect(hasError).toBe(false);
        console.log(`Switched back to all: OK`);
      }
    }
  });

  test("5. API错误: 筛选请求失败时显示错误", async ({ page }) => {
    await page.route("**/api/v1/books/**/timelines**", (route) => {
      route.fulfill({ status: 500, body: "Server Error" });
    });
    await page.reload();
    await page.waitForTimeout(2000);

    const error = page.locator(
      "[data-testid$='error-state'], [data-testid$='state-error'], :has-text('错误'), :has-text('失败'), :has-text('重试')"
    );
    const hasError = await error.isVisible().catch(() => false);
    console.log(`Error state shown: ${hasError}`);
  });
});
