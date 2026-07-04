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

    // The deleted entry should be gone; the remaining one should still be visible
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 5_000 });
  });
});
