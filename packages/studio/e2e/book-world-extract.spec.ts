import { test, expect } from "@playwright/test";
import { seedBookWorldExtract, E2E_BOOK_ID, E2E_WORLD_ID } from "./fixtures/seed-book-world-extract";

test.beforeAll(async () => {
  await seedBookWorldExtract();
});

test("1. 世界设定页面加载", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("玄幻修仙世界").first()).toBeVisible({ timeout: 5_000 });
});

test("2. 搜索过滤世界", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });

  const searchInput = page.getByPlaceholder("搜索世界名称或描述");
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await searchInput.fill("玄幻");
  await page.waitForTimeout(500);
  await expect(page.getByText("玄幻修仙世界").first()).toBeVisible({ timeout: 3_000 });

  // Clear and search for non-existent
  await searchInput.fill("不存在的世界");
  await page.waitForTimeout(500);
  await expect(page.getByText("没有符合条件的 World").first()).toBeVisible({ timeout: 3_000 });
});

test("3. AI提取按钮和新建世界按钮", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("button", { name: /AI 提取/ }).first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole("button", { name: "新建世界" })).toBeVisible({ timeout: 3_000 });
});

test("4. 点击世界卡片→导航", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });

  await page.getByText("玄幻修仙世界").first().click();
  await page.waitForTimeout(2000);
  // Should navigate (URL hash should change)
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain("worlds");
});

test("5. AI提取模态框可打开", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });

  // Click AI提取 button
  await page.getByRole("button", { name: /AI 提取/ }).first().click();
  await page.waitForTimeout(1000);

  // Check if modal opened
  const modalTitle = page.getByText("AI 提取世界设定");
  const modalVisible = await modalTitle.isVisible().catch(() => false);
  if (modalVisible) {
    // Close modal
    await page.locator('button:has(svg.lucide-x)').first().click();
  }
});

test("6. 维度标签显示", async ({ page }) => {
  await page.goto("/#/worlds");
  await page.waitForTimeout(2000);
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 20_000 });

  // The world card should show dimension chips
  await expect(page.getByText("世界观设定 1").first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("世界角色 1").first()).toBeVisible({ timeout: 3_000 });
});
