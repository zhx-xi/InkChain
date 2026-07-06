import { test, expect, Page } from "@playwright/test";
import {
  seedForeshadowing,
  clearForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";

// ── Helpers ───────────────────────────────────────────────────────

function mockAiExtract(page: Page, entries: Array<Record<string, unknown>>) {
  page.route("**/api/foreshadowing/extract*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: entries }),
    });
  });
}

// ── Setup ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await clearForeshadowing();
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
});

// ── Tests ─────────────────────────────────────────────────────────

test.describe("伏笔提取 — lastMentionedChapter 与 大纲未指定", () => {
  test("1. 提取结果展示 lastMentionedChapter", async ({ page }) => {
    // Mock extraction with lastMentionedChapter
    mockAiExtract(page, [
      {
        id: "fs-e2e-lmc-1",
        title: "玉佩的秘密",
        description: "祖传玉佩蕴含灵力波动",
        type: "物品伏笔",
        chapter: 3,
        lastMentionedChapter: 5,
        expectedPayoffChapter: 12,
        confidence: 0.85,
      },
      {
        id: "fs-e2e-lmc-2",
        title: "老者的嘱托",
        description: "客栈老者临终托付",
        type: "角色伏笔",
        chapter: 2,
        lastMentionedChapter: 4,
        expectedPayoffChapter: 15,
        confidence: 0.72,
      },
    ]);

    // Open AI extract
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Start extraction
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results
    await expect(page.getByText("玉佩的秘密")).toBeVisible({ timeout: 8_000 });

    // Verify lastMentionedChapter is displayed
    await expect(page.getByText("最近提及：第 5 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("最近提及：第 4 章")).toBeVisible({ timeout: 3_000 });

    // Apply selected
    await page.getByRole("button", { name: "应用选中" }).click();
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 5_000 });
  });

  test("2. expectedPayoffChapter 为 null 时显示「大纲未指定」", async ({ page }) => {
    mockAiExtract(page, [
      {
        id: "fs-e2e-null-1",
        title: "古井暗道",
        description: "村口枯井下藏有通道",
        type: "设定伏笔",
        chapter: 1,
        lastMentionedChapter: 3,
        expectedPayoffChapter: null,
        confidence: 0.65,
      },
      {
        id: "fs-e2e-null-2",
        title: "断剑残片",
        description: "祖传断剑需要修复",
        type: "物品伏笔",
        chapter: 4,
        lastMentionedChapter: 6,
        expectedPayoffChapter: null,
        confidence: 0.80,
      },
    ]);

    // Open AI extract
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Start extraction
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results
    await expect(page.getByText("古井暗道")).toBeVisible({ timeout: 8_000 });

    // "大纲未指定" should appear instead of empty expectedPayoffChapter
    await expect(page.getByText("预期回收：大纲未指定")).toBeVisible({ timeout: 3_000 });

    // lastMentionedChapter should still be visible
    await expect(page.getByText("最近提及：第 3 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("最近提及：第 6 章")).toBeVisible({ timeout: 3_000 });

    // Apply and verify in main list
    await page.getByRole("button", { name: "应用选中" }).click();
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("古井暗道")).toBeVisible({ timeout: 5_000 });
  });

  test("3. 既有 lastMentionedChapter 又有 expectedPayoffChapter 时正常显示", async ({ page }) => {
    mockAiExtract(page, [
      {
        id: "fs-e2e-both-1",
        title: "暗红信封",
        description: "封蜡上刻着家族徽章",
        type: "情节伏笔",
        chapter: 2,
        lastMentionedChapter: 4,
        expectedPayoffChapter: 10,
        confidence: 0.95,
      },
    ]);

    // Open AI extract
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });
    await page.getByRole("button", { name: "开始提取" }).click();

    await expect(page.getByText("暗红信封")).toBeVisible({ timeout: 8_000 });

    // Both fields should display
    await expect(page.getByText("最近提及：第 4 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("预期回收：第 10 章")).toBeVisible({ timeout: 3_000 });
    // "大纲未指定" should NOT appear
    await expect(page.getByText("大纲未指定")).not.toBeVisible({ timeout: 2_000 });
  });

  test("4. 已有伏笔列表中 expectedPayoffChapter=null 显示「大纲未指定」", async ({ page }) => {
    // Create a foreshadowing entry with null expectedPayoffChapter via API
    const createRes = await page.request.post("/api/foreshadowing", {
      data: {
        id: "fs-e2e-existing-null",
        bookId: E2E_FORES_BOOK_ID,
        title: "无名信件",
        description: "一封没有署名的神秘信件",
        type: "情节伏笔",
        status: "active",
        chapter: 3,
        lastMentionedChapter: 5,
        expectedPayoffChapter: null,
      },
    });
    expect(createRes.status()).toBe(200);

    await page.reload();
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });

    // The created entry should show "大纲未指定"
    await expect(page.getByText("无名信件")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("预期回收：大纲未指定")).toBeVisible({ timeout: 3_000 });
  });
});
