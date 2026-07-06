import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";

// ── Setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.describe("Foreshadowing — 表格视图", () => {
  test("1. 表格默认显示表头列和种子数据", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Verify view mode toggle buttons
    await expect(page.getByRole("button", { name: /^卡片$/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^表格$/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^关系图$/ })).toBeVisible({ timeout: 3_000 });

    // Table headers: 标题, 类型, 创建章, 最近提及, 预期回收, 状态
    await expect(page.locator("table thead tr th")).toHaveCount(6);
    await expect(page.locator("table thead tr th").nth(0)).toContainText("标题");
    await expect(page.locator("table thead tr th").nth(1)).toContainText("类型");
    await expect(page.locator("table thead tr th").nth(2)).toContainText("创建章");
    await expect(page.locator("table thead tr th").nth(3)).toContainText("最近提及");
    await expect(page.locator("table thead tr th").nth(4)).toContainText("预期回收");
    await expect(page.locator("table thead tr th").nth(5)).toContainText("状态");

    // Table has data rows with seeded entries
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
  });

  test("2. 列头点击排序", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Click "标题" column to sort ascending
    const titleHeader = page.locator("table thead tr th").nth(0);
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Sort indicator should appear
    await expect(titleHeader.locator("span.text-\\[10px\\]")).toBeVisible({ timeout: 3_000 });

    // Click again to toggle direction
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Sort indicator still visible (direction toggled)
    await expect(titleHeader.locator("span.text-\\[10px\\]")).toBeVisible({ timeout: 3_000 });
  });

  test("3. 表格和卡片视图切换", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Switch to card view
    await page.getByRole("button", { name: /^卡片$/ }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("table")).not.toBeVisible({ timeout: 3_000 });

    // Switch back to table view
    await page.getByRole("button", { name: /^表格$/ }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("table")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 搜索过滤后表格更新", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Count initial rows
    const rowCount = await page.locator("table tbody tr").count();
    expect(rowCount).toBeGreaterThan(0);

    // Search for a specific entry
    await page.getByPlaceholder("搜索伏笔名称或描述…").fill("神秘戒指");
    await page.waitForTimeout(800);

    // Row count should be filtered
    const filteredCount = await page.locator("table tbody tr").count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
  });
});
