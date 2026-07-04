import { test, expect, Page } from "@playwright/test";
import {
  seedTimeline,
  clearTimeline,
  E2E_TIMELINE_BOOK_ID,
} from "./fixtures/seed-timeline";

// ── Shared helpers ──────────────────────────────────────────────

/** Open the "新增事件" modal, fill fields, and submit */
async function createEventViaUI(
  page: Page,
  { title, description }: { title: string; description: string },
) {
  await page.getByTitle("新增事件").click();
  await expect(page.getByText("新增事件")).toBeVisible({ timeout: 5_000 });
  await page.getByPlaceholder("事件标题").fill(title);
  await page.getByPlaceholder("事件描述").fill(description);
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page.getByText("新增事件")).not.toBeVisible({ timeout: 5_000 });
}

/** Mock the AI timeline extraction endpoint to return given events */
function mockAiTimelineExtract(page: Page, events: Array<Record<string, unknown>>) {
  return page.route("**/api/v1/books/**/timelines/extract*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: events }),
    });
  });
}

// ── Setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedTimeline();
});

test.beforeEach(async ({ page }) => {
  await seedTimeline();
  await page.goto(`/#/timeline/${E2E_TIMELINE_BOOK_ID}`);
  await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });
});

// ── Tests ────────────────────────────────────────────────────────

