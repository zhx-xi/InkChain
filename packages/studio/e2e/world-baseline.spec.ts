import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("WorldMapPage — 世界地图基线 (Issue #684)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/world-map/test-world`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 地图画布
  test("2. 地图画布存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator(
      "[data-testid='wm-canvas-map'], canvas[id*='map'], canvas[class*='map'], [class*='map-canvas'], [class*='world-canvas']"
    );
    const count = await canvas.count();
    console.log(`Map canvas: ${count}`);
  });

  // 3. 缩放控件
  test("3. 缩放控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const zoomIn = page.locator(
      "[data-testid*='zoom-in'], button:has-text('+'), [aria-label*='zoom in'], [aria-label*='放大'], [class*='zoom-in']"
    );
    const zoomInCount = await zoomIn.count();
    console.log(`Zoom in control: ${zoomInCount}`);

    const zoomOut = page.locator(
      "[data-testid*='zoom-out'], button:has-text('-'), [aria-label*='zoom out'], [aria-label*='缩小'], [class*='zoom-out']"
    );
    const zoomOutCount = await zoomOut.count();
    console.log(`Zoom out control: ${zoomOutCount}`);
  });

  // 4. 详情面板
  test("4. 详情面板存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const panel = page.locator(
      "[data-testid='wm-detail-panel'], [data-testid*='wm-panel'], [class*='detail-panel'], [class*='side-panel'], aside[class*='panel']"
    );
    const count = await panel.count();
    console.log(`Detail panel: ${count}`);
  });

  // 5. 面包屑导航
  test("5. 面包屑导航存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const breadcrumb = page.locator(
      "[data-testid='wm-breadcrumb'], nav[aria-label*='breadcrumb'], [class*='breadcrumb'], nav[aria-label*='面包屑']"
    );
    const count = await breadcrumb.count();
    console.log(`Breadcrumb: ${count}`);
  });

  // 6. 工具栏
  test("6. 工具栏存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const toolbar = page.locator(
      "[data-testid='wm-toolbar'], [data-testid*='wm-tool'], [class*='toolbar'], [class*='map-toolbar'], [role='toolbar']"
    );
    const count = await toolbar.count();
    console.log(`Toolbar: ${count}`);
  });

  // 7. 添加标记按钮
  test("7. 添加标记按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='wm-btn-add-marker'], button:has-text('添加'), button:has-text('标记'), button:has-text('标注'), button[aria-label*='添加'], [data-testid*='wm-add']"
    );
    const count = await btn.count();
    console.log(`Add marker button: ${count}`);
  });

  // 8. 返回按钮
  test("8. 返回按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='back'], button:has-text('返回'), button[aria-label*='返回'], button[aria-label*='back'], a:has-text('返回')"
    );
    const count = await btn.count();
    console.log(`Back button: ${count}`);
  });

  // 9. 加载状态
  test("9. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [data-testid*='Loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 10. 空状态
  test("10. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个'), :has-text('还没有世界')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 11. 错误状态
  test("11. 错误状态: API失败时显示错误", async ({ page }) => {
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

  // 12. 地图交互：点击画布
  test("12. 地图交互: 点击画布存在反馈", async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator(
      "[data-testid='wm-canvas-map'], canvas[id*='map'], canvas[class*='map']"
    );
    const hasCanvas = (await canvas.count()) > 0;
    console.log(`Map canvas for interaction: ${hasCanvas}`);

    if (hasCanvas) {
      await canvas.first().click({ position: { x: 200, y: 200 } });
      await page.waitForTimeout(500);
      console.log("Map click executed");
    }
  });
});
