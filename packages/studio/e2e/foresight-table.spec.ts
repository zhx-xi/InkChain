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
  test("1. 表格视图默认显示表头列", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // Verify view mode toggle buttons are present
    await expect(page.getByRole("button", { name: "卡片" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "表格" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^关系图$/ })).toBeVisible({ timeout: 3_000 });

    // The table should have column headers: 标题, 类型, 创建章, 最近提及, 预期回收, 状态
    await expect(page.locator("table thead tr th")).toHaveCount(6);
    await expect(page.locator("table thead tr th").nth(0)).toContainText("标题");
    await expect(page.locator("table thead tr th").nth(1)).toContainText("类型");
    await expect(page.locator("table thead tr th").nth(2)).toContainText("创建章");
    await expect(page.locator("table thead tr th").nth(3)).toContainText("最近提及");
    await expect(page.locator("table thead tr th").nth(4)).toContainText("预期回收");
    await expect(page.locator("table thead tr th").nth(5)).toContainText("状态");
  });

  test("2. 表格显示种子数据行且可排序", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Verify table has rows
    const tableRows = page.locator("table tbody tr");
    await expect(tableRows).not.toHaveCount(0);

    // Click "标题" column header to sort
    const titleHeader = page.locator("table thead tr th").nth(0);
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Sort indicator should appear
    await expect(titleHeader.locator("span")).toContainText(/[▲▼]/);
  });

  test("3. 在卡片视图和表格视图间切换", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Switch to card view
    await page.getByRole("button", { name: "卡片" }).click();
    await page.waitForTimeout(800);

    // Table should be hidden
    await expect(page.locator("table")).not.toBeVisible({ timeout: 3_000 });

    // Switch back to table view
    await page.getByRole("button", { name: "表格" }).click();
    await page.waitForTimeout(800);

    // Table should be visible again
    await expect(page.locator("table")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 搜索过滤后表格同步更新", async ({ page }) => {
    await seedForeshadowing();
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Get initial row count
    const initialRows = await page.locator("table tbody tr").count();
    expect(initialRows).toBeGreaterThan(0);

    // Search for something that should match
    const searchInput = page.getByPlaceholder("搜索伏笔名称或描述…");
    await searchInput.fill("神秘戒指");
    await page.waitForTimeout(800);

    // After filtering, fewer rows should match
    const filteredRows = await page.locator("table tbody tr").count();
    expect(filteredRows).toBeGreaterThanOrEqual(1);
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });
});
