import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  clearForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";

// ── Setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });
});

// ── Tests ────────────────────────────────────────────────────────

test.describe("Foreshadowing — 表格视图", () => {
  test("1. 视图切换按钮可见且默认显示表格", async ({ page }) => {
    // Verify all three view mode buttons are present
    await expect(page.getByRole("button", { name: "卡片" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "表格" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "关系图" })).toBeVisible({ timeout: 3_000 });
  });

  test("2. 表格视图显示正确表头列", async ({ page }) => {
    // The table should have these column headers
    const tableHeaders = page.locator("table thead tr th");
    await expect(tableHeaders).toHaveCount(6);
    await expect(tableHeaders.nth(0)).toContainText("标题");
    await expect(tableHeaders.nth(1)).toContainText("类型");
    await expect(tableHeaders.nth(2)).toContainText("创建章");
    await expect(tableHeaders.nth(3)).toContainText("最近提及");
    await expect(tableHeaders.nth(4)).toContainText("预期回收");
    await expect(tableHeaders.nth(5)).toContainText("状态");
  });

  test("3. 表格显示伏笔数据行", async ({ page }) => {
    // Verify the table has rows (seeded data should be visible)
    const tableRows = page.locator("table tbody tr");
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify at least one known entry is visible in the table
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("门口的")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 点击列头排序", async ({ page }) => {
    // Click the "标题" column header to sort ascending
    const titleHeader = page.locator("table thead tr th").nth(0);
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Verify the sort indicator appears (▲ or ▼)
    await expect(titleHeader.locator("span.text-\\[10px\\]")).toBeVisible({ timeout: 3_000 });

    // Click again to toggle sort direction
    await titleHeader.click();
    await page.waitForTimeout(500);
    await expect(titleHeader.locator("span.text-\\[10px\\]")).toBeVisible({ timeout: 3_000 });
  });

  test("5. 切换到卡片视图再切回表格", async ({ page }) => {
    // Switch to card view
    await page.getByRole("button", { name: "卡片" }).click();
    await page.waitForTimeout(500);

    // Card view should show entry cards (check for card-like elements)
    await expect(page.locator("table")).not.toBeVisible({ timeout: 3_000 });

    // Switch back to table view
    await page.getByRole("button", { name: "表格" }).click();
    await page.waitForTimeout(500);

    // Table should be visible again
    await expect(page.locator("table")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
  });

  test("6. 创建新伏笔后表格自动更新", async ({ page }) => {
    // Create a new foreshadowing via the UI
    await page.getByRole("button", { name: "新建伏笔" }).click();
    await expect(page.getByText("创建伏笔")).toBeVisible({ timeout: 3_000 });
    await page.getByPlaceholder("伏笔名称").fill("表格测试伏笔");
    await page.getByPlaceholder("伏笔描述").fill("测试表格视图自动刷新");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await expect(page.getByText("创建伏笔")).not.toBeVisible({ timeout: 5_000 });

    // Verify the new entry appears in the table
    await expect(page.getByText("表格测试伏笔")).toBeVisible({ timeout: 5_000 });
  });
});
