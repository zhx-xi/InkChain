// ── LLM-based World Extraction E2E (Issue #471) ──
// Validates that the world extraction UI shows progress stages,
// AI badge on results, and dimension distribution chips.

import { test, expect } from "@playwright/test";
import { seedBookWorldExtract, E2E_BOOK_ID } from "./fixtures/seed-book-world-extract";
import { conditionalMock } from "./fixtures/mock-llm-helper";

// ── Mock data ─────────────────────────────────────────────────

const MOCK_AI_EXTRACT_RESULT = {
  success: true,
  data: {
    summary: "从15个章节中提取出42个世界设定实体，涵盖7个维度。",
    entities: [
      { name: "剑与魔法世界", dimension: "settings", description: "一个剑与魔法的奇幻世界" },
      { name: "艾伦", dimension: "roles", description: "人类少年，勇敢善良" },
      { name: "莉莉", dimension: "roles", description: "精灵公主，擅用弓箭" },
      { name: "艾尔大陆", dimension: "regions", description: "主大陆，三国鼎立" },
      { name: "光明教会", dimension: "institutions", description: "信仰光明的宗教组织" },
      { name: "暗影战争", dimension: "history", description: "光明历1200年爆发的重大战争" },
      { name: "魔法守恒定律", dimension: "rules", description: "能量来源于自然界" },
    ],
    sections: [],
  },
};

// ── Setup ──────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedBookWorldExtract();
});

test.beforeEach(async ({ page }) => {
  await seedBookWorldExtract();
});

// ── Tests ──────────────────────────────────────────────────────

test("1. 世界设定页面加载并显示AI提取按钮", async ({ page }) => {
  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // The AI提取 button should have the Sparkles icon (from PR #471)
  const extractBtn = page.getByRole("button", { name: /开始提取/ }).first();
  await expect(extractBtn).toBeVisible({ timeout: 5_000 });
});

test("2. 点击开始提取显示进度指示器", async ({ page }) => {
  // Mock the extract API to return results with a delay
  await page.route("**/api/extract", async (route) => {
    if (route.request().method() === "POST") {
      // Simulate a short delay so we can observe the progress indicator
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_AI_EXTRACT_RESULT),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // Click the 开始提取 button
  await page.getByRole("button", { name: /开始提取/ }).first().click();

  // Progress indicator should appear
  await expect(page.getByText("正在读取设定文件…")).toBeVisible({ timeout: 5_000 });

  // Wait for extraction to complete
  await expect(page.getByText("剑与魔法世界")).toBeVisible({ timeout: 15_000 });
});

test("3. 提取结果显示AI标签和维度分布", async ({ page }) => {
  // Mock the extract API
  await page.route("**/api/extract", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_AI_EXTRACT_RESULT),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // Click extract button
  await page.getByRole("button", { name: /开始提取/ }).first().click();

  // Wait for results
  await expect(page.getByText("剑与魔法世界")).toBeVisible({ timeout: 15_000 });

  // Verify AI badge appears
  await expect(page.getByText("AI 分析")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("基于 LLM 模型提取")).toBeVisible({ timeout: 3_000 });

  // Verify dimension distribution chips appear with counts
  // The seed data has 7 entities across 6 dimensions
  // settings(1), roles(2), regions(1), institutions(1), history(1), rules(1)
  await expect(page.getByText("世界观设定 (1)")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("世界角色 (2)")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("地理区域 (1)")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("组织势力 (1)")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("历史事件 (1)")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("世界规则 (1)")).toBeVisible({ timeout: 3_000 });
});

test("4. 提取摘要显示实体数量和统计", async ({ page }) => {
  await page.route("**/api/extract", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_AI_EXTRACT_RESULT),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto("/#/worlds");
  await expect(page.getByText("世界设定").first()).toBeVisible({ timeout: 15_000 });

  // Click extract
  await page.getByRole("button", { name: /开始提取/ }).first().click();
  await expect(page.getByText("剑与魔法世界")).toBeVisible({ timeout: 15_000 });

  // The summary should be visible
  await expect(page.getByText("提取摘要")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("42个世界设定实体")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("7个维度")).toBeVisible({ timeout: 3_000 });
});
