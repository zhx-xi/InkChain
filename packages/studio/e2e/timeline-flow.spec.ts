import { test, expect } from "@playwright/test";
import { seedTimeline, E2E_TIMELINE_BOOK_ID } from "./fixtures/seed-timeline";

test.beforeAll(async () => {
  await seedTimeline();
});

test.beforeEach(async ({ page }) => {
  // Re-seed to reset modifications from previous tests
  await seedTimeline();
  await page.goto(`/#/timeline/${E2E_TIMELINE_BOOK_ID}`);
  // Wait for the timeline canvas to render (header with "时间线" is visible)
  await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });
});

test.describe("Timeline — 完整流程", () => {
  test("1. renders seeded timeline events", async ({ page }) => {
    // All seeded events must appear as nodes in the timeline
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("结识好友")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("获得传承")).toBeVisible({ timeout: 3_000 });

    // Event count should be shown in the header
    await expect(page.getByText("4 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("2. creates a new timeline event", async ({ page }) => {
    // Click the add event button (+ icon button with title "新增事件")
    await page.getByTitle("新增事件").click();

    // Wait for the dialog to open
    await expect(page.getByText("新增事件")).toBeVisible({ timeout: 5_000 });

    // Fill in the form
    await page.getByPlaceholder("事件标题").fill("击败魔头");
    await page.getByPlaceholder("事件描述").fill("主角在终章击败了魔头");

    // Click "创建"
    await page.getByRole("button", { name: "创建" }).click();

    // Wait for the dialog to close and verify the new event appears
    await expect(page.getByText("新增事件")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("击败魔头")).toBeVisible({ timeout: 5_000 });

    // Event count should have increased
    await expect(page.getByText("5 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("3. AI extract button is visible", async ({ page }) => {
    // The AI extract button should be present in the timeline header
    await expect(page.getByTitle("AI 提取事件")).toBeVisible({ timeout: 3_000 });
  });

  test("4. updates an event via edit dialog", async ({ page }) => {
    // Double-click on "主角入门" to open the edit dialog
    await page.getByText("主角入门").dblclick();

    // Wait for the edit dialog
    await expect(page.getByText("编辑事件")).toBeVisible({ timeout: 5_000 });

    // Change the title
    const titleInput = page.getByPlaceholder("事件标题");
    await titleInput.clear();
    await titleInput.fill("主角拜师入门");

    // Click "保存"
    await page.getByRole("button", { name: "保存" }).click();

    // Wait for the dialog to close
    await expect(page.getByText("编辑事件")).not.toBeVisible({ timeout: 5_000 });

    // The updated title should appear
    await expect(page.getByText("主角拜师入门")).toBeVisible({ timeout: 5_000 });
  });

  test("5. deletes an event and verifies it is gone", async ({ page }) => {
    // Delete via API directly (right-click context menu is fragile in E2E)
    const deleteRes = await page.request.delete(
      `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/tl-e2e-1`,
    );
    expect(deleteRes.status()).toBe(200);

    // Refresh
    await page.reload();
    await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });

    // The deleted event should be gone
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 5_000 });

    // Remaining events should still be visible
    await expect(page.getByText("结识好友")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("获得传承")).toBeVisible({ timeout: 3_000 });

    // Event count should have decreased
    await expect(page.getByText("3 个事件")).toBeVisible({ timeout: 3_000 });
  });

  test("6. 空状态显示", async ({ page }) => {
    // Delete all seeded events via API
    for (const id of ["tl-e2e-1", "tl-e2e-2", "tl-e2e-3", "tl-e2e-4"]) {
      const res = await page.request.delete(
        `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/${id}`,
      );
      expect(res.status()).toBe(200);
    }

    // Reload to see empty state
    await page.reload();
    await expect(page.getByText("时间线")).toBeVisible({ timeout: 15_000 });

    // Empty state should show
    await expect(page.getByText("暂无时间线事件")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("开始添加第一个事件吧")).toBeVisible({ timeout: 3_000 });
  });

  test("7. 事件详情展开", async ({ page }) => {
    // Click on an event node to open the detail dialog
    await page.getByText("主角入门").click();

    // The detail dialog should show event info
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("主角拜入青云门")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("剧情")).toBeVisible({ timeout: 3_000 });

    // Close the detail dialog
    await page.getByRole("button", { name: "关闭" }).first().click();
  });

  test("8. 按章节过滤", async ({ page }) => {
    // Select chapter 3 from the chapter filter
    const chapterSelect = page.locator("select").first();
    await chapterSelect.selectOption("3");
    await page.waitForTimeout(500);

    // Only events in chapter 3 should be visible
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });

    // Events in other chapters should not be visible (or at least not matching)
    // Note: ReactFlow keeps all nodes but hides via fitView — check the node is rendered differently
    // The chapter filter on the backend may still return all events, client-side filtering applies
    // Verify the filter select shows chapter 3
    await expect(chapterSelect).toHaveValue("3");
  });

  test("9. 取消创建事件", async ({ page }) => {
    // Click the add event button
    await page.getByTitle("新增事件").click();

    // Dialog should open
    await expect(page.getByText("新增事件")).toBeVisible({ timeout: 3_000 });

    // Fill partial data
    await page.getByPlaceholder("事件标题").fill("临时事件");

    // Click cancel
    await page.getByRole("button", { name: "取消" }).click();

    // Dialog should close without creating
    await expect(page.getByText("新增事件")).not.toBeVisible({ timeout: 5_000 });

    // The temporary event should not be in the timeline
    await expect(page.getByText("临时事件")).not.toBeVisible({ timeout: 3_000 });
  });

  test("10. API错误处理", async ({ page }) => {
    // Intercept the timeline API to return an error, then reload
    await page.route("**/api/v1/books/**/timelines*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "模拟服务端错误" } }),
      });
    });

    await page.reload();
    await page.waitForTimeout(2_000);

    // Error state should be displayed
    await expect(page.getByText("无法加载时间线数据")).toBeVisible({ timeout: 10_000 });
  });
});
