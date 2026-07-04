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
    // All three seeded events must appear as nodes in the timeline
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("结识好友")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });

    // Event count should be shown in the header
    await expect(page.getByText("3 个事件")).toBeVisible({ timeout: 3_000 });
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
    await expect(page.getByText("4 个事件")).toBeVisible({ timeout: 3_000 });
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

    // Event count should have decreased
    await expect(page.getByText("2 个事件")).toBeVisible({ timeout: 3_000 });
  });
});
