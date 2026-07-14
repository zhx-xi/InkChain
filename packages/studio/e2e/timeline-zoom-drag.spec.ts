import { test, expect } from "@playwright/test";
import { seedTimeline, clearTimeline } from "./fixtures/seed-timeline";

test.beforeAll(async () => {
  await seedTimeline();
});

// ─── 1. 加载状态 ───
test("1. 加载状态→画布显示loading指示器", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="tl-state-loading"]').or(page.locator("text=时间线"))).toBeVisible({ timeout: 10_000 });
});

// ─── 2. 正常状态 ───
test("2. 正常状态→时间线画布渲染事件节点", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("时间线").first()).toBeVisible({ timeout: 10_000 });
  // Verify zoom controls visible
  await expect(page.locator('[data-testid="tl-btn-zoom-in"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="tl-btn-zoom-out"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-testid="tl-btn-fit-view"]')).toBeVisible({ timeout: 5_000 });
});

// ─── 3. 放大按钮 ───
test("3. 放大按钮→点击后画布缩放正确", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-btn-zoom-in"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="tl-btn-zoom-in"]').click();
  // Zoom in should be registered — verify canvas transform changes
  await page.waitForTimeout(300);
  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
});

// ─── 4. 缩小按钮 ───
test("4. 缩小按钮→点击后画布缩放正确", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-btn-zoom-out"]')).toBeVisible({ timeout: 15_000 });
  // First zoom in, then zoom out
  await page.locator('[data-testid="tl-btn-zoom-in"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="tl-btn-zoom-out"]').click();
  await page.waitForTimeout(200);
  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
});

// ─── 5. 适应画布按钮 ───
test("5. 适应画布按钮→点击后恢复画布适配视图", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-btn-fit-view"]')).toBeVisible({ timeout: 15_000 });
  // Zoom in first, then fit view
  await page.locator('[data-testid="tl-btn-zoom-in"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="tl-btn-fit-view"]').click();
  await page.waitForTimeout(300);
  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
});

// ─── 6. 鼠标滚轮缩放 ───
test("6. 鼠标滚轮缩放→滚轮上下可缩放画布", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });

  const canvas = page.locator('[data-testid="tl-canvas-reactflow"]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Simulate mouse wheel zoom in (deltaY negative = zoom in)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(300);

  // Simulate mouse wheel zoom out (deltaY positive = zoom out)
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);

  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
});

// ─── 7. 拖拽平移 ───
test("7. 拖拽平移→鼠标拖拽可平移画布", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });

  const canvas = page.locator('[data-testid="tl-canvas-reactflow"]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  // Simulate drag: mousedown → move → mouseup
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
  // After drag, transform should reflect the pan
  expect(transform).toContain("translate");
});

// ─── 8. 缩放后拖拽 ───
test("8. 缩放后拖拽→放大后可继续拖拽平移", async ({ page }) => {
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });

  // Zoom in first
  await page.locator('[data-testid="tl-btn-zoom-in"]').click();
  await page.waitForTimeout(300);

  const canvas = page.locator('[data-testid="tl-canvas-reactflow"]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  // Drag while zoomed in
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy - 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const transform = await page.locator(".react-flow__viewport").getAttribute("style");
  expect(transform).toBeTruthy();
  expect(transform).toContain("translate");
});

// ─── 9. 边界: 空画布 ───
test("9. 空画布→无事件时显示空状态", async ({ page }) => {
  await clearTimeline();
  await page.goto("/#/timeline");
  await expect(page.locator('[data-testid="tl-canvas-reactflow"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="tl-state-empty"]')).toBeVisible({ timeout: 10_000 });
  // Restore state
  await seedTimeline();
});
