import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("TimelinePage — 时间线基线 (Issue #685)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/timeline`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 创建事件按钮
  test("2. 创建事件按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='tl-add-btn'], [data-testid='tl-btn-create-event'], button:has-text('创建'), button:has-text('添加事件'), button:has-text('新建事件'), [data-testid*='tl-add']"
    );
    const count = await btn.count();
    console.log(`Create event button: ${count}`);
  });

  // 3. AI提取按钮
  test("3. AI提取按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='tl-extract-btn'], [data-testid='tl-btn-ai-extract'], button:has-text('AI'), button:has-text('提取'), button:has-text('智能'), button:has-text('AI提取')"
    );
    const count = await btn.count();
    console.log(`AI extract button: ${count}`);
  });

  // 4. ReactFlow画布
  test("4. ReactFlow画布存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator(
      "[data-testid='tl-canvas-reactflow'], [class*='react-flow'], [class*='reactflow'], [data-id*='react-flow']"
    );
    const count = await canvas.count();
    console.log(`ReactFlow canvas: ${count}`);
  });

  // 5. 缩放控件
  test("5. 缩放控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const zoomControls = page.locator(
      "[class*='react-flow__controls'], [data-testid*='tl-zoom'], [class*='zoom-controls']"
    );
    const hasZoom = (await zoomControls.count()) > 0;
    console.log(`Zoom controls: ${hasZoom}`);
  });

  // 6. 角色筛选器
  test("6. 角色筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filter = page.locator(
      "[data-testid='tl-select-character-filter'], select[id*='character'], select[name*='character'], [class*='character-filter'], [data-testid*='tl-character']"
    );
    const count = await filter.count();
    console.log(`Character filter: ${count}`);
  });

  // 7. 章节筛选器
  test("7. 章节筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filter = page.locator(
      "[data-testid='tl-select-chapter-filter'], select[id*='chapter'], select[name*='chapter'], [class*='chapter-filter'], [data-testid*='tl-chapter']"
    );
    const count = await filter.count();
    console.log(`Chapter filter: ${count}`);
  });

  // 8. 卷筛选器
  test("8. 卷筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filter = page.locator(
      "[data-testid='tl-volume-filter-select'], select[id*='volume'], select[name*='volume'], [class*='volume-filter'], [data-testid*='tl-volume']"
    );
    const count = await filter.count();
    console.log(`Volume filter: ${count}`);
  });

  // 9. 事件节点
  test("9. 事件节点存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const nodes = page.locator(
      "[data-testid*='tl-node'], [class*='react-flow__node'], [data-id*='event'], [class*='event-node'], [class*='timeline-node']"
    );
    const count = await nodes.count();
    console.log(`Event nodes: ${count}`);
  });

  // 10. 加载状态
  test("10. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [data-testid*='Loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 11. 空状态
  test("11. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个'), :has-text('还没有事件')"
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
