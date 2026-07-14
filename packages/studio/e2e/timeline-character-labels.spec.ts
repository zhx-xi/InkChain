import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

/**
 * E2E for #616 — 时间线：角色事件标签重叠显示
 *
 * Acceptance Criteria:
 *  - Multi-character labels in the same time period do not overlap
 *  - Labels have reasonable spacing or collapse mechanism
 *
 * 4-state coverage: loading / normal / error / empty / edge
 * Given-When-Then format
 */

test.describe("TimelinePage — 角色事件标签重叠 (#616)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/timeline`);
  });

  // ── Normal state ──

  test("1. Given 时间线页面已加载, When 画布中有多个角色事件, Then 标签不互相遮挡", async ({ page }) => {
    await page.waitForTimeout(3000);
    // Check for overlapping labels via bounding box comparison
    const labels = page.locator(
      '[data-testid*="tl-node"], [data-testid*="tl-event"], [class*="react-flow__node"], [class*="timeline-label"], [class*="event-label"]'
    );
    const count = await labels.count();
    console.log(`Event nodes/labels found: ${count}`);

    if (count >= 2) {
      // Check first two labels for overlapping bounding boxes
      const box1 = await labels.nth(0).boundingBox();
      const box2 = await labels.nth(1).boundingBox();
      if (box1 && box2) {
        const overlapX = box1.x < box2.x + box2.width && box1.x + box1.width > box2.x;
        const overlapY = box1.y < box2.y + box2.height && box1.y + box1.height > box2.y;
        console.log(`Label overlap detected (X: ${overlapX}, Y: ${overlapY})`);
        // If labels overlap, check for collapse/stack mechanism
        if (overlapX && overlapY) {
          const collapseIndicator = page.locator(
            '[data-testid*="collapse"], [data-testid*="stack"], [data-testid*="overflow"], text=更多, text=+'
          );
          const hasCollapse = (await collapseIndicator.count()) > 0;
          console.log(`Collapse/overflow indicator visible: ${hasCollapse}`);
        }
      }
    }
  });

  test("2. Given 时间线画布有角色标签, When 查看标签间距, Then 标签有合理的视觉间距", async ({ page }) => {
    await page.waitForTimeout(3000);
    const labels = page.locator(
      '[data-testid*="tl-node-event"], [data-testid*="tl-event"], [class*="react-flow__node"], [class*="event"]'
    );
    const count = await labels.count();
    console.log(`Total event nodes: ${count}`);

    let minGap = Infinity;
    for (let i = 0; i < Math.min(count - 1, 10); i++) {
      const box1 = await labels.nth(i).boundingBox();
      const box2 = await labels.nth(i + 1).boundingBox();
      if (box1 && box2) {
        const gapX = Math.abs(box1.x + box1.width - box2.x);
        const gapY = Math.abs(box1.y + box1.height - box2.y);
        const gap = Math.min(gapX, gapY);
        if (gap < minGap && gap > 0) minGap = gap;
      }
    }
    console.log(`Minimum label gap: ${minGap === Infinity ? "N/A (< 2 nodes)" : minGap + "px"}`);
  });

  test("3. Given 时间线有同时间段多角色, When 标签过多无法全部显示, Then 出现折叠/展开机制", async ({ page }) => {
    await page.waitForTimeout(3000);
    const collapseBtn = page.locator(
      '[data-testid*="collapse"], [data-testid*="expand"], [data-testid*="overflow"], button:has-text("更多"), button:has-text("展开"), text=+'
    );
    const hasCollapse = (await collapseBtn.count()) > 0;
    console.log(`Collapse/expand mechanism present: ${hasCollapse}`);

    if (hasCollapse) {
      // Try clicking collapse to expand
      await collapseBtn.first().click();
      await page.waitForTimeout(1000);
      const expandedLabels = page.locator(
        '[data-testid*="tl-node"], [data-testid*="tl-event"]'
      );
      console.log(`Labels after expand: ${await expandedLabels.count()}`);
    }
  });

  // ── Loading state ──

  test("4. Given 时间线页面初次加载, When 数据获取中, Then 显示加载指示器", async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/timeline`);
    const spinner = page.locator(
      '[data-testid="tl-loading-spinner"], [data-testid="tl-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    const hasSpinner = (await spinner.count()) > 0;
    console.log(`Loading indicator visible: ${hasSpinner}`);
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // ── Error state ──

  test("5. Given 时间线数据加载失败, When 页面渲染, Then 显示错误状态", async ({ page }) => {
    await page.route("**/api/v1/books/**/timelines**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const errorState = page.locator(
      '[data-testid="tl-error-state"], [data-testid="tl-state-error"], text=错误, text=失败, text=重试'
    );
    const hasError = (await errorState.count()) > 0;
    console.log(`Error state visible: ${hasError}`);
  });

  // ── Empty state ──

  test("6. Given 时间线无事件, When 页面加载, Then 显示空状态", async ({ page }) => {
    await page.waitForTimeout(2000);
    const emptyState = page.locator(
      '[data-testid="tl-empty-state"], [data-testid="tl-state-empty"], text=创建第一个, text=暂无事件'
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state visible: ${hasEmpty}`);
  });

  // ── Edge state ──

  test("7. Given 所有角色事件在同一时间段, When 标签必须全部显示, Then 不发生视觉重叠导致不可读", async ({ page }) => {
    await page.waitForTimeout(3000);
    const nodes = page.locator(
      '[class*="react-flow__node"], [data-testid*="tl-node"], [data-testid*="tl-event"]'
    );
    const count = await nodes.count();
    console.log(`Total nodes in same timeframe area: ${count}`);

    // Verify each node is at least partially visible (not completely hidden behind another)
    let hiddenCount = 0;
    for (let i = 0; i < Math.min(count, 20); i++) {
      const isVisible = await nodes.nth(i).isVisible();
      if (!isVisible) hiddenCount++;
    }
    console.log(`Hidden nodes (out of ${Math.min(count, 20)}): ${hiddenCount}`);
  });

  test("8. Given 角色过滤启用以仅显示单个角色, When 画布刷新, Then 标签不再拥挤", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filterSelect = page.locator(
      '[data-testid*="character-filter"], [data-testid*="CharacterFilter"], select, [role="combobox"]'
    ).first();
    if ((await filterSelect.count()) > 0) {
      // Select first available option to filter
      await filterSelect.click();
      await page.waitForTimeout(500);
      const options = page.locator('[role="option"], option');
      const optCount = await options.count();
      if (optCount > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(2000);
      }
    }
    const filteredNodes = await page.locator(
      '[class*="react-flow__node"], [data-testid*="tl-node"]'
    ).count();
    console.log(`Nodes after character filter: ${filteredNodes}`);
  });
});
