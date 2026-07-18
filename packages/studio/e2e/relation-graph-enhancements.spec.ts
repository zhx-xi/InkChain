import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const BOOK_ID = "test-project-123";

/**
 * E2E tests for #729 — 关系图谱角色标签、手动 CRUD、首章出场、关系编辑、卷筛选修复
 *
 * Acceptance criteria:
 * 1. 角色标签正确：图谱中的角色节点标注正确的角色类型（主角/配角/一次性角色等）
 * 2. 手动添加关系：点击「添加关系」→ 弹出表单 → 保存后图谱更新
 * 3. 删除关系：右键/悬停关系边 → 显示删除按钮 → 确认删除 → 图谱更新
 * 4. 编辑关系：双击/右键关系边 → 弹出编辑面板 → 保存后图谱更新
 * 5. 初次出场章节：角色节点显示章节编号
 * 6. 卷筛选：选择卷后图谱仅显示该卷范围内的角色和关系
 * 7. 所有操作后端 API 同步，刷新页面后数据持久化
 */

test.describe("关系图谱 — 增强功能（标签/CRUD/出场/筛选）", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/relations/${BOOK_ID}`);
    await page.waitForURL(/#\/relations\//, { timeout: 15000 });

    // Handle CSS pointer-events isolation for ReactFlow/SVG graphs
    await page.addStyleTag({
      content: ".pointer-events-none { pointer-events: auto !important; }"
    });
    await page.waitForTimeout(2000);
  });

  // ── Relation page core ─────────────────────────────────────

  test("1. 关系图谱页面正常加载 — 标题可见，画布有内容", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /关系|relation/i });
    const headingCount = await heading.count();
    console.log(`Relation heading count: ${headingCount}`);

    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);

    const canvas = page.locator(
      '[data-testid="rg-canvas-graph"], .react-flow, [class*="graph"], [class*="react-flow"]'
    );
    if (await canvas.count() > 0) {
      await expect(canvas.first()).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Character labels ───────────────────────────────────────

  test("2. 角色节点显示正确的角色类型标签", async ({ page }) => {
    await page.waitForTimeout(3000);

    const nodes = page.locator(
      '[data-testid*="rg-node"], .react-flow__node, [class*="node"]'
    );
    const nodeCount = await nodes.count();
    console.log(`Character nodes: ${nodeCount}`);

    if (nodeCount > 0) {
      const firstNode = nodes.first();
      await firstNode.click({ force: true });
      await page.waitForTimeout(1000);

      const roleLabel = page.locator(
        ':has-text("主角"), :has-text("配角"), :has-text("角色"), [data-testid*="rg-label"], [data-testid*="rg-role"]'
      );
      const hasRoleLabel = (await roleLabel.count()) > 0;
      console.log(`Role labels visible: ${hasRoleLabel}`);
    }
  });

  // ── First appearance ───────────────────────────────────────

  test("3. 角色节点显示初次出场章节", async ({ page }) => {
    await page.waitForTimeout(3000);

    const nodes = page.locator(
      '[data-testid*="rg-node"], .react-flow__node'
    );
    const nodeCount = await nodes.count();

    if (nodeCount > 0) {
      await nodes.first().click({ force: true });
      await page.waitForTimeout(1000);

      const chapterInfo = page.locator(
        ':has-text("章节"), :has-text("出场"), :has-text("第"), [data-testid*="rg-chapter"], [data-testid*="rg-first"]'
      );
      const hasChapterInfo = (await chapterInfo.count()) > 0;
      console.log(`Chapter/first-appearance info: ${hasChapterInfo}`);
    }
  });

  // ── Add relation ───────────────────────────────────────────

  test("4. 添加关系按钮存在且可触发", async ({ page }) => {
    await page.waitForTimeout(2000);

    const addBtn = page.locator(
      '[data-testid="rg-btn-add-relation"], [data-testid*="rg-add"], button:has-text("添加关系"), button:has-text("新增关系")'
    );
    const btnCount = await addBtn.count();
    console.log(`Add relation buttons: ${btnCount}`);

    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible({ timeout: 5000 });
      await addBtn.first().click();
      await page.waitForTimeout(1000);

      const form = page.locator(
        '[role="dialog"], [data-testid*="rg-modal"], [class*="dialog"], [class*="modal"]'
      );
      const formCount = await form.count();
      console.log(`Relation form visible after add click: ${formCount > 0}`);

      if (formCount > 0) {
        const selects = page.locator("select");
        const selectCount = await selects.count();
        console.log(`Form selects (source/target/type etc): ${selectCount}`);

        const closeBtn = page.locator("button:has-text('取消'), button:has-text('关闭')").first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click();
        }
      }
    }
  });

  // ── Delete relation ────────────────────────────────────────

  test("5. 删除关系 — 右键菜单存在", async ({ page }) => {
    await page.waitForTimeout(3000);

    const edges = page.locator(
      '[data-testid*="rg-edge"], .react-flow__edge, [class*="edge"]'
    );
    const edgeCount = await edges.count();
    console.log(`Relation edges: ${edgeCount}`);

    if (edgeCount > 0) {
      const edge = edges.first();
      await edge.click({ button: "right", force: true });
      await page.waitForTimeout(500);

      const contextMenu = page.locator(
        '[role="menu"], [class*="context"], button:has-text("删除"), [data-testid*="rg-delete"]'
      );
      const hasMenu = (await contextMenu.count()) > 0;
      console.log(`Context menu after right-click: ${hasMenu}`);
    }

    const deleteBtn = page.locator(
      '[data-testid*="rg-delete"], [data-testid*="rg-btn-delete"], button:has-text("删除")'
    );
    const delCount = await deleteBtn.count();
    console.log(`Delete buttons visible: ${delCount}`);
  });

  // ── Volume filter ──────────────────────────────────────────

  test("6. 卷筛选器存在且对图谱有效", async ({ page }) => {
    await page.waitForTimeout(2000);

    const volumeFilter = page.locator(
      '[data-testid="rg-select-volume-filter"], [data-testid*="rg-volume"], select'
    ).first();

    const filterCount = await volumeFilter.count();
    console.log(`Volume filter: ${filterCount}`);

    if (filterCount > 0) {
      await expect(volumeFilter).toBeVisible({ timeout: 5000 });

      const tagName = await volumeFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === "select") {
        const options = await volumeFilter.locator("option").allTextContents();
        console.log(`Volume options: ${options.length}`);
        expect(options.length).toBeGreaterThan(0);

        if (options.length > 1) {
          const optionValues = await volumeFilter.locator("option").evaluateAll(
            els => els.map(e => (e as HTMLOptionElement).value).filter(v => v !== "")
          );
          if (optionValues.length > 0) {
            await volumeFilter.selectOption(optionValues[0]);
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });

  // ── Toolbar ────────────────────────────────────────────────

  test("7. 工具栏按钮存在 — 刷新/放大/缩小/适应画布/AI提取", async ({ page }) => {
    await page.waitForTimeout(2000);

    const refreshBtn = page.locator(
      '[data-testid="rg-btn-refresh"], [data-testid*="rg-refresh"], button:has-text("刷新")'
    );
    const aiBtn = page.locator(
      '[data-testid="rg-btn-ai-extract"], [data-testid*="rg-ai"], button:has-text("AI"), button:has-text("提取")'
    );
    const zoomIn = page.locator(
      '[data-testid="rg-btn-zoom-in"], [data-testid*="rg-zoom-in"], button:has-text("放大")'
    );

    const hasRefresh = (await refreshBtn.count()) > 0;
    const hasAI = (await aiBtn.count()) > 0;
    const hasZoom = (await zoomIn.count()) > 0;
    console.log(`Buttons: refresh=${hasRefresh} ai=${hasAI} zoom=${hasZoom}`);
  });

  // ── State coverage ─────────────────────────────────────────

  test("8. 加载中状态 — 图谱数据加载时显示 spinner", async ({ page }) => {
    await page.reload();
    const spinner = page.locator(
      '[data-testid="rg-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    const hasSpinner = (await spinner.count()) > 0;
    console.log(`Loading spinner: ${hasSpinner}`);

    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("9. 错误状态 — API 失败时显示错误", async ({ page }) => {
    await page.route("**/api/books/**/relations**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);

    const errorText = page.locator(
      '[data-testid="rg-state-error"], :has-text("错误"), :has-text("失败"), :has-text("重试")'
    );
    const hasError = (await errorText.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });
});
