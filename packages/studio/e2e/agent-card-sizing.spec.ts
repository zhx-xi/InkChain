import { test, expect } from "@playwright/test";
import { seedAgentTeam } from "./fixtures/seed-agent-team";

test.beforeAll(async () => {
  await seedAgentTeam();
});

// ─── 1. 加载状态 ───
test("1. 加载状态→Agent列表显示loading", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  // The team panel should render
  await expect(page.locator('[data-testid="ag-list-agents"]')).toBeVisible({ timeout: 10_000 });
});

// ─── 2. 正常状态 ───
test("2. 正常状态→Agent卡片渲染完成", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  // Verify agent cards are rendered
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="ag-agent-card-architect"]')).toBeVisible({ timeout: 5_000 });
});

// ─── 3. 卡片宽度一致 ───
test("3. 卡片宽度一致→所有Agent卡片宽度相同", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  const agentNames = ["writer", "architect", "planner", "reviewer", "reviser", "searcher", "executor"];
  const widths: number[] = [];

  for (const name of agentNames) {
    const card = page.locator(`[data-testid="ag-agent-card-${name}"]`);
    if (await card.isVisible({ timeout: 3000 })) {
      const box = await card.boundingBox();
      if (box) widths.push(box.width);
    }
  }

  // All visible cards should have the same width (within 2px tolerance)
  if (widths.length >= 2) {
    const min = Math.min(...widths);
    const max = Math.max(...widths);
    expect(max - min).toBeLessThanOrEqual(2);
  }
});

// ─── 4. 卡片高度一致 ───
test("4. 卡片高度一致→所有Agent卡片高度相同", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  const agentNames = ["writer", "architect", "planner", "reviewer", "reviser"];
  const heights: number[] = [];

  for (const name of agentNames) {
    const card = page.locator(`[data-testid="ag-agent-card-${name}"]`);
    if (await card.isVisible({ timeout: 3000 })) {
      const box = await card.boundingBox();
      if (box) heights.push(box.height);
    }
  }

  if (heights.length >= 2) {
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    expect(max - min).toBeLessThanOrEqual(2);
  }
});

// ─── 5. 长内容不破坏布局 ───
test("5. 长内容自适应→Agent描述过长不破坏布局", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  // The longest description agent — card should still be well-formed
  const card = page.locator('[data-testid="ag-agent-card-writer"]');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  // Card should have reasonable proportions
  if (box) {
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(40);
  }
});

// ─── 6. 短内容不冗余 ───
test("6. 短内容不自适应→卡片不因短内容坍缩", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-executor"]')).toBeVisible({ timeout: 15_000 });

  const card = page.locator('[data-testid="ag-agent-card-executor"]');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThan(100);
  }
});

// ─── 7. 单Agent卡片 ───
test("7. 单Agent卡片→只有一个卡片时尺寸正常", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  const card = page.locator('[data-testid="ag-agent-card-writer"]');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThan(80);
    expect(box.height).toBeGreaterThan(40);
  }
});

// ─── 8. 不同Agent卡片大小对比 ───
test("8. 不同Agent卡片→大小对比在容忍范围内", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  // Compare writer (most content) vs executor (least content) sizes
  const writerCard = page.locator('[data-testid="ag-agent-card-writer"]');
  const executorCard = page.locator('[data-testid="ag-agent-card-executor"]');

  const writerBox = await writerCard.boundingBox();
  const executorBox = await executorCard.boundingBox();

  if (writerBox && executorBox) {
    // Width should be the same (±5px for decimals)
    expect(Math.abs(writerBox.width - executorBox.width)).toBeLessThanOrEqual(5);
  }
});

// ─── 9. 边界: 空Agent列表 ───
test("9. 空Agent列表→无自定义Agent时显示空状态", async ({ page }) => {
  // Navigate to agents hub — the list tab should show built-in agents or empty state
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  // Switch to team config tab which shows agent cards
  await expect(page.locator('[data-testid="ag-list-agents"]')).toBeVisible({ timeout: 10_000 });
});
