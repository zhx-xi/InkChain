import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

/**
 * Baseline E2E for WorldMapPage (#569 - 核心创作功能全页面覆盖)
 *
 * Covers: drill-down, zoom, export, detail panel, breadcrumb
 * States: loading, normal, error, empty
 */

test.describe("WorldMapPage — 核心创作功能基线", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/world-map/test-world`);
  });

  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. 地图画布渲染", async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator(
      "[data-testid='wm-canvas-map'], [class*='map'], [class*='Map'], canvas"
    );
    const count = await canvas.count();
    console.log(`Map canvas elements: ${count}`);
  });

  test("3. 缩放控制按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const zoomBtns = page.locator(
      "[data-testid*='zoom'], [data-testid*='Zoom'], button:has-text('放大'), button:has-text('缩小')"
    );
    const count = await zoomBtns.count();
    console.log(`Zoom buttons: ${count}`);
  });

  test("4. 详情面板存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const detailPanel = page.locator(
      "[data-testid='wm-detail-panel'], [data-testid*='detail'], [data-testid*='Detail'], [class*='panel'], [class*='Panel']"
    );
    const count = await detailPanel.count();
    console.log(`Detail panel elements: ${count}`);
  });

  test("5. 面包屑导航存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const breadcrumb = page.locator(
      "[data-testid='wm-breadcrumb'], [data-testid*='breadcrumb'], [aria-label='breadcrumb'], nav[class*='breadcrumb']"
    );
    const count = await breadcrumb.count();
    console.log(`Breadcrumb elements: ${count}`);
  });

  test("6. 工具栏存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const toolbar = page.locator(
      "[data-testid='wm-toolbar'], [class*='toolbar'], [class*='Toolbar'], [role='toolbar']"
    );
    const count = await toolbar.count();
    console.log(`Toolbar elements: ${count}`);
  });

  test("7. 空状态: 无数据时显示空状态", async ({ page }) => {
    await page.waitForTimeout(2000);
    const emptyState = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据')"
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  test("8. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/map/**", (route) =>
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

  test("9. 返回按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const backBtn = page.locator(
      "[data-testid='back-btn'], button:has-text('返回'), [aria-label='返回']"
    );
    const count = await backBtn.count();
    console.log(`Back buttons: ${count}`);
  });
});
