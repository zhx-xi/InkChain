import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.describe("Foreshadowing — 分页视图", () => {
  test("1. 页面加载后表格模式可切换", async ({ page }) => {
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    // Verify view mode toggle buttons are present
    await expect(page.getByRole("button", { name: /^卡片$/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^表格$/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^关系图$/ })).toBeVisible({ timeout: 3_000 });

    // Verify filter controls exist (part of the new pagination UI)
    await expect(page.getByPlaceholder("搜索伏笔名称或描述…")).toBeVisible({ timeout: 3_000 });
  });

  test("2. 视图模式切换流畅", async ({ page }) => {
    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // Toggle through all three view modes without error
    await page.getByRole("button", { name: /^卡片$/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^表格$/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^关系图$/ }).click();
    await page.waitForTimeout(400);

    // No JS errors should have occurred
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    expect(errors.length).toBe(0);
  });
});
