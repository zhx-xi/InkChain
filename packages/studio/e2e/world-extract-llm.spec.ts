// ── LLM-based World Extraction E2E (Issue #471) ──
// Validates that the world extraction UI shows the new extraction panel
// with "开始提取" button (Sparkles icon) and correct panel structure.

import { test, expect } from "@playwright/test";
import { seedBookWorldExtract } from "./fixtures/seed-book-world-extract";

// ── Setup ──────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedBookWorldExtract();
});

test.beforeEach(async ({ page }) => {
  await seedBookWorldExtract();
});

// ── Tests ──────────────────────────────────────────────────────

test("1. 世界设定页面加载并显示AI提取入口按钮", async ({ page }) => {
  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // The "AI 提取" button opens the extraction panel
  const openBtn = page.getByRole("button", { name: /AI 提取/ }).first();
  await expect(openBtn).toBeVisible({ timeout: 5_000 });
});

test("2. 打开AI提取面板后显示开始提取按钮", async ({ page }) => {
  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // Click the "AI 提取" button to open the extraction panel
  await page.getByRole("button", { name: /AI 提取/ }).first().click();
  await page.waitForTimeout(1000);

  // The extraction panel should show "开始提取" button with the Sparkles icon
  const startBtn = page.getByRole("button", { name: /开始提取/ }).first();
  await expect(startBtn).toBeVisible({ timeout: 5_000 });

  // The panel should have the correct title
  await expect(page.getByText("AI 提取世界设定")).toBeVisible({ timeout: 3_000 });
});
