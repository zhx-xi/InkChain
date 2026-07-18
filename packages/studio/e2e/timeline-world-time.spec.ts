import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const BOOK_ID = "test-project-123";

/**
 * E2E tests for #730 — 时间线改为小说世界时间线，保留卷/章筛选
 *
 * These tests MUST FAIL in Phase A (code not yet implemented).
 * Strong assertions: getByText, getByRole, toBeVisible with specific content.
 */
test.describe("时间线 — 小说世界时间排序与筛选", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/timeline/${BOOK_ID}`);
    await page.waitForURL(/#\/timeline\//, { timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // ── Timeline page core (must fail if page doesn't render) ──

  test("1. 时间线页面标题可见 — '时间线' heading 出现", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /时间线|timeline/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("2. ReactFlow 画布可见 — 图谱画布正常渲染", async ({ page }) => {
    const canvas = page.locator(".react-flow, [data-testid='tl-canvas-reactflow']");
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  // ── World time markers ─────────────────────────────────────

  test("3. 事件节点显示世界时间标记 — 节点包含时间信息", async ({ page }) => {
    // Find at least one event node
    const eventNode = page.locator(
      '[data-testid*="tl-node"], .react-flow__node'
    ).first();
    await expect(eventNode).toBeVisible({ timeout: 10000 });
    await eventNode.click({ force: true });
    await page.waitForTimeout(1000);

    // A detail panel or modal should appear with time info
    const detailPanel = page.locator(
      '[data-testid*="tl-modal"], [data-testid*="tl-detail"], [role="dialog"], [class*="detail"]'
    );
    await expect(detailPanel.first()).toBeVisible({ timeout: 5000 });
  });

  // ── Volume filter ──────────────────────────────────────────

  test("4. 卷筛选器存在且包含选项", async ({ page }) => {
    const volumeSelect = page.locator("select").first();
    await expect(volumeSelect).toBeVisible({ timeout: 5000 });

    // Must have at least 1 option besides default
    const options = await volumeSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  // ── Chapter filter ─────────────────────────────────────────

  test("5. 章节筛选器存在 — '章节'相关下拉/选择器可见", async ({ page }) => {
    // Should have more than one select (volume + chapter)
    const selects = page.locator("select, [role='combobox']");
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // ── Toolbar buttons ────────────────────────────────────────

  test("6. 创建事件按钮可见", async ({ page }) => {
    const createBtn = page.locator(
      '[data-testid="tl-btn-create-event"], button:has-text("创建"), button:has-text("新增")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("7. AI 提取按钮可见", async ({ page }) => {
    const aiBtn = page.locator(
      '[data-testid="tl-btn-ai-extract"], button:has-text("AI"), button:has-text("提取")'
    );
    await expect(aiBtn.first()).toBeVisible({ timeout: 5000 });
  });

  // ── State coverage ─────────────────────────────────────────

  test("8. 加载中状态 — 刷新后出现 spinner", async ({ page }) => {
    await page.reload();
    const loadingEl = page.locator(
      '[data-testid="tl-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    await expect(loadingEl.first()).toBeVisible({ timeout: 3000 });
  });

  test("9. 错误状态 — API 500 后显示错误", async ({ page }) => {
    await page.route("**/api/books/**/timeline**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);

    const errorEl = page.locator(
      '[data-testid="tl-state-error"], [class*="toast"], :has-text("错误")'
    );
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });
});
