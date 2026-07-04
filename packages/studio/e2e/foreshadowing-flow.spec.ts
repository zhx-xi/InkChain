import { test, expect } from "@playwright/test";
import { seedForeshadowing, E2E_FORES_BOOK_ID } from "./fixtures/seed-foreshadowing";

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  // Re-seed to reset any modifications from previous tests
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  // Wait for the page to render fully
  await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });
});

test.describe("Foreshadowing — 完整流程", () => {
  test("1. renders seeded entries", async ({ page }) => {
    // Both seeded entries must appear in the list
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 5_000 });
  });

  test("2. creates a new foreshadowing entry", async ({ page }) => {
    // Click the create button
    await page.getByRole("button", { name: "新建伏笔" }).click();
    // Wait for the modal
    await expect(page.getByText("创建伏笔")).toBeVisible({ timeout: 3_000 });

    // Fill in the form
    await page.getByPlaceholder("伏笔名称").fill("破碎的玉佩");
    await page.getByPlaceholder("伏笔描述").fill("玉佩上刻着不认识的符文");
    await page.getByRole("button", { name: "创建", exact: true }).click();

    // Wait for the modal to close and assert the new entry appears
    await expect(page.getByText("创建伏笔")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("破碎的玉佩")).toBeVisible({ timeout: 5_000 });
  });

  test("3. edits an entry and marks it as paid off", async ({ page }) => {
    // Click the first seeded entry to open edit modal
    await page.getByText("神秘戒指").click();
    await expect(page.getByText("编辑伏笔")).toBeVisible({ timeout: 3_000 });

    // Click "标记回收" button
    await page.getByRole("button", { name: "标记回收" }).click();

    // Wait for the modal to close
    await expect(page.getByText("编辑伏笔")).not.toBeVisible({ timeout: 5_000 });

    // Verify the status changed — "神秘戒指" now shows "已回收"
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("已回收")).toBeVisible({ timeout: 3_000 });
  });

  test("4. deletes an entry and verifies it is gone", async ({ page }) => {
    // Delete via API directly (no delete button in the foreshadowing UI)
    const deleteRes = await page.request.delete("/api/foreshadowing/fs-e2e-1");
    expect(deleteRes.status()).toBe(200);

    // Refresh the page to pick up the change
    await page.reload();
    await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });

    // The deleted entry should be gone; the remaining ones should still be visible
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 5_000 });
  });

  test("5. 空状态显示", async ({ page }) => {
    // Delete all entries via API
    for (const id of ["fs-e2e-1", "fs-e2e-2", "fs-e2e-3", "fs-e2e-4", "fs-e2e-5"]) {
      await page.request.delete(`/api/foreshadowing/${id}`);
    }

    // Reload to see empty state
    await page.reload();
    await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });

    // Empty state message should appear
    await expect(page.getByText("暂无伏笔，点击「新建伏笔」开始追踪")).toBeVisible({ timeout: 5_000 });
  });

  test("6. AI提取按钮和模态框打开", async ({ page }) => {
    // AI extract button should be visible
    const aiBtn = page.getByRole("button", { name: /AI 提取/ });
    await expect(aiBtn).toBeVisible({ timeout: 3_000 });

    // Click to open the modal
    await aiBtn.click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Verify the extract modal has chapter range selection and start button
    await expect(page.getByRole("button", { name: "开始提取" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("章节范围：")).toBeVisible({ timeout: 3_000 });

    // Close the modal
    await page.getByRole("button", { name: "关闭" }).first().click();
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 3_000 });
  });

  test("7. 按类型过滤", async ({ page }) => {
    // Select "物品伏笔" from the type filter dropdown
    const typeSelect = page.locator("select").nth(1); // second select is type filter
    await typeSelect.selectOption("物品伏笔");
    await page.waitForTimeout(500);

    // Only 物品伏笔 entries should show
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("古墓钥匙")).toBeVisible({ timeout: 3_000 });

    // 设定伏笔 and others should be hidden
    await expect(page.getByText("门口的石像")).not.toBeVisible({ timeout: 3_000 });

    // Empty state should NOT appear
    await expect(page.getByText("没有符合条件的伏笔")).not.toBeVisible({ timeout: 2_000 });
  });

  test("8. 按状态过滤", async ({ page }) => {
    // Select "已回收" from the status filter dropdown
    const statusSelect = page.locator("select").first(); // first select is status filter
    await statusSelect.selectOption("paid_off");
    await page.waitForTimeout(500);

    // Only paid_off entry should show
    await expect(page.getByText("神秘的预言")).toBeVisible({ timeout: 3_000 });

    // Active entries should be hidden
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("门口的石像")).not.toBeVisible({ timeout: 3_000 });
  });

  test("9. 搜索关键词", async ({ page }) => {
    // Type in the search box
    const searchInput = page.getByPlaceholder("搜索伏笔名称或描述…");
    await searchInput.fill("石像");
    await page.waitForTimeout(500);

    // Only matching entry should be visible
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 3_000 });

    // Non-matching entries should be hidden
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 3_000 });

    // Clear search and verify all entries reappear
    await searchInput.fill("");
    await page.waitForTimeout(500);
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
  });

  test("10. 取消创建操作", async ({ page }) => {
    // Click new button
    await page.getByRole("button", { name: "新建伏笔" }).click();
    await expect(page.getByText("创建伏笔")).toBeVisible({ timeout: 3_000 });

    // Fill partial data
    await page.getByPlaceholder("伏笔名称").fill("临时条目");
    await page.getByPlaceholder("伏笔描述").fill("不会被保存");

    // Click cancel
    await page.getByRole("button", { name: "取消" }).click();

    // Modal should close
    await expect(page.getByText("创建伏笔")).not.toBeVisible({ timeout: 5_000 });

    // The temporary entry should NOT appear in the list
    await expect(page.getByText("临时条目")).not.toBeVisible({ timeout: 3_000 });
  });
});
