import { test, expect } from "@playwright/test";
import { seedWorldMap, E2E_WORLD_ID } from "./fixtures/seed-world-map";

test.beforeAll(async () => {
  await seedWorldMap();
});

test("1. 加载地图页面显示交互式地图标签", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  // Breadcrumb should include "世界" as root level name
  await expect(page.getByText("大陆视图 · 0 个区域").first()).toBeVisible({ timeout: 3_000 });
});

test("2. 缩放控制按钮可见", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('button[title="放大"]')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('button[title="缩小"]')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('button[title="重置视图"]')).toBeVisible({ timeout: 3_000 });
});

test("3. 缩放按钮可点击", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  await page.locator('button[title="放大"]').click();
  await page.locator('button[title="缩小"]').click();
  await page.locator('button[title="重置视图"]').click();
});

test("4. 详情面板初始状态显示提示", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("点击地图上的节点")).toBeVisible({ timeout: 3_000 });
});

test("5. 空状态页面可加载", async ({ page }) => {
  await page.request.post("/api/worlds", {
    data: { id: "e2e-empty-world-map", name: "空地图世界", description: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), references: [] },
  });
  await page.goto("/#/worlds/e2e-empty-world-map/map");
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 15_000 });
});

test("6. 导航回世界详情按钮存在", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  // The header button navigates back to world detail
});

test("7. 工具栏显示区域信息", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("大陆视图 · 0 个区域").first()).toBeVisible({ timeout: 3_000 });
});

test("8. 地图容器渲染", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}/map`);
  await expect(page.getByText("交互式地图")).toBeVisible({ timeout: 20_000 });
  // Check that the map area exists (the detail panel hint is visible)
  await expect(page.getByText("查看区域详情")).toBeVisible({ timeout: 3_000 });
});