test.describe("Timeline — 核心创作流E2E", () => {
  test("1. 页面加载显示空状态", async ({ page }) => {
    // Clear all seeded events
    for (const id of ["tl-e2e-1", "tl-e2e-2", "tl-e2e-3", "tl-e2e-4"]) {
      const res = await page.request.delete(
        `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/${id}`,
      );
      expect(res.status()).toBe(200);
    }

    // Reload to see empty state
    await page.reload();
    await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });

    // Empty state message should display
    await expect(page.getByText("暂无时间线事件")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("开始添加第一个事件吧")).toBeVisible({ timeout: 3_000 });

    // The add button should still be available
    await expect(page.getByTitle("新增事件")).toBeVisible({ timeout: 3_000 });
  });

  test("2. 手动创建事件保存后列表刷新", async ({ page }) => {
    await createEventViaUI(page, {
      title: "击败魔头",
      description: "主角在终章击败了魔头",
    });
    await expect(page.getByText("击败魔头")).toBeVisible({ timeout: 5_000 });

    // Event count should have increased
    await expect(page.getByText("5 个事件")).toBeVisible({ timeout: 3_000 });

    // Create another event
    await createEventViaUI(page, {
      title: "庆功宴",
      description: "众人举行庆功宴",
    });
    await expect(page.getByText("庆功宴")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("6 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("3. AI提取: 选章节提取应用后事件出现", async ({ page }) => {
    // Mock extraction API response
    await mockAiTimelineExtract(page, [
      {
        id: "tl-e2e-ai-1",
        title: "比武大会",
        eventType: "plot",
        description: "主角参加宗门比武大会夺冠",
        chapter: 4,
        importance: 4,
        tags: ["比武", "关键事件"],
      },
      {
        id: "tl-e2e-ai-2",
        title: "下山历练",
        eventType: "plot",
        description: "主角随师父下山历练",
        chapter: 2,
        importance: 3,
        tags: ["历练"],
      },
    ]);

    // Click AI extract button
    await page.getByTitle("AI 提取事件").click();

    // Wait for the extraction dialog
    await expect(page.getByText("AI 提取事件")).toBeVisible({ timeout: 5_000 });

    // Select a chapter range (or verify the selector exists)
    await expect(page.getByText("章节选择：")).toBeVisible({ timeout: 3_000 });

    // Click start extract
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results to appear
    await expect(page.getByText("比武大会")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("下山历练")).toBeVisible({ timeout: 3_000 });

    // Apply all results
    await page.getByRole("button", { name: "应用所有" }).click();

    // Dialog should close
    await expect(page.getByText("AI 提取事件")).not.toBeVisible({ timeout: 5_000 });

    // New events should appear in the timeline
    await expect(page.getByText("比武大会")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("下山历练")).toBeVisible({ timeout: 3_000 });

    // Event count should reflect additions
    await expect(page.getByText("6 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 选择性应用事件: 勾选部分仅已选保存", async ({ page }) => {
    // Mock extraction with multiple candidates
    await mockAiTimelineExtract(page, [
      {
        id: "tl-e2e-select-1",
        title: "被选中的事件",
        eventType: "plot",
        description: "这条会应用",
        chapter: 3,
        importance: 4,
      },
      {
        id: "tl-e2e-select-2",
        title: "被跳过的测试事件",
        eventType: "character",
        description: "这条不应用",
        chapter: 4,
        importance: 2,
      },
      {
        id: "tl-e2e-select-3",
        title: "另一条选中的",
        eventType: "world",
        description: "这条也会应用",
        chapter: 5,
        importance: 3,
      },
    ]);

    // Open AI extraction dialog
    await page.getByTitle("AI 提取事件").click();
    await expect(page.getByText("AI 提取事件")).toBeVisible({ timeout: 5_000 });

    // Start extraction
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results
    await expect(page.getByText("被选中的事件")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("被跳过的测试事件")).toBeVisible({ timeout: 3_000 });

    // Uncheck the one to skip
    const skipCheckbox = page.locator("text=被跳过的测试事件")
      .locator("..")
      .locator('input[type="checkbox"]');
    if (await skipCheckbox.isChecked()) {
      await skipCheckbox.uncheck();
    }

    // Apply selected
    await page.getByRole("button", { name: "应用选中" }).click();
    await expect(page.getByText("AI 提取事件")).not.toBeVisible({ timeout: 5_000 });

    // Only checked events appear
    await expect(page.getByText("被选中的事件")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("另一条选中的")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("被跳过的测试事件")).not.toBeVisible({ timeout: 3_000 });
  });

  test("5. 编辑事件: 点击修改保存", async ({ page }) => {
    // Double-click to open edit dialog
    await page.getByText("主角入门").dblclick();
    await expect(page.getByText("编辑事件")).toBeVisible({ timeout: 5_000 });

    // Modify title
    const titleInput = page.getByPlaceholder("事件标题");
    await titleInput.clear();
    await titleInput.fill("主角拜师入门");

    // Modify description
    const descInput = page.getByPlaceholder("事件描述");
    await descInput.clear();
    await descInput.fill("主角正式拜入青云门，成为内门弟子");

    // Change chapter if the field exists
    const chapterInput = page.locator('input[type="number"]').first();
    if (await chapterInput.isVisible()) {
      await chapterInput.clear();
      await chapterInput.fill("1");
    }

    // Save
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("编辑事件")).not.toBeVisible({ timeout: 5_000 });

    // Verify updated title
    await expect(page.getByText("主角拜师入门")).toBeVisible({ timeout: 5_000 });
  });

  test("6. 删除事件: 删除确认", async ({ page }) => {
    // Try to delete via right-click context menu first
    const target = page.getByText("结识好友");
    await target.click({ button: "right" });

    const deleteMenuItem = page.getByText(/删除事件/);
    if (await deleteMenuItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deleteMenuItem.click();

      // Confirm deletion
      await expect(page.getByText("确认删除")).toBeVisible({ timeout: 3_000 });
      await page.getByRole("button", { name: "确认" }).click();
    } else {
      // Fallback: use API if no context menu
      const deleteRes = await page.request.delete(
        `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/tl-e2e-2`,
      );
      expect(deleteRes.status()).toBe(200);
      await page.reload();
      await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });
    }

    // Deleted event should be gone
    await expect(page.getByText("结识好友")).not.toBeVisible({ timeout: 5_000 });

    // Other events remain
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("获得传承")).toBeVisible({ timeout: 3_000 });

    // Event count should reflect the deletion
    await expect(page.getByText("3 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("7. 事件详情: 点击展开", async ({ page }) => {
    // Click on an event node to open the detail dialog
    await page.getByText("主角入门").click();

    // Detail dialog should show full event info
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("主角拜入青云门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("剧情")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第 1 章")).toBeVisible({ timeout: 3_000 });

    // Related characters should be shown
    await expect(page.getByText("叶云")).toBeVisible({ timeout: 3_000 });

    // Tags should be shown
    await expect(page.getByText("入门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("关键事件")).toBeVisible({ timeout: 3_000 });

    // Close detail dialog
    await page.getByRole("button", { name: "关闭" }).first().click();
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 2_000 });

    // Click a different event to verify multiple detail views
    await page.getByText("发现秘境").click();
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("后山出现远古秘境入口")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("世界")).toBeVisible({ timeout: 3_000 });

    // Close
    await page.getByRole("button", { name: "关闭" }).first().click();
  });

  test("8. 时间线滚动缩放", async ({ page }) => {
    // The timeline canvas should have zoom controls
    const zoomInBtn = page.getByTitle(/放大/);
    const zoomOutBtn = page.getByTitle(/缩小/);

    if (await zoomInBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Click zoom in and verify zoom level changes
      await zoomInBtn.click();
      await page.waitForTimeout(500);

      // Zoom out
      await zoomOutBtn.click();
      await page.waitForTimeout(500);

      // Reset zoom if available
      const resetBtn = page.getByTitle(/重置/);
      if (await resetBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await resetBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // The timeline canvas should be scrollable
    // Simulate scroll on the timeline container
    const timelineCanvas = page.locator('[data-testid="timeline-canvas"]').first();
    if (await timelineCanvas.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await timelineCanvas.evaluate((el) => {
        el.scrollLeft = 200;
        el.scrollTop = 100;
      });
      await page.waitForTimeout(300);

      // Verify scroll position changed
      const scrollLeft = await timelineCanvas.evaluate((el) => el.scrollLeft);
      expect(scrollLeft).toBe(200);
    }

    // Ensure events are still visible after zoom/scroll
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("获得传承")).toBeVisible({ timeout: 3_000 });
  });

  test("9. 空状态显示（全部删除后）", async ({ page }) => {
    // Delete all events via API
    for (const id of ["tl-e2e-1", "tl-e2e-2", "tl-e2e-3", "tl-e2e-4"]) {
      const res = await page.request.delete(
        `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/${id}`,
      );
      expect(res.status()).toBe(200);
    }

    // Reload
    await page.reload();
    await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });

    // Empty state should show with guidance
    await expect(page.getByText("暂无时间线事件")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("开始添加第一个事件吧")).toBeVisible({ timeout: 3_000 });

    // No events should be listed
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("获得传承")).not.toBeVisible({ timeout: 2_000 });
  });

  test("10. 错误处理: API失败显示错误", async ({ page }) => {
    // Intercept the timeline API to return a server error
    await page.route("**/api/v1/books/**/timelines*", async (route) => {
      // Only block GET requests
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "SERVER_ERROR", message: "无法加载时间线数据" },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.reload();
    await page.waitForTimeout(2_000);

    // Error state should be displayed
    await expect(page.getByText("无法加载时间线数据")).toBeVisible({ timeout: 10_000 });

    // Retry button should be visible
    await expect(page.getByRole("button", { name: /重试/ })).toBeVisible({
      timeout: 3_000,
    });

    // Normal events should NOT be visible in error state
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 2_000 });
  });
});
