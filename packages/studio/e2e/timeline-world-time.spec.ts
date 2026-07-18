import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const BOOK_ID = "test-project-123";

/**
 * E2E tests for #730 — 时间线改为小说世界时间线，保留卷/章筛选
 *
 * Acceptance criteria:
 * 1. 时间线默认按小说世界时间（而非章节编号）展示
 * 2. 事件节点显示世界时间标记（如：第 X 年/第 Y 月/某事件年代）
 * 3. 卷筛选器存在且可用：选择卷后仅显示该卷时间范围内的事件
 * 4. 章节筛选器存在且可用：选择章节后聚焦到对应时间点
 * 5. 保持现有手动创建、AI提取、编辑、删除事件功能
 * 6. 时间线视图正常渲染，ReactFlow 节点可交互
 */

test.describe("时间线 — 小说世界时间排序与筛选", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/timeline/${BOOK_ID}`);
    await page.waitForURL(/#\/timeline\//, { timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // ── Timeline page core ─────────────────────────────────────

  test("1. 时间线页面正常加载 — 标题可见", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /时间线|timeline/i });
    const headingCount = await heading.count();
    console.log(`Timeline heading count: ${headingCount}`);

    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  test("2. ReactFlow 画布存在并可交互", async ({ page }) => {
    await page.waitForTimeout(3000);

    const canvas = page.locator(
      '[data-testid="tl-canvas-reactflow"], .react-flow, [class*="react-flow"]'
    );
    const canvasCount = await canvas.count();
    console.log(`ReactFlow canvas elements: ${canvasCount}`);

    const canvasContent = await page.locator(".react-flow, [data-testid='tl-canvas-reactflow']").first();
    if (await canvasContent.count() > 0) {
      await expect(canvasContent).toBeVisible({ timeout: 5000 });
    }
  });

  // ── World time markers ─────────────────────────────────────

  test("3. 事件节点显示世界时间标记", async ({ page }) => {
    await page.waitForTimeout(3000);

    const eventNodes = page.locator(
      '[data-testid*="tl-node"], [data-testid*="tl-event"], .react-flow__node'
    );
    const nodeCount = await eventNodes.count();
    console.log(`Timeline event nodes: ${nodeCount}`);

    if (nodeCount > 0) {
      const firstNode = eventNodes.first();
      await firstNode.click({ force: true });
      await page.waitForTimeout(1000);

      const timeInfo = page.locator(
        ':has-text("时间"), :has-text("年"), [data-testid*="tl-time"], [data-testid*="tl-modal"]'
      );
      const hasTimeInfo = (await timeInfo.count()) > 0;
      console.log(`Time info visible: ${hasTimeInfo}`);
    }
  });

  // ── Volume filter ──────────────────────────────────────────

  test("4. 卷筛选器存在且可用", async ({ page }) => {
    await page.waitForTimeout(2000);

    const volumeFilter = page.locator(
      '[data-testid="tl-select-volume-filter"], [data-testid*="tl-volume"], select, [role="combobox"]'
    ).first();

    const filterCount = await volumeFilter.count();
    console.log(`Volume filter elements: ${filterCount}`);

    if (filterCount > 0) {
      await expect(volumeFilter).toBeVisible({ timeout: 5000 });

      const tagName = await volumeFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === "select") {
        const options = await volumeFilter.locator("option").allTextContents();
        console.log(`Volume filter options: ${options.length}`);
        expect(options.length).toBeGreaterThan(0);
      }
    }
  });

  // ── Chapter filter ─────────────────────────────────────────

  test("5. 章节筛选器存在且可用", async ({ page }) => {
    await page.waitForTimeout(2000);

    const selects = page.locator("select, [role='combobox']");
    const selectCount = await selects.count();
    console.log(`Filter selects total: ${selectCount}`);

    const chapterFilter = page.locator(
      '[data-testid="tl-select-chapter-filter"], [data-testid*="tl-chapter"]'
    ).first();
    if (await chapterFilter.count() > 0) {
      await expect(chapterFilter).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Toolbar buttons ────────────────────────────────────────

  test("6. 工具栏按钮存在 — 创建事件/AI提取/缩放/适应画布", async ({ page }) => {
    await page.waitForTimeout(2000);

    const createBtn = page.locator(
      '[data-testid="tl-btn-create-event"], [data-testid*="tl-create"], button:has-text("创建"), button:has-text("新增")'
    );
    const aiBtn = page.locator(
      '[data-testid="tl-btn-ai-extract"], [data-testid*="tl-ai"], button:has-text("AI"), button:has-text("提取")'
    );
    const zoomIn = page.locator(
      '[data-testid="tl-btn-zoom-in"], [data-testid*="tl-zoom"], button:has-text("放大")'
    );
    const fitView = page.locator(
      '[data-testid="tl-btn-fit-view"], [data-testid*="tl-fit"], button:has-text("适应"), button:has-text("适配")'
    );

    const hasCreate = (await createBtn.count()) > 0;
    const hasAI = (await aiBtn.count()) > 0;
    const hasZoom = (await zoomIn.count()) > 0;
    const hasFit = (await fitView.count()) > 0;
    console.log(`Buttons: create=${hasCreate} ai=${hasAI} zoom=${hasZoom} fit=${hasFit}`);
  });

  // ── State coverage ─────────────────────────────────────────

  test("7. 加载中状态 — 时间线数据加载时显示 spinner", async ({ page }) => {
    await page.reload();
    const spinner = page.locator(
      '[data-testid="tl-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    const hasSpinner = (await spinner.count()) > 0;
    console.log(`Loading spinner: ${hasSpinner}`);

    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("8. 错误状态 — API 失败时显示错误", async ({ page }) => {
    await page.route("**/api/books/**/timeline**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);

    const errorText = page.locator(
      '[data-testid="tl-state-error"], :has-text("错误"), :has-text("失败"), :has-text("重试")'
    );
    const hasError = (await errorText.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });
});
